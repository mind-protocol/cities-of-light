# BEHAVIORS -- Server

> What the server does that the visitor experiences. Observable effects from the
> visitor's perspective. The visitor never sees the server. They see what the
> server makes possible.

---

## B1. Connection: Entering the World

### First Connection

GIVEN the visitor opens `venezia.mindprotocol.ai` in the Quest 3 browser
WHEN the page loads
THEN a WebSocket connection is established automatically. Citizens appear
within 1-2 seconds. The 3D scene renders immediately with static geometry
(buildings, water, sky). Citizens populate as the WebSocket delivers state.

No "Connecting..." screen. No login. No account creation. The visitor is
assigned an anonymous identity -- a Forestiere, a foreigner. The world does
not ask who they are. Citizens will.

### Initial State Load

GIVEN the WebSocket connection succeeds and the server sends `welcome`
THEN the client receives the visitor's citizen ID, their room assignment,
and all current citizen positions, tiers, and states in a single burst.
180 citizens appear at once, not trickling in one by one.

---

## B2. Real-Time Updates: The Living City

### Citizen Movement

GIVEN the visitor is standing in the Rialto market
WHEN a citizen walks past at 5 meters
THEN the citizen's position updates smoothly. Movement appears fluid even
though position data arrives at 20 updates per second. No teleporting,
no stuttering.

Citizens continue moving beyond the visitor's immediate area. The world
does not stop simulating when the visitor is not looking.

### World Events

GIVEN a tension event triggers (a fight breaks out at Rialto)
THEN every visitor in that district sees it simultaneously. Citizens react.
Ambient audio shifts. The event is live.

GIVEN the visitor is in a different district
THEN they do not see the event directly. They learn about it later through
citizen gossip. News propagation is narrative, not broadcast.

### Citizen State Changes

GIVEN a citizen's mood drops from content to distressed
THEN the citizen's behavior visibly shifts: slower movement, different
posture, different conversation tone. The visitor does not see a mood label.
They see a person having a bad day.

---

## B3. Reconnection: Seamless Recovery

### Brief Network Drop (Under 30 Seconds)

GIVEN the visitor's Wi-Fi drops for 5 seconds
WHEN connectivity returns
THEN the WebSocket reconnects automatically. Citizens may freeze briefly,
then catch up. No dialog box. No "Reconnecting..." banner. The world
stuttered and continued.

### Extended Disconnect (Over 30 Seconds)

GIVEN the visitor loses connection for 2 minutes
WHEN they reconnect
THEN the server sends full state. Citizens may have moved significantly.
The visitor sees the current state, not a replay. The world moved on.

### Server Restart

GIVEN the server process restarts (deployment or crash recovery)
THEN the client attempts reconnection every 3 seconds. On success, full
state reloads. The visitor experiences a 5-30 second pause. Their position
is preserved. Citizen conversation memory persists (stored in citizen
memory files, not in the server process). No data is lost.

---

## B4. Multiple Visitors

### Solo Experience (V1)

GIVEN only one visitor is connected
THEN the experience is indistinguishable from single-player. No multiplayer
infrastructure is exposed.

### Multiple Visitors (Future)

GIVEN two visitors are in the same room
THEN they see each other's avatars with real-time head and hand positions.
If Visitor A speaks to a citizen, Visitor B (within 15m) hears both Visitor
A's voice and the citizen's response, spatially positioned.

GIVEN visitors are in different rooms
THEN they cannot see or hear each other. AI citizens exist in all rooms.

---

## B5. Rate Limiting

### Normal Pace

GIVEN the visitor speaks, waits for response, speaks again
THEN every interaction succeeds. Natural conversational rhythm is never
throttled.

### Rapid Speech

GIVEN the visitor sends 5 voice messages in 10 seconds
THEN the first is processed. Subsequent messages queue. The citizen responds
at a measured pace with a 10-second cooldown. The visitor sees a citizen who
finishes one thought before starting another. No error is shown.

### Spam Condition

GIVEN the visitor sends voice faster than 1 every 2 seconds
THEN excess is silently dropped. Other visitors are not affected (rate
limiting is per-visitor).

### LLM Backpressure

GIVEN 3 concurrent LLM calls are running (1 visitor + 2 ambient conversations)
WHEN the visitor speaks
THEN one ambient conversation is deprioritized. Visitor speech always takes
priority. The visitor never waits because AI citizens are chatting.

---

## B6. Session Persistence: Returning After Hours

### The World Advanced

GIVEN the visitor leaves at noon and returns 6 hours later
THEN the world is in its evening state: different lighting, sounds, citizen
positions. The 6 hours happened. A building that was intact may be damaged.
A cheerful citizen may now be worried. The market stall is closed.

The visitor discovers changes through exploration, not through a summary.

### Citizen Memory Persists

GIVEN the visitor discussed grain prices with a baker yesterday
WHEN they return and speak to the same baker
THEN the baker remembers. "You asked about grain yesterday. Prices went up."
Citizen memory survives server restarts.

### Visitor Identity Persists

GIVEN the visitor closes and reopens the browser
THEN their anonymous identity is restored from local storage. Citizens who
know them still know them. Clearing local storage creates a new stranger.

---

## B7. Error States Visible to the Visitor

### Server Unreachable

The visitor sees the 3D scene (static buildings, water, sky) but no citizens.
The city is empty and silent. The client retries every 3 seconds. When the
server becomes available, citizens appear and the world comes alive.
No error dialog.

### Server Under Load

Voice responses may take 3-5 seconds instead of 1.5-2. Citizen movement
continues normally. The world does not freeze. Only voice slows.

### Airtable Sync Failure

The visitor notices nothing. The server uses cached data. Citizens continue
based on last known state. The world does not crash because an external
API returned a 429.

---

## B8. What the Visitor Should Never Experience

**Connection dialogs.** No "Connecting..." No "Connection lost." The world
is either alive or paused. Status is communicated through the world itself.

**Loading screens between areas.** Walking from Rialto to San Marco has no
gate. The entire city exists simultaneously.

**Other visitors' errors.** If Visitor B disconnects, Visitor A sees their
avatar freeze and disappear. No error message. No degradation.

**Data loss.** A server crash loses no data. Identity persists (client-side).
Citizen memories persist (filesystem). World state rebuilds from Airtable.

---

## B9. Testable Scenarios

### Cold Start
1. Clear browser data. Navigate to `venezia.mindprotocol.ai`.
2. PASS: First citizen visible under 5 seconds (broadband), 10 seconds (mobile).
3. PASS: No login, prompt, or dialog appeared.

### Reconnection
1. Connect. Verify citizens visible. Airplane mode 10 seconds. Disable.
2. PASS: Citizens resume within 10 seconds. No error dialog appeared.

### Speech Under Load
1. Speak to a citizen. Note response time.
2. Send 5 rapid push-to-talk messages in 10 seconds.
3. PASS: First response within normal latency. No error shown.

### Return After Absence
1. Speak to a citizen. Close browser. Wait 4 hours. Reopen.
2. PASS: The citizen has moved. Speaking to them, they reference the earlier
   conversation.

### Server Restart Survival
1. Note citizen positions. Restart server. Wait for reconnection.
2. PASS: Visitor in same position. Citizens visible within 30 seconds.
   Previously-met citizen remembers the visitor.
