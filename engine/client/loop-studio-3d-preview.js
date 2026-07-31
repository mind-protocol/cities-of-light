import * as THREE from 'three';
import { HEALTH_STATES } from './loop-studio-core.js';
import { compileNodeVisualPlan } from './loop-physicalization-plan.js';

const STATE_COLORS = Object.freeze({
  healthy: 0x75d6a0,
  degraded: 0xf0b86a,
  stale: 0xa895d6,
  unknown: 0x9ba6b8,
  not_measured: 0x6f7b8d,
  measurement_failed: 0xef7f87,
});

function numberProperty(element, name, fallback) {
  const value = Number.parseFloat(element.style.getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

function inferSubtype(element) {
  const label = element.querySelector('.node-kicker span')?.textContent?.trim() ?? '';
  return label.split(/\s+/).at(-1) || 'physicalization_toolkit';
}

function inferEpistemic(element) {
  return element.querySelector('.node-footer .node-chip:nth-child(2)')?.textContent?.trim() || 'unknown';
}

function selectedNodeFromDom(previewHealth = null) {
  const element = document.querySelector('.loop-node.selected');
  if (!element) return null;

  return {
    id: element.dataset.nodeId,
    subtype: inferSubtype(element),
    health: previewHealth ?? element.dataset.health ?? 'not_measured',
    epistemic: inferEpistemic(element),
    position: {
      x: Number.parseFloat(element.style.left) || 0,
      y: Number.parseFloat(element.style.top) || 0,
      source: element.querySelector('.node-origin')?.textContent?.trim() || 'Built',
    },
    visual: {
      scale: numberProperty(element, '--node-scale', 1),
      roundness: numberProperty(element, '--node-roundness', 18),
      shell: numberProperty(element, '--node-shell', 1),
      emission: numberProperty(element, '--node-emission', 0),
      pulse: numberProperty(element, '--node-pulse', 0),
      opacity: numberProperty(element, '--node-opacity', 1),
    },
  };
}

function createMaterial(plan, { wireframe = false, opacityFactor = 1 } = {}) {
  const color = new THREE.Color(STATE_COLORS[plan.health]);
  color.offsetHSL(0, (plan.material.saturation - 1) * 0.25, 0);
  const emission = Math.min(1, plan.material.aestheticEmission * 0.45 + plan.material.signalEmission);

  return new THREE.MeshStandardMaterial({
    color,
    roughness: plan.health === 'stale' ? 0.92 : 0.48,
    metalness: plan.role === 'implementation' || plan.role === 'code' ? 0.56 : 0.2,
    emissive: color,
    emissiveIntensity: emission,
    transparent: plan.material.opacity * opacityFactor < 0.999,
    opacity: plan.material.opacity * opacityFactor,
    wireframe: wireframe || plan.material.shellMode === 'wire',
  });
}

function mesh(geometry, material, position = null) {
  const object = new THREE.Mesh(geometry, material);
  if (position) object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function addIdentityGeometry(group, plan, material) {
  const secondary = createMaterial(plan, { wireframe: plan.material.shellMode === 'wire', opacityFactor: 0.62 });

  switch (plan.identity.geometry) {
    case 'target':
      group.add(mesh(new THREE.TorusGeometry(0.92, 0.12, 16, 64), material));
      group.add(mesh(new THREE.SphereGeometry(0.28, 24, 16), secondary));
      break;
    case 'frame': {
      const core = mesh(new THREE.BoxGeometry(1.45, 1.05, 0.72), material);
      group.add(core);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(core.geometry),
        new THREE.LineBasicMaterial({ color: STATE_COLORS[plan.health], transparent: true, opacity: 0.86 }),
      );
      group.add(edges);
      break;
    }
    case 'stack':
      for (let index = 0; index < 4; index += 1) {
        const slab = mesh(new THREE.BoxGeometry(1.25 - index * 0.12, 0.18, 0.82), index % 2 ? secondary : material);
        slab.position.y = (index - 1.5) * 0.34;
        slab.rotation.y = index * 0.12;
        group.add(slab);
      }
      break;
    case 'gate':
      group.add(mesh(new THREE.TorusGeometry(0.72, 0.17, 16, 48), material));
      group.add(mesh(new THREE.BoxGeometry(0.22, 1.72, 0.34), secondary, [-0.94, 0, 0]));
      group.add(mesh(new THREE.BoxGeometry(0.22, 1.72, 0.34), secondary, [0.94, 0, 0]));
      break;
    case 'sequencer':
      group.add(mesh(new THREE.CylinderGeometry(0.44, 0.58, 1.7, 24), material));
      for (let index = -1; index <= 1; index += 1) {
        const ring = mesh(new THREE.TorusGeometry(0.64, 0.055, 10, 40), secondary);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = index * 0.5;
        group.add(ring);
      }
      break;
    case 'icosahedron':
      group.add(mesh(new THREE.IcosahedronGeometry(0.96, 1), material));
      group.add(mesh(new THREE.IcosahedronGeometry(1.12, 1), secondary));
      break;
    case 'machine':
      group.add(mesh(new THREE.BoxGeometry(1.45, 1.15, 1), material));
      group.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.7, 20), secondary));
      break;
    case 'support':
      group.add(mesh(new THREE.ConeGeometry(0.86, 1.62, 4), material));
      group.add(mesh(new THREE.BoxGeometry(1.45, 0.18, 1.45), secondary, [0, -0.88, 0]));
      break;
    case 'test-rig': {
      const ring = mesh(new THREE.TorusGeometry(0.78, 0.11, 14, 48), material);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      for (let index = -1; index <= 1; index += 1) {
        const probe = mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), secondary);
        probe.position.x = index * 0.48;
        group.add(probe);
      }
      break;
    }
    case 'probe': {
      const lens = mesh(new THREE.SphereGeometry(0.62, 28, 20), material);
      lens.scale.z = 0.42;
      group.add(lens);
      const body = mesh(new THREE.ConeGeometry(0.34, 1.35, 20), secondary, [0, -0.94, 0]);
      group.add(body);
      break;
    }
    case 'instrument-array':
      group.add(mesh(new THREE.CylinderGeometry(0.76, 0.88, 0.2, 28), secondary, [0, -0.76, 0]));
      for (let index = 0; index < 5; index += 1) {
        const height = 0.5 + index * 0.2;
        const bar = mesh(new THREE.BoxGeometry(0.17, height, 0.25), material);
        bar.position.set((index - 2) * 0.3, -0.65 + height / 2, 0);
        group.add(bar);
      }
      break;
    case 'sphere':
      group.add(mesh(new THREE.SphereGeometry(0.82, 32, 24), material));
      group.add(mesh(new THREE.TorusGeometry(1.02, 0.055, 12, 56), secondary));
      break;
    case 'octahedron':
      group.add(mesh(new THREE.OctahedronGeometry(0.96, 0), material));
      group.add(mesh(new THREE.TorusGeometry(0.82, 0.06, 12, 48), secondary));
      break;
    case 'dodecahedron':
      group.add(mesh(new THREE.DodecahedronGeometry(0.98, 0), material));
      group.add(mesh(new THREE.DodecahedronGeometry(1.14, 0), secondary));
      break;
    default:
      group.add(mesh(new THREE.SphereGeometry(0.82, 24, 18), material));
  }
}

