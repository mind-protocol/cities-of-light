#!/usr/bin/env python3
"""
Physics Tick Runner — executes one tick cycle and outputs JSON.

Called by physics-bridge.js via child_process.spawn.
Reads FalkorDB connection config from environment variables.
Outputs a JSON summary to stdout for the bridge to parse.

DOCS: docs/narrative/physics/IMPLEMENTATION_Physics.md

Co-Authored-By: Tomaso Nervo (@nervo) <nervo@mindprotocol.ai>
"""

import json
import logging
import os
import sys
import time
from dataclasses import asdict
from pathlib import Path

# ── sys.path setup ────────────────────────────────────────
# The runtime package lives at .mind/runtime/ relative to repo root.
# Imports use `from runtime.physics...` so we need .mind/ on sys.path.
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MIND_DIR = REPO_ROOT / ".mind"
if str(MIND_DIR) not in sys.path:
    sys.path.insert(0, str(MIND_DIR))

# ── Logging ───────────────────────────────────────────────
# Log to stderr so stdout stays clean for JSON output.
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("run_tick")


def load_tick_number(state_path: Path) -> int:
    """Load the current tick number from a state file."""
    if state_path.exists():
        try:
            data = json.loads(state_path.read_text())
            return data.get("tick", 0)
        except (json.JSONDecodeError, OSError):
            pass
    return 0


def save_tick_number(state_path: Path, tick: int) -> None:
    """Save the current tick number to a state file."""
    try:
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps({"tick": tick}))
    except OSError as e:
        logger.warning(f"Could not save tick state: {e}")


def result_to_dict(result) -> dict:
    """Convert a TickResultV1_2 to a JSON-serializable dict."""
    try:
        return asdict(result)
    except Exception:
        # Fallback: manually extract known fields
        fields = [
            "energy_generated", "energy_drawn", "energy_flowed",
            "energy_interacted", "energy_backflowed", "energy_cooled",
            "actors_updated", "moments_active", "moments_possible",
            "moments_completed", "moments_rejected",
            "links_cooled", "links_crystallized",
            "completions", "rejections",
            "hot_links", "cold_links",
        ]
        d = {}
        for f in fields:
            d[f] = getattr(result, f, 0)
        # Legacy fields added by tick engine
        d["energy_total"] = getattr(result, "energy_total", 0.0)
        d["moments_decayed"] = getattr(result, "moments_decayed", 0)
        d["avg_pressure"] = getattr(result, "avg_pressure", 0.0)
        d["flips"] = getattr(result, "flips", [])
        return d


def detect_significant_tension_changes(result) -> list:
    """
    Detect citizens whose tension changed significantly during the tick.

    Tension signals come from:
    - Completions (moment resolved -> tension released)
    - High energy flow (actors receiving significant energy)
    - Rejections (energy returned to player)
    """
    changes = []

    # Completions release tension for involved actors
    for completion in (result.completions or []):
        changes.append({
            "moment_id": completion.get("moment_id"),
            "type": "completion",
            "energy": completion.get("energy", 0),
        })

    # Rejections create tension spikes
    for rejection in (result.rejections or []):
        changes.append({
            "moment_id": rejection.get("moment_id"),
            "type": "rejection",
            "energy_returned": rejection.get("energy_returned", 0),
        })

    return changes


def detect_narrative_events(result) -> list:
    """
    Detect emergent narrative events from tick results.

    Look for signals that something narratively significant happened:
    - Multiple completions in one tick (convergence)
    - High energy flow (narrative heating up)
    - New crystallized links (relationships forming)
    """
    events = []

    # Multiple completions = narrative convergence
    if result.moments_completed >= 2:
        events.append({
            "type": "convergence",
            "description": f"{result.moments_completed} moments completed simultaneously",
            "moments": [c.get("moment_id") for c in (result.completions or [])],
        })

    # Many new crystallized links = relationship formation
    if result.links_crystallized >= 3:
        events.append({
            "type": "relationship_formation",
            "description": f"{result.links_crystallized} new actor relationships crystallized",
            "count": result.links_crystallized,
        })

    # High total energy flow = narrative heating up
    total_energy = (
        result.energy_generated + result.energy_drawn +
        result.energy_flowed + result.energy_interacted +
        result.energy_backflowed
    )
    if total_energy > 10.0:
        events.append({
            "type": "energy_surge",
            "description": f"High energy flow: {total_energy:.2f} total",
            "total_energy": round(total_energy, 4),
        })

    return events


