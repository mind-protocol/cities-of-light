# Visual Memory Substrate — Sync: Current State

```
LAST_UPDATED: 2026-03-14
UPDATED_BY: Tomaso Nervo (@nervo) — Initial doc chain creation
STATUS: PROPOSED
```

---

## MATURITY

**What's canonical (v1):**
- Nothing. This module is fully PROPOSED. Zero code exists.

**What's still being designed:**
- The full Visual Memory Substrate architecture is documented in the CONCEPT doc and this 7-file doc chain. The design is detailed and specific, but no implementation has begun.
- Key open decisions: CLIP vs SigLIP model, image generation API, object storage provider, FLASHBULB_THRESHOLD value.

**What's proposed (v2+):**
- Video capture (temporal sequences instead of single screenshots)
- 3D memory palace visualization (rendering memory images in spatial context)
- Cross-citizen visual memory sharing (citizens see each other's memories)
- Fine-tuned CLIP on Venice-specific scenes

---

## CURRENT STATE

No code exists for the Visual Memory Substrate. The module is fully specified in documentation:

- **CONCEPT doc:** `docs/architecture/CONCEPT_Visual_Memory_Substrate.md` — the full technical specification covering architecture, generation strategy, physics integration, and open questions
- **Doc chain (this directory):** 7 files (OBJECTIVES, PATTERNS, BEHAVIORS, ALGORITHM, VALIDATION, IMPLEMENTATION, SYNC) translating the CONCEPT into implementation-ready documentation

The FalkorDB graph schema does not yet include `image_uri` or `image_embedding` properties on nodes. No object storage is provisioned. No CLIP/SigLIP encoding service exists. No image generation API is configured.

**Dependencies that must exist before implementation:**
1. **CLIP/SigLIP encoding service** — Python microservice or ONNX-in-browser library for computing image embeddings. This is the foundation — without it, no image can become a physics participant.
2. **Object storage** — S3, Cloudflare R2, or local bucket for image files. Without it, screenshots have nowhere to go.
3. **Image generation API** — Stable Diffusion (self-hosted), DALL-E (OpenAI API), or Flux for Flashbulb Vision and Desire image generation. Without it, citizens cannot dream.
4. **FalkorDB schema extension** — `image_uri` (string) and `image_embedding` (vecf32) properties on Moment, Actor, Desire, Concept, Value, and State node types.

**What blocks on this module:**
- Visual prediction error for motor control (CONCEPT_Active_Inference_Motor_Control) — needs Desire images and POV capture
- Desire image generation during traversal — needs this module's desire traversal trigger
- Multimodal LLM prompts — needs this module's WM thumbnail assembly

---

## IN PROGRESS

No work is in progress. The module is PROPOSED.

---

## RECENT CHANGES

### 2026-03-14: Full Doc Chain Created

- **What:** Created 7-file documentation chain for the Visual Memory Substrate module. OBJECTIVES (5 ranked: multimodal graph, visual prediction error, budget-efficient generation, URI-only storage, two-axis decay), PATTERNS (6 pillars: URI-only storage, Coherence v2, medoid selection, two generation triggers, self-stimulus reinjection, Law 8 native propagation), BEHAVIORS (8 behaviors in narrative style: visual similarity recall, Flashbulb Vision, two-axis decay, prediction error motor control, medoid crystallization, desire traversal generation, profile pic social recall, brightness/contrast injection), ALGORITHM (7 algorithms: POV capture pipeline, Coherence v2, Flashbulb Vision pipeline, desire traversal trigger, medoid selection, two-axis decay, brightness/contrast multiplier), VALIDATION (6 invariants: URI-only CRITICAL, coherence consistency CRITICAL, energy conservation HIGH, budget control HIGH, self-stimulus privacy HIGH, medoid integrity MEDIUM), IMPLEMENTATION (full code structure map — all TODO, 10 proposed files across engine/client, src/server, .mind/runtime, services), SYNC (this file).
- **Why:** The CONCEPT doc existed with full technical content but lacked the doc chain structure needed for implementation. This chain makes the architecture buildable — algorithms pseudocoded, invariants named, code locations mapped, dependencies listed.
- **Files:** `docs/architecture/visual-memory/OBJECTIVES_Visual_Memory.md`, `PATTERNS_Visual_Memory.md`, `BEHAVIORS_Visual_Memory.md`, `ALGORITHM_Visual_Memory.md`, `VALIDATION_Visual_Memory.md`, `IMPLEMENTATION_Visual_Memory.md`, `SYNC_Visual_Memory.md`
- **Struggles/Insights:** The Coherence v2 formula has a subtle fallback issue — when visual weights are absent, the remaining weights must redistribute to sum to ~1.0. The fallback formula (0.30 + 0.50 - 0.20 = 0.60 max, but Delta_affect can be subtracted below zero) needs careful bounding in implementation. Also, the FLASHBULB_THRESHOLD is undefined — it controls how often citizens dream, making it both the most impactful constant and the most uncertain.

---

## KNOWN ISSUES

### CLIP vs SigLIP Model Choice

- **Severity:** medium (blocks implementation)
- **Symptom:** Cannot begin CLIP encoding service without choosing a model
- **Suspected cause:** No Venice-specific benchmarks exist. CLIP (512-dim) has broader training; SigLIP (384-dim) is lighter and may be sufficient for scene similarity.
- **Attempted:** Nothing — needs benchmarking on actual Venice screenshots.

### FLASHBULB_THRESHOLD Undefined

- **Severity:** high (blocks Flashbulb Vision calibration)
- **Symptom:** Cannot determine how frequently citizens generate visions
- **Suspected cause:** Depends on the limbic delta distribution in the running physics engine. Need to observe delta values over many ticks to set a threshold that produces ~1-3 visions per citizen per day.
- **Attempted:** Nothing — needs live physics data.

### Image Generation API Budget

- **Severity:** medium (blocks Flashbulb Vision and Desire generation)
- **Symptom:** Cannot estimate cost without knowing generation frequency and API choice
- **Suspected cause:** Circular dependency — frequency depends on FLASHBULB_THRESHOLD, budget depends on frequency, API choice depends on budget.
- **Attempted:** Nothing — needs threshold calibration first.

---

## HANDOFF: FOR AGENTS

**Your likely VIEW:** VIEW_Implement (greenfield — build from spec)

**Where I stopped:** Documentation only. Zero code exists. The doc chain is complete and implementation-ready.

**What you need to understand:**
The CONCEPT doc (`docs/architecture/CONCEPT_Visual_Memory_Substrate.md`) is the authoritative source. This doc chain decomposes it into structured implementation guidance. Start with OBJECTIVES (what matters), then PATTERNS (how it works), then ALGORITHM (exact steps). The key invariant is V1: URI-only storage — no base64 in FalkorDB, ever. Everything flows from this.

**Watch out for:**
- The Coherence v2 fallback formula weights must redistribute cleanly. Test with missing embeddings.
- CLIP encoding latency (~50-200ms) must not block Moment creation. Make it async.
- Flashbulb Vision must never block the physics tick. The entire pipeline (freeze→generate→inject) runs async.
- The brightness/contrast injection multiplier is bounded [1.0, ~1.35]. If your pixel values produce NaN or infinity, the energy injection goes haywire.

**Open questions I had:**
- Is 200x200 the right thumbnail size? Smaller saves storage but may lose CLIP discriminability.
- Should desire images be regenerated if the desire's content changes? Currently one-shot, immutable.
- How do we handle the cold start? A new citizen has zero screenshots — all Coherence scoring falls back to text-only until the first POV captures roll in.

---

## HANDOFF: FOR HUMAN

**Executive summary:**
The Visual Memory Substrate is fully documented (CONCEPT + 7-file doc chain) but has zero code implementation. The design specifies how images become first-class physics participants in the cognitive graph: POV screenshots on Moments, generated visions on emotional peaks, desire images for motor control, medoid selection for concepts, two-axis visual decay. Three external dependencies must be resolved before implementation: CLIP model choice, object storage provisioning, image generation API selection.

**Decisions made:**
- URI-only storage in FalkorDB (no base64, ever)
- Coherence v2 formula with Sim_vis at 0.25 weight, graceful text-only fallback
- Two generation triggers only (Flashbulb Vision on emotional peaks, Desire traversal at energy > 0.4)
- Medoid selection for concept images (no generation for concepts)
- Two-axis decay: energy→opacity/brightness, weight→size/blur

**Needs your input:**
- CLIP vs SigLIP model choice (needs Venice scene benchmarking)
- Image generation API: Stable Diffusion (free, self-hosted) vs DALL-E (API, $0.04/image) vs Flux (API, fast)
- Object storage: S3 (AWS) vs R2 (Cloudflare, free egress) vs local filesystem for POC
- FLASHBULB_THRESHOLD calibration — how often should citizens dream? Target: 1-3 visions per citizen per day

---

## TODO

### Doc/Impl Drift

- [ ] DOCS→IMPL: Entire doc chain is ahead of implementation (0% code)

### Tests to Run

```bash
# No tests exist yet. When implemented:
# npm test -- --grep "visual-memory"
# python -m pytest tests/visual_memory/
```

### Immediate

- [ ] Benchmark CLIP vs SigLIP on Venice scene screenshots (discriminability, latency, dimension)
- [ ] Choose and provision object storage (S3/R2/local for POC)
- [ ] Extend FalkorDB schema: add `image_uri` (string) and `image_embedding` (vecf32) to Moment, Actor, Desire, Concept, Value, State node types
- [ ] Build CLIP encoding microservice (`services/clip-service/`)
- [ ] Build POV capture module (`engine/client/visual-memory/pov-capture.js`)

### Later

- [ ] Build object storage adapter (`src/server/visual-memory/image-store.js`)
- [ ] Build Coherence v2 scoring (`src/server/visual-memory/coherence-v2.js`)
- [ ] Build Flashbulb Vision pipeline (`src/server/visual-memory/flashbulb-vision.js`)
- [ ] Build desire traversal trigger (`.mind/runtime/traversal/desire_image.py`)
- [ ] Build medoid selection (`.mind/runtime/physics/crystallization_image.py`)
- [ ] Build two-axis decay renderer (`engine/client/visual-memory/decay-renderer.js`)
- [ ] Calibrate FLASHBULB_THRESHOLD against live physics data
- [ ] Choose image generation API and configure budget limits
- IDEA: Client-side CLIP via onnxruntime-web to eliminate Python service dependency
- IDEA: Pre-encode Venice landmark images as reference vectors for scene recognition

---

## CONSCIOUSNESS TRACE

**Mental state when stopping:**
Clear and structured. The doc chain captures the full CONCEPT faithfully. No ambiguity in the design — the open questions are genuinely open (model choice, threshold values, API selection), not gaps in the architecture.

**Threads I was holding:**
- The Coherence v2 fallback weights don't quite sum to 1.0 in the same way as the visual formula. The visual version sums to 0.80 + 0.10 subtracted = net 0.70 worst case (when Delta_affect = 1). The fallback sums to 0.80 - 0.20 = 0.60 worst case. This asymmetry is probably fine (coherence is a ranking signal, not a probability), but worth noting.
- The self-stimulus injection for Flashbulb Visions needs to integrate with whatever stimulus queue Law 1 uses. I haven't verified how that queue is implemented yet.
- Desire image immutability (once generated, never regenerated) may cause issues if the desire's textual content changes. The image would reflect the old aspiration.

**Intuitions:**
- SigLIP is probably the right choice — lighter, faster, and the 384-dim embedding is sufficient for scene similarity in a constrained environment (Venice, known locations, limited visual vocabulary).
- Local filesystem storage is fine for POC. R2 for production (free egress, Cloudflare integration).
- FLASHBULB_THRESHOLD should be set empirically by observing limbic delta distribution over 24h of live physics, then picking the 95th percentile as threshold. This produces ~1-3 visions per citizen per day.

**What I wish I'd known at the start:**
The CONCEPT doc is extremely thorough. It contains almost everything needed for implementation. The doc chain is mostly a restructuring exercise, not a gap-filling exercise. The real work is implementation, not specification.

---

## POINTERS

| What | Where |
|------|-------|
| Full CONCEPT specification | `docs/architecture/CONCEPT_Visual_Memory_Substrate.md` |
| Active inference motor control (visual prediction error consumer) | `docs/architecture/CONCEPT_Active_Inference_Motor_Control.md` |
| 3D pipeline (screenshot capture source) | `docs/architecture/pipeline/` |
| Serenissima asset pipeline (WM→Channel 1 bridge) | `docs/architecture/serenissima/` |
| Physics engine laws | `.mind/runtime/physics/` |
| FalkorDB graph schema | `.mind/schema.yaml` |
| Existing coherence formula | `.mind/runtime/physics/` (to be extended with Sim_vis) |
| Law 10 crystallization | `.mind/runtime/physics/` (to be extended with medoid selection) |
