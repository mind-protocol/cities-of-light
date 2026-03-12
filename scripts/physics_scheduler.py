"""
Physics Scheduler — Run Venice physics tick every 5 minutes.

Standalone process that ticks the graph continuously.
Tracks tick count, calculates time-of-day, logs results.

Usage:
    cd /home/mind-protocol/cities-of-light
    python scripts/physics_scheduler.py --graph cities_of_light

    # As background process:
    nohup python scripts/physics_scheduler.py > logs/physics.log 2>&1 &

    # With systemd (see docs/infra/deployment/)
"""

import argparse
import logging
import os
import sys
import time
import signal
import json
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Add runtime to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '.mind'))

# Graceful shutdown
_running = True

def _signal_handler(sig, frame):
    global _running
    logger.info("Received shutdown signal, finishing current tick...")
    _running = False

signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


def main():
    parser = argparse.ArgumentParser(description="Venice Physics Scheduler")
    parser.add_argument("--graph", default="cities_of_light", help="Graph name")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=6379)
    parser.add_argument("--interval", type=int, default=300, help="Tick interval in seconds (default: 300 = 5 min)")
    parser.add_argument("--venice-time-offset", type=int, default=0,
                        help="Hours to add to UTC to get Venice time (default: 0 = use UTC)")
    args = parser.parse_args()

    from runtime.physics.tick_v1_2 import GraphTickV1_2

    logger.info(f"Starting Venice Physics Scheduler")
    logger.info(f"  Graph: {args.graph}")
    logger.info(f"  Tick interval: {args.interval}s")
    logger.info(f"  Venice time offset: UTC+{args.venice_time_offset}")

    engine = GraphTickV1_2(graph_name=args.graph, host=args.host, port=args.port)

    tick_count = 0
    tick_log_path = os.path.join(
        os.path.dirname(__file__), '..', 'shrine', 'state', 'tick_history.jsonl'
    )
    os.makedirs(os.path.dirname(tick_log_path), exist_ok=True)

    while _running:
        tick_start = time.time()

        # Calculate Venice time-of-day
        now = datetime.utcnow()
        venice_hour = (now.hour + args.venice_time_offset) % 24

        logger.info(f"[Tick {tick_count}] Venice hour: {venice_hour}")

        try:
            result = engine.run(current_tick=tick_count, time_of_day_hour=venice_hour)

            # Log tick result
            tick_duration = time.time() - tick_start
            tick_log = {
                "tick": tick_count,
                "timestamp": now.isoformat(),
                "venice_hour": venice_hour,
                "duration_ms": round(tick_duration * 1000, 1),
                "energy_generated": round(result.energy_generated, 4),
                "energy_decayed": round(result.energy_decayed, 4),
                "energy_routed": round(result.energy_routed, 4),
                "avg_pressure": round(result.avg_pressure, 4),
                "effective_decay_rate": round(result.effective_decay_rate, 4),
                "moments_active": result.moments_active,
                "moments_possible": result.moments_possible,
                "flips": len(result.completions),
                "hot_links": result.hot_links,
                "characters_updated": result.actors_updated,
            }

            # Log to file
            with open(tick_log_path, 'a') as f:
                f.write(json.dumps(tick_log) + '\n')

            # Console summary
            flip_info = ""
            if result.completions:
                flip_ids = [f.get('moment_id', '?') for f in result.completions]
                flip_info = f" FLIPS: {flip_ids}"

            logger.info(
                f"[Tick {tick_count}] "
                f"gen={result.energy_generated:.2f} "
                f"dec={result.energy_decayed:.2f} "
                f"route={result.energy_routed:.2f} "
                f"pressure={result.avg_pressure:.3f} "
                f"chars={result.actors_updated} "
                f"({tick_duration*1000:.0f}ms)"
                f"{flip_info}"
            )

        except Exception as e:
            logger.error(f"[Tick {tick_count}] Error: {e}")

        tick_count += 1

        # Sleep until next tick
        elapsed = time.time() - tick_start
        sleep_time = max(0, args.interval - elapsed)
        if sleep_time > 0 and _running:
            logger.debug(f"Sleeping {sleep_time:.1f}s until next tick")
            # Sleep in small increments to respond to shutdown signal
            sleep_end = time.time() + sleep_time
            while time.time() < sleep_end and _running:
                time.sleep(min(1.0, sleep_end - time.time()))

    logger.info(f"Scheduler stopped after {tick_count} ticks")


if __name__ == "__main__":
    main()
