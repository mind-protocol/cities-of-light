import {
  EPISTEMIC_STATES,
  HEALTH_STATES,
  LIFECYCLE_STATES,
  REQUIRED_RELATIONS,
  REQUIRED_ROLE_SUBTYPES,
  applyMaintenance,
  applyScenario,
  createInitialLoop,
  executeProof,
  serializeLoop,
  validateStructure,
} from './loop-studio-core.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let loop = createInitialLoop();
let mode = 'define';
let zoom = 1;
let drag = null;
let toastTimer = null;

const nodeLayer = $('#node-layer');
const relationLayer = $('#relation-layer');
const canvasWorld = $('#canvas-world');
const canvasViewport = $('#canvas-viewport');

function selectedNode() {
  return loop.nodes.find((node) => node.id === loop.selectedNodeId) || loop.nodes[0];
}

function statusLabel(status) {
  return status.replaceAll('_', ' ');
}

function toContentText(content) {
  return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
}

function parseContentText(text, original) {
  if (typeof original === 'string') return text;
  try {
    return JSON.parse(text);
  } catch {
    return { description: text };
  }
}

function roleIcon(subtype) {
  const icons = {
    physicalization_toolkit: '◈', objective: '◎', pattern: '⌘', vocabulary: '≡',
    behavior: '→', algorithm: '⋮', code: '</>', implementation: '▣',
    justification: '∵', validation: '✓', observability_algorithm: '◉',
    metric: '∿', health: '✦', maintenance: '◇',
  };
  return icons[subtype] || '•';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 2400);
}

function setMode(nextMode) {
  mode = nextMode;
  document.body.dataset.mode = mode;
  $$('.mode-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
}

function createNodeElement(node) {
  const element = document.createElement('article');
  element.className = 'loop-node';
  element.dataset.nodeId = node.id;
  element.dataset.health = node.health;
  element.style.left = `${node.position.x}px`;
  element.style.top = `${node.position.y}px`;
  element.style.setProperty('--node-scale', node.visual.scale);
  element.style.setProperty('--node-roundness', `${node.visual.roundness}px`);
  element.style.setProperty('--node-shell', `${node.visual.shell}px`);
  element.style.setProperty('--node-emission', node.visual.emission);
  element.style.setProperty('--node-pulse', node.visual.pulse);
  element.style.setProperty('--node-opacity', node.visual.opacity);
  element.classList.toggle('pulsing', node.visual.pulse > 0.05 && node.health !== 'stale');
  element.classList.toggle('selected', node.id === loop.selectedNodeId);

  const summary = toContentText(node.content).replace(/\s+/g, ' ').slice(0, 175);
  element.innerHTML = `
    <div class="node-kicker">
      <span>${roleIcon(node.subtype)} ${escapeHtml(node.subtype)}</span>
      <span>${escapeHtml(statusLabel(node.health))}</span>
    </div>
    <div class="node-title">${escapeHtml(node.title)}</div>
    <div class="node-summary">${escapeHtml(summary)}</div>
    <div class="node-footer">
      <span class="node-chip">${escapeHtml(node.lifecycle)}</span>
      <span class="node-chip">${escapeHtml(node.epistemic)}</span>
      <span class="node-chip node-origin">${escapeHtml(node.position.source)}</span>
    </div>`;

  element.addEventListener('pointerdown', (event) => beginDrag(event, node.id));
  element.addEventListener('click', (event) => {
    event.stopPropagation();
    loop.selectedNodeId = node.id;
    render();
  });
  return element;
}

function beginDrag(event, nodeId) {
  if (event.button !== 0) return;
  const node = loop.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return;
  drag = {
    node,
    startX: event.clientX,
    startY: event.clientY,
    originX: node.position.x,
    originY: node.position.y,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!drag) return;
  const dx = (event.clientX - drag.startX) / zoom;
  const dy = (event.clientY - drag.startY) / zoom;
  drag.node.position = {
    x: Math.max(0, Math.min(1000, drag.originX + dx)),
    y: Math.max(0, Math.min(680, drag.originY + dy)),
    source: 'Built',
  };
  drag.node.derivedPosition = null;
  drawNodes();
  drawRelations();
}

function endDrag() {
  if (!drag) return;
  loop.history.push({ at: new Date().toISOString(), action: 'move_node', nodeId: drag.node.id, source: 'Built' });
  drag = null;
  renderInspector();
}

function nodeCenter(node) {
  return { x: node.position.x + 90, y: node.position.y + 48 };
}

function edgePath(source, target) {
  const a = nodeCenter(source);
  const b = nodeCenter(target);
  const direction = b.x - a.x >= 0 ? 1 : -1;
  const startX = a.x + 82 * direction;
  const endX = b.x - 82 * direction;
  const control = Math.max(42, Math.abs(endX - startX) * 0.42);
  return {
    d: `M ${startX} ${a.y} C ${startX + control * direction} ${a.y}, ${endX - control * direction} ${b.y}, ${endX} ${b.y}`,
    labelX: (startX + endX) / 2,
    labelY: (a.y + b.y) / 2 - 7,
  };
}

function drawRelations() {
  $$('.relation-line, .relation-label', relationLayer).forEach((element) => element.remove());
  const byId = new Map(loop.nodes.map((node) => [node.id, node]));
  const failureFront = loop.observation.failureFront;

  for (const relation of loop.relations) {
    const source = byId.get(relation.source);
    const target = byId.get(relation.target);
    if (!source || !target) continue;
    const geometry = edgePath(source, target);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const failed = failureFront && (relation.source === failureFront || relation.target === failureFront);
    line.setAttribute('d', geometry.d);
    line.setAttribute('class', `relation-line${failed ? ' failure' : ''}`);
    relationLayer.appendChild(line);

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'relation-label');
    const width = Math.max(52, relation.predicate.length * 5.1);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', geometry.labelX - width / 2);
    rect.setAttribute('y', geometry.labelY - 8);
    rect.setAttribute('width', width);
    rect.setAttribute('height', 16);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', geometry.labelX);
    text.setAttribute('y', geometry.labelY);
    text.textContent = relation.predicate;
    group.append(rect, text);
    relationLayer.appendChild(group);
  }
}

