# IMPLEMENTATION: citizens/mind -- Citizen Conversation Pipeline

```
STATUS: DRAFT
CREATED: 2026-03-11
VERIFIED: Not yet implemented
```

---

## CHAIN

```
OBJECTIVES:      ../../../docs/01_OBJECTIFS_Venezia.md
BEHAVIORS:       ./BEHAVIORS_Mind.md
PATTERNS:        ./PATTERNS_Mind.md
ALGORITHM:       ./ALGORITHM_Mind.md
THIS:            IMPLEMENTATION_Mind.md (you are here)
SYNC:            ./SYNC_Mind.md

FILES:           src/server/citizen-router.js (primary — NEW)
                 src/server/index.js (existing — integration point)
                 src/server/serenissima-sync.js (planned — Airtable data source)
                 src/server/venice-state.js (planned — in-memory world state)
```

---

## FILE MAP

```
src/server/
  index.js                  ← EXISTING: Express + WS. Integrates citizen-router.
  citizen-router.js         ← THIS MODULE. Context assembly, Claude API, memory write, trust.
  venice-state.js           ← In-memory cache of Airtable data. Queried by citizen-router.
  serenissima-sync.js       ← Periodic Airtable sync. Populates venice-state.
  physics-bridge.js         ← FalkorDB client. Queried by citizen-router for beliefs.
  voice.js                  ← EXISTING: STT/TTS pipeline (reused for citizen speech).

serenissima/
  citizens/
    {username}/
      CLAUDE.md             ← System prompt per citizen (personality, backstory).
      .cascade/
        memories/
          index.json         ← Memory index: [{ file, visitor, timestamp, heat, summary }]
          2026-03-11T14:22:00.json  ← Individual memory entries.
        experiences/
          *.json             ← Life experiences (non-visitor, background context).
```

---

## NPM PACKAGES

```json
{
  "@anthropic-ai/sdk": "^0.74.0",
  "openai": "^6.18.0",
  "airtable": "^0.12.2",
  "falkordb": "^0.4.0",
  "ws": "^8.18.0"
}
```

`@anthropic-ai/sdk` and `openai` are already in package.json. `airtable` and `falkordb` are new dependencies required by the Venezia expansion.

---

## IMPORT GRAPH

```
citizen-router.js
  <- @anthropic-ai/sdk (Anthropic)
  <- openai (OpenAI — for STT/TTS)
  <- ./venice-state.js (getCitizenById, getDistrictEvents, getRelationship)
  <- ./physics-bridge.js (queryBeliefs)
  <- fs (readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync)
  <- path (join)

venice-state.js
  <- airtable (Airtable)

physics-bridge.js
  <- falkordb (FalkorDB)

index.js
  <- ./citizen-router.js (routeCitizenConversation)
  <- ./venice-state.js (startSync, getState)
```

---

## ANTHROPIC SDK USAGE

The citizen mind module uses the Anthropic SDK directly (not OpenAI). Each citizen conversation is a single Claude API call with a citizen-specific system prompt and assembled context.

### Client Initialization

```js
// citizen-router.js

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model selection: claude-sonnet for conversation (fast, cheap).
// claude-opus for memory summarization (higher quality, rare calls).
const CONVERSATION_MODEL = 'claude-sonnet-4-20250514';
const SUMMARY_MODEL = 'claude-sonnet-4-20250514';
const MAX_CONVERSATION_TOKENS = 300;
const MAX_SUMMARY_TOKENS = 100;
const CONVERSATION_TEMPERATURE = 0.8;
```

### Exact API Call Format

```js
// citizen-router.js

/**
 * Call Claude API as a citizen.
 *
 * @param {string} systemPrompt - Citizen's CLAUDE.md content
 * @param {string} contextBlock - Assembled context (see ALGORITHM_Mind A1)
 * @returns {Promise<string>} Citizen's spoken response text
 */
async function callCitizenLLM(systemPrompt, contextBlock) {
  const response = await anthropic.messages.create({
    model: CONVERSATION_MODEL,
    max_tokens: MAX_CONVERSATION_TOKENS,
    temperature: CONVERSATION_TEMPERATURE,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: contextBlock,
      },
    ],
  });

  // Extract text from response content blocks
  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.text?.trim() || '';
}

/**
 * Generate a memory summary from the citizen's perspective.
 * Uses a separate, cheaper LLM call.
 *
 * @param {string} citizenName
 * @param {string} socialClass
 * @param {Array<{ role: string, text: string }>} conversationTurns
 * @returns {Promise<string>}
 */
async function generateMemorySummary(citizenName, socialClass, conversationTurns) {
  const formatted = conversationTurns
    .map(t => `${t.role}: ${t.text}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: MAX_SUMMARY_TOKENS,
    temperature: 0.5,
    messages: [
      {
        role: 'user',
        content: `Summarize this conversation in 1-2 sentences from the perspective of ${citizenName}, a ${socialClass} citizen of Venice. Focus on: what was discussed, how you felt about it, what you think of this person.\n\nConversation:\n${formatted}`,
      },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.text?.trim() || 'A brief encounter.';
}
```

---

## CONTEXT ASSEMBLY

### Function Signatures

```js
// citizen-router.js

/**
 * Assemble the full context block for a citizen conversation.
 * Five data sources converge into a single string sent as the user message.
 * Total budget: ~2000 tokens.
 *
 * @param {string} citizenId - Airtable record ID
 * @param {string} visitorId - Visitor's session/identity ID
 * @param {string} visitorSpeech - Transcribed speech text
 * @returns {Promise<{ systemPrompt: string, contextBlock: string }>}
 */
