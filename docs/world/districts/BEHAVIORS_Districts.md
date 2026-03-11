# BEHAVIORS: world/districts — Observable Effects

What the visitor sees, hears, and feels in each district. Described from the outside. No implementation details.

---

## B1. Arriving in Venice

The visitor does not enter Venice through a loading screen. They arrive by water.

Starting position: a wooden dock at the edge of the lagoon, facing inward toward the city. The Grand Canal stretches ahead, bending out of sight. Building facades rise directly from the water on both sides. The sound of water against stone. A gondola passes silently. Somewhere deeper in the city, a bell rings.

No map. No waypoint marker. No "Welcome to Venice" text. The visitor walks forward along the fondamenta. The first district they encounter depends on which dock they spawn at. Default: Rialto (commerce), because it has the most citizen activity.

---

## B2. The Feel of Each District

### Rialto (Commerce)

- **Density**: highest. Buildings press close on both sides of narrow streets. Upper floors overhang, blocking sky. You walk in a canyon of stone.
- **Sound**: market calls, clattering coins, crate-scraping, voices negotiating. The soundscape is thick. Multiple citizen conversations overlap.
- **Light**: filtered. Direct sunlight only where the fondamenta widens near the Grand Canal. Alleys are shaded.
- **Props**: market stalls with goods displayed (crates of fish, bolts of cloth, ceramic jars). Awnings. Barrels. Rope coils. A wooden sign creaks on a hinge.
- **Canals**: the rii here are narrow (5-8m) and busy. Small cargo boats parked along walls. Water is darker — shadowed by buildings.
- **Buildings**: functional. Wide ground-floor arches (warehouses). Upper floors are living quarters. Facades are weathered — plaster peeling, stone exposed underneath. Colors: ochre, faded red, grey stone.
- **Citizens**: the most. Merchants at stalls, porters carrying goods, customers arguing over prices. The market never sleeps until sundown.

### San Marco (Power)

- **Density**: low. The piazza is an open expanse — the only wide-open space in Venice. The visitor steps out of a narrow alley into sudden vastness.
- **Sound**: echoing. Footsteps on stone carry. The ambient hum is lower but more resonant. Bell tower (campanile) chimes mark the hour.
- **Light**: bright and direct. The piazza catches full sun. Building facades gleam. Gold accents catch light.
- **Props**: columns, marble benches, flagpoles, a central well-head (vera da pozzo). Guard presence — citizen guards stand at positions.
- **Canals**: the Grand Canal border is wide and stately. No cargo boats — only ceremonial or passenger gondolas.
- **Buildings**: grand. Tall facades with pointed arches (Venetian Gothic). Ornamental tracery. Marble cladding on important buildings. Colors: white, pale gold, rose marble.
- **Citizens**: fewer but more formal. Nobles in conversation. Guards. A scribe at a desk under an arch. The atmosphere is serious.

### Castello (Memory / Residential)

- **Density**: medium-high. Buildings are close but lower (2-3 stories). Streets are slightly wider than Rialto — room for two people to pass.
- **Sound**: domestic. A baby crying behind a wall. Water splashing from a basin. Quiet conversation from an open window. Distant hammering from the Arsenale direction.
- **Light**: warm. Afternoon sun hits west-facing walls in golden tones. Shadows are soft, not the hard canyon shadows of Rialto.
- **Props**: laundry lines strung between buildings (cloth rectangles). Flower boxes on windowsills (small colored geometry). Small wooden boats tied to iron rings in the fondamenta. A cat sleeping on warm stone (ambient prop).
- **Canals**: residential rii. Quiet water. Reflections of colored building facades visible on the surface.
- **Buildings**: intimate. Narrow facades with shuttered windows. Doorways with stone lintels. Some buildings have visible wear — cracked plaster, replaced bricks in a different color. Colors: warm pink, terracotta, cream, sun-bleached yellow.
- **Citizens**: residents going about daily life. A woman hanging laundry. An old man sitting on a stone bench. Children running (if implemented as ambient props).

