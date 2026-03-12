"""
Physics Dry Run — Run N ticks rapidly, collect stats, tune constants.

No 5-minute wait between ticks. Runs as fast as possible to validate
constants produce healthy dynamics at Venice scale (152 citizens).

Usage:
    cd /home/mind-protocol/cities-of-light
    python scripts/physics_dryrun.py --ticks 1000 --graph cities_of_light

Tuning targets:
    - Ticks to first flip: 30-100 (~2.5-8 hours world time)
    - Flip rate: 1-3 per hour (12 ticks)
    - No stasis (energy → 0) or runaway (energy → ∞)
    - Avg pressure in [0.4, 0.6] for 90% of ticks
"""

import argparse
import logging
import os
import sys
import time

logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s %(message)s"
)

# Add runtime to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '.mind'))


def main():
    parser = argparse.ArgumentParser(description="Physics Dry Run")
    parser.add_argument("--ticks", type=int, default=200, help="Number of ticks to run")
    parser.add_argument("--graph", default="cities_of_light", help="Graph name")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=6379)
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.INFO)

    from runtime.physics.tick_v1_2 import GraphTickV1_2

    print(f"Initializing tick engine for graph '{args.graph}'...")
    engine = GraphTickV1_2(graph_name=args.graph, host=args.host, port=args.port)

    # Stats collectors
    total_generated = 0.0
    total_decayed = 0.0
    total_routed = 0.0
    total_flips = 0
    first_flip_tick = None
    flip_ticks = []
    pressures = []
    decay_rates = []
    energy_per_tick = []

    print(f"\nRunning {args.ticks} ticks...\n")
    print(f"{'Tick':>5} {'Generated':>10} {'Decayed':>10} {'Routed':>10} {'Pressure':>10} {'Flips':>6} {'DecayRate':>10}")
    print("-" * 70)

    start_time = time.time()

    for tick in range(args.ticks):
        # Simulate day cycle: hour = (tick * 5 / 60) % 24
        hour = int((tick * 5 / 60) % 24)

        result = engine.run(current_tick=tick, time_of_day_hour=hour)

        total_generated += result.energy_generated
        total_decayed += result.energy_decayed
        total_routed += result.energy_routed
        energy_per_tick.append(result.energy_generated)
        pressures.append(result.avg_pressure)
        decay_rates.append(result.effective_decay_rate)

        if result.completions:
            total_flips += len(result.completions)
            if first_flip_tick is None:
                first_flip_tick = tick
            flip_ticks.append(tick)

        # Print every 10 ticks or on flip
        if tick % 10 == 0 or result.completions:
            flip_marker = f" ** FLIP: {[f.get('moment_id','?') for f in result.completions]}" if result.completions else ""
            print(f"{tick:5d} {result.energy_generated:10.4f} {result.energy_decayed:10.4f} "
                  f"{result.energy_routed:10.4f} {result.avg_pressure:10.4f} "
                  f"{len(result.completions):6d} {result.effective_decay_rate:10.4f}{flip_marker}")

    elapsed = time.time() - start_time

    # Summary
    print("\n" + "=" * 70)
    print("DRY RUN SUMMARY")
    print("=" * 70)
    print(f"  Ticks run:           {args.ticks}")
    print(f"  Wall time:           {elapsed:.1f}s ({elapsed/args.ticks*1000:.1f}ms/tick)")
    print(f"  Total generated:     {total_generated:.2f}")
    print(f"  Total decayed:       {total_decayed:.2f}")
    print(f"  Total routed:        {total_routed:.2f}")
    print(f"  Net energy balance:  {total_generated - total_decayed:.2f}")
    print()

    # Flip analysis
    print(f"  Total flips:         {total_flips}")
    if first_flip_tick is not None:
        print(f"  First flip at tick:  {first_flip_tick} ({first_flip_tick * 5 / 60:.1f} hours)")
    else:
        print(f"  First flip at tick:  NONE (no flips in {args.ticks} ticks)")

    if flip_ticks:
        intervals = [flip_ticks[i+1] - flip_ticks[i] for i in range(len(flip_ticks)-1)]
        if intervals:
            avg_interval = sum(intervals) / len(intervals)
            print(f"  Avg ticks between flips: {avg_interval:.1f} ({avg_interval * 5 / 60:.1f} hours)")
        flips_per_hour = total_flips / (args.ticks * 5 / 60)
        print(f"  Flips per hour:      {flips_per_hour:.2f} (target: 1-3)")

    # Pressure analysis
    if pressures:
        valid_pressures = [p for p in pressures if p > 0]
        if valid_pressures:
            avg_p = sum(valid_pressures) / len(valid_pressures)
            in_band = sum(1 for p in valid_pressures if 0.4 <= p <= 0.6) / len(valid_pressures) * 100
            print(f"\n  Avg pressure:        {avg_p:.4f} (target: 0.4-0.6)")
            print(f"  % in target band:    {in_band:.1f}% (target: >90%)")
            print(f"  Min pressure:        {min(valid_pressures):.4f}")
            print(f"  Max pressure:        {max(valid_pressures):.4f}")

    # Decay rate analysis
    if decay_rates:
        valid_rates = [r for r in decay_rates if r > 0]
        if valid_rates:
            print(f"\n  Avg decay rate:      {sum(valid_rates)/len(valid_rates):.4f}")
            print(f"  Min decay rate:      {min(valid_rates):.4f}")
            print(f"  Max decay rate:      {max(valid_rates):.4f}")

    # Health verdict
    print("\n" + "-" * 70)
    issues = []

    if first_flip_tick is None:
        issues.append("NO FLIPS — world is dead. Lower DEFAULT_BREAKING_POINT or increase GENERATION_RATE")
    elif first_flip_tick > 200:
        issues.append(f"First flip too late (tick {first_flip_tick}). Lower thresholds.")
    elif first_flip_tick < 5:
        issues.append(f"First flip too early (tick {first_flip_tick}). Raise thresholds.")

    if total_generated > 0 and total_decayed / total_generated > 0.95:
        issues.append("Decay consuming >95% of generated energy. Lower DECAY_RATE.")
    if total_generated > 0 and total_decayed / total_generated < 0.3:
        issues.append("Decay consuming <30% of generated energy. May lead to energy runaway.")

    if valid_pressures and avg_p > 0.8:
        issues.append(f"Avg pressure {avg_p:.2f} too high. Increase DECAY_RATE or DEFAULT_BREAKING_POINT.")
    elif valid_pressures and avg_p < 0.1:
        issues.append(f"Avg pressure {avg_p:.2f} too low. Decrease DECAY_RATE or thresholds.")

    if issues:
        print("ISSUES:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("HEALTHY — all metrics within target ranges")

    print()


if __name__ == "__main__":
    main()