async function assembleCitizenContext(citizenId, visitorId, visitorSpeech) {
  // Load all five sources in parallel
  const [identity, memories, economic, beliefs, world] = await Promise.all([
    loadCitizenIdentity(citizenId),
    loadVisitorMemories(citizenId, visitorId),
    loadEconomicState(citizenId),
    loadBeliefGraph(citizenId),
    loadWorldContext(citizenId),
  ]);

  const mood = computeCitizenMood(economic, identity.fields);
  const trustScore = await getTrustScore(identity.username, visitorId);
  const relationshipNotes = await getRelationshipNotes(identity.username, visitorId);

  const contextBlock = formatContext({
    identity,
    visitorMemories: memories.visitor,
    hotMemories: memories.hot,
    economicState: economic,
    beliefs,
    recentEvents: world.events,
    timeOfDay: world.timeOfDay,
    mood,
    trustScore,
    relationshipNotes,
    districtTension: world.tension,
    visitorSpeech,
  });

  return {
    systemPrompt: identity.claudeMd,
    contextBlock,
  };
}
```

### Source Loaders

```js
// citizen-router.js

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getState } from './venice-state.js';
import { queryBeliefs } from './physics-bridge.js';

const SERENISSIMA_CITIZENS_DIR = join(
  process.env.HOME || '/home/mind-protocol',
  'serenissima', 'citizens'
);

/**
 * SOURCE 1: Citizen Identity — Airtable + filesystem CLAUDE.md
 *
 * @param {string} citizenId
 * @returns {Promise<{
 *   fields: Object,
 *   username: string,
 *   cascadePath: string,
 *   claudeMd: string,
 * }>}
 */
async function loadCitizenIdentity(citizenId) {
  const state = getState();
  const citizen = state.citizens.get(citizenId);
  if (!citizen) throw new Error(`Citizen ${citizenId} not found in state cache`);

  const username = citizen.fields.Username;
  const cascadePath = join(SERENISSIMA_CITIZENS_DIR, username);

  let claudeMd = '';
  const claudeMdPath = join(cascadePath, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    claudeMd = readFileSync(claudeMdPath, 'utf-8');
  }

  return {
    fields: citizen.fields,
    username,
    cascadePath,
    claudeMd,
  };
}

/**
 * SOURCE 2: Citizen Memory — filesystem .cascade/memories/
 *
 * Reads memory index, filters to visitor-specific and high-heat entries.
 *
 * @param {string} citizenId
 * @param {string} visitorId
 * @returns {Promise<{
 *   visitor: Array<MemoryEntry>,
 *   hot: Array<MemoryEntry>,
 * }>}
 */
async function loadVisitorMemories(citizenId, visitorId) {
  const state = getState();
  const citizen = state.citizens.get(citizenId);
  if (!citizen) return { visitor: [], hot: [] };

  const username = citizen.fields.Username;
  const memoriesDir = join(SERENISSIMA_CITIZENS_DIR, username, '.cascade', 'memories');
  const indexPath = join(memoriesDir, 'index.json');

  if (!existsSync(indexPath)) return { visitor: [], hot: [] };

  /** @type {Array<{ file: string, visitor: string, timestamp: string, heat: number, summary: string }>} */
  let index;
  try {
    index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  } catch {
    return { visitor: [], hot: [] };
  }

  // Filter visitor memories: match by visitor ID, sort by recency, take 10
  const visitorEntries = index
    .filter(entry => entry.visitor === visitorId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

  // Load full memory files for visitor entries (need summary + detail)
  const visitor = visitorEntries.map(entry => {
    try {
      return JSON.parse(readFileSync(entry.file, 'utf-8'));
    } catch {
      return { summary: entry.summary, timestamp: entry.timestamp };
    }
  });

  // High-heat non-visitor memories (preoccupations)
  const hot = index
    .filter(entry => entry.heat > 50 && entry.visitor !== visitorId)
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 5)
    .map(entry => ({ summary: entry.summary, heat: entry.heat }));

  return { visitor, hot };
}

/**
 * SOURCE 3: Economic State — Airtable CITIZENS + ledger
 *
 * @param {string} citizenId
 * @returns {Promise<EconomicState>}
 */
async function loadEconomicState(citizenId) {
  const state = getState();
  const citizen = state.citizens.get(citizenId);
  if (!citizen) return {};

  const fields = citizen.fields;
  const ledger = state.ledgers.get(fields.Username) || {};

  return {
    ducats: fields.Ducats || 0,
    income: ledger.daily_income || 0,
    expenses: ledger.daily_expenses || 0,
    debts: ledger.outstanding_loans || 0,
    employment: ledger.workplace_building || null,
    housing: ledger.home_building || null,
    ownedLands: ledger.owned_lands?.length || 0,
    ownedBuildings: ledger.owned_buildings?.length || 0,
    recentTrades: (ledger.last_activities || []).slice(0, 5),
    activeStraggems: {
      executing: (ledger.stratagems_executed || []).slice(0, 3),
      targetedBy: (ledger.stratagems_targeting || []).slice(0, 3),
    },
  };
}

/**
 * SOURCE 4: Belief Graph — FalkorDB BELIEVES edges + active narratives
 *
 * @param {string} citizenId
 * @returns {Promise<Array<{ content: string, confidence: number, energy: number }>>}
 */
async function loadBeliefGraph(citizenId) {
  const state = getState();
  const citizen = state.citizens.get(citizenId);
  if (!citizen) return [];

  const username = citizen.fields.Username;
  return queryBeliefs(username);
}

/**
 * SOURCE 5: World Context — recent events, time, district tension
 *
 * @param {string} citizenId
 * @returns {Promise<{
 *   events: Array<{ description: string }>,
 *   timeOfDay: string,
 *   tension: number,
 * }>}
 */
