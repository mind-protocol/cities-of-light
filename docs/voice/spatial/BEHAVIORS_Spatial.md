# BEHAVIORS -- Spatial Audio

> What the visitor experiences through their ears. Observable effects, not
> implementation details. Written from inside the Quest 3 headset.

---

## The First Impression: Sound as Geography

The visitor enters Venice and hears it before they understand it. Water lapping
against stone from below. Seagulls calling from above and to the right. A
distant bell tolling from across the lagoon. Faint market chatter ahead.

Without moving, the visitor already knows: water is close, something busy is
ahead, the sky is open above. Sound teaches the city's shape faster than sight.

---

## B1. Citizen Voice Positioning

### Voice Comes From the Citizen

GIVEN a citizen is standing 5 meters to the visitor's left
WHEN the citizen speaks
THEN the voice arrives predominantly in the visitor's left ear, with subtle
delay and frequency difference in the right ear.

GIVEN the visitor turns their head 90 degrees to face the citizen
THEN the voice shifts to center, arriving equally in both ears.

GIVEN the visitor turns past the citizen, placing them behind-right
THEN the voice sounds muffled, slightly attenuated, and positioned
behind-right. The brain registers "someone is speaking behind me."

### Distance Attenuation

| Distance     | What the visitor hears                                |
|--------------|-------------------------------------------------------|
| 2 meters     | Clear, present, intimate -- a person next to you      |
| 12 meters    | Noticeably quieter, calling from across a room        |
| 30 meters    | Barely audible -- a murmur on the edge of perception  |
| Beyond 50m   | Inaudible. Silence from that direction.               |

Attenuation follows inverse distance. No hard cutoff. The voice fades
smoothly. The visitor never hears a voice "pop" into existence.

---

## B2. District Ambient Soundscapes

Each district has a sonic identity. Close your eyes. If you can tell which
district you are in, the ambient system is working.

| District   | Primary              | Secondary             | Accent                    |
|------------|----------------------|-----------------------|---------------------------|
| Rialto     | Market crowd roar    | Water against boats   | Merchant calls, coin clink|
| San Marco  | Piazza echo          | Pigeons cooing        | Distant bells             |
| Dorsoduro  | Quiet canal lap      | Wind through trees    | Gondolier singing         |
| Cannaregio | Residential hum      | Footsteps on stone    | Children playing          |
| Murano     | Furnace rumble       | Glass clinking        | Heat hiss                 |

Volume correlates to district density: Rialto is loudest, Cannaregio quietest.

---

## B3. District Transitions

GIVEN the visitor walks from Cannaregio toward Rialto, crossing a bridge
WHEN they reach the midpoint of the bridge
THEN both districts blend: Cannaregio fading, Rialto growing. The crossfade
takes approximately 3 seconds.

WHEN they step off the bridge into Rialto
THEN Cannaregio is gone. Rialto dominates.

The transition is never sudden. There is no audible seam. The visitor
experiences a gradient, not a boundary.

---

## B4. Reverb and Acoustic Space

| Space             | Character                                        | Reverb tail |
|-------------------|--------------------------------------------------|-------------|
| Narrow calle      | Tight, close, footsteps bounce sharply off walls  | ~0.8s       |
| Open piazza       | Diffuse, exposed, footsteps echo long             | ~2.5s       |
| Canal-side        | Wet reflections, open horizontal, bounded vertical| ~1.5s       |
| Indoor (church)   | Deep, dark, solemn, slow release                  | ~4.0s       |

GIVEN the visitor walks from a narrow calle into an open piazza
THEN the reverb profile crossfades over approximately 2 seconds. The visitor
does not hear the old reverb "snap off" and the new one begin. The transition
feels like physically moving between spaces.

---

## B5. Occlusion (Sound Blocked by Buildings)

GIVEN the visitor and a citizen are both in the same piazza
THEN the citizen's voice arrives clearly with full frequency range.

