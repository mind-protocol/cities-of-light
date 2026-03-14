#!/usr/bin/env bash
set -euo pipefail

MANIFEST_PATH="${1:-worlds/venezia/world-manifest.json}"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Missing manifest: $MANIFEST_PATH" >&2
  exit 1
fi

CITIES_SERVER_MODE=engine WORLD_MANIFEST="$MANIFEST_PATH" node src/server/canonical_server_entrypoint_router.js