function addStateGeometry(group, plan) {
  const color = new THREE.Color(STATE_COLORS[plan.health]);
  const accent = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: plan.health === 'measurement_failed' ? 0.75 : 0.2,
    transparent: true,
    opacity: 0.82,
    roughness: 0.45,
  });

  if (plan.structure.additions.includes('stress-band')) {
    const ring = mesh(new THREE.TorusGeometry(1.12, 0.055, 10, 48), accent);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }
  if (plan.structure.additions.includes('age-ring')) {
    const ring = mesh(new THREE.TorusGeometry(1.08, 0.035, 10, 48), accent);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.62;
    group.add(ring);
  }
  if (plan.structure.additions.includes('unresolved-shell')) {
    const shellMaterial = createMaterial(plan, { wireframe: true, opacityFactor: 0.7 });
    group.add(mesh(new THREE.SphereGeometry(1.28, 18, 12), shellMaterial));
  }
  if (plan.structure.additions.includes('empty-socket')) {
    const socket = mesh(new THREE.TorusGeometry(0.42, 0.08, 12, 38), accent);
    socket.rotation.x = Math.PI / 2;
    socket.position.y = -1.02;
    group.add(socket);
  }
  if (plan.structure.additions.includes('fracture')) {
    const fractureA = mesh(new THREE.BoxGeometry(0.055, 2.25, 0.07), accent);
    fractureA.rotation.z = 0.64;
    fractureA.position.z = 0.95;
    group.add(fractureA);
    const fractureB = fractureA.clone();
    fractureB.rotation.z = -0.42;
    fractureB.scale.y = 0.65;
    group.add(fractureB);
  }
  if (plan.structure.additions.includes('failure-marker')) {
    const marker = mesh(new THREE.ConeGeometry(0.2, 0.56, 12), accent, [0.96, 0.98, 0]);
    marker.rotation.z = Math.PI;
    group.add(marker);
  }
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

