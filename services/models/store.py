"""Generic JSONL store — DRYs the consent/store.py pattern."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class JSONLStore:
    """Append-only JSONL store with in-memory latest-state cache."""

    def __init__(self, path: Path, model_cls: Type[T]):
        self.path = path
        self.model_cls = model_cls
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._items: dict[str, T] = {}
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        for line in self.path.read_text().splitlines():
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                item = self.model_cls(**data)
                self._items[item.id] = item  # type: ignore[attr-defined]
            except (json.JSONDecodeError, Exception):
                continue

    def _append(self, item: T) -> None:
        with open(self.path, "a") as f:
            f.write(item.model_dump_json() + "\n")

    def create(self, item: T) -> T:
        self._items[item.id] = item  # type: ignore[attr-defined]
        self._append(item)
        return item

    def get(self, item_id: str) -> Optional[T]:
        return self._items.get(item_id)

    def list_all(self) -> list[T]:
        return list(self._items.values())

    def update(self, item: T) -> T:
        if hasattr(item, "updated_at"):
            item.updated_at = datetime.now(timezone.utc)  # type: ignore[attr-defined]
        self._items[item.id] = item  # type: ignore[attr-defined]
        self._append(item)
        return item
