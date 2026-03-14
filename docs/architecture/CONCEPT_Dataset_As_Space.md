# CONCEPT: Dataset as Space — Walk Your Data, Code Your Architecture

```
STATUS: DRAFT
CREATED: 2026-03-14
```

---

## WHAT IT IS

Any structured dataset — a codebase, a documentation chain, a wallet graph, a social network, a knowledge base — can be spatialized as a walkable 3D environment. The citizen (or human) navigates the data by moving through it physically. Data flow becomes rivers, functions become rooms, modules become buildings, bugs become structural damage, documentation links become visible threads.

This is not visualization. This is **habitation** — you live inside your data and modify it by modifying the space.

---

## WHY IT EXISTS

Programming is the act of manipulating invisible structures through text. Humans are terrible at this — our brains evolved for spatial navigation, not symbol manipulation. The hippocampus (spatial memory) is the most powerful memory system in the human brain. By converting data structures into spatial structures, we hijack the brain's strongest capability to solve its weakest problem: understanding complex systems.

---

## KEY PROPERTIES

- **Bidirectional:** Change the space → change the data. Change the data → space updates in real-time
- **Any graph fits:** Wallet transactions, social networks, codebases, doc chains, API call graphs, dependency trees
- **Bugs are visible:** Null pointer = broken pipe. Circular dependency = loop you can walk in circles. Missing docs = dark room
- **Doc chain as threads:** OBJECTIVES → BEHAVIORS → ALGORITHM links rendered as visible golden filaments between rooms

---

## ARCHITECTURE

### 1. Codebase as Architecture

```
MAPPING:

  Repository          → City / District
  Module / Package    → Building
  Class / File        → Room
  Function / Method   → Object in room (desk, machine, tool)
  Variable            → Container (box, barrel, vessel)
  Data flow           → Pipes / Rivers connecting rooms
  Control flow        → Corridors / Doors (if/else = fork in corridor)
  Loop                → Circular corridor (walk in circles to see iterations)
  API endpoint        → Door to outside (portal to another building)
  Import / Dependency → Bridge between buildings
  Error / Exception   → Structural damage (cracked wall, broken pipe, fire)
  Test                → Inspector plaque on the wall (green = passing, red = failing)
  Git blame           → Nameplate on each object (who built this)
  Documentation       → Signs, plaques, murals on walls

CODEBASE SPATIALIZATION:
  # Step 1: Parse AST (Abstract Syntax Tree)
  # Step 2: Build dependency graph (imports, calls, data flow)
  # Step 3: Force-directed layout → 3D positions
  # Step 4: Map code constructs → architectural primitives
  # Step 5: Render via R3F / engine

  # Example: cities-of-light codebase
  #   engine/ → a building with 16 rooms
  #   src/server/ → adjacent building, bridges to engine
  #   src/client/ → building across the canal
  #   physics-bridge.js → a literal bridge (pipe) between Python and JS buildings
  #   Each function → a machine in its room
  #   Data flowing through physics-bridge → visible stream of particles in the pipe
```

### 2. Doc Chain as Visible Thread Network

```
MIND Protocol doc chain:
  OBJECTIVES → PATTERNS → BEHAVIORS → ALGORITHM → VALIDATION → IMPLEMENTATION → SYNC

RENDERING:
  Each doc → a room or alcove in the module's building
  Chain links → golden threads running along the ceiling between rooms
  Missing doc → dark room with no thread connection (visible gap)
  Stale doc → thread dims, cobwebs appear (SYNC outdated)

  BEHAVIORS linked to specific code functions:
    → thread runs from BEHAVIORS room through the wall
    → into the IMPLEMENTATION room
    → attaches to the specific function object
    → if the function changed but BEHAVIORS didn't update: thread turns red (broken contract)

  # Walking the doc chain: enter OBJECTIVES room, follow the golden thread
  # through PATTERNS, BEHAVIORS, ALGORITHM... see the entire design chain
  # as a physical path. Missing links = dead ends you physically cannot pass.
```

### 3. Wallet / Transaction Graph as Economic Landscape

```
MAPPING:
  Wallet address     → Building / House
  Transaction        → River / Channel between buildings
  Token amount       → River width / flow rate
  Transaction freq.  → River current speed
  Large holder       → Tall building (height = balance)
  Dead wallet        → Abandoned ruin
  Smart contract     → Factory (inputs go in, outputs come out)
  DEX pool           → Lake (two rivers merge)

  # Walk through and SEE where money flows
  # Follow a river upstream to find where funds originate
  # See which buildings are connected (common counterparties)
  # Dry riverbed = old transaction path, no longer active
```

### 4. Live Editing — Change Space, Change Data

```
THE BIDIRECTIONAL BRIDGE:

  # Human grabs a "pipe" (data flow) in VR and reroutes it
  → backend: refactors the function call to point to new target
  → code diff generated, PR created

  # Human adds a "door" between two rooms
  → backend: creates an import statement / API connection

  # Human sees a cracked wall (bug) and "repairs" it
  → backend: shows the error, suggests fix, applies on confirmation

  # Human places a "sign" (documentation) in an empty room
  → backend: creates the markdown file in the correct docs/ location

  # Human walks into a dark room (missing tests)
  → system highlights what needs testing
  → human "installs a lamp" (writes a test)
  → room illuminates, inspector plaque appears

CONSTRAINTS:
  # All edits go through standard git workflow
  # Change → diff → review → commit
  # The space reflects the repository state, not a parallel world
  # Conflict: if someone else edits the same code, the room "shifts"
  # (merge conflict = two overlapping rooms trying to occupy same space)
```

---

## COMMON MISUNDERSTANDINGS

- **Not:** A code visualization dashboard (those are read-only)
- **Not:** A game where you pretend to code (the changes are real)
- **Not:** Limited to code (any graph-structured dataset works)
- **Actually:** A bidirectional spatial interface where navigating data = understanding data, and modifying space = modifying data

---

## SEE ALSO

- `docs/architecture/CONCEPT_Superhuman_Senses.md` — Code Vision (Matrix Mode) for viewing code in existing spaces
- `docs/architecture/CONCEPT_Lumina_Prime.md` — The procedural generation engine that would render these spaces
- `docs/architecture/CONCEPT_3D_Pipeline_Supply_Chain.md` — Two Coupled Engines for real-time rendering