class LoopPhysicalizationPreview extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.previewHealth = null;
    this.plan = null;
    this.object = null;
    this.frame = null;
    this.elapsed = 0;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; border:1px solid rgba(219,226,240,.14); border-radius:12px; overflow:hidden; background:rgba(5,8,13,.66); }
        .top { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 9px; border-bottom:1px solid rgba(219,226,240,.12); }
        .name { font:600 10px/1.2 ui-sans-serif,system-ui; color:#eff2f8; }
        .state { color:#8d96aa; font:9px ui-monospace,monospace; }
        canvas { display:block; width:100%; height:220px; cursor:grab; }
        .states { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; padding:7px; border-top:1px solid rgba(219,226,240,.12); }
        button { border:1px solid rgba(219,226,240,.14); border-radius:6px; background:rgba(255,255,255,.04); color:#9da6b7; padding:5px 3px; font:8px ui-sans-serif,system-ui; cursor:pointer; }
        button.active { color:#f2d790; border-color:rgba(214,179,95,.52); background:rgba(214,179,95,.1); }
        .manifest { display:grid; grid-template-columns:1fr auto; gap:4px 8px; padding:8px 9px; color:#8d96aa; font:9px/1.4 ui-monospace,monospace; border-top:1px solid rgba(219,226,240,.12); }
        .manifest strong { color:#d7dce6; font-weight:500; text-align:right; }
      </style>
      <div class="top"><span class="name">PhysicalizationPlan</span><span class="state">no selection</span></div>
      <canvas aria-label="Aperçu 3D de la physicalisation"></canvas>
      <div class="states"></div>
      <div class="manifest"></div>`;

    this.canvas = this.shadowRoot.querySelector('canvas');
    this.stateLabel = this.shadowRoot.querySelector('.state');
    this.stateControls = this.shadowRoot.querySelector('.states');
    this.manifest = this.shadowRoot.querySelector('.manifest');
    this.stateControls.innerHTML = HEALTH_STATES.map((state) => `<button type="button" data-state="${state}">${state.replaceAll('_', ' ')}</button>`).join('');
    this.stateControls.addEventListener('click', (event) => {
      const state = event.target.closest('[data-state]')?.dataset.state;
      if (!state) return;
      this.previewHealth = state;
      this.sync();
    });

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0.25, 4.6);
    this.scene.add(new THREE.HemisphereLight(0xbfd7ff, 0x14100c, 1.4));
    const key = new THREE.DirectionalLight(0xffe0ad, 3.2);
    key.position.set(3, 4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7ca7ff, 1.8);
    rim.position.set(-4, 1, -3);
    this.scene.add(rim);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this);
    this.domObserver = new MutationObserver(() => this.sync());
    const nodeLayer = document.querySelector('#node-layer');
    if (nodeLayer) this.domObserver.observe(nodeLayer, { attributes: true, childList: true, subtree: true });

    this.sync();
    this.animate();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.domObserver?.disconnect();
    if (this.object) disposeObject(this.object);
    this.renderer?.dispose();
  }

  resize() {
    const width = Math.max(1, this.clientWidth);
    const height = 220;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  sync() {
    const node = selectedNodeFromDom(this.previewHealth);
    if (!node) return;
    this.plan = compileNodeVisualPlan(node, { previewHealth: node.health });
    this.materialize();
    this.stateLabel.textContent = `${this.plan.role} · ${this.plan.health}`;
    this.stateControls.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('active', button.dataset.state === this.plan.health);
    });
    this.manifest.innerHTML = `
      <span>archetype</span><strong>${this.plan.identity.archetypeId}</strong>
      <span>shell</span><strong>${this.plan.material.shellMode}</strong>
      <span>energy</span><strong>${this.plan.protectedChannels.energy.epistemic}</strong>
      <span>signal emission</span><strong>${this.plan.material.signalEmission.toFixed(2)}</strong>
      <span>draw calls</span><strong>${this.plan.estimatedDrawCalls}</strong>`;
  }

  materialize() {
    if (this.object) {
      this.scene.remove(this.object);
      disposeObject(this.object);
    }

    const group = new THREE.Group();
    const material = createMaterial(this.plan);
    addIdentityGeometry(group, this.plan, material);
    addStateGeometry(group, this.plan);
    group.scale.setScalar(this.plan.transform.scale * (0.86 + this.plan.structure.integrity * 0.14));
    group.rotation.z = this.plan.transform.tilt;

    if (this.plan.health === 'measurement_failed') {
      for (const child of group.children) {
        if (child.isMesh && child.position.x === 0) child.position.x += child.id % 2 ? 0.11 : -0.11;
      }
    }

    this.object = group;
    this.scene.add(group);
  }

  animate() {
    this.frame = requestAnimationFrame(() => this.animate());
    if (!this.object || !this.plan) return;
    this.elapsed += 0.016;
    const motion = this.plan.dynamics.motionFactor;
    this.object.rotation.y += 0.004 * (0.4 + motion + this.plan.dynamics.effectivePulse * 0.25);
    if (this.plan.health === 'degraded') {
      this.object.rotation.z = this.plan.transform.tilt + Math.sin(this.elapsed * 3.2) * 0.035;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

customElements.define('loop-physicalization-preview', LoopPhysicalizationPreview);

function installPreview() {
  const visualSection = [...document.querySelectorAll('.inspector-section')]
    .find((section) => section.querySelector('h2')?.textContent === 'VisualDefinition');
  if (!visualSection || document.querySelector('loop-physicalization-preview')) return;

  const section = document.createElement('section');
  section.className = 'inspector-section';
  section.dataset.panelMode = 'design';
  section.innerHTML = `
    <div class="section-heading">
      <h2>Physicalization</h2>
      <span class="small-label">compiled preview</span>
    </div>
    <loop-physicalization-preview></loop-physicalization-preview>`;
  visualSection.insertAdjacentElement('afterend', section);
}

installPreview();
