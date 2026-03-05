/**
 * VR Controls — locomotion, snap turn, grab (controllers + hands).
 *
 * Controllers:
 *   Left stick: move | Right stick: snap turn 30°
 *   Grip button: grab nearby objects
 *
 * Hands:
 *   Pinch (index + thumb): grab nearby objects
 *   Locomotion via controllers only (hands = grab only)
 */

import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

export class VRControls {
  constructor(renderer, camera, scene) {
    this.renderer = renderer;
    this.camera = camera;

    // ─── Player rig (dolly) ─────────────────────────────
    this.dolly = new THREE.Group();
    scene.add(this.dolly);
    this.dolly.add(camera);

    // ─── Controllers ────────────────────────────────────
    this.controllers = [
      this._setupController(0, 0x00ff88),
      this._setupController(1, 0xff8800),
    ];

    // ─── Hands ──────────────────────────────────────────
    const handFactory = new XRHandModelFactory();
    this.hands = [
      this._setupHand(0, handFactory),
      this._setupHand(1, handFactory),
    ];
    this._wasPinching = [false, false];

    // ─── Grab state ─────────────────────────────────────
    this.grabbed = null; // { object, source, offset }
    this.grabbables = [];

    // ─── Snap turn ──────────────────────────────────────
    this._snapReady = true;

    // ─── Push-to-talk (A button, right controller) ──────
    this._pttActive = false;
    this.onPushToTalkStart = null;
    this.onPushToTalkEnd = null;

    // ─── Config ─────────────────────────────────────────
    this.moveSpeed = 3.0;       // m/s
    this.snapAngle = Math.PI / 6; // 30°
    this.grabRange = 1.5;       // meters
    this.pinchThreshold = 0.03; // 3cm between fingertips
  }

  // ─── Setup ──────────────────────────────────────────────

