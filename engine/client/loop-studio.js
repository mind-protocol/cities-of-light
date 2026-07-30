import {
  EPISTEMIC_STATES,
  HEALTH_STATES,
  LIFECYCLE_STATES,
  REQUIRED_RELATIONS,
  REQUIRED_ROLE_SUBTYPES,
  validateStructure,
} from './loop-studio-core.js';
import {
  INTENT_TYPES,
  createIntent,
  createLocalLoopStudio,
  serializeStudioBundle,
  verifyReceiptChain,
} from './loop-studio-intents.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const studio = createLocalLoopStudio();
let sensed = studio.sense();
let loop = sensed.snapshot;
let revision = sensed.revision;
let receipts = sensed.receipts;
let selectedNodeId = loop.id;
let mode = 'define';
let zoom = 1;
let drag = null;
let visualPreview = null;
let toastTimer = null;

const nodeLayer = $('#node-layer');
const relationLayer = $('#relation-layer');
const canvasWorld = $('#canvas-world');
const canvasViewport = $('#canvas-viewport');

function refreshSense({ preserveSelection = true } = {}) {
  sensed = studio.sense();
  loop = sensed.snapshot;
  revision = sensed.revision;
  receipts = sensed.receipts;

  if (!preserveSelection || !loop.nodes.some((node) => node.id === selectedNodeId)) {
    selectedNodeId = loop.id;
  }
}

function selectedNode() {
  return loop.nodes.find((node) => node.id === selectedNodeId) || loop.nodes[0];
}

function statusLabel(status) {
  return String(status).replaceAll('_', ' ');
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
  toastTimer = setTimeout(() => element.classList.remove('visible'), 2600);
}