function drawNodes() {
  nodeLayer.replaceChildren(...loop.nodes.map(createNodeElement));
}

function populateSelect(select, values) {
  if (select.options.length > 0) return;
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = statusLabel(value);
    select.appendChild(option);
  }
}

function renderInspector() {
  const node = selectedNode();
  $('#selected-subtype').textContent = `${node.node_type} · ${node.subtype}`;
  $('#selected-title').value = node.title;
  $('#selected-id').textContent = node.id;
  $('#selected-content').value = toContentText(node.content);

  populateSelect($('#selected-lifecycle'), LIFECYCLE_STATES);
  populateSelect($('#selected-epistemic'), EPISTEMIC_STATES);
  populateSelect($('#selected-health'), HEALTH_STATES);
  $('#selected-lifecycle').value = node.lifecycle;
  $('#selected-epistemic').value = node.epistemic;
  $('#selected-health').value = node.health;

  const sliders = [
    ['visual-scale', 'scale', 'scale-output'],
    ['visual-roundness', 'roundness', 'roundness-output'],
    ['visual-shell', 'shell', 'shell-output'],
    ['visual-emission', 'emission', 'emission-output'],
    ['visual-pulse', 'pulse', 'pulse-output'],
    ['visual-opacity', 'opacity', 'opacity-output'],
  ];
  for (const [inputId, property, outputId] of sliders) {
    const value = node.visual[property];
    $(`#${inputId}`).value = value;
    $(`#${outputId}`).textContent = Number(value).toFixed(property === 'roundness' ? 0 : 2);
  }

  $('#state-preview-grid').innerHTML = HEALTH_STATES.map((state) => `
    <div class="state-preview" data-health="${state}">
      <div>${roleIcon(node.subtype)}<br>${statusLabel(state)}</div>
    </div>`).join('');

  $('#evidence-count').textContent = String(node.evidenceRefs.length);
  $('#selected-evidence').classList.toggle('empty-state', node.evidenceRefs.length === 0);
  $('#selected-evidence').innerHTML = node.evidenceRefs.length
    ? node.evidenceRefs.map((reference) => `<div class="evidence-item"><code>${escapeHtml(reference)}</code></div>`).join('')
    : 'Aucune preuve.';
}

