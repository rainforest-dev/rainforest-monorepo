"""loopctl — deterministic loop state engine."""

__version__ = "0.2.0"

PIPELINE_STATES = [
    "not-started",
    "queued",
    "in-progress",
    "pr-ready",
    "in-qa",
    "released",
    "blocked",
]

AGENT_STATES = [
    "needs-tuning",
    "spec-drafted",
    "split-drafted",
]

LIFECYCLE_STATES = [
    "onboarding",
    "active",
    "maintenance",
    "dormant",
    "archived",
]
