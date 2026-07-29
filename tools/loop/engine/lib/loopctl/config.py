from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

_STOP_AT_BY_POLICY = {"greenlit-only": "pr-ready", "autonomous": "done", "read-only": "none"}
POLICIES = frozenset(_STOP_AT_BY_POLICY)
SOURCES = frozenset({"github", "notion", "obsidian-base", "vault"})


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
        stop_at = entry.get("stop_at") or _STOP_AT_BY_POLICY.get(policy, "pr-ready")
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