function renderContract() {
  const validation = validateStructure(loop);
  const checks = [
    ...REQUIRED_ROLE_SUBTYPES.map((subtype) => ({ label: subtype, code: 'role', pass: !validation.missingRoles.includes(subtype) })),
    ...REQUIRED_RELATIONS.map((predicate) => ({ label: predicate, code: 'relation', pass: !validation.missingRelations.includes(predicate) })),
    { label: 'parent scope', code: 'scope', pass: validation.validScope },
    { label: 'runtime moments produced only', code: 'runtime', pass: validation.precreatedMomentCount === 0 },
  ];

  $('#contract-checks').innerHTML = checks.map((check) => `
    <div class="contract-check ${check.pass ? 'pass' : 'fail'}">
      <span></span><span>${escapeHtml(check.label)}</span><code>${check.code}</code>
    </div>`).join('');
  $('#contract-completion').textContent = `${REQUIRED_ROLE_SUBTYPES.length - validation.missingRoles.length} / ${REQUIRED_ROLE_SUBTYPES.length}`;
}

function latestAssessment() {
  return [...loop.runtimeMoments].reverse().find((moment) => moment.subtype === 'health_assessment');
}

function latestObserverRun() {
  return [...loop.runtimeMoments].reverse().find((moment) => moment.subtype === 'observer_run');
}

function renderRuntime() {
  const moments = loop.runtimeMoments.slice(-5).reverse();
  const container = $('#runtime-moments');
  container.classList.toggle('empty-state', moments.length === 0);
  container.innerHTML = moments.length
    ? moments.map((moment) => `
      <div class="moment-item">
        <strong>${escapeHtml(moment.subtype)}</strong>
        <code>${escapeHtml(moment.id)}</code>
        <div>${escapeHtml(moment.derivedState || moment.executionStatus || (moment.passed ? 'passed' : 'failed'))}</div>
      </div>`).join('')
    : 'Aucun moment runtime. La santé ne peut pas encore être déclarée.';

  const assessment = latestAssessment();
  const health = assessment?.derivedState || selectedNode().health || 'not_measured';
  const globalHealth = $('#global-health');
  globalHealth.dataset.health = health;
  globalHealth.textContent = statusLabel(health);
  $('#evidence-age').textContent = loop.observation.observedAt
    ? `${Math.round((Date.now() - Date.parse(loop.observation.observedAt)) / 1000)} s`
    : 'aucune';

  const failureFront = assessment?.failureFront || loop.observation.failureFront;
  $('#failure-front-badge').textContent = failureFront || 'aucun front';
  const failurePath = $('#failure-path');
  failurePath.classList.toggle('active', Boolean(failureFront));
  failurePath.textContent = failureFront
    ? `Front causal : ${failureFront} → les états downstream deviennent explicitement indéterminés.`
    : 'Aucune rupture mesurée.';

  const metrics = latestObserverRun()?.metrics;
  const metricContainer = $('#metric-vector');
  metricContainer.classList.toggle('empty-state', !metrics);
  metricContainer.innerHTML = metrics
    ? Object.entries(metrics).map(([name, value]) => {
      const display = typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(3) : String(value);
      const good = name.includes('violations') || name.includes('rate')
        ? Number(value) === 0
        : name === 'evidence_freshness_seconds'
          ? Number(value) <= loop.observation.ttlSeconds
          : Number(value) === 1;
      return `<div class="metric-item" data-health="${good ? 'healthy' : 'degraded'}"><strong>${escapeHtml(name)}</strong><span class="metric-value">${escapeHtml(display)}</span></div>`;
    }).join('')
    : 'Non mesuré.';
}

