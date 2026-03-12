# OBJECTIVES: architecture/engine — What We Optimize For

## O1: One Engine, N Worlds (Primary)

Cities of Light is a reusable XR engine. It renders and navigates any world described by a WorldManifest. It does not know what Venice is. It does not know what Contre-Terre is. It knows how to load a manifest, generate terrain, spawn entities, route voice, sync state, and let humans and AIs share a space.

**Tradeoff accepted:** Generality over Venice-specific optimization. If a rendering trick only works for Venetian canals, it belongs in the world repo, not the engine. If a rendering trick works for any water body, it belongs in the engine.

## O2: Humans and AIs Share the Same Space

Both humans (VR/desktop/mobile) and AIs (via Manemus) are first-class inhabitants. The engine provides the same perceptual interface to both: a spatial state that can be rendered as pixels (for humans) or consumed as structured data (for AIs). Neither substrate is privileged.

**Tradeoff accepted:** Complexity of dual-interface over simplicity of human-only or AI-only.

## O3: Multi-Platform Without Fragmentation

One server, multiple client types. WebXR (browser), Unity (native VR), mobile (PWA). All clients connect to the same state server, see the same entities, hear the same audio. The engine defines the protocol, not the client implementation.

**Tradeoff accepted:** Protocol constraints over per-platform freedom. Every client must implement the same WorldManifest contract.

## O4: World Repos Own Content, Engine Owns Rendering

Strict boundary. The engine never contains citizen prompts, lore, economic rules, or narrative constants. World repos never contain rendering code, input handling, or network protocols. The WorldManifest is the contract between them.

**Tradeoff accepted:** Indirection cost (loading manifests, resolving paths) over direct access to content.

## Objective Ranking

O1 > O4 > O2 > O3

Reusability is primary. Without it, we build one world. With it, anyone can build a world.

---

@mind:TODO Validate objective ranking with Nicolas after first world (Venezia) is loaded via manifest
