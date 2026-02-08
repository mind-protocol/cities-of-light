/**
 * VR Controls — locomotion, snap turn, grab.
 *
 * Left stick: move (forward/back/strafe)
 * Right stick: snap turn (30°)
 * Grip button: grab nearby objects
 */

import * as THREE from 'three';

export class VRControls {
  constructor(renderer, camera, scene) {
    this.renderer = renderer;
    this.camera = camera;

    // Player rig — moving this moves the whole playspace
    this.dolly = new THREE.Group();
    scene.add(this.dolly);
    this.dolly.add(camera);

    // Controllers with ray visualization
    this.controllers = [
      this._setupController(0, 0x00ff88),
      this._setupController(1, 0xff8800),
    ];

    // Grab state
    this.grabbed = null; // { object, controller, offset }
    this.grabbables = [];

    // Snap turn state
    this._snapReady = true;

    // Config
    this.moveSpeed = 3.0;     // m/s
    this.snapAngle = Math.PI / 6; // 30°
  }

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
    controller.addEventListener('squeezestart', () => this._onGripStart(controller));
    controller.addEventListener('squeezeend', () => this._onGripEnd(controller));

    return controller;
  }

  /** Register an object as grabbable */
  addGrabbable(obj) {
    this.grabbables.push(obj);
  }

  /** Check if a specific object is currently grabbed */
  isGrabbed(obj) {
    return this.grabbed?.object === obj;
  }

  /** Call every frame */
  update(delta) {
    if (!this.renderer.xr.isPresenting) return;

    const session = this.renderer.xr.getSession();
    if (!session) return;

    for (const source of session.inputSources) {
      if (!source.gamepad) continue;
      const { axes } = source.gamepad;

      // Quest: 2 axes (thumbstick only). Index/Vive: 4 axes (touchpad + stick)
      const off = axes.length >= 4 ? 2 : 0;
      const stickX = axes[off] || 0;
      const stickY = axes[off + 1] || 0;

      if (source.handedness === 'left') {
        this._locomotion(stickX, stickY, delta);
      } else if (source.handedness === 'right') {
        this._snapTurn(stickX);
      }
    }

    // Move grabbed object with controller
    if (this.grabbed) {
      const pos = new THREE.Vector3();
      this.grabbed.controller.getWorldPosition(pos);
      this.grabbed.object.position.copy(pos).add(this.grabbed.offset);
    }
  }

  _locomotion(stickX, stickY, delta) {
    if (Math.abs(stickX) < 0.15 && Math.abs(stickY) < 0.15) return;

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const right = new THREE.Vector3()
      .crossVectors(dir, new THREE.Vector3(0, 1, 0))
      .normalize();

    const speed = this.moveSpeed * delta;
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

  _onGripStart(controller) {
    if (this.grabbed) return;

    const cPos = new THREE.Vector3();
    controller.getWorldPosition(cPos);

    let closest = null;
    let closestDist = 2.0; // max grab distance in meters

    for (const obj of this.grabbables) {
      const d = cPos.distanceTo(obj.position);
      if (d < closestDist) {
        closestDist = d;
        closest = obj;
      }
    }

    if (closest) {
      this.grabbed = {
        object: closest,
        controller,
        offset: new THREE.Vector3().copy(closest.position).sub(cPos),
      };
    }
  }

  _onGripEnd(controller) {
    if (this.grabbed?.controller === controller) {
      this.grabbed = null;
    }
  }
}