def run():
    """Execute one physics tick and print JSON to stdout."""
    # ── Read configuration from environment ───────────────
    host = os.environ.get("FALKORDB_HOST", "localhost")
    port = int(os.environ.get("FALKORDB_PORT", "6379"))
    graph_name = os.environ.get("FALKORDB_GRAPH", "cities_of_light")
    player_id = os.environ.get("TICK_PLAYER_ID", "player")
    elapsed_str = os.environ.get("TICK_ELAPSED_MINUTES", "")

    # Tick state file lives next to this script
    state_path = Path(__file__).parent / ".tick_state.json"

    logger.info(f"Connecting to FalkorDB {host}:{port} graph={graph_name}")

    try:
        # ── Import and create the tick engine ─────────────
        # Set env vars before importing so the database factory picks them up
        os.environ.setdefault("DATABASE_BACKEND", "falkordb")
        os.environ["FALKORDB_HOST"] = host
        os.environ["FALKORDB_PORT"] = str(port)
        os.environ["FALKORDB_GRAPH"] = graph_name

        from runtime.physics.tick_v1_2 import GraphTickV1_2

        engine = GraphTickV1_2(
            graph_name=graph_name,
            host=host,
            port=int(port),
        )

        # ── Load tick number ──────────────────────────────
        current_tick = load_tick_number(state_path)

        # ── Parse elapsed minutes ─────────────────────────
        elapsed_minutes = None
        if elapsed_str:
            try:
                elapsed_minutes = float(elapsed_str)
            except ValueError:
                pass

        # ── Run the tick ──────────────────────────────────
        start_time = time.time()

        result = engine.run(
            current_tick=current_tick,
            player_id=player_id,
            elapsed_minutes=elapsed_minutes,
        )

        elapsed_ms = (time.time() - start_time) * 1000

        # ── Detect events ─────────────────────────────────
        tension_changes = detect_significant_tension_changes(result)
        narrative_events = detect_narrative_events(result)
        moment_flips = result.completions or []

        # ── Build output ──────────────────────────────────
        output = {
            "success": True,
            "tick": current_tick,
            "elapsed_ms": round(elapsed_ms, 2),
            "result": result_to_dict(result),
            "events": {
                "moment_flips": moment_flips,
                "tension_changes": tension_changes,
                "narrative_events": narrative_events,
            },
            "summary": {
                "energy_generated": round(result.energy_generated, 4),
                "energy_total_flow": round(
                    result.energy_drawn + result.energy_flowed +
                    result.energy_interacted + result.energy_backflowed, 4
                ),
                "energy_cooled": round(result.energy_cooled, 4),
                "actors_updated": result.actors_updated,
                "moments_active": result.moments_active,
                "moments_completed": result.moments_completed,
                "moments_rejected": result.moments_rejected,
                "links_crystallized": result.links_crystallized,
                "hot_links": result.hot_links,
                "cold_links": result.cold_links,
            },
        }

        # ── Warn if tick exceeded 1 second ────────────────
        if elapsed_ms > 1000:
            logger.warning(f"TICK EXCEEDED 1s: {elapsed_ms:.0f}ms")
            output["warning"] = f"Tick took {elapsed_ms:.0f}ms (>1000ms threshold)"

        # ── Save tick number ──────────────────────────────
        save_tick_number(state_path, current_tick + 1)

        # ── Output JSON to stdout ─────────────────────────
        print(json.dumps(output))

    except Exception as e:
        logger.error(f"Tick failed: {e}", exc_info=True)
        error_output = {
            "success": False,
            "tick": load_tick_number(state_path),
            "error": str(e),
            "error_type": type(e).__name__,
        }
        print(json.dumps(error_output))
        sys.exit(1)


if __name__ == "__main__":
    run()