async function loadWorldContext(citizenId) {
  const state = getState();
  const citizen = state.citizens.get(citizenId);
  if (!citizen) return { events: [], timeOfDay: 'midday', tension: 0 };

  const position = citizen.fields.Position || { x: 0, z: 0 };
  const district = state.getDistrictForPosition(position);
  const events = state.getDistrictEvents(district, 6); // last 6 hours
  const timeOfDay = state.getVeniceTimeOfDay();
  const tension = state.getDistrictTensionLevel(district);

  return { events, timeOfDay, tension };
}
```

---

## .CASCADE/ FILESYSTEM ACCESS PATTERNS

The mind module reads from and writes to the `.cascade/` directory structure inside each citizen's folder in the `serenissima/citizens/` repository.

### Read Patterns

```
READ: serenissima/citizens/{username}/CLAUDE.md
  When: Every conversation (system prompt)
  Frequency: Once per conversation start
  Size: ~500-2000 bytes
  Cached: No (may be updated externally by KinOS)

READ: serenissima/citizens/{username}/.cascade/memories/index.json
  When: Every conversation (context assembly)
  Frequency: Once per conversation start
  Size: ~10-50KB (186 citizens, ~50 memories each)
  Cached: No (grows with each conversation)

READ: serenissima/citizens/{username}/.cascade/memories/{timestamp}.json
  When: Loading visitor-specific memories
  Frequency: Up to 10 reads per conversation (last 10 encounters)
  Size: ~500 bytes each
  Cached: No
```

### Write Patterns

```
WRITE: serenissima/citizens/{username}/.cascade/memories/{timestamp}.json
  When: After every conversation (even incomplete ones)
  Frequency: Once per conversation end
  Content: MemoryEntry JSON (see format below)
  Mode: Create new file (append-only pattern — never overwrite)

WRITE: serenissima/citizens/{username}/.cascade/memories/index.json
  When: After writing a new memory
  Frequency: Once per conversation end
  Content: Full index array (rewritten with new entry appended)
  Mode: Overwrite (read → append → write)
  Concurrency: Single-writer assumption (one visitor talks to one citizen at a time)
```

### Memory Entry File Format

```json
// serenissima/citizens/marco_contarini/.cascade/memories/2026-03-11T14:22:00.000Z.json
{
  "timestamp": "2026-03-11T14:22:00.000Z",
  "visitor_id": "visitor_abc123",
  "visitor_name": "Nicolas",
  "location": "San Marco",
  "trust_before": 42,
  "trust_after": 44,
  "mood_during": "bitter",
  "turn_count": 5,
  "summary": "A Forestiere asked about the guild fees. I told them what everyone knows. They seemed persistent but not hostile.",
  "key_topics": ["guild_fees", "trade_routes"],
  "emotional_valence": 0.1,
  "incomplete": false,
  "heat": 70
}
```

### Memory Index Format

```json
// serenissima/citizens/marco_contarini/.cascade/memories/index.json
[
  {
    "file": "/home/mind-protocol/serenissima/citizens/marco_contarini/.cascade/memories/2026-03-11T14:22:00.000Z.json",
    "visitor": "visitor_abc123",
    "timestamp": "2026-03-11T14:22:00.000Z",
    "heat": 70,
    "summary": "A Forestiere asked about the guild fees."
  },
  {
    "file": "/home/mind-protocol/serenissima/citizens/marco_contarini/.cascade/memories/2026-03-10T09:15:00.000Z.json",
    "visitor": "visitor_def456",
    "timestamp": "2026-03-10T09:15:00.000Z",
    "heat": 35,
    "summary": "Someone asked for directions to Rialto."
  }
]
```

---

## AIRTABLE SDK CALLS

### Sync Module (serenissima-sync.js)

```js
// serenissima-sync.js

import Airtable from 'airtable';

const base = new Airtable({
  apiKey: process.env.AIRTABLE_PAT,
}).base(process.env.AIRTABLE_BASE_ID || 'appkLmnbsEFAZM5rB');

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch all citizens from Airtable CITIZENS table.
 * Fields: Name, Username, SocialClass, Ducats, Mood, Description,
 *         Strength, Flaw, Drive, Position, CurrentActivity,
 *         HomeDistrict, IsAlive.
 *
 * @returns {Promise<Map<string, AirtableRecord>>}
 */
async function fetchCitizens() {
  const records = new Map();
  await base('CITIZENS')
    .select({
      fields: [
        'Name', 'Username', 'SocialClass', 'Ducats', 'Mood',
        'Description', 'Strength', 'Flaw', 'Drive',
        'Position', 'CurrentActivity', 'HomeDistrict', 'IsAlive',
      ],
      pageSize: 100,
    })
    .eachPage((page, fetchNextPage) => {
      for (const record of page) {
        records.set(record.id, {
          id: record.id,
          fields: record.fields,
        });
      }
      fetchNextPage();
    });
  return records;
}

/**
 * Fetch relationships (trust scores) between citizens.
 * Table: RELATIONSHIPS
 * Fields: Citizen1, Citizen2, TrustScore, Notes.
 *
 * @returns {Promise<Map<string, { trust: number, notes: string }>>}
 */
async function fetchRelationships() {
  const relationships = new Map();
  await base('RELATIONSHIPS')
    .select({
      fields: ['Citizen1', 'Citizen2', 'TrustScore', 'Notes'],
      pageSize: 100,
    })
    .eachPage((page, fetchNextPage) => {
      for (const record of page) {
        const key = `${record.fields.Citizen1}:${record.fields.Citizen2}`;
        relationships.set(key, {
          trust: record.fields.TrustScore || 50,
          notes: record.fields.Notes || '',
        });
      }
      fetchNextPage();
    });
  return relationships;
}

