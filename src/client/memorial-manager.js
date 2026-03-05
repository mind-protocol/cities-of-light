/**
 * MemorialManager — fetches donors, builds memorials, manages proximity.
 *
 * Bridges the Python services (donor/vault) with the Three.js scene.
 */

import * as THREE from 'three';
import { Memorial } from './memorial.js';
import { ZONES } from '../shared/zones.js';

export class MemorialManager {
  constructor(scene) {
    this.scene = scene;
    this.memorials = []; // Memorial[]
    this._playerPos = new THREE.Vector3();
  }

  /** Fetch donors + assets from FastAPI (via Express proxy), build memorials. */
  async init() {
    try {
      const donorsResp = await fetch('/services/donors');
      if (!donorsResp.ok) {
        console.warn('MemorialManager: services unavailable, skipping');
        return;
      }
      const donors = await donorsResp.json();

      for (const donor of donors) {
        // Fetch vault assets
        let assets = [];
        try {
          const assetsResp = await fetch(`/services/vault/${donor.id}/assets`);
          if (assetsResp.ok) {
            assets = await assetsResp.json();
          }
        } catch (e) {
          console.warn(`Failed to fetch assets for ${donor.id}:`, e);
        }

        // Filter to video assets only
        const videoAssets = assets.filter(a =>
          a.asset_type === 'video' || a.filename.match(/\.(mp4|webm|mov)$/i)
        );

        if (videoAssets.length === 0) {
          console.log(`No video assets for ${donor.name}, skipping memorial`);
          continue;
        }

        // Create memorial
        const memorial = new Memorial(donor, videoAssets, this.scene);

        // Place on zone — first donor on zone 0, offset from center
        const zoneIndex = this.memorials.length % ZONES.length;
        const zone = ZONES[zoneIndex];
        memorial.group.position.set(zone.position.x + 5, 0, zone.position.z - 5);
        // Face toward zone center
        memorial.group.lookAt(zone.position.x, 0, zone.position.z);

        this.scene.add(memorial.group);
        this.memorials.push(memorial);
        console.log(`Memorial: ${donor.name} (${videoAssets.length} videos) on ${zone.name}`);
      }
    } catch (e) {
      console.warn('MemorialManager init failed (services offline?):', e);
    }
  }

  /** Get the memorial the player is currently near, if any. */
  getNearestActiveMemorial() {
    for (const m of this.memorials) {
      if (m.isNearby) return m;
    }
    return null;
  }

  /** Per-frame update (call from main render loop). */
  update(elapsed, playerPosition) {
    this._playerPos.copy(playerPosition);
    for (const m of this.memorials) {
      m.update(elapsed, this._playerPos);
    }
  }
}
