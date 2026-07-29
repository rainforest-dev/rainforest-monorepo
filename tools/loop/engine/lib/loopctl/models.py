from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TaskRef:
    id: str
    title: str
    branch: str | None = None
    claimed: bool = True
    source_state: str | None = None
    priority: str | int | None = None
    metadata: dict = field(default_factory=dict)