/**
 * Fetch active buildings.
 * Table: BUILDINGS
 * Fields: Name, Type, Category, Owner, Position, District.
 *
 * @returns {Promise<Map<string, AirtableRecord>>}
 */
async function fetchBuildings() {
  const buildings = new Map();
  await base('BUILDINGS')
    .select({
      fields: ['Name', 'Type', 'Category', 'Owner', 'Position', 'District'],
      pageSize: 100,
    })
    .eachPage((page, fetchNextPage) => {
      for (const record of page) {
        buildings.set(record.id, { id: record.id, fields: record.fields });
      }
      fetchNextPage();
    });
  return buildings;
}

/**
 * Fetch recent activities (last 30 minutes).
 * Table: ACTIVITIES
 * Fields: Citizen, ActivityType, StartTime, EndTime, Location, District,
 *         Indoor, Importance, GroupID.
 *
 * @returns {Promise<Array<AirtableRecord>>}
 */
async function fetchRecentActivities() {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const activities = [];
  await base('ACTIVITIES')
    .select({
      fields: [
        'Citizen', 'ActivityType', 'StartTime', 'EndTime',
        'Location', 'District', 'Indoor', 'Importance', 'GroupID',
      ],
      filterByFormula: `IS_AFTER({EndTime}, '${thirtyMinAgo}')`,
      pageSize: 100,
    })
    .eachPage((page, fetchNextPage) => {
      for (const record of page) {
        activities.push({ id: record.id, fields: record.fields });
      }
      fetchNextPage();
    });
  return activities;
}

/**
 * Update trust score in Airtable RELATIONSHIPS table.
 *
 * @param {string} citizen1Username
 * @param {string} citizen2Username
 * @param {number} trustDelta - change to apply
 * @param {string} activityType - e.g. 'visitor_conversation'
 * @param {boolean} success
 * @param {string} notesDetail
 */