function setMode(nextMode) {
  mode = nextMode;
  document.body.dataset.mode = mode;
  $$('.mode-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
}

function act(type, payload, successMessage) {
  const intent = createIntent(type, payload, revision);
  const receipt = studio.act(intent);
  refreshSense();
  visualPreview = null;
  render();

  if (receipt.status === 'committed') {
    toast(successMessage ?? `${type} committed · revision ${receipt.revisionAfter}`);
  } else if (receipt.status === 'conflict') {
    toast(`Conflit de révision : ${receipt.error}`);
  } else {
    toast(`Intent rejeté : ${receipt.error}`);
  }

  return receipt;
}

function effectiveVisual(node) {
  if (visualPreview?.nodeId === node.id) {
    return { ...node.visual, ...visualPreview.patch };
  }
  return node.visual;
}

function displayPosition(node) {
  if (drag?.nodeId === node.id && drag.previewPosition) return drag.previewPosition;
  return node.position;
}

function createNodeElement(node) {
  const position = displayPosition(node);
  const visual = effectiveVisual(node);
  const element = document.createElement('article');
  element.className = 'loop-node';
  element.dataset.nodeId = node.id;
  element.dataset.health = node.health;
  element.style.left = `${position.x}px`;
  element.style.top = `${position.y}px`;
  element.style.setProperty('--node-scale', visual.scale);
  element.style.setProperty('--node-roundness', `${visual.roundness}px`);
  element.style.setProperty('--node-shell', `${visual.shell}px`);
  element.style.setProperty('--node-emission', visual.emission);
  element.style.setProperty('--node-pulse', visual.pulse);
  element.style.setProperty('--node-opacity', visual.opacity);
  element.classList.toggle('pulsing', visual.pulse > 0.05 && node.health !== 'stale');
  element.classList.toggle('selected', node.id === selectedNodeId);

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
      <span class="node-chip node-origin">${escapeHtml(position.source)}</span>
    </div>`;

  element.addEventListener('pointerdown', (event) => beginDrag(event, node.id, element));
  element.addEventListener('click', (event) => {
    event.stopPropagation();
    selectedNodeId = node.id;
    visualPreview = null;
    render();
  });
  return element;
}

function beginDrag(event, nodeId, element) {
  if (event.button !== 0) return;
  const node = loop.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return;

  drag = {
    nodeId,
    element,
    startX: event.clientX,
    startY: event.clientY,
    originX: node.position.x,
    originY: node.position.y,
    previewPosition: { ...node.position },
    moved: false,
  };
  element.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag, { once: true });
}

function moveDrag(event) {
  if (!drag) return;
  const dx = (event.clientX - drag.startX) / zoom;
  const dy = (event.clientY - drag.startY) / zoom;
  drag.previewPosition = {
    x: Math.max(0, Math.min(1000, drag.originX + dx)),
    y: Math.max(0, Math.min(680, drag.originY + dy)),
    source: 'Built',
  };
  drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 2;
  drag.element.style.left = `${drag.previewPosition.x}px`;
  drag.element.style.top = `${drag.previewPosition.y}px`;
  drawRelations();
}

function endDrag() {
  window.removeEventListener('pointermove', moveDrag);
  if (!drag) return;

  const completed = drag;
  drag = null;

  if (completed.moved) {
    act(
      INTENT_TYPES.MOVE_VISUAL,
      { targetId: completed.nodeId, position: completed.previewPosition },
      'Position Built committée.',
    );
  } else {
    drawNodes();
    drawRelations();
  }
}

function nodeCenter(node) {
  const position = displayPosition(node);
  return { x: position.x + 90, y: position.y + 48 };
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
  const visual = effectiveVisual(node);
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
    const value = visual[property];
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
  const momentEntries = loop.runtimeMoments.slice(-4).reverse().map((moment) => ({
    kind: 'moment',
    id: moment.id,
    label: moment.subtype,
    result: moment.derivedState || moment.executionStatus || (moment.passed ? 'passed' : 'failed'),
  }));
  const receiptEntries = receipts.slice(-4).reverse().map((receipt) => ({
    kind: 'receipt',
    id: receipt.id,
    label: `${receipt.intentType} · r${receipt.revisionBefore}→r${receipt.revisionAfter}`,
    result: receipt.status,
  }));
  const entries = [...receiptEntries, ...momentEntries].slice(0, 7);
  const container = $('#runtime-moments');
  container.classList.toggle('empty-state', entries.length === 0);
  container.innerHTML = entries.length
    ? entries.map((entry) => `
      <div class="moment-item" data-entry-kind="${entry.kind}">
        <strong>${escapeHtml(entry.label)}</strong>
        <code>${escapeHtml(entry.id)}</code>
        <div>${escapeHtml(entry.result)}</div>
      </div>`).join('')
    : 'Aucun reçu ni moment runtime. La santé ne peut pas encore être déclarée.';

  const assessment = latestAssessment();
  const healthNode = loop.nodes.find((node) => node.subtype === 'health');
  const health = assessment?.derivedState || healthNode?.health || 'not_measured';
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

function renderAuthorityStatus() {
  const latest = receipts.at(-1);
  $('#canvas-subtitle').textContent = latest
    ? `revision ${revision} · ${latest.status} ${latest.intentType} · sense → act → receipt → sense`
    : `revision ${revision} · authority observed through sense`;
}

function render() {
  drawNodes();
  drawRelations();
  renderInspector();
  renderContract();
  renderRuntime();
  renderScenarios();
  renderAuthorityStatus();
  canvasWorld.style.transform = `scale(${zoom})`;
  $('#zoom-value').textContent = `${Math.round(zoom * 100)}%`;
}

function setZoom(next) {
  zoom = Math.max(0.55, Math.min(1.4, next));
  render();
}

function bindInspector() {
  $('#selected-title').addEventListener('change', (event) => {
    act(
      INTENT_TYPES.MODIFY_ROLE,
      { targetId: selectedNodeId, patch: { title: event.target.value } },
      'Titre committé.',
    );
  });
  $('#selected-content').addEventListener('change', (event) => {
    const node = selectedNode();
    act(
      INTENT_TYPES.MODIFY_ROLE,
      { targetId: selectedNodeId, patch: { content: parseContentText(event.target.value, node.content) } },
      'Autorité sémantique committée.',
    );
  });
  $('#selected-lifecycle').addEventListener('change', (event) => {
    act(
      INTENT_TYPES.MODIFY_ROLE,
      { targetId: selectedNodeId, patch: { lifecycle: event.target.value } },
      'Lifecycle committé.',
    );
  });
  $('#selected-epistemic').addEventListener('change', (event) => {
    act(
      INTENT_TYPES.MODIFY_ROLE,
      { targetId: selectedNodeId, patch: { epistemic: event.target.value } },
      'Statut épistémique committé.',
    );
  });

  const sliders = [
    ['visual-scale', 'scale', 'scale-output'],
    ['visual-roundness', 'roundness', 'roundness-output'],
    ['visual-shell', 'shell', 'shell-output'],
    ['visual-emission', 'emission', 'emission-output'],
    ['visual-pulse', 'pulse', 'pulse-output'],
    ['visual-opacity', 'opacity', 'opacity-output'],
  ];

  for (const [inputId, property, outputId] of sliders) {
    const input = $(`#${inputId}`);
    input.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      visualPreview = { nodeId: selectedNodeId, patch: { ...(visualPreview?.patch ?? {}), [property]: value } };
      $(`#${outputId}`).textContent = value.toFixed(property === 'roundness' ? 0 : 2);
      drawNodes();
    });
    input.addEventListener('change', () => {
      if (!visualPreview || visualPreview.nodeId !== selectedNodeId) return;
      const patch = { ...visualPreview.patch };
      visualPreview = null;
      act(
        INTENT_TYPES.MODIFY_VISUAL,
        { targetId: selectedNodeId, patch },
        'VisualDefinition committée.',
      );
    });
  }
}

