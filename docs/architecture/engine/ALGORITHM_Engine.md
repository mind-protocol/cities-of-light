# ALGORITHM: architecture/engine — How It Works

## A1: World Loading Sequence

```
ENGINE_START(manifest_path):
  manifest = read_json(manifest_path)
  validate(manifest, WORLD_MANIFEST_SCHEMA)

  // Terrain
  generator = resolve_terrain_generator(manifest.terrain.generator)
  terrain_mesh = generator.generate(manifest.terrain.seed, manifest.terrain.biomes, manifest.terrain.palette)
  scene.add(terrain_mesh)

  // Zones
  for zone in manifest.zones:
    zone_obj = create_zone(zone.id, zone.position, zone.radius)
    zone_obj.set_atmosphere(zone.atmosphere)
    zone_obj.set_ambient(zone.ambient_sounds)
    if zone.type == "portal":
      zone_obj.set_portal_target(zone.target_manifest)
    scene.add(zone_obj)

  // Atmosphere
  atmosphere = create_atmosphere(manifest.atmosphere)
  scene.set_atmosphere(atmosphere)

  // Entity source
  entity_source = resolve_entity_source(manifest.entity_sources)
  entity_manager = EntityManager(entity_source, manifest.entity_sources.tier_config)
  entity_manager.start_sync()

  // Physics
  if manifest.physics.engine != "none":
    physics_bridge = resolve_physics_bridge(manifest.physics.engine)
    physics_bridge.start_tick(manifest.physics.graph_name, manifest.physics.tick_interval_ms, manifest.physics.constants)

  // Voice
  voice_pipeline = VoicePipeline(manifest.ai_config)

  // Network
  ws_server.broadcast("world_loaded", { world: manifest.name })
```

## A2: Entity Tier Assignment

```
ASSIGN_TIERS(visitor_pos, entities, tier_config):
  for entity in entities:
    distance = distance_3d(visitor_pos, entity.position)

    if distance < tier_config.FULL.radius AND count(FULL) < tier_config.FULL.max:
      entity.tier = FULL
    elif distance < tier_config.ACTIVE.radius AND count(ACTIVE) < tier_config.ACTIVE.max:
      entity.tier = ACTIVE
    else:
      entity.tier = AMBIENT

    // Transition smoothing
    if entity.tier != entity.previous_tier:
      entity.transition_progress = 0  // starts fade
      entity.transitioning_from = entity.previous_tier

  // FULL slots: prefer entities with highest relationship_score to visitor
  if count(candidates_for_FULL) > tier_config.FULL.max:
    sort(candidates_for_FULL, by=relationship_score, desc)
    promote top N, demote rest to ACTIVE
```

## A3: Voice Routing

```
ROUTE_VOICE(audio_buffer, visitor_entity, nearby_entities):
  text = whisper_stt(audio_buffer)
  if text is empty: return

  // Find target: nearest FULL-tier entity facing visitor
  target = find_conversation_target(visitor_entity, nearby_entities)
  if target is null: return

  // Load prompt from world repo
  prompt = load_prompt(target.prompt_path)
  context = assemble_context(target, visitor_entity, recent_events)

  // LLM call
  response = claude_api(system=prompt, context=context, user=text)

  // TTS
  audio = elevenlabs_tts(response, voice_id=target.voice_id)

  // Spatial playback
  ws_server.broadcast("entity_speak", {
    entity_id: target.id,
    audio: audio,
    text: response,
    position: target.position
  })

  // Memory write (delegated to world repo's memory backend)
  memory_backend.write(target.id, { visitor: text, response: response, timestamp: now() })
```

## A4: Physics Bridge Tick

```
PHYSICS_TICK(bridge, graph_name, constants):
  result = bridge.tick(graph_name, constants)
  // result = { flipped_moments: [], energy_changes: [], new_narratives: [] }

  for moment in result.flipped_moments:
    event = resolve_event_template(moment.type)  // from world repo
    ws_server.broadcast("world_event", {
      type: moment.type,
      zone: moment.zone,
      affected_entities: moment.affected,
      visual_effect: event.visual,
      audio_effect: event.audio,
      duration_ms: event.duration
    })

  for change in result.energy_changes:
    entity_manager.update_entity_state(change.entity_id, change.new_state)
```

## A5: Manemus Integration

```
// Engine → Manemus (push)
SEND_PERCEPTION(entity_id):
  screenshot = render_from_pov(entity_id)  // render scene from entity's camera
  nearby = get_nearby_entities(entity_id, radius=30)
  recent = get_recent_events(entity_id.zone, last_5_minutes)
  manemus_api.post("/perception", { entity_id, screenshot, nearby, recent })

// Manemus → Engine (receive via WebSocket)
ON_AI_ACTION(action):
  switch action.type:
    "move":    entity_manager.move(action.entity_id, action.target)
    "speak":   voice_pipeline.play_speech(action.entity_id, action.text)
    "emote":   entity_manager.emote(action.entity_id, action.gesture)
    "spawn":   entity_manager.spawn(action.entity_id)
    "despawn": entity_manager.despawn(action.entity_id)
```

## A6: Portal Transition

```
ENTER_PORTAL(portal_zone):
  target_path = portal_zone.target_manifest

  // Validate target is reachable
  if not exists(target_path):
    portal_zone.set_state("offline")
    return

  // Transition out
  atmosphere.fade_to_fog(duration=2000)
  audio.crossfade_to_silence(duration=2000)
  await sleep(2000)

  // Unload
  entity_manager.despawn_all()
  physics_bridge.stop()
  scene.clear()

  // Load new world
  ENGINE_START(target_path)

  // Transition in
  visitor.position = portal_zone.target_spawn
  atmosphere.fade_from_fog(duration=2000)
```

---

@mind:TODO Flesh out entity state sync protocol (delta encoding, compression)
@mind:TODO Define error recovery for each algorithm (partial failures, reconnection)