function renderScenarios() {
  $$('[data-scenario]').forEach((button) => button.classList.toggle('active', button.dataset.scenario === loop.scenario));
}

function render() {
  drawNodes();
  drawRelations();
  renderInspector();
  renderContract();
  renderRuntime();
  renderScenarios();
  canvasWorld.style.transform = `scale(${zoom})`;
  $('#zoom-value').textContent = `${Math.round(zoom * 100)}%`;
}

function setZoom(next) {
  zoom = Math.max(0.55, Math.min(1.4, next));
  render();
}

function mutateSelected(mutator) {
  mutator(selectedNode());
  render();
}

function bindInspector() {
  $('#selected-title').addEventListener('input', (event) => mutateSelected((node) => { node.title = event.target.value; }));
  $('#selected-content').addEventListener('change', (event) => mutateSelected((node) => {
    node.content = parseContentText(event.target.value, node.content);
  }));
  $('#selected-lifecycle').addEventListener('change', (event) => mutateSelected((node) => { node.lifecycle = event.target.value; }));
  $('#selected-epistemic').addEventListener('change', (event) => mutateSelected((node) => { node.epistemic = event.target.value; }));

  const sliders = [
    ['visual-scale', 'scale', 'scale-output'],
    ['visual-roundness', 'roundness', 'roundness-output'],
    ['visual-shell', 'shell', 'shell-output'],
    ['visual-emission', 'emission', 'emission-output'],
    ['visual-pulse', 'pulse', 'pulse-output'],
    ['visual-opacity', 'opacity', 'opacity-output'],
  ];
  for (const [inputId, property, outputId] of sliders) {
    $(`#${inputId}`).addEventListener('input', (event) => {
      const value = Number(event.target.value);
      selectedNode().visual[property] = value;
      $(`#${outputId}`).textContent = value.toFixed(property === 'roundness' ? 0 : 2);
      drawNodes();
    });
  }
}

function bindActions() {
  $$('.mode-tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  $$('[data-scenario]').forEach((button) => button.addEventListener('click', () => {
    applyScenario(loop, button.dataset.scenario);
    setMode('simulate');
    render();
    toast(`Scénario chargé : ${button.textContent.trim()}`);
  }));
  $$('[data-maintenance]').forEach((button) => button.addEventListener('click', () => {
    const result = applyMaintenance(loop, button.dataset.maintenance);
    render();
    toast(result ? `Réparation mesurée : ${result.healthAssessment.derivedState}` : 'Affordance de maintenance appliquée.');
  }));
  $('#prove-loop').addEventListener('click', () => {
    if (loop.observation.executionStatus === 'not_run') {
      loop.observation.executionStatus = 'success';
      loop.observation.evidenceComplete = true;
      loop.observation.observedAt = new Date().toISOString();
    }
    const result = executeProof(loop);
    setMode('prove');
    render();
    toast(`HealthAssessment produit : ${result.healthAssessment.derivedState}`);
  });
  $('#reset-loop').addEventListener('click', () => {
    loop = createInitialLoop();
    render();
    toast('Loop restaurée. Aucun moment runtime précréé.');
  });
  $('#export-loop').addEventListener('click', () => {
    const blob = new Blob([serializeLoop(loop)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'self-verifying-loop.snapshot.json';
    link.click();
    URL.revokeObjectURL(url);
    toast('Snapshot JSON exporté.');
  });
  $('#zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
  $('#zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
  canvasViewport.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? 0.06 : -0.06));
  }, { passive: false });
  nodeLayer.addEventListener('pointermove', moveDrag);
  nodeLayer.addEventListener('pointerup', endDrag);
  nodeLayer.addEventListener('pointercancel', endDrag);
  canvasViewport.addEventListener('click', () => {
    loop.selectedNodeId = loop.id;
    render();
  });
}

function init() {
  document.body.dataset.mode = mode;
  bindInspector();
  bindActions();
  render();
}

init();
