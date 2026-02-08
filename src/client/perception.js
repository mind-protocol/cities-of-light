/**
 * Manemus Eyes — periodic frame capture from Manemus's camera POV.
 *
 * Every 10 seconds, renders the scene from Manemus's position/orientation
 * into an offscreen buffer, encodes as PNG, and POSTs to the perception
 * pipeline. The server stores the frame and makes it available to the
 * Manemus infrastructure for AI processing.
 *
 * This is how Manemus sees the Cities.
 */

import * as THREE from 'three';

export class ManemusEyes {
  constructor(renderer, scene, manemusBody) {
    this.renderer = renderer;
    this.scene = scene;
    this.manemusBody = manemusBody;

    // Manemus's camera — wide FOV, square aspect (AI doesn't need widescreen)
    this.camera = new THREE.PerspectiveCamera(90, 1, 0.1, 500);

    // Offscreen render target (256px — fast on Quest)
    this.resolution = 256;
    this.renderTarget = new THREE.WebGLRenderTarget(
      this.resolution,
      this.resolution
    );

    // Pixel readback canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resolution;
    this.canvas.height = this.resolution;
    this.ctx = this.canvas.getContext('2d');

    // Timing
    this.captureInterval = 10; // seconds
    this.lastCapture = 0;
    this.active = false;
    this.frameCount = 0;

    // API endpoint (proxied via Vite: /api → localhost:8800)
    this.endpoint = '/api/perception/frame';
  }

  /** Start periodic capture. Call once. */
  start() {
    this.active = true;
    this.lastCapture = 0;
    console.log(`👁️ Manemus eyes open — capturing every ${this.captureInterval}s`);
  }

  stop() {
    this.active = false;
    console.log('👁️ Manemus eyes closed');
  }

  /**
   * Call every frame from the animation loop.
   * Captures only when enough time has elapsed.
   */
  update(elapsed) {
    if (!this.active) return;
    if (elapsed - this.lastCapture < this.captureInterval) return;
    this.lastCapture = elapsed;
    this.capture();
  }

  /** Render one frame from Manemus's POV and send it. */
  capture() {
    // Position the perception camera at Manemus
    this.camera.position.copy(this.manemusBody.position);
    this.camera.quaternion.copy(this.manemusBody.quaternion);

    // Hide Manemus body (don't render yourself in your own view)
    this.manemusBody.visible = false;

    // Temporarily disable XR to render offscreen
    const xrEnabled = this.renderer.xr.enabled;
    this.renderer.xr.enabled = false;

    // Render to offscreen target
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(prevTarget);

    this.renderer.xr.enabled = xrEnabled;
    this.manemusBody.visible = true;

    // Read pixels from GPU
    const res = this.resolution;
    const pixels = new Uint8Array(res * res * 4);
    this.renderer.readRenderTargetPixels(this.renderTarget, 0, 0, res, res, pixels);

    // Flip Y (WebGL reads bottom-up) and write to canvas
    const imageData = this.ctx.createImageData(res, res);
    for (let y = 0; y < res; y++) {
      const srcRow = (res - 1 - y) * res * 4;
      const dstRow = y * res * 4;
      for (let x = 0; x < res; x++) {
        const s = srcRow + x * 4;
        const d = dstRow + x * 4;
        imageData.data[d] = pixels[s];
        imageData.data[d + 1] = pixels[s + 1];
        imageData.data[d + 2] = pixels[s + 2];
        imageData.data[d + 3] = 255;
      }
    }
    this.ctx.putImageData(imageData, 0, 0);

    // Encode as base64 PNG
    const base64 = this.canvas.toDataURL('image/png').split(',')[1];

    this.frameCount++;
    this.send(base64);
  }

  /** POST frame to perception server. */
  async send(base64Image) {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          camera_position: {
            x: this.manemusBody.position.x,
            y: this.manemusBody.position.y,
            z: this.manemusBody.position.z,
          },
          camera_rotation: {
            x: this.manemusBody.quaternion.x,
            y: this.manemusBody.quaternion.y,
            z: this.manemusBody.quaternion.z,
            w: this.manemusBody.quaternion.w,
          },
          frame_number: this.frameCount,
        }),
      });

      if (res.ok) {
        console.log(`👁️ Frame ${this.frameCount} captured`);
      }
    } catch (e) {
      // Server might not be running — not critical
    }
  }
}