  _setupController(index, color) {
    const controller = this.renderer.xr.getController(index);
    this.dolly.add(controller);

    // Pointer ray
    const ray = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3),
      ]),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })
    );
    controller.add(ray);

    // Grip events
    controller.addEventListener('squeezestart', () => this._tryGrab(controller));
    controller.addEventListener('squeezeend', () => this._release(controller));

    return controller;
  }

  _setupHand(index, factory) {
    const hand = this.renderer.xr.getHand(index);
    hand.add(factory.createHandModel(hand, 'spheres'));
    this.dolly.add(hand);
    return hand;
  }

  // ─── Public API ─────────────────────────────────────────

  addGrabbable(obj) {
    this.grabbables.push(obj);
  }

  isGrabbed(obj) {
    return this.grabbed?.object === obj;
  }

  // ─── Frame update ───────────────────────────────────────

  update(delta) {
    if (!this.renderer.xr.isPresenting) return;

    const session = this.renderer.xr.getSession();
    if (!session) return;

    // Controller thumbstick input
    for (const source of session.inputSources) {
      if (!source.gamepad) continue;
      const { axes } = source.gamepad;

      // Quest 2/3 typically: 4 axes where [0],[1]=touchpad(0), [2],[3]=thumbstick
      // Some builds: 2 axes where [0],[1]=thumbstick
      // Fallback: if primary axes are dead, try secondary
      let off = axes.length >= 4 ? 2 : 0;
      let stickX = axes[off] || 0;
      let stickY = axes[off + 1] || 0;
      if (axes.length >= 4 && Math.abs(stickX) < 0.01 && Math.abs(stickY) < 0.01) {
        stickX = axes[0] || 0;
        stickY = axes[1] || 0;
      }

      if (source.handedness === 'left') {
        this._locomotion(stickX, stickY, delta);
      } else if (source.handedness === 'right') {
        this._snapTurn(stickX);

        // A button (buttons[4]) — push-to-talk
        const aButton = source.gamepad.buttons[4];
        if (aButton?.pressed && !this._pttActive) {
          this._pttActive = true;
          if (this.onPushToTalkStart) this.onPushToTalkStart();
        } else if (!aButton?.pressed && this._pttActive) {
          this._pttActive = false;
          if (this.onPushToTalkEnd) this.onPushToTalkEnd();
        }
      }
    }

    // Hand pinch detection
    for (let i = 0; i < 2; i++) {
      const pinching = this._isPinching(this.hands[i]);

      if (pinching && !this._wasPinching[i]) {
        // Pinch start
        const pos = this._pinchPoint(this.hands[i]);
        if (pos) this._tryGrab(this.hands[i], pos);
      } else if (!pinching && this._wasPinching[i]) {
        // Pinch end
        this._release(this.hands[i]);
      }
      this._wasPinching[i] = pinching;
    }

    // Update grabbed object — position AND rotation follow hand/controller
    if (this.grabbed) {
      const pos = this._getSourcePosition(this.grabbed.source);
      if (pos) {
        this.grabbed.object.position.copy(pos).add(this.grabbed.offset);
      }
      // Rotation follows controller/hand orientation
      const quat = new THREE.Quaternion();
      if (this.grabbed.source.joints) {
        // Hand: use wrist orientation
        const wrist = this.grabbed.source.joints['wrist'];
        if (wrist) wrist.getWorldQuaternion(quat);
      } else {
        // Controller: use controller orientation
        this.grabbed.source.getWorldQuaternion(quat);
      }
      this.grabbed.object.quaternion.copy(quat);
    }
  }

  // ─── Locomotion ─────────────────────────────────────────

  _locomotion(stickX, stickY, delta) {
    if (Math.abs(stickX) < 0.15 && Math.abs(stickY) < 0.15) return;

    // Force matrix update so direction reflects current headset + dolly orientation
    this.dolly.updateMatrixWorld(true);

    // Get forward direction from headset world quaternion (more reliable than getWorldDirection on ArrayCamera)
    const worldQuat = new THREE.Quaternion();
    this.camera.getWorldQuaternion(worldQuat);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
    dir.y = 0;
    dir.normalize();

    // Right = perpendicular to forward on XZ plane (rotated 90° clockwise)
    const right = new THREE.Vector3(-dir.z, 0, dir.x);

    const speed = this.moveSpeed * delta;
    // stickY: negative = push forward (WebXR convention), so negate for forward movement
    this.dolly.position.addScaledVector(dir, -stickY * speed);
    this.dolly.position.addScaledVector(right, stickX * speed);
  }

  _snapTurn(stickX) {
    if (Math.abs(stickX) > 0.6 && this._snapReady) {
      this.dolly.rotation.y += stickX > 0 ? -this.snapAngle : this.snapAngle;
      this._snapReady = false;
    }
    if (Math.abs(stickX) < 0.3) {
      this._snapReady = true;
    }
  }

  // ─── Hand detection ─────────────────────────────────────

  _isPinching(hand) {
    const indexTip = hand.joints?.['index-finger-tip'];
    const thumbTip = hand.joints?.['thumb-tip'];
    if (!indexTip || !thumbTip) return false;

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    indexTip.getWorldPosition(a);
    thumbTip.getWorldPosition(b);

    return a.distanceTo(b) < this.pinchThreshold;
  }

  _pinchPoint(hand) {
    const indexTip = hand.joints?.['index-finger-tip'];
    const thumbTip = hand.joints?.['thumb-tip'];
    if (!indexTip || !thumbTip) return null;

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    indexTip.getWorldPosition(a);
    thumbTip.getWorldPosition(b);

    return a.add(b).multiplyScalar(0.5); // midpoint
  }

  // ─── Hand data export (for network sync) ────────────────

  /** XR Hand joint names in order */
  static JOINT_NAMES = [
    'wrist',
    'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
    'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
    'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
    'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
    'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
  ];

  /**
   * Export current hand/controller data for network transmission.
   * Returns { left, right } where each is either:
   *   { mode: 'hand', joints: [[x,y,z], ...] }   — 25 joints from finger tracking
   *   { mode: 'controller', position: {x,y,z}, rotation: {x,y,z,w} } — controller
   *   null — not active
   */
  getHandsData() {
    if (!this.renderer.xr.isPresenting) return null;

    const result = { left: null, right: null };
    const _pos = new THREE.Vector3();
    const _quat = new THREE.Quaternion();

    // Check hand tracking first (preferred)
    for (let i = 0; i < 2; i++) {
      const hand = this.hands[i];
      const side = i === 0 ? 'left' : 'right';

      if (hand.joints && Object.keys(hand.joints).length > 0) {
        const joints = [];
        let hasData = false;
        for (const name of VRControls.JOINT_NAMES) {
          const joint = hand.joints[name];
          if (joint) {
            joint.getWorldPosition(_pos);
            joints.push([
              Math.round(_pos.x * 1000) / 1000,
              Math.round(_pos.y * 1000) / 1000,
              Math.round(_pos.z * 1000) / 1000,
            ]);
            hasData = true;
          } else {
            joints.push(null);
          }
        }
        if (hasData) {
          result[side] = { mode: 'hand', joints };
          continue;
        }
      }

      // Fallback: controller data
      const controller = this.controllers[i];
      if (controller) {
        controller.getWorldPosition(_pos);
        controller.getWorldQuaternion(_quat);
        // Only send if position is non-zero (controller active)
        if (_pos.lengthSq() > 0.001) {
          result[side] = {
            mode: 'controller',
            position: {
              x: Math.round(_pos.x * 1000) / 1000,
              y: Math.round(_pos.y * 1000) / 1000,
              z: Math.round(_pos.z * 1000) / 1000,
            },
            rotation: {
              x: Math.round(_quat.x * 1000) / 1000,
              y: Math.round(_quat.y * 1000) / 1000,
              z: Math.round(_quat.z * 1000) / 1000,
              w: Math.round(_quat.w * 1000) / 1000,
            },
          };
        }
      }
    }

    return (result.left || result.right) ? result : null;
  }

  // ─── Grab system ────────────────────────────────────────

  _getSourcePosition(source) {
    // Hand: use pinch point between fingers
    if (source.joints) {
      return this._pinchPoint(source);
    }
    // Controller: use world position
    const pos = new THREE.Vector3();
    source.getWorldPosition(pos);
    return pos;
  }

  _tryGrab(source, worldPos) {
    if (this.grabbed) return;

    const pos = worldPos || this._getSourcePosition(source);
    if (!pos) return;

    let closest = null;
    let closestDist = this.grabRange;

    for (const obj of this.grabbables) {
      const d = pos.distanceTo(obj.position);
      if (d < closestDist) {
        closestDist = d;
        closest = obj;
      }
    }

    if (closest) {
      this.grabbed = {
        object: closest,
        source,
        offset: new THREE.Vector3().copy(closest.position).sub(pos),
      };
    }
  }

  _release(source) {
    if (this.grabbed?.source === source) {
      this.grabbed = null;
    }
  }
}