### Dorsoduro (Governance)

- **Density**: medium. Mix of building types — residences and civic structures. Open courtyards break up the building mass.
- **Sound**: debate. Voices raised in argument (ambient audio, not specific conversations unless close). The scratch of a quill. A gavel striking wood (if council is in session).
- **Light**: neutral. Well-lit but not dramatic. Torches in sconces at dusk — the first district to light up at evening.
- **Props**: notice boards on walls (flat rectangles with text textures). Podiums (elevated stone platforms). Guard posts (small wooden structures). Stone benches for petitioners waiting.
- **Canals**: average width. The Giudecca canal side is wide and open — a view across water.
- **Buildings**: civic. Wider facades. Larger windows. Some buildings have balconies overlooking courtyards (for addressing crowds). Colors: grey stone, off-white, muted.
- **Citizens**: petitioners, council members, guards. Clusters of citizens talking politics. A citizen pacing nervously before a hearing.

### Cannaregio (Knowledge)

- **Density**: medium-low. More breathing room. Some buildings are set back from the fondamenta with small gardens.
- **Sound**: quiet. Pages turning. A distant bell. Water. The quietest district. When a citizen speaks here, the visitor notices because the baseline silence amplifies it.
- **Light**: warm interior glow. Many buildings have lit windows (point lights behind frosted window geometry). At night, Cannaregio glows softly from within while other districts go dark.
- **Props**: bookseller stalls (small tables with book-shaped boxes). Writing desks visible through windows. Lanterns — more lanterns here than any other district. A well-head with carved inscriptions (decorative geometry).
- **Canals**: calm. Wider rii with slow-moving water. No cargo traffic.
- **Buildings**: tall and narrow. Many windows (Venice's glass industry). Pointed arches with fine tracery. Colors: dusky rose, sage, pale blue — the most varied palette of any district.
- **Citizens**: scholars, scribes, the occasional rabbi (Cannaregio contained the Ghetto). Quiet conversations, walking slowly, carrying books.

### Santa Croce (Operations)

- **Density**: medium. A working district. Buildings are utilitarian — larger footprints, fewer stories.
- **Sound**: industry. Hammering, sawing, water sloshing against hulls, rope creaking. The soundscape has rhythm.
- **Light**: hazy. Smoke from forges. Steam from dyeing workshops. The air feels thicker (fog density slightly higher).
- **Props**: timber stacks, rope coils, tool racks, cargo on docks, a forge glow (emissive orange light from a workshop doorway). Crane arms at the canal edge (simplified geometry).
- **Canals**: the widest minor canals in Venice. Designed for freight. Larger boats moored here.
- **Buildings**: functional. No decoration. Exposed brick. Wide doors. Some buildings are open-fronted workshops. Colors: grey, brown, raw stone, charcoal.
- **Citizens**: workers. Physical labor visible — carrying, lifting, pulling. Less idle conversation, more task-focused movement.

### Isola della Certosa (Discovery)

- **Density**: very low. This is an island, connected to Venice by a single bridge. Mostly open ground with a ruined monastery.
- **Sound**: nature. Wind through overgrown stone. Bird calls. Waves on the island shore. No market sounds, no crowd noise. The contrast with the city is stark.
- **Light**: open sky. No building shadows. Full sun exposure. At sunset, the whole island turns golden.
- **Props**: overgrown walls (stone + vine geometry). Broken columns. Wild trees (reuse palm tree logic but with deciduous silhouette). A dock with a single boat.
- **Canals**: none on the island. The lagoon surrounds it.
- **Buildings**: ruins. Partial walls, exposed foundations, a roofless chapel. One intact building serves as a meeting point.
- **Citizens**: rare. A hermit philosopher. An exile. Someone who came here to think. Encountering a citizen on Certosa is notable — the silence makes the meeting more significant.

---

## B3. District Transitions

Transitions between districts are gradual, not instantaneous. The visitor does not cross a line and see the world change. Instead:

- **Ambient audio**: crossfades over ~30 seconds of walking distance. Rialto market sounds fade; San Marco echo grows.
- **Building style**: the last buildings of one district and first buildings of the next district are blended — a Rialto-style building next to a San Marco-style building at the border.
- **Lighting**: fog color and density shift gradually. The visitor may not consciously notice but feels the mood change.
- **Canal character**: the canal they walk along may widen or narrow as they cross a district boundary, signaling the shift.
- **Bridge as threshold**: major district transitions happen at bridges. Crossing a bridge = entering new territory. This is architecturally natural — Venice districts are separated by water.

---

## B4. Time-of-Day Effects on Buildings

The world has a day/night cycle. Buildings respond:

### Dawn (05:00-07:00)
- East-facing facades catch the first light — warm orange on stone.
- Windows begin to glow (interior lights on as citizens wake).
- Market stalls are being set up (Rialto: new prop positions).
- Few citizens on the streets.

### Morning (07:00-12:00)
- Full sunlight. Strong shadows from buildings create sharp contrasts in narrow streets.
- Market stalls fully deployed with goods.
- Maximum citizen density in commercial districts.
- Cannaregio windows reflect morning light.

### Afternoon (12:00-17:00)
- Sun moves west. Shadows shift. East-facing alleys darken.
- Workshop activity peaks in Santa Croce (forge glow visible).
- Dorsoduro courtyards lit by overhead sun.
- Boats move along canals (ambient prop movement).

### Evening (17:00-20:00)
- Golden hour. All west-facing facades glow warm.
- Lanterns begin to light (point lights activate sequentially, from Cannaregio outward).
- Market stalls being packed up. Goods disappear from stall geometry.
- Citizens shift from work locations to taverns and homes.

### Night (20:00-05:00)
- Dark. Only lanterns, window lights, and moonlight on water.
- Building facades are barely visible — silhouettes against the sky.
- Canal water reflects lantern light (specular highlights).
- Very few citizens visible. Guards patrol with torches (moving point lights).
- The city's architecture transforms: the same narrow alley that felt busy at noon feels ominous at midnight.

---

## B5. Weather Effects on Buildings

### Clear
- Sharp shadows, high contrast. Stone textures visible in detail. Canal water is translucent.

### Overcast
- Flat lighting. No shadows. Building colors appear muted/desaturated. Water is opaque grey-green.

### Fog
- Buildings beyond 40m fade into grey. The visitor's visible world shrinks. Only nearby buildings exist. Creates claustrophobia in narrow streets, openness in piazzas.

### Rain
- Wet material effect: building roughness decreases (shinier). Fondamenta stone darkens. Canal water surface agitated (different normal map parameters). Drip particle effects from roof edges.

---

## B6. Economy Reflected in Architecture

Buildings are not static. They reflect Airtable economic data:

- A **prosperous merchant's shop** has goods displayed on a stall outside, lit interior, clean facade.
- A **bankrupt business** has an empty stall, dark windows, maybe a "closed" board propped against the door (prop swap).
- A **noble's palazzo** has ornamental balconies, marble accents, lit chandeliers visible through windows.
- A **poor worker's dwelling** has no decoration, shuttered windows, patches of different-colored plaster.

These visual differences come from the building's Airtable owner data: citizen wealth determines facade decoration level, window light intensity, and prop presence. Updated every 15-minute sync cycle.

---

## B7. Water in Districts

Every district has water. It is the constant.

- Canals reflect building facades (planar reflection or screen-space reflection depending on performance budget).
- Water color varies: darker in narrow shaded rii, bluer in open Grand Canal sections, greenish in Santa Croce (industrial).
- Boats are ambient props: gondolas drift slowly along major canals. Cargo boats are moored in Santa Croce and Rialto. A single ceremonial barge passes through San Marco at sunset.
- The water surface animates continuously (reuse existing `Water` from Three.js addons, same as current `scene.js`).
- Sound: water is always audible. Louder near canals. The sound of a canal is the sound of Venice.
