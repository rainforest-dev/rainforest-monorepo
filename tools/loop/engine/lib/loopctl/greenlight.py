"""Apply an owner greenlight request to this machine's allowlist.

The allowlist is only ever written here. The Observatory host emits requests;
this machine decides whether to apply them. Requests cross a personal->company
boundary, so every field is validated before it reaches the file.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from loopctl import registry

SUPPORTED_VERSION = 1

# Mirrors SAFE_ID in the Observatory's src/lib/greenlightOutbox.ts. That side is
# the producer; this side is the trust boundary, so this one must never be the
# looser of the two.
#
# \A and \Z rather than ^ and $: Python's `$` also matches immediately before a
# trailing newline, so `^[A-Za-z]{0,8}-?\d{1,20}$` accepted "130\n" while the
# JS producer's identical-looking /^...$/ rejected it. The stricter check was on
# the producer and the looser one on the boundary -- backwards.
#
# The digit run is up to 20 because a personal task id is a timestamp --
# `T-20260720151941`, fourteen digits -- and the old `\d{1,9}` could not
# represent one at all.
SAFE_ID = re.compile(r"\A[A-Za-z]{0,8}-?\d{1,20}\Z")

# One definition of "an allowlist bullet", shared with scan.py's
# `_greenlight_rank`, which imports `is_bullet` from here. The dependency only
# runs this way -- greenlight.py imports nothing from scan.py -- so it cannot
# cycle.
#
# The quantifier is `\s*`, not `\s+`, and that single character is the point:
# the allowlist header invites hand editing, and a hand-typed `-290` must mean
# the same thing to the producer (this module, deciding `duplicate`) and to the
# consumer (scan.py, deciding what ralph may run unsupervised). They previously
# disagreed by exactly this character, so `-290` made Air answer `duplicate`
# while ralph never saw the task at all.
_BULLET = re.compile(r"^\s*[-*]\s*")

# A bullet and the id it names. The id is matched in the same shape SAFE_ID
# accepts, and it is taken as written: `- AG-290` names `AG-290` and nothing
# else.
_BULLET_ID = re.compile(r"^\s*[-*]\s*([A-Za-z]{0,8}-?\d{1,20})(?=\s|—|$)")


# An HTML comment, however many lines it spans. The allowlist template ships a
# worked example inside one -- `<!-- e.g.\n- 106 ...\n- 31 ...\n-->` -- directly
# under `## Cleared`, and a line-at-a-time scanner cannot see the fence around
# it. Measured 2026-08-25: a file whose Cleared section read `_(none yet)_`
# authorised both ids, and `-->` itself parsed as a bullet.
_COMMENT = re.compile(r"<!--.*?-->", re.S)

# The section a bullet must live under to authorise anything. Free text elsewhere
# in the file is prose, not permission: `## How to use` documents the format with
# lines that are themselves valid-looking bullets, and even a YAML frontmatter
# `---` matches `_BULLET`.
_CLEARED = re.compile(r"^##\s+Cleared\s*$", re.M)
_HEADING = re.compile(r"^##\s+", re.M)


def cleared_section(text: str) -> str:
    """The `## Cleared` body with comments removed, or "" when there is none.

    Producer and consumer must narrow the file the same way, for the same reason
    they must agree on what a bullet is: a rule applied on one side only is a
    rule that two readers disagree about.
    """
    stripped = _COMMENT.sub("", text or "")
    start = _CLEARED.search(stripped)
    if not start:
        # No `## Cleared` heading: an older, hand-written allowlist that is all
        # bullets under a single `#` title. Narrowing those to nothing would
        # silently revoke every authorisation they carry -- measured on
        # rainforest-monorepo.md, which has one live entry and no `##` at all.
        # Comments are still stripped; only the section narrowing is skipped.
        return stripped
    rest = stripped[start.end():]
    end = _HEADING.search(rest)
    return rest[: end.start()] if end else rest


def is_bullet(line: str) -> bool:
    """True when `line` is an allowlist bullet. See `_BULLET`."""
    return _BULLET.match(line) is not None


def bullet_id(line: str) -> str | None:
    """The id an allowlist bullet names, exactly as written, or None."""
    match = _BULLET_ID.match(line)
    return match.group(1) if match else None


def is_bullet_for(task_id: object, line: str) -> bool:
    """True when `line` is an allowlist bullet naming exactly `task_id`.

    Compared as strings. Ids used to be canonicalised here -- a leading alpha
    prefix stripped -- because one Notion sync emitted both `290` and `AG-290`
    for the same task. That migration is done: every id is now `AG-<n>`, so the
    only thing prefix-stripping still bought was collapsing `EHT-290` and
    `AG-290` onto one key, letting two genuinely different tasks satisfy each
    other's authorisation. `EHT-` is a real legacy prefix here, so that is a
    live hazard, not a hypothetical one.
    """
    text = str(task_id)
    if not text:
        return False
    return bullet_id(line) == text


def _one_line(value: object) -> str:
    """Collapse everything Python considers a line break into single spaces.

    The consumer, `_greenlight_rank`, iterates lines with `str.splitlines()`,
    which breaks on more than CR/LF: U+2028, U+2029, \\v, \\f, \\x1c-\\x1e,
    \\x85. Stripping only CR/LF would let a crafted `name` resurrect as a real
    bulleted line downstream and forge a greenlight for an arbitrary id. Using
    `splitlines()` here is deliberate: the producer and the consumer then share
    one definition of "a line", so no character can be a break for one and not
    the other -- including any Python may add later.
    """
    return " ".join(str(value if value is not None else "").splitlines()).strip()


def _line_for(request: dict) -> str:
    """Render the allowlist entry.

    `_greenlight_rank` (in scan.py) scans every *bulleted* line
    (`^\\s*[-*]\\s+`) for a bare `<item_id>` match anywhere in it. Free text
    on that line is therefore unsafe by construction: any digit in `name` --
    another task's id, a fraction like "1/2" -- would be read as a greenlight
    for that digit. There is no way to sanitize `name` for this without
    mangling human titles, so instead the bullet line carries only the task
    id, and all free text lives on a continuation line prefixed with `↳`.
    That prefix is applied unconditionally, even when `name` is empty: a
    continuation line is never itself a bulleted line, so `_greenlight_rank`
    never inspects it and no digit in `name` can ever be seen. Without the
    unconditional `↳`, a `name` starting with `-` or `*` would turn the
    continuation into a second bulleted line and reopen the hole.

    The bullet carries the id exactly as the request spelled it; the source ref
    is repeated on the continuation line, where the owner can read it back to
    the sprint board and no scanner will ever see it.
    """
    source = _one_line(request.get("sourceId") or request.get("id"))
    return "- {}\n  ↳ {} · {} · repo: {}".format(
        request["id"],
        source,
        _one_line(request.get("name")),
        request["slug"],
    )


def _already_listed(task_id: str, text: str) -> bool:
    """Same narrowing as the reader. `_greenlight_rank` only honours bullets in
    `## Cleared`, so a bullet anywhere else -- the commented example, the format
    documented under `## How to use` -- must not count as already-listed here
    either, or `apply_request` reports `duplicate` for an id the loop will never
    actually see."""
    return any(
        is_bullet_for(task_id, line)
        for line in cleared_section(text).splitlines()
    )


def _fail(reason: str) -> dict:
    return {"result": "failed", "reason": reason, "line": None}


def validate(request: object, slug: str) -> str | None:
    """Return a failure reason, or None when the request is acceptable.

    Both `id` and the optional `sourceId` must pass SAFE_ID, and they must be
    the same string -- otherwise a request could put one id in the bullet and
    label it with another on the continuation line the owner actually reads.
    """
    if not isinstance(request, dict):
        return "request is not a JSON object"
    if request.get("version") != SUPPORTED_VERSION:
        return f"unsupported request version: {request.get('version')!r}"
    task_id = str(request.get("id", ""))
    if not SAFE_ID.match(task_id):
        return f"unsafe task id: {task_id!r}"
    source_id = request.get("sourceId")
    if source_id is not None:
        if not SAFE_ID.match(str(source_id)):
            return f"unsafe source id: {source_id!r}"
        if str(source_id) != task_id:
            return f"source id {source_id!r} is not the same task as id {task_id!r}"
    if request.get("slug") != slug:
        return f"slug mismatch: request says {request.get('slug')!r}, applying to {slug!r}"
    return None


def _is_continuation(line: str) -> bool:
    """True for an indented, non-blank line -- a bullet's `↳` detail line.

    Blank lines are excluded deliberately: they separate entries and belong to
    no bullet, so treating one as a continuation would swallow the separator and
    glue two entries together.
    """
    return bool(line[:1].isspace()) and bool(line.strip())


def retire(task_id: object, greenlight_path: Path, *, dry_run: bool = False) -> dict:
    """Withdraw one task's authorisation from the allowlist.

    A greenlight authorises one task. Once the loop has carried that task to its
    terminal state there is nothing left to authorise -- and leaving the bullet
    behind is not merely untidy: `_IN_FLIGHT` includes `pr-ready`, and
    `state_order` ranks it *above* `not-started`, so a finished task stays the
    highest-ranked candidate. The next sweep picks up work that is already done,
    and on an executor fallback opens a second PR for the same fix.

    Removes the bullet together with the continuation lines that describe it.
    Dropping the bullet alone would leave an orphan `↳` line, which reads as
    part of whichever entry follows it.
    """
    text = str(task_id)
    if not text:
        return {"result": "skipped", "reason": "empty task id", "removed": 0}
    try:
        current = greenlight_path.read_text()
    except OSError:
        return {"result": "absent", "reason": "no allowlist file", "removed": 0}

    kept: list[str] = []
    dropping = False
    removed = 0
    for line in current.split("\n"):
        if is_bullet(line):
            dropping = is_bullet_for(text, line)
            if dropping:
                removed += 1
                continue
        elif dropping and _is_continuation(line):
            continue
        else:
            dropping = False
        kept.append(line)

    if not removed:
        return {"result": "absent", "reason": "not listed", "removed": 0}
    if not dry_run:
        body = re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).rstrip()
        registry.atomic_write(greenlight_path, body + "\n")
    return {"result": "retired", "reason": None, "removed": removed}


def apply_request(
    request: dict,
    greenlight_path: Path,
    *,
    expected_slug: str,
    dry_run: bool = False,
) -> dict:
    """Insert the request's line under '## Cleared'. Idempotent.

    `expected_slug` comes from the caller (the enrolled project being applied
    to), never from the request itself -- otherwise the slug check would be the
    request agreeing with itself and a request could be applied to the wrong
    project's allowlist.
    """
    reason = validate(request, expected_slug)
    if reason:
        return _fail(reason)

    task_id = str(request["id"])
    line = _line_for(request)
    try:
        current = greenlight_path.read_text()
    except OSError:
        current = ""

    if _already_listed(task_id, current):
        return {"result": "duplicate", "reason": None, "line": line}

    lines = current.split("\n") if current else [
        f"# {request['slug']} greenlight",
        "",
        "## Cleared",
        "",
    ]
    cleared = next(
        (i for i, text in enumerate(lines) if re.match(r"^##\s+Cleared\s*$", text.strip())),
        -1,
    )
    if cleared == -1:
        # Above the existing bullets, never appended below them.
        #
        # `cleared_section` treats a file with no `## Cleared` as all-bullets --
        # deliberately, so a hand-written allowlist keeps working. Adding the
        # heading at the end therefore moved every one of those bullets OUTSIDE
        # the section that authorises them: the first apply on such a file
        # returned success while silently revoking everything already cleared.
        # Reproduced on a copy of rainforest-monorepo.md, which today has one
        # live entry and no `##` at all, so the next apply would have done it.
        first_entry = next(
            (
                i
                for i, text in enumerate(lines)
                if is_bullet(text) or _is_continuation(text)
            ),
            -1,
        )
        at = len(lines) if first_entry == -1 else first_entry
        lines[at:at] = ["## Cleared", ""]
        cleared = at
    placeholder = next(
        (i for i, text in enumerate(lines) if i > cleared and re.match(r"^\s*_\(none\)", text, re.I)),
        -1,
    )
    if placeholder != -1:
        del lines[placeholder]
    lines.insert(cleared + 1, line)

    if not dry_run:
        body = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).rstrip()
        # Atomic, because `loopctl next` reads this file through
        # `_greenlight_text` with no ProjectLock. A truncate-then-write left a
        # window in which that reader could see a partial file, and a torn read
        # can expose a prefix of a longer id as a complete bullet (`- AG-290`
        # read as `- AG-29`), which is a valid authorisation for another task.
        registry.atomic_write(greenlight_path, body + "\n")
    return {"result": "applied", "reason": None, "line": line}


def apply_request_file(
    path: Path,
    greenlight_path: Path,
    *,
    expected_slug: str,
    dry_run: bool = False,
) -> dict:
    try:
        request = json.loads(Path(path).read_text())
    except (OSError, ValueError) as exc:
        return _fail(f"unreadable request: {exc}")
    return apply_request(
        request, greenlight_path, expected_slug=expected_slug, dry_run=dry_run
    )