async function updateTrustScore(citizen1Username, citizen2Username, trustDelta, activityType, success, notesDetail) {
  const key = `${citizen1Username}:${citizen2Username}`;
  const reverseKey = `${citizen2Username}:${citizen1Username}`;

  // Find existing relationship record
  const records = await base('RELATIONSHIPS')
    .select({
      filterByFormula: `OR(
        AND({Citizen1}='${citizen1Username}', {Citizen2}='${citizen2Username}'),
        AND({Citizen1}='${citizen2Username}', {Citizen2}='${citizen1Username}')
      )`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length > 0) {
    const record = records[0];
    const currentTrust = record.fields.TrustScore || 50;
    const newTrust = Math.max(0, Math.min(100, currentTrust + trustDelta));
    await base('RELATIONSHIPS').update(record.id, {
      TrustScore: newTrust,
      Notes: `${record.fields.Notes || ''}\n[${new Date().toISOString()}] ${activityType}: ${notesDetail}`.trim(),
    });
  } else {
    // Create new relationship
    await base('RELATIONSHIPS').create({
      Citizen1: citizen1Username,
      Citizen2: citizen2Username,
      TrustScore: Math.max(0, Math.min(100, 50 + trustDelta)),
      Notes: `[${new Date().toISOString()}] ${activityType}: ${notesDetail}`,
    });
  }
}

/**
 * Start periodic sync loop.
 * @param {import('./venice-state.js').VeniceState} veniceState
 */
export function startSync(veniceState) {
  async function sync() {
    try {
      const [citizens, relationships, buildings, activities] = await Promise.all([
        fetchCitizens(),
        fetchRelationships(),
        fetchBuildings(),
        fetchRecentActivities(),
      ]);

      veniceState.updateFromSync({ citizens, relationships, buildings, activities });
      console.log(`Airtable sync: ${citizens.size} citizens, ${relationships.size} relationships, ${buildings.size} buildings`);
    } catch (err) {
      console.error('Airtable sync error:', err.message);
    }
  }

  sync(); // Initial sync
  setInterval(sync, SYNC_INTERVAL_MS);
}

export { updateTrustScore };
```

---

## FALKORDB QUERY CLIENT

```js
// physics-bridge.js

import { FalkorDB } from 'falkordb';

let graph = null;

/**
 * Initialize FalkorDB connection.
 * @param {string} host - default 'localhost'
 * @param {number} port - default 6379
 */
export async function initFalkorDB(host = 'localhost', port = 6379) {
  const client = await FalkorDB.connect({ host, port });
  graph = client.selectGraph('blood_ledger');
  console.log('FalkorDB connected: blood_ledger graph');
}

/**
 * Query belief graph for a citizen.
 * Returns top 5 beliefs ranked by confidence * energy.
 *
 * @param {string} citizenUsername
 * @returns {Promise<Array<{ content: string, confidence: number, energy: number }>>}
 */
export async function queryBeliefs(citizenUsername) {
  if (!graph) return [];

  try {
    const result = await graph.query(
      `MATCH (c:Character {name: $name})-[b:BELIEVES]->(n:Narrative)
       RETURN n.content AS content, b.confidence AS confidence, n.energy AS energy
       ORDER BY b.confidence * n.energy DESC
       LIMIT 5`,
      { params: { name: citizenUsername } }
    );

    return result.data.map(row => ({
      content: row.content,
      confidence: row.confidence,
      energy: row.energy,
    }));
  } catch (err) {
    console.error('FalkorDB belief query error:', err.message);
    return [];
  }
}

/**
 * Query active tensions involving a citizen.
 *
 * @param {string} citizenUsername
 * @returns {Promise<Array<{ narrative: string, tension: number }>>}
 */
export async function queryTensions(citizenUsername) {
  if (!graph) return [];

  try {
    const result = await graph.query(
      `MATCH (c:Character {name: $name})-[t:TENSION]->(n:Narrative)
       WHERE n.energy > 0.3
       RETURN n.content AS narrative, t.weight AS tension
       ORDER BY t.weight DESC
       LIMIT 3`,
      { params: { name: citizenUsername } }
    );

    return result.data.map(row => ({
      narrative: row.narrative,
      tension: row.tension,
    }));
  } catch (err) {
    console.error('FalkorDB tension query error:', err.message);
    return [];
  }
}

/**
 * Ensure a Character node exists for a citizen.
 * Called during Airtable sync.
 *
 * @param {string} username
 * @param {Object} properties - { socialClass, ducats, mood }
 */
export async function ensureCharacterNode(username, properties) {
  if (!graph) return;

  try {
    await graph.query(
      `MERGE (c:Character {name: $name})
       SET c.socialClass = $socialClass,
           c.ducats = $ducats,
           c.mood = $mood`,
      {
        params: {
          name: username,
          socialClass: properties.socialClass || '',
          ducats: properties.ducats || 0,
          mood: properties.mood || 'neutral',
        },
      }
    );
  } catch (err) {
    console.error('FalkorDB ensureCharacterNode error:', err.message);
  }
}
```

---

## MEMORY WRITE FORMAT

```js
// citizen-router.js

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Write a memory entry after a conversation.
 *
 * @param {Object} citizen - { username, cascadePath }
 * @param {string} visitorId
 * @param {string} visitorName
 * @param {Array<{ role: string, text: string }>} turns
 * @param {Object} mood - { complex_mood, intensity }
 * @param {number} trustBefore
 * @param {number} trustAfter
 * @param {string} district
 * @param {boolean} incomplete - conversation was interrupted
 * @returns {Promise<Object>} The written memory entry
 */
async function writeMemory(citizen, visitorId, visitorName, turns, mood, trustBefore, trustAfter, district, incomplete = false) {
  const memoriesDir = join(citizen.cascadePath, '.cascade', 'memories');
  if (!existsSync(memoriesDir)) {
    mkdirSync(memoriesDir, { recursive: true });
  }

  // Generate memory summary via LLM
  const summary = await generateMemorySummary(
    citizen.fields?.Name || citizen.username,
    citizen.fields?.SocialClass || 'Popolani',
    turns
  );

  // Determine heat based on emotional intensity and conversation length
  let heat;
  const valence = computeConversationValence(turns);
  if (Math.abs(valence) > 0.7) {
    heat = 90; // Intense encounters stay in active memory
  } else if (turns.length > 5) {
    heat = 70; // Long conversations are remembered
  } else {
    heat = 50; // Brief encounters start in middle tier
  }

  const timestamp = new Date().toISOString();
  const memoryEntry = {
    timestamp,
    visitor_id: visitorId,
    visitor_name: visitorName || 'unknown Forestiere',
    location: district,
    trust_before: trustBefore,
    trust_after: trustAfter,
    mood_during: mood.complex_mood,
    turn_count: turns.length,
    summary,
    key_topics: extractTopics(turns),
    emotional_valence: valence,
    incomplete,
    heat,
  };

  // Write memory file
  const filePath = join(memoriesDir, `${timestamp}.json`);
  writeFileSync(filePath, JSON.stringify(memoryEntry, null, 2));

  // Update index
  const indexPath = join(memoriesDir, 'index.json');
  let index = [];
  if (existsSync(indexPath)) {
    try {
      index = JSON.parse(readFileSync(indexPath, 'utf-8'));
    } catch { /* start fresh */ }
  }

  // Append new entry
  index.push({
    file: filePath,
    visitor: visitorId,
    timestamp,
    heat,
    summary: summary.substring(0, 100),
  });

  // Heat decay: reduce heat of all other memories by 1
  for (const entry of index) {
    if (entry.file !== filePath) {
      entry.heat = Math.max(0, entry.heat - 1);
    }
  }

  writeFileSync(indexPath, JSON.stringify(index, null, 2));

  return memoryEntry;
}

/**
 * Extract key topics from conversation turns.
 * Simple keyword extraction (V1). Replace with NLP in V2.
 *
 * @param {Array<{ role: string, text: string }>} turns
 * @returns {Array<string>}
 */
function extractTopics(turns) {
  const allText = turns.map(t => t.text).join(' ').toLowerCase();
  const topicKeywords = [
    'guild', 'trade', 'ducats', 'money', 'debt', 'rent', 'tax',
    'council', 'doge', 'senate', 'election', 'war', 'plague',
    'family', 'marriage', 'death', 'birth', 'church', 'god',
    'work', 'job', 'food', 'home', 'ship', 'cargo',
    'secret', 'plot', 'revenge', 'trust', 'betrayal',
  ];
  return topicKeywords.filter(k => allText.includes(k));
}

/**
 * Compute average emotional valence of a conversation.
 * Positive = warm/friendly. Negative = hostile/cold.
 *
 * @param {Array<{ role: string, text: string }>} turns
 * @returns {number} -1.0 to +1.0
 */
function computeConversationValence(turns) {
  // V1: simple keyword sentiment. Replace with LLM classification in V2.
  const text = turns.map(t => t.text).join(' ').toLowerCase();
  const positive = ['thank', 'help', 'friend', 'trust', 'good', 'please', 'kind', 'welcome'];
  const negative = ['hate', 'enemy', 'liar', 'cheat', 'kill', 'steal', 'curse', 'leave'];
  const posCount = positive.filter(w => text.includes(w)).length;
  const negCount = negative.filter(w => text.includes(w)).length;
  const total = posCount + negCount;
  if (total === 0) return 0;
  return (posCount - negCount) / total;
}
```

---

## TRUST UPDATE INTEGRATION

```js
// citizen-router.js

import { updateTrustScore } from './serenissima-sync.js';

/** Trust score constants (from ALGORITHM_Mind A7) */
const TRUST = {
  MINOR_POSITIVE:    0.2,
  SUCCESS_SIMPLE:    1.0,
  SUCCESS_MEDIUM:    2.0,
  SUCCESS_HIGH:      5.0,
  FAILURE_SIMPLE:   -1.0,
  FAILURE_MEDIUM:   -2.0,
  FAILURE_HIGH:     -5.0,
  RAW_POINT_SCALE:   0.1,
};

/**
 * Compute trust delta and persist to Airtable.
 *
 * @param {string} citizenUsername
 * @param {string} visitorId
 * @param {Array<{ role: string, text: string }>} turns
 * @param {Object} mood
 * @returns {Promise<{ trustBefore: number, trustAfter: number, delta: number }>}
 */
async function updateTrustAfterConversation(citizenUsername, visitorId, turns, mood) {
  const state = getState();
  const trustBefore = state.getTrustScore(citizenUsername, visitorId);

  // Base delta: just showing up
  let delta = TRUST.MINOR_POSITIVE;

  // Assess conversation quality (V1: heuristic based on turn count + valence)
  const valence = computeConversationValence(turns);
  if (turns.length >= 5 && valence > 0.3) {
    delta += TRUST.SUCCESS_MEDIUM;
  } else if (turns.length >= 3 && valence > 0) {
    delta += TRUST.SUCCESS_SIMPLE;
  } else if (turns.length === 1) {
    delta += TRUST.FAILURE_SIMPLE; // Abruptly short
  } else if (valence < -0.3) {
    delta += TRUST.FAILURE_MEDIUM;
  }

  // Apply asymptotic scaling: gains shrink near 100, losses shrink near 0
  const scaledDelta = delta * TRUST.RAW_POINT_SCALE * (
    delta > 0 ? (100 - trustBefore) / 100 : trustBefore / 100
  );

  const trustAfter = Math.max(0, Math.min(100, trustBefore + scaledDelta));
  const success = delta > 0;

  // Persist to Airtable
  await updateTrustScore(
    citizenUsername,
    visitorId,
    scaledDelta,
    'visitor_conversation',
    success,
    `mood:${mood.complex_mood},turns:${turns.length},valence:${valence.toFixed(2)}`
  );

  return { trustBefore, trustAfter, delta: scaledDelta };
}
```

---

## WEBSOCKET MESSAGE FORMAT FOR CONVERSATION STATE

### Server -> Client Messages

```js
// Sent when a citizen begins speaking (text + audio will follow)
{
  type: 'citizen_speak_start',
  data: {
    citizenId: 'rec_abc123',
    citizenName: 'Marco Contarini',
    text: 'Cosa vuoi, straniero? Non ho tempo per i Forestieri.',
    mood: 'angry',
    turnNumber: 1,
  }
}

// Sent as TTS audio chunks arrive (streaming)
{
  type: 'citizen_speak_audio',
  data: {
    citizenId: 'rec_abc123',
    chunk: '<base64 mp3 data>',
    index: 1,
    format: 'audio/mpeg',
  }
}

// Sent when citizen finishes speaking
{
  type: 'citizen_speak_end',
  data: {
    citizenId: 'rec_abc123',
    totalChunks: 5,
    latencyMs: 1850,
  }
}

// Sent when conversation state changes
{
  type: 'citizen_conversation_state',
  data: {
    citizenId: 'rec_abc123',
    state: 'SPEAKING',     // IDLE | AWARE | LISTENING | THINKING | SPEAKING | CONVERSING | ENDING
    visitorId: 'visitor_xyz',
    turnCount: 3,
    timeoutSeconds: 30,    // null when not in CONVERSING state
  }
}

// Sent when a citizen becomes aware of the visitor
{
  type: 'citizen_awareness',
  data: {
    citizenId: 'rec_abc123',
    aware: true,            // false when visitor leaves range
    distance: 12.5,         // meters
  }
}
```

### Client -> Server Messages

```js
// Visitor speaks to a citizen (audio + optional target)
{
  type: 'visitor_speech',
  data: {
    audio: '<base64 webm/opus>',
    targetCitizenId: 'rec_abc123',  // null = auto-detect nearest FULL-tier citizen
  }
}

// Visitor position update (used for proximity detection)
// Already exists as 'position' message in current protocol.
// citizen-router.js reads visitor positions from venice-state.js.
```

---

## COMPLETE CONVERSATION FLOW (INTEGRATION WITH INDEX.JS)

```js
// citizen-router.js — main export

/**
 * Route an incoming visitor speech to the appropriate citizen.
 * Called from index.js WebSocket 'visitor_speech' handler.
 *
 * @param {Buffer} audioBuffer - raw audio from visitor mic
 * @param {string} visitorId - visitor's session ID
 * @param {string|null} targetCitizenId - explicit target or null for auto-detect
 * @param {{ x: number, y: number, z: number }} visitorPosition
 * @param {function} send - send(jsonObject) to the visitor's WebSocket
 * @param {function} broadcast - broadcast(jsonObject) to all clients in room
 * @returns {Promise<void>}
 */
export async function routeCitizenConversation(audioBuffer, visitorId, targetCitizenId, visitorPosition, send, broadcast) {
  const startTime = Date.now();

  // ── 1. STT ──────────────────────────────────────────────
  const transcription = await transcribeAudio(audioBuffer);
  if (!transcription) return;

  // ── 2. Identify target citizen ──────────────────────────
  let citizenId = targetCitizenId;
  if (!citizenId) {
    citizenId = findNearestFullTierCitizen(visitorPosition, 15.0);
  }
  if (!citizenId) return; // No citizen in range

  // ── 3. Notify clients: citizen is thinking ──────────────
  broadcast({
    type: 'citizen_conversation_state',
    data: {
      citizenId,
      state: 'THINKING',
      visitorId,
      turnCount: getConversationTurnCount(citizenId, visitorId),
      timeoutSeconds: null,
    },
  });

  // ── 4. Assemble context + call Claude ───────────────────
  const { systemPrompt, contextBlock } = await assembleCitizenContext(
    citizenId, visitorId, transcription
  );

  const responseText = await callCitizenLLM(systemPrompt, contextBlock);
  if (!responseText) return;

  const llmMs = Date.now() - startTime;

  // ── 5. Notify clients: citizen is speaking ──────────────
  const state = getState();
  const citizen = state.citizens.get(citizenId);
  const citizenName = citizen?.fields?.Name || 'Unknown';

  send({
    type: 'citizen_speak_start',
    data: {
      citizenId,
      citizenName,
      text: responseText,
      mood: citizen?.fields?.Mood || 'neutral',
      turnNumber: getConversationTurnCount(citizenId, visitorId) + 1,
    },
  });

  broadcast({
    type: 'citizen_conversation_state',
    data: {
      citizenId,
      state: 'SPEAKING',
      visitorId,
      turnCount: getConversationTurnCount(citizenId, visitorId) + 1,
      timeoutSeconds: null,
    },
  });

  // ── 6. TTS streaming ───────────────────────────────────
  await streamCitizenTTS(citizenId, responseText, citizen?.fields?.VoiceId, send);

  // ── 7. Persist memory + update trust ────────────────────
  const identity = await loadCitizenIdentity(citizenId);
  const mood = computeCitizenMood(
    await loadEconomicState(citizenId),
    identity.fields
  );

  const turns = getConversationTurns(citizenId, visitorId);
  turns.push({ role: 'visitor', text: transcription });
  turns.push({ role: 'citizen', text: responseText });

  const { trustBefore, trustAfter } = await updateTrustAfterConversation(
    identity.username, visitorId, turns, mood
  );

  await writeMemory(
    identity, visitorId, null, turns, mood,
    trustBefore, trustAfter,
    state.getDistrictForPosition(citizen?.fields?.Position),
    false
  );

  // ── 8. Set CONVERSING state with timeout ────────────────
  broadcast({
    type: 'citizen_conversation_state',
    data: {
      citizenId,
      state: 'CONVERSING',
      visitorId,
      turnCount: turns.length,
      timeoutSeconds: 30,
    },
  });

  setConversationTimeout(citizenId, visitorId, 30000, broadcast);
}
```

### Integration in index.js

```js
// src/server/index.js — additions to WebSocket message handler

import { routeCitizenConversation } from './citizen-router.js';
import { startSync } from './serenissima-sync.js';
import { VeniceState } from './venice-state.js';
import { initFalkorDB } from './physics-bridge.js';

// Initialize at startup
const veniceState = new VeniceState();
startSync(veniceState);
initFalkorDB().catch(err => console.warn('FalkorDB not available:', err.message));

// In WebSocket message handler, add case:
case 'visitor_speech': {
  if (!citizenId || !msg.data?.audio) break;
  const audioBuffer = Buffer.from(msg.data.audio, 'base64');
  const citizen = citizens.get(citizenId);
  const send = (obj) => ws.send(JSON.stringify(obj));
  const broadcastToRoom = (obj) => roomManager.broadcastFromCitizen(citizenId, obj);

  routeCitizenConversation(
    audioBuffer,
    citizenId,
    msg.data.targetCitizenId || null,
    citizen?.position || { x: 0, y: 1.7, z: 0 },
    send,
    broadcastToRoom,
  ).catch(err => console.error('Citizen conversation error:', err.message));
  break;
}
```

---

## CONVERSATION STATE MANAGEMENT

```js
// citizen-router.js — internal state tracking

/** @type {Map<string, { visitorId: string, turns: Array, timeout: NodeJS.Timeout, startTime: number }>} */
const activeConversations = new Map();

const MAX_TURNS = 10;
const CONVERSATION_TIMEOUT_MS = 30000;

/**
 * Get or create conversation state.
 */
function getConversationTurns(citizenId, visitorId) {
  const key = `${citizenId}:${visitorId}`;
  const conv = activeConversations.get(key);
  return conv ? conv.turns : [];
}

function getConversationTurnCount(citizenId, visitorId) {
  return getConversationTurns(citizenId, visitorId).length;
}

/**
 * Set a conversation timeout. When it fires, the citizen ends the conversation.
 */
function setConversationTimeout(citizenId, visitorId, timeoutMs, broadcast) {
  const key = `${citizenId}:${visitorId}`;
  let conv = activeConversations.get(key);
  if (!conv) {
    conv = { visitorId, turns: [], timeout: null, startTime: Date.now() };
    activeConversations.set(key, conv);
  }

  // Clear existing timeout
  if (conv.timeout) clearTimeout(conv.timeout);

  // Set new timeout
  conv.timeout = setTimeout(async () => {
    // End conversation
    broadcast({
      type: 'citizen_conversation_state',
      data: {
        citizenId,
        state: 'ENDING',
        visitorId,
        turnCount: conv.turns.length,
        timeoutSeconds: null,
      },
    });

    // After a beat, return to IDLE
    setTimeout(() => {
      broadcast({
        type: 'citizen_conversation_state',
        data: { citizenId, state: 'IDLE', visitorId: null, turnCount: 0, timeoutSeconds: null },
      });
      activeConversations.delete(key);
    }, 2000);
  }, timeoutMs);

  // Check max turns
  if (conv.turns.length >= MAX_TURNS * 2) {
    clearTimeout(conv.timeout);
    conv.timeout = setTimeout(() => {
      broadcast({
        type: 'citizen_conversation_state',
        data: { citizenId, state: 'ENDING', visitorId, turnCount: conv.turns.length, timeoutSeconds: null },
      });
      activeConversations.delete(key);
    }, 1000);
  }
}
```

---

## STT AND TTS HELPERS

```js
// citizen-router.js

import OpenAI from 'openai';
import { createReadStream, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const openai = new OpenAI();
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

/**
 * Transcribe audio via Whisper.
 * @param {Buffer} audioBuffer
 * @returns {Promise<string|null>}
 */
async function transcribeAudio(audioBuffer) {
  const tempPath = join(tmpdir(), `citizen_voice_${Date.now()}.webm`);
  writeFileSync(tempPath, audioBuffer);

  try {
    const result = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
    });
    return result.text?.trim() || null;
  } catch (err) {
    console.error('STT error:', err.message);
    return null;
  }
}