GIVEN a citizen is in an adjacent calle connected by an open archway
THEN the voice arrives attenuated (~6dB) and filtered (muffled, high
frequencies reduced). The visitor hears someone around the corner.

GIVEN a citizen is behind a solid building, two areas away
THEN the citizen is inaudible. Stone walls block sound entirely.

The progression -- silence, muffled, clear -- teaches the visitor that
buildings are solid acoustic barriers without any UI explanation. The visitor
walks around a building and the hidden voice gradually appears.

---

## B6. Audio Priority

GIVEN three citizens speak at 3m, 10m, and 25m respectively
THEN the nearest is clear and dominant, the middle is audible but secondary,
the farthest is faint background texture.

GIVEN the visitor walks toward the farthest citizen
THEN the mix shifts smoothly. No abrupt changes. The visitor controls the
mix by moving their body.

GIVEN the visitor is in a crowded market with 20 citizens nearby
THEN the closest 2-3 produce recognizable speech. The rest merge into
ambient crowd texture. The visitor never hears 20 distinct voices competing.

---

## B7. Time-of-Day Audio

**Dawn:** Bells toll. Birds increase. Water sounds prominent in the quiet.

**Day:** Full ambient layers. Crowd noise at Rialto. The loudest, most
complex soundscape of the cycle.

**Dusk:** Market sounds taper. Tavern noise begins -- laughter, music.

**Night:** Near silence. Wind over water. Guard patrol footsteps. A shutter
closing. The visitor hears their own footsteps more prominently. Walking
through San Marco at 2:00 AM, the reverb makes each step echo across the
empty square.

---

## B8. Weather Audio

**Rain:** Rain on rooftops above (steady patter). Rain on water (hiss and
splatter). Rain on stone (harder, sharper). Under an archway, rain attenuates
above and stays loud ahead and behind.

**Wind:** Directional. Turning the head reveals the wind source. Narrow calli
produce a whistle. Open piazzas get a broader, lower tone.

**Storm:** Thunder positioned in 3D space -- a rumble rolling across the sky.
Lightning cracks with delay proportional to simulated distance.

---

## B9. What the Visitor Should Never Experience

**Flat audio.** A citizen's voice playing equally in both ears regardless of
position. If the visitor cannot point to a voice with eyes closed, the spatial
system has failed.

**Ambient silence.** District ambient should never go silent during daytime.
Even an empty piazza has water, wind, and distant city sounds.

**Sound pop-in.** A citizen walking into range should never appear at full
volume. The voice grows smoothly from inaudible. Any abrupt appearance breaks
immersion.

**Reverb mismatch.** A voice in a narrow calle must not have piazza reverb.
Cathedral echo in a back alley means the reverb zone is wrong.

**Clipping.** Multiple overlapping citizens at close range must never produce
distortion. If the visitor hears crackling, the mix is broken.

---

## B10. Testable Scenarios

### Directional Accuracy
1. Stand still in a piazza. A citizen walks a circle around you at 5 meters.
2. Close your eyes. Point to where you hear the citizen.
3. PASS: Pointing tracks actual position within 30 degrees throughout.

### Distance Perception
1. A citizen speaks from 3 meters, then walks to 15 meters and speaks again.
2. PASS: The second utterance is noticeably quieter. Distance is judgeable
   by sound alone.

### District Identification
1. Eyes closed. Teleport to Rialto, listen 10 seconds. Teleport to
   Cannaregio, listen 10 seconds.
2. PASS: The visitor correctly identifies the market vs residential district.

### Occlusion
1. Stand in a piazza. A citizen on the far side of a building speaks loudly.
2. PASS: Nothing or faint muffle heard.
3. Walk around the building.
4. PASS: Voice becomes clear.

### Night Stillness
1. Set time to 3:00 AM. Walk through three districts.
2. PASS: No market chatter, no crowd noise. Only water, wind, guard footsteps.
