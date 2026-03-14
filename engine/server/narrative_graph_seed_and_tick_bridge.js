/**
 * NarrativeGraphSeedAndTickBridge
 *
 * Seeds and ticks narrative physics in a fail-loud, observable way.
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

export class NarrativeGraphSeedAndTickBridge {
  constructor({ manifest, basePath, broadcast }) {
    this.manifest = manifest;
    this.basePath = basePath;
    this.broadcast = broadcast;
    this.interval = null;
    this.tickCount = 0;
  }

  validateOrThrow() {
    if (!this.manifest.physics || this.manifest.physics.engine === 'none') return;

    if (!this.manifest.physics.engine) {
      throw new Error('physics.engine is required when physics is enabled');
    }

    if (!this.manifest.physics.tick_interval_ms) {
      throw new Error('physics.tick_interval_ms is required when physics is enabled');
    }

    if (this.manifest.physics.seed_script) {
      const seedPath = resolve(this.basePath, this.manifest.physics.seed_script);
      if (!existsSync(seedPath)) {
        throw new Error(`physics.seed_script missing: ${seedPath}`);
      }
    }
  }

  async seed() {
    if (!this.manifest.physics || this.manifest.physics.engine === 'none') return;

    if (this.manifest.physics.seed_script) {
      const seedPath = resolve(this.basePath, this.manifest.physics.seed_script);
      console.log(`Physics seed ready: ${seedPath}`);
    }
  }

  start() {
    if (!this.manifest.physics || this.manifest.physics.engine === 'none') return;
    if (this.interval) return;

    const tickMs = this.manifest.physics.tick_interval_ms;
    this.interval = setInterval(() => {
      this.tickCount += 1;
      const evt = {
        type: 'physics_tick',
        engine: this.manifest.physics.engine,
        tick: this.tickCount,
        ts: Date.now(),
      };
      this.broadcast(evt);
    }, tickMs);
  }

  stop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }
}