/**
 * Stream TTS audio for a citizen's speech.
 * Uses ElevenLabs with citizen-specific voice ID, falls back to OpenAI.
 *
 * @param {string} citizenId
 * @param {string} text
 * @param {string|null} voiceId - ElevenLabs voice ID (null = default)
 * @param {function} send - send(jsonObject) to visitor WebSocket
 */
async function streamCitizenTTS(citizenId, text, voiceId, send) {
  const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  const effectiveVoiceId = voiceId || defaultVoiceId;
  let chunksStreamed = 0;

  if (ELEVENLABS_API_KEY) {
    try {
      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            output_format: 'mp3_44100_128',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (ttsRes.ok && ttsRes.body) {
        const reader = ttsRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunksStreamed++;
          send({
            type: 'citizen_speak_audio',
            data: {
              citizenId,
              chunk: Buffer.from(value).toString('base64'),
              index: chunksStreamed,
              format: 'audio/mpeg',
            },
          });
        }
      }
    } catch (err) {
      console.error('Citizen TTS stream error:', err.message);
    }
  }

  // Fallback: OpenAI TTS
  if (chunksStreamed === 0) {
    try {
      const ttsRes = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: text,
        response_format: 'mp3',
      });
      const ttsBuffer = Buffer.from(await ttsRes.arrayBuffer());
      chunksStreamed = 1;
      send({
        type: 'citizen_speak_audio',
        data: {
          citizenId,
          chunk: ttsBuffer.toString('base64'),
          index: 1,
          format: 'audio/mpeg',
        },
      });
    } catch (err) {
      console.error('Citizen TTS fallback error:', err.message);
    }
  }

  send({
    type: 'citizen_speak_end',
    data: {
      citizenId,
      totalChunks: chunksStreamed,
      latencyMs: 0, // caller tracks total latency
    },
  });
}
```

---

## PROXIMITY DETECTION

```js
// citizen-router.js

