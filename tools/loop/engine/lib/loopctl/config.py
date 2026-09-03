from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

_STOP_AT_BY_POLICY = {"greenlit-only": "pr-ready", "autonomous": "done", "read-only": "none"}
POLICIES = frozenset(_STOP_AT_BY_POLICY)
SOURCES = frozenset({"github", "notion", "obsidian-base", "vault"})

# Where a project's loop stops: a pipeline state the task can actually reach, or
# one of the two terminals that are not states -- `done` for autonomous work that
# ends without a PR, `none` for read-only projects that never execute.
#
# Validated because the greenlight retirement compares this to a task's state by
# string equality, so a value no task can ever hold means the authorisation is
# never withdrawn and the finished task stays the top candidate. `policy` and
# `source` above were already checked; this one was not, and on 2026-09-02
# rainforest-monorepo carried `stop_at: pr` -- a plausible-looking typo for
# `pr-ready`. Nothing complained. Two tasks finished, kept their greenlight, and
# the next sweep was about to redo a task that already had a PR open, at roughly
# $10 a run.
_EXTRA_STOP_AT = frozenset({"done", "none"})


def _valid_stop_at() -> frozenset[str]:
    """Legal `stop_at` values, resolved lazily.

    PIPELINE_STATES/AGENT_STATES live in the package __init__; importing them at
    module scope here would close an import cycle, so this reads them on use.
    """
    from loopctl import AGENT_STATES, PIPELINE_STATES

    return frozenset(PIPELINE_STATES) | frozenset(AGENT_STATES) | _EXTRA_STOP_AT


@dataclass
class Project:
    slug: str
    path: Path
    source: str
    source_config: dict = field(default_factory=dict)
    policy: str = "greenlit-only"
    stop_at: str = ""
    machines: list[str] = field(default_factory=list)
    greenlight: str | None = None
    account: str | None = None


@dataclass
class Config:
    defaults: dict
    projects: list[Project]


def load_config(path: Path) -> Config:
    config_path = Path(path)
    raw = yaml.safe_load(config_path.read_text()) or {}
    defaults = raw.get("defaults", {}) or {}
    projects = []
    for entry in raw.get("projects", []) or []:
        policy = entry.get("policy", defaults.get("policy", "greenlit-only"))
        if policy not in POLICIES:
            raise ValueError(f"unsupported loop policy: {policy}")
        source = entry["source"]
        if source not in SOURCES:
            raise ValueError(f"unsupported loop source: {source}")
        # `greenlit-only` with nothing to read is not a strict configuration --
        # it is an inert one. `_greenlight_text` returns "" for a project with no
        # `greenlight:` key, every task then ranks None, and `next` reports zero
        # candidates: indistinguishable from "the owner has cleared nothing yet".
        # obsidian-vault has been in that state on the mini since enrolment.
        # Raised for the same reason as stop_at above: a policy that cannot ever
        # admit a task should fail where it is written, not go quiet where it is
        # read.
        if policy == "greenlit-only" and not (
            entry.get("greenlight") or defaults.get("greenlight")
        ):
            raise ValueError(
                f"project {entry.get('slug')!r} is greenlit-only but names no "
                "greenlight file; it can never have a candidate"
            )
        stop_at = entry.get("stop_at") or _STOP_AT_BY_POLICY.get(policy, "pr-ready")
        if stop_at not in _valid_stop_at():
            raise ValueError(
                f"unsupported loop stop_at: {stop_at} "
                f"(expected one of {', '.join(sorted(_valid_stop_at()))})"
            )
        projects.append(
            Project(
                slug=entry["slug"],
                path=Path(entry["path"]).expanduser(),
                source=source,
                machines=entry.get("machines", []),
                policy=policy,
                stop_at=stop_at,
                source_config=entry.get("source_config", {}) or {},
                greenlight=entry.get("greenlight"),
                account=entry.get("account"),
            )
        )
    return Config(defaults=defaults, projects=projects)


def config_path() -> Path:
    from loopctl.registry import loop_home

    return loop_home() / "config.yaml"


def find_project(config: Config, slug: str) -> Project | None:
    return next((project for project in config.projects if project.slug == slug), None)


def find_project_for_path(config: Config, path: Path) -> Project | None:
    target = Path(path).expanduser().resolve()
    matches = []
    for project in config.projects:
        try:
            target.relative_to(project.path.resolve())
        except ValueError:
            continue
        matches.append(project)
    return max(matches, key=lambda project: len(project.path.parts), default=None)
