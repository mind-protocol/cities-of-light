/**
 * Memorial — a donor's memorial structure with video screen.
 *
 * Stone plinth + name label + floating video screen + glow ring.
 * Videos play when the visitor approaches (3m proximity).
 */

import * as THREE from 'three';

const isQuest = /OculusBrowser|Quest/.test(navigator.userAgent);

export class Memorial {
  constructor(donor, videoAssets, scene) {
    this.donor = donor;
    this.videoAssets = videoAssets; // [{filename, metadata}]
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = `memorial-${donor.id}`;

    this.videoElement = null;
    this.videoTexture = null;
    this.screenMesh = null;
    this.currentVideoIndex = 0;
    this.isNearby = false;
    this.isPlaying = false;
    this._xrReady = false;

    this._build();
  }

  _build() {
    // Stone plinth (base)
    const plinthGeo = new THREE.CylinderGeometry(0.8, 1.0, 0.4, 16);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x8a8378,
      roughness: 0.9,
      metalness: 0.1,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.2;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // Name label (sprite)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.donor.name, 256, 64);
    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
    const label = new THREE.Sprite(labelMat);
    label.scale.set(2, 0.5, 1);
    label.position.y = 2.8;
    this.group.add(label);

    // Video screen frame
    const frameGeo = new THREE.BoxGeometry(2.2, 1.35, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.3,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 1.8;
    frame.rotation.x = -0.15; // Slight tilt toward viewer
    this.group.add(frame);

    // Video screen surface (will get VideoTexture when playing)
    const screenGeo = new THREE.PlaneGeometry(2.0, 1.125);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x111122,
    });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.y = 1.8;
    this.screenMesh.position.z = 0.03;
    this.screenMesh.rotation.x = -0.15;
    this.group.add(this.screenMesh);

    // Glow ring
    const ringGeo = new THREE.TorusGeometry(1.2, 0.03, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
    });
    this.glowRing = new THREE.Mesh(ringGeo, ringMat);
    this.glowRing.position.y = 0.05;
    this.glowRing.rotation.x = Math.PI / 2;
    this.group.add(this.glowRing);

    // Soft point light
    const light = new THREE.PointLight(0x00ff88, 0.4, 5);
    light.position.y = 1.5;
    this.group.add(light);
  }

  /** Set up video playback (call after XR session established). */
  _initVideo() {
    if (this.videoElement || this.videoAssets.length === 0) return;

    this.videoElement = document.createElement('video');
    this.videoElement.crossOrigin = 'anonymous';
    this.videoElement.playsInline = true;
    this.videoElement.loop = true;
    this.videoElement.muted = true; // Must be muted for autoplay
    this.videoElement.preload = 'metadata';

    this.videoTexture = new THREE.VideoTexture(this.videoElement);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this._xrReady = true;
  }

  _loadCurrentVideo() {
    if (!this.videoElement || this.videoAssets.length === 0) return;
    const asset = this.videoAssets[this.currentVideoIndex];
    const url = `/vault-media/${this.donor.id}/media/${encodeURIComponent(asset.filename)}`;
    this.videoElement.src = url;
  }

  /** Called when player enters proximity. */
  onApproach() {
    if (this.isNearby) return;
    this.isNearby = true;

    if (!this._xrReady) this._initVideo();
    if (!this.videoElement) return;

    this._loadCurrentVideo();
    this.screenMesh.material = new THREE.MeshBasicMaterial({ map: this.videoTexture });
    this.videoElement.play().catch(() => {});
    this.isPlaying = true;
  }

  /** Called when player leaves proximity. */
  onDepart() {
    if (!this.isNearby) return;
    this.isNearby = false;

    if (this.videoElement && this.isPlaying) {
      this.videoElement.pause();
      this.isPlaying = false;
    }
    // Restore dark screen
    this.screenMesh.material = new THREE.MeshBasicMaterial({ color: 0x111122 });
  }

  /** Cycle to next video. */
  nextVideo() {
    if (this.videoAssets.length <= 1) return;
    this.currentVideoIndex = (this.currentVideoIndex + 1) % this.videoAssets.length;
    this._loadCurrentVideo();
    if (this.isPlaying) {
      this.videoElement.play().catch(() => {});
    }
  }

  /** Get the 3D position for spatial audio playback. */
  getAudioPosition() {
    const worldPos = new THREE.Vector3();
    this.group.getWorldPosition(worldPos);
    worldPos.y += 1.8; // Screen height
    return worldPos;
  }

  /** Per-frame update. */
  update(elapsed, playerPosition) {
    // Proximity check
    const memPos = new THREE.Vector3();
    this.group.getWorldPosition(memPos);
    const dist = playerPosition.distanceTo(memPos);
    const proximityThreshold = isQuest ? 5 : 3;

    if (dist < proximityThreshold && !this.isNearby) {
      this.onApproach();
    } else if (dist >= proximityThreshold + 1 && this.isNearby) {
      this.onDepart();
    }

    // Glow ring animation
    if (this.glowRing) {
      this.glowRing.material.opacity = 0.15 + Math.sin(elapsed * 1.5) * 0.15;
      this.glowRing.rotation.z = elapsed * 0.3;
    }

    // Force VideoTexture update per frame (Quest workaround)
    if (this.videoTexture && this.isPlaying) {
      this.videoTexture.needsUpdate = true;
    }
  }
}