import { getState } from './venice-state.js';

/**
 * Find the nearest FULL-tier citizen within range of the visitor.
 * Used for auto-targeting when visitor doesn't specify a citizen.
 *
 * FULL-tier determination: citizen must be outdoor, alive, and within
 * the FULL tier distance threshold (20m effective distance).
 *
 * @param {{ x: number, y: number, z: number }} visitorPosition
 * @param {number} maxRange - meters
 * @returns {string|null} citizenId or null
 */
function findNearestFullTierCitizen(visitorPosition, maxRange) {
  const state = getState();
  let nearest = null;
  let nearestDist = Infinity;

  for (const [id, citizen] of state.citizens) {
    if (!citizen.fields.IsAlive) continue;
    const pos = citizen.fields.Position;
    if (!pos) continue;

    const dx = pos.x - visitorPosition.x;
    const dy = (pos.y || 0) - visitorPosition.y;
    const dz = pos.z - visitorPosition.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < maxRange && dist < nearestDist) {
      nearestDist = dist;
      nearest = id;
    }
  }

  return nearest;
}
```

---

## INTERACTIONS

| Module | Import From | Function Called | Purpose |
|--------|-------------|----------------|---------|
| `index.js` | `citizen-router.js` | `routeCitizenConversation()` | Entry point for visitor speech |
| `citizen-router.js` | `venice-state.js` | `getState()`, `getCitizenById()` | Read cached Airtable data |
| `citizen-router.js` | `venice-state.js` | `getDistrictEvents()`, `getTrustScore()` | World context for assembly |
| `citizen-router.js` | `physics-bridge.js` | `queryBeliefs()` | FalkorDB belief graph |
| `citizen-router.js` | `serenissima-sync.js` | `updateTrustScore()` | Write trust changes to Airtable |
| `citizen-router.js` | `@anthropic-ai/sdk` | `anthropic.messages.create()` | Claude API for conversation |
| `citizen-router.js` | `openai` | `audio.transcriptions.create()` | Whisper STT |
| `citizen-router.js` | `fs` | `readFileSync()`, `writeFileSync()` | .cascade/ memory read/write |
| `serenissima-sync.js` | `airtable` | `base('CITIZENS').select()` | Periodic data fetch |
| `serenissima-sync.js` | `venice-state.js` | `updateFromSync()` | Populate in-memory cache |
| `physics-bridge.js` | `falkordb` | `graph.query()` | Cypher queries for beliefs |
