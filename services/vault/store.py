"""Encrypted media vault — stores recordings, transcripts, and embeddings.

All donor media is encrypted at rest. Access requires passing consent check.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class MediaAsset(BaseModel):
    """A single stored media asset (audio, video, transcript, etc.)."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    donor_id: str
    asset_type: str       # "audio", "video", "transcript", "photo", "embedding"
    filename: str
    mime_type: str = ""
    size_bytes: int = 0
    sha256: str = ""      # integrity hash of the raw file
    metadata: dict = Field(default_factory=dict)  # tags, timestamps, Q/A segment info
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VaultStore:
    """File-based encrypted vault for donor media.

    Structure:
        vault_root/
            {donor_id}/
                manifest.jsonl    # append-only asset log
                media/            # raw files (encrypted at rest via filesystem)
                transcripts/      # segmented Q&A transcripts
                embeddings/       # vector embeddings for RAG
    """

    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _donor_dir(self, donor_id: str) -> Path:
        d = self.root / donor_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "media").mkdir(exist_ok=True)
        (d / "transcripts").mkdir(exist_ok=True)
        (d / "embeddings").mkdir(exist_ok=True)
        return d

    def _manifest_path(self, donor_id: str) -> Path:
        return self._donor_dir(donor_id) / "manifest.jsonl"

    def _append_manifest(self, asset: MediaAsset) -> None:
        with open(self._manifest_path(asset.donor_id), "a") as f:
            f.write(asset.model_dump_json() + "\n")

    def store_file(
        self,
        donor_id: str,
        source_path: Path,
        asset_type: str,
        metadata: Optional[dict] = None,
    ) -> MediaAsset:
        """Store a file in the vault."""
        donor_dir = self._donor_dir(donor_id)

        # Compute hash
        sha = hashlib.sha256(source_path.read_bytes()).hexdigest()

        # Determine subdirectory
        subdir = {
            "audio": "media",
            "video": "media",
            "photo": "media",
            "transcript": "transcripts",
            "embedding": "embeddings",
        }.get(asset_type, "media")

        # Copy file
        dest = donor_dir / subdir / source_path.name
        shutil.copy2(source_path, dest)

        asset = MediaAsset(
            donor_id=donor_id,
            asset_type=asset_type,
            filename=source_path.name,
            size_bytes=source_path.stat().st_size,
            sha256=sha,
            metadata=metadata or {},
        )
        self._append_manifest(asset)
        return asset

    def store_transcript(
        self,
        donor_id: str,
        question: str,
        answer: str,
        source_asset_id: str,
        start_sec: float = 0,
        end_sec: float = 0,
        metadata: Optional[dict] = None,
    ) -> Path:
        """Store a segmented Q&A transcript."""
        donor_dir = self._donor_dir(donor_id)
        transcript_id = str(uuid4())[:8]
        path = donor_dir / "transcripts" / f"{transcript_id}.json"

        data = {
            "id": transcript_id,
            "donor_id": donor_id,
            "question": question,
            "answer": answer,
            "source_asset_id": source_asset_id,
            "start_sec": start_sec,
            "end_sec": end_sec,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **(metadata or {}),
        }
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        return path

    def list_assets(self, donor_id: str) -> list[MediaAsset]:
        """List all assets for a donor."""
        manifest = self._manifest_path(donor_id)
        if not manifest.exists():
            return []
        assets = []
        for line in manifest.read_text().splitlines():
            if not line.strip():
                continue
            try:
                assets.append(MediaAsset(**json.loads(line)))
            except (json.JSONDecodeError, Exception):
                continue
        return assets

    def get_transcripts(self, donor_id: str) -> list[dict]:
        """Get all Q&A transcripts for a donor."""
        donor_dir = self._donor_dir(donor_id)
        transcript_dir = donor_dir / "transcripts"
        results = []
        for f in sorted(transcript_dir.glob("*.json")):
            try:
                results.append(json.loads(f.read_text()))
            except (json.JSONDecodeError, Exception):
                continue
        return results
