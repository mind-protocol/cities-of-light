# BEHAVIORS -- Deployment

> What deployment means for the visitor. Not CI/CD pipelines or Docker
> configuration. What the visitor experiences when they access Venice, from
> different devices, and when the system updates underneath them.

---

## B1. One URL to Enter the World

GIVEN the visitor knows the URL `venezia.mindprotocol.ai`
WHEN they type it into a browser
THEN they are in Venice. No download. No install. No account creation.
No app store. No sideloading. No invite code. One URL. That is the
distribution strategy.

GIVEN the visitor navigates to the URL on a non-WebXR device (old phone,
old browser)
THEN they see Venice in flat 3D. They can look around with mouse or touch.
They can speak to citizens. The experience is diminished but functional.
No error page. No "your device is not supported" wall.

---

## B2. HTTPS: The Invisible Requirement

GIVEN the visitor types the URL into the browser
THEN the connection is HTTPS. The browser shows the lock icon. The visitor
does not think about this.

Without HTTPS, nothing works:
- WebXR will not initialize. No "Enter VR" button.
- `getUserMedia` will not grant microphone access. Push-to-talk is dead.
- The visitor sees a flat webpage with no interactivity.

### Certificate Failure

GIVEN the TLS certificate expires
THEN the browser shows a security warning. On Quest 3, a full-page
interstitial that most visitors will not bypass. This is a total outage --
equivalent to the server being offline. Certificate renewal must be
automated and monitored.

---

## B3. Load Time: The First Seconds

### Broadband (20+ Mbps, < 50ms latency)

```
T+0.0s   Browser begins loading
T+0.5s   HTML parsed, JS bundle loading
T+1.5s   Three.js initializes, skybox and water visible
T+2.0s   WebSocket connects, citizen state received
T+2.5s   Buildings visible (LOD2 first, LOD0 progressively)
T+3.0s   Citizens visible and moving
T+3.5s   Ambient audio playing
T+4.0s   Fully interactive
```

### Slow Connection (5 Mbps, 150ms latency)

Same sequence, stretched to ~8 seconds total.

### What the Visitor Sees During Load

Something is always visible. The load sequence is designed as an arrival:
1. Sky and water first (tiny assets, near-instant)
2. Building silhouettes (LOD3 merged meshes, small)
3. Building detail fills in (LOD0 loaded progressively, not blocking)
4. Citizens appear (data from WebSocket)
5. Audio begins (ambient loops, streamed)

No black screen after initial page load. No progress bar. No spinner.
The world assembles around the visitor. This feels like arriving, not waiting.

---

## B4. Offline Behavior

### No Internet

GIVEN the visitor has no internet connection
THEN the browser shows its standard offline page. There is no offline mode.
Venice requires a live server. Citizens are powered by LLM calls. The economy
runs on a server. A frozen world is worse than no world.

### Connection Lost Mid-Session

The 3D scene remains visible. Water continues to animate (shader-based).
Ambient audio loops locally. But citizens freeze. Push-to-talk does nothing.
The world becomes a beautiful, silent, still painting.

WHEN connectivity returns
THEN the WebSocket reconnects within seconds. Citizens resume. Voice works.
The world comes back to life.

---

## B5. Updates Without Disruption

### Server-Side Updates

GIVEN the team pushes a new server version
THEN connected visitors experience a brief pause (5-30 seconds): citizens
freeze, voice fails silently, WebSocket disconnects and auto-reconnects,
state resyncs. No browser refresh needed. No "update available" banner.
The visitor resumes where they were.

### Client-Side Updates

Existing visitors continue on the old client until they refresh or return.
New visitors get the new client.

GIVEN the update is critical (security, breaking protocol)
THEN the server sends a `client_update_required` message. The client shows
a subtle pulsing dot in peripheral vision. Removing and replacing the
headset triggers a reload. No forced interruption.

### World State Updates

Economic simulation updates flow through WebSocket in real time. A citizen
happy at session start may be distressed 30 minutes later. This is not an
"update" -- it is the world living.

---

## B6. Geographic Latency

| Visitor Location  | Network RTT  | Voice Total   | Perception                    |
|-------------------|-------------|---------------|-------------------------------|
| Same region (EU)  | Under 30ms   | 1.5-2.0s      | Natural thinking pause         |
| Cross-continent   | 100-150ms    | 1.8-2.5s      | Slightly more thoughtful citizen |
| Asia/Oceania      | 250-400ms    | 2.5-3.5s      | Noticeable pause, edge of natural |

Network latency is absorbed into LLM thinking time. The visitor perceives a
thoughtful citizen, not lag. Position sync for multi-visitor uses client-side
interpolation to mask delay.

---

## B7. Entry Points: VR, Desktop, Mobile

### Quest 3 (Primary)

Page loads in 2D. "Enter VR" button appears (WebXR standard). Click with
controller. Full immersive VR: head tracking, hand tracking, spatial audio,
push-to-talk via controller. The complete experience.

### Desktop Browser

Standard 3D viewport. WASD + mouse. Push-to-talk via spacebar. Spatial audio
through headphones (stereo panning). Citizens respond. No "works best in VR"
banner. Desktop is first-class for what it is.

### Mobile Browser

Simplified 3D viewport. Touch to look. On-screen controls for movement.
Push-to-talk via screen button. Adaptive quality may engage Tier 2-3
degradation on lower-end phones. Sparser but present.

### Unsupported Browsers

A static page with a brief description and browser recommendation. No broken
3D scene. No JavaScript errors. A clean fallback.

---

## B8. What the Visitor Should Never Experience

**Installation prompts.** No "Add to Home Screen." No PWA banners. Venice
is a website. You visit it.

**App store gatekeeping.** Never distributed through Meta Quest Store, App
Store, or Play Store. No review process. No 30% platform fee. The URL is
the only distribution channel.

**Regional blocking.** Available worldwide. No geo-restrictions. Same URL,
same world, same citizens, regardless of physical location.

**Maintenance windows.** No "Server is down for maintenance." Updates deploy
via rolling restart. Maximum 30-second reconnection pause. Scheduled downtime
does not exist.

**Stale experiences.** Two visitors accessing Venice 10 minutes apart both
see the same current world state. Static assets may be cached; world state
is always live via WebSocket.

---

## B9. Testable Scenarios

### Zero-Friction Entry
1. Give the URL to someone who has never seen Venice.
2. They type it into Quest 3 browser.
3. PASS: Standing in Venice with citizens visible under 30 seconds total
   (including page load and "Enter VR" click).
4. PASS: Zero prompts, logins, or install steps.

### Desktop Parity
1. Open the URL on desktop Chrome. Walk with WASD + mouse.
2. Speak to a citizen via push-to-talk.
3. PASS: Citizen responds with voice. No "requires VR" message.

### Mobile Graceful Degradation
1. Open the URL on a mid-range Android phone.
2. PASS: Scene renders without crash. 30fps minimum. Citizens visible.

### Update Continuity
1. Connect on Quest 3. Team deploys new server version.
2. PASS: World pauses under 30 seconds, resumes. No manual refresh.
   Visitor position preserved.

### Certificate Monitoring
1. PASS: TLS certificate has 30+ days remaining.
2. PASS: Auto-renewal configured and verified.
3. FAIL: Under 7 days remaining with unverified renewal is critical.

### Geographic Access
1. VPN from North America, Asia, Europe. Navigate to URL.
2. PASS: Venice accessible from all regions.
3. PASS: Voice under 3s (EU/NA), under 4s (Asia).
