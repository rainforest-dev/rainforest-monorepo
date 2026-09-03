"""Probe for the audit suite: build a ledger from argv and summarise it.

A file rather than a heredoc inside the shell test, because the nesting needed to
inline it is what broke three earlier attempts -- and a quoting bug in a test is
indistinguishable from the failure it was meant to detect.
"""

import json
import os
import pathlib
import sys

usage = pathlib.Path(os.environ["AUDIT_VAULT"]) / "_system" / "usage"
usage.mkdir(parents=True, exist_ok=True)
rows = json.loads(sys.argv[1])
(usage / "loop-runs.m.jsonl").write_text("\n".join(json.dumps(r) for r in rows))

os.environ["LOOP_VAULT_PATH"] = os.environ["AUDIT_VAULT"]
from loopctl.audit import audit_task  # noqa: E402  (after the env is set)

print(json.dumps(audit_task("T-1", ["m"])))