function bindActions() {
  $$('.mode-tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));

  $$('[data-scenario]').forEach((button) => button.addEventListener('click', () => {
    act(
      INTENT_TYPES.APPLY_SCENARIO,
      { scenario: button.dataset.scenario },
      `Scénario committé : ${button.textContent.trim()}`,
    );
    setMode('simulate');
  }));

  $$('[data-maintenance]').forEach((button) => button.addEventListener('click', () => {
    act(
      INTENT_TYPES.APPLY_MAINTENANCE,
      { action: button.dataset.maintenance },
      'Maintenance committée et réobservée.',
    );
  }));

  $('#prove-loop').addEventListener('click', () => {
    const receipt = act(INTENT_TYPES.RUN_PROOF, {}, 'Proof exécutée.');
    if (receipt.status === 'committed') {
      const assessment = latestAssessment();
      toast(`HealthAssessment produit : ${assessment?.derivedState ?? 'not_measured'}`);
      setMode('prove');
    }
  });

  $('#reset-loop').addEventListener('click', () => {
    selectedNodeId = loop.id;
    act(INTENT_TYPES.RESET_LOOP, {}, 'Loop restaurée par transaction.');
    selectedNodeId = loop.id;
  });

  $('#export-loop').addEventListener('click', () => {
    const bundle = studio.exportBundle();
    const replay = verifyReceiptChain(bundle.genesis, bundle.receipts);
    const blob = new Blob([serializeStudioBundle(studio)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'self-verifying-loop.universe-bundle.json';
    link.click();
    URL.revokeObjectURL(url);
    toast(replay.passed
      ? `Bundle exporté · receipt chain vérifiée à r${replay.revision}.`
      : `Bundle exporté · ${replay.failures.length} rupture(s) de replay.`);
  });

  $('#zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
  $('#zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
  canvasViewport.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? 0.06 : -0.06));
  }, { passive: false });

  canvasViewport.addEventListener('click', () => {
    selectedNodeId = loop.id;
    visualPreview = null;
    render();
  });
}

function init() {
  document.body.dataset.mode = mode;
  const evidenceHeading = $('.evidence-section h2');
  if (evidenceHeading) evidenceHeading.textContent = 'Receipts & preuves';
  bindInspector();
  bindActions();
  render();
}

init();
