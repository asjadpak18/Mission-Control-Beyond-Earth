# PROJECT MEMORY — MISSION CONTROL: BEYOND EARTH

> This file is the cross-session memory for this project. Read it first whenever the user
> says "let's work on the game", "continue", "you remember that game", etc. It is the single
> source of truth for project state between conversations (memory does NOT carry over
> automatically — this file is how we fake it).

**Last updated:** 2026-11-15 (session web-8a23945e: font fix, Windows packaging, multiplayer
server heartbeat + sandbox-revert recovery. Prior sessions: web-1cd7d574 workstreams A–D)

---

## 1. What this project is

- **Name:** MISSION CONTROL: BEYOND EARTH
- **Tagline:** Educational space mission design simulator
- **Origin:** Built for the **NASA Space Apps Challenge 2026** (challenge: "Space Mission Design Game")
- **Current version:** **v2.1 — Visual Systems Revision**
- **Made with:** Z.ai (this assistant), in a different account, during a team competition
- **User intent now:** Continue developing it further. Treat this as the canonical working copy.

## 2. Where it lives

| Path | Purpose |
| --- | --- |
| `/home/z/my-project/` | **ACTIVE PROJECT ROOT.** Edit here. The platform auto-runs `bun run dev` on port 3000 and exposes it via the Preview Panel. |
| `/home/z/my-project/upload/Z.ai 7th attempt.tar` | **Canonical lineage** — the user's latest upload (v2.3), promoted to root. |
| `/home/z/my-project/upload/Z.ai 5th attempt.tar` | Full v2.2 **with AI features** (advisor, generate-event, TutorOverlay). The 7th attempt dropped these files — recover from here if the user wants them back. |
| `/home/z/my-project/upload/extracted/` | Pristine 4th-attempt reference (read-only, do not edit) |
| `/home/z/my-project/upload/Mission_Control_Beyond_Earth_Game_Documentation.docx` | Game documentation |
| `/home/z/my-project/agent-ctx/PROJECT_MEMORY.md` | THIS FILE — read first |
| `/home/z/my-project/download/` | Deliverables ("Z.ai 9th attempt.tar", "MissionControl-Windows.zip") |

**Lineage note:** the 7th attempt tar has its OWN git history (fresh init). The 7th attempt
deliberately REPLACED the AI tutor mode with a self-contained "LEARN BASICS" screen
(`learn` phase, `LearnBasicsScreen.tsx`) and added `ProgressScreen.tsx` + `progression.ts`
(achievements). AI advisor / AI events / TutorOverlay files exist ONLY in the 5th attempt tar.

**SANDBOX REVERT INCIDENT (2026-11-15, session web-8a23945e):** between turns the platform
recycled the sandbox and restored an OLD snapshot (pre-promotion root, old .git, download/
wiped — my earlier commits 1875bf7/d24510f/6ec2fe4 were lost). Recovered by re-extracting
`upload/Z.ai 7th attempt.tar` and re-applying every fix (all edits were reproducible from
conversation context). LESSON: cut deliverable artifacts early and often; the upload/ dir
survives recycles, download/ does NOT always survive.

**As of 2026-11-15**, the project was promoted from `game/` subdirectory to the project root
so the platform's auto dev-server picks it up. The standalone `game/` copy was removed;
`upload/extracted/` still holds the pristine original if a reset is ever needed.

**To run the game from inside the chat (what the user asked about on 2026-11-15):**
1. The fullstack-dev platform auto-starts `bun run dev` on port 3000 whenever the project
   root has a valid Next.js setup. If the dev server isn't running, re-run:
   `curl -s https://z-cdn.chatglm.cn/fullstack/init-fullstack.sh | bash`
   (it preserves existing files and just restarts `.zscripts/dev.sh`).
2. Verify the dev server is up: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
   should return `200`.
3. Verify rendering with Agent Browser:
   `agent-browser open http://localhost:3000/ && agent-browser wait --load networkidle && agent-browser errors`
   (should print nothing — no errors).
4. The user views the game via the **Preview Panel** on the right side of the Z.ai web UI,
   or clicks "Open in New Tab" above it. On IM platforms, hand them the
   `https://preview-<bot-id>.space-z.ai/` link.
5. The single Next.js route is `/` (`src/app/page.tsx`) — the whole game is a single-page
   React app that swaps screens via Zustand state.

**Verified working 2026-11-15:** landing page (15 missions listed), single-player mode
toggle, mission briefing screen (Lunar Research Expedition tested — objectives, risk
assessment, scoring breakdown all rendered). No console errors, no hydration warnings.
Multiplayer server (`bun run multiplayer`) is NOT auto-started by the platform — if the
user wants to test multiplayer, start it manually as a mini-service per the fullstack-dev
skill's mini-service rules, OR run `bun run multiplayer` and note that LAN-only coop
won't work from the preview URL (it needs a separate WebSocket port).

## 3. Stack

- **Next.js 16** (App Router, single route at `src/app/page.tsx`)
- **TypeScript 5** (strict, clean `tsc --noEmit`)
- **Tailwind CSS 4** + **shadcn/ui** + Radix UI primitives
- **Zustand** for state + persistence
- **framer-motion** for transitions
- **Bun** as preferred runtime + **Bun WebSocket server** for multiplayer
- **Prisma** (`db/custom.db`, SQLite) — schema in `prisma/schema.prisma`
- Fonts: Orbitron, Space Grotesk, JetBrains Mono
- `z-ai-web-dev-sdk` is a dependency (can be used for AI features)

## 4. Core gameplay loop

`PLAN → DESIGN → VALIDATE → LAUNCH → MANAGE → EVALUATE`

- Pick one of 15 missions (Moon → Mars → NEA → Comet → Venus → Asteroid Belt → Mercury → Sun → Jupiter → Europa → Saturn → Titan → Mars Sample Return → Deep Space)
- Engineer a spacecraft from a 54-component catalogue within a real budget/mass/power/fuel envelope
- Validate flight readiness (errors block launch; warnings don't)
- Fly an 8-stage mission (launch → separation → cruise → navigation → arrival → science → comms → evaluation)
- Manage events with real consequences; deterministic given `(seed, spacecraft, decisions)`
- Earn a score out of 1,000 (primary 400 + secondary 150 + engineering 200 + resource efficiency 150 + decision-making 100)
- Read a full mission report with recommendations

## 5. Game engine architecture (pure, deterministic, tested)

The whole simulation lives in **`src/lib/game/`** and is pure TypeScript with no I/O — same modules
run on both client and multiplayer server.

| File | Lines | Role |
| --- | --- | --- |
| `types.ts` | 442 | Frozen shared data contract (Equipment, Mission, SpacecraftConfig, ResourceSummary, ValidationResult, SimulationResult, multiplayer types) |
| `equipment.ts` | 835 | 54-component catalogue (7 engines, 4 tanks, 8 power, 5 antennas, 6 science, 4 nav, 5 thermal, 9 protection/structure) |
| `missions.ts` | 1284 | 15 missions with objectives (400 primary + 150 secondary), events, environmental conditions |
| `events.ts` | 585 | v2.0 pooled generic + role-tagged events (~27 pooled + mission-specific) |
| `constraints.ts` | 244 | 5 difficulty settings + 12 random constraints (budget cuts, mass limits, redundant comms, banned equipment, science goals) |
| `calculations.ts` | 172 | Deterministic resource math (cost, mass, power balance w/ solar derate, fuel, reliability) |
| `validation.ts` | 355 | Readiness validation (errors vs warnings) |
| `simulation.ts` | 671 | 8-stage engine, event handling, scoring, report generation |
| `multiplayer.ts` | 397 | Pure multiplayer logic: roles, routing, votes, contributions |
| `rng.ts` | 33 | Seeded serializable PRNG (mulberry32) |
| `__tests__/` | — | 182 engine tests; `tests/multiplayer-e2e.ts` adds 22 e2e checks |

Total engine: ~5,018 lines. Total components: ~6,910 lines. Server/tests/store: ~1,522 lines.
**93 TS/TSX files** total across `src server tests scripts`.

## 6. Component layout

```
src/
├── app/                 layout.tsx, page.tsx (single route), globals.css, api/
├── components/
│   ├── game/
│   │   ├── GameApp.tsx             Mode router (single-player phases | multiplayer)
│   │   ├── GameHeader.tsx          Identity + phase stepper
│   │   ├── StarfieldBackground.tsx
│   │   ├── SpacecraftCanvas.tsx    Design Lab visualizer
│   │   ├── MissionVisualizer.tsx   8-stage flight view (970 lines, big)
│   │   ├── MultiplayerApp.tsx      4-player coop flow (1,412 lines, biggest)
│   │   ├── shared.tsx              Stat bars, badges, tooltips
│   │   ├── screens/                6 phase screens (Dashboard, Briefing, Designer, Readiness, Simulation, Report)
│   │   └── spacecraft/
│   │       ├── model.ts            Pure layout engine (config → ordered visual parts)
│   │       ├── parts.tsx           SVG art for every part with live flight states (1,057 lines)
│   │       ├── SpacecraftDiagram.tsx
│   │       └── LaunchScene.tsx     T-3 countdown, ignition, ascent
│   └── ui/             shadcn/ui primitives
├── hooks/              use-mobile.ts, use-toast.ts
├── lib/game/           (see section 5)
└── store/
    ├── gameStore.ts              Single-player session (mode, difficulty, constraints)
    └── multiplayerStore.ts       WebSocket client + session mirror

server/
└── multiplayer-server.ts         Host-authoritative WS server (Bun), 669 lines
```

## 7. v2.0 / v2.1 highlights (don't accidentally regress these)

- **Shared spacecraft component system (v2.1)** — `model.ts` + `parts.tsx` drive the design preview,
  liftoff animation AND mission-event simulation. The rocket you build is the rocket that flies.
  14 model tests pin the config→visuals sync contract.
- **Interactive spacecraft visualizer** — animated SVG, builds as you add/remove components, rotatable.
- **Animated flight view** — every stage has a dedicated scene; events draw overlays (solar storms,
  impacts, faults, comm loss, low fuel, discoveries). All CSS transform/opacity, disabled under
  `prefers-reduced-motion`.
- **15 missions, 54 components, 5 difficulty settings, 12 random constraints, ~27 pooled events.**
- **Four-player cooperative LAN multiplayer** — host-authoritative, role-specific event routing,
  recommend→approve cooperation, team votes, reconnection tokens, host migration.
- **UI accessibility pass** — contrast-audited buttons, focus rings, modal positioning fix.

## 8. How to run it (in this sandbox)

```bash
cd /home/z/my-project               # project lives at the root now
bun install                      # first time only
bun run dev                      # http://localhost:3000
bun test                         # 182 engine tests
bun run test:mp                  # 22 multiplayer e2e checks (spawns real WS server)
bun run lint
bun run build
bunx tsc --noEmit                # full type check
bun run multiplayer              # ws://0.0.0.0:3001 (separate process)
```

Environment:
- `.env` contains `DATABASE_URL=file:/home/z/my-project/db/custom.db`
- `db/custom.db` is the existing SQLite file (24 KB) — keep it, don't blow it away without reason.
- Public assets in `public/images/` (12 destination PNGs + `hero-earth.png`).
- `scripts/generate-destination-art.ts` regenerates the v2.0 destination PNGs from SVG.

## 9. Git state

History is the 7th-attempt tar's own lineage (fresh init, UUID messages) + the recovery
commits made in session web-8a23945e. The OLD pre-promotion root history (v2.0→v2.2 with
AI features) no longer exists in this repo — recover v2.2 AI files from
`upload/Z.ai 5th attempt.tar` if ever needed.

## 10. v2.2 Features (added 2026-11-15, session web-1cd7d574)

> **STATUS CORRECTION:** workstreams A and B below ARE in the current codebase (they came in
> via the user's 7th-attempt upload). Workstreams C and D (AI advisor, AI events,
> TutorOverlay) were **dropped by the user** before uploading the 7th attempt — those files
> live only in `upload/Z.ai 5th attempt.tar`. The 7th attempt replaced tutor mode with a
> self-contained LEARN BASICS screen + Progress/achievements.

Four workstreams were completed and verified in that session:

### A. Polished Flight Visualizer
- **New file:** `src/components/game/spacecraft/scenes/ArrivalScene.tsx` (~510 lines) —
  standalone phased scene component for stage 5 (arrival). Orbiter/flyby:
  approach → capture_burn → orbit_insertion → orbit_trace. Lander/probe:
  approach → atmospheric_entry → powered_descent → touchdown. Destination-specific
  flourishes (Europa plumes, Sun wind, Titan haze, entry plasma for atmosphere bodies).
  Ties the touchdown visual to `simulation.landingQuality` (rough landings tilt the craft).
- **New file:** `src/components/game/FlightHud.tsx` (~170 lines) — live telemetry overlay
  on the flight view. Shows FUEL (kg + bar), PWR DRAW (W), RELIAB (%), and a stage-specific
  metric (SCIENCE for cruise/science, NAV ACCY for navigation, LANDING for lander arrival,
  DATA TX for orbiter arrival, DOWNLINK for comm). Hidden on stage 8 / mission over.
- **Modified:** `src/components/game/MissionVisualizer.tsx` — routes stage 5 to ArrivalScene,
  renders FlightHud overlay, exports `DestPalette` interface, threads `simulation` to StageScene.
- **New CSS keyframes** in `globals.css`: `trajectory-draw`, `orbit-reveal`, `dust-kick`,
  `dust-kick-heavy`. All disabled under `prefers-reduced-motion`.

### B. Sound System with Volume Control
- **New file:** `src/lib/sound/soundManager.ts` (~260 lines) — singleton Web Audio synth.
  15 procedural cues: `ui_click`, `ui_hover`, `stage_advance`, `launch_ignition`,
  `launch_ascent`, `engine_burn`, `event_alert`, `event_resolved_good/bad`, `touchdown`,
  `separation`, `scan_sweep`, `comm_signal`, `mission_complete`, `mission_failure`.
  No audio asset files — everything synthesized from oscillators, filtered noise, envelopes.
  Lazy AudioContext init (browser autoplay gate). Master gain + mute.
- **New file:** `src/store/soundStore.ts` (~80 lines) — Zustand store, persisted to
  localStorage key `mission-control-sound`. Volume (0..1) + muted + audioUnlocked.
  `useCue()` hook unlocks audio on first call (from a user gesture).
- **New file:** `src/components/game/SoundControl.tsx` (~75 lines) — mute toggle +
  volume slider in GameHeader.
- **Integration:** SimulationScreen plays cues on stage execute (launch_ignition +
  launch_ascent for stage 1, stage_advance for others), event alert (via useEffect on
  pendingEvent), event resolved (good/bad based on choice.quality), mission complete/failure.
  MissionVisualizer plays separation (stage 2), engine_burn (4/5), touchdown (5 lander),
  scan_sweep (6), comm_signal (7).

### C. AI Features (z-ai-web-dev-sdk, server-side only)
- **New file:** `src/app/api/advisor/route.ts` (~110 lines) — POST endpoint for the AI
  Mission Advisor. Takes mission context (name, destination, type, stage, spacecraft summary,
  telemetry, recent log, pending event) + user question + conversation history. Returns
  advisor response. System prompt: in-character mission advisor (Gene Kranz style),
  concise, educational, actionable.
- **New file:** `src/app/api/generate-event/route.ts` (~180 lines) — POST endpoint for
  AI event generation. Takes mission context + stage. Returns a validated `MissionEvent`-
  shaped JSON with 2-3 choices, each with numeric effects and a quality rating. Schema-
  validated before return; rejects malformed AI output.
- **New file:** `src/components/game/AdvisorPanel.tsx` (~240 lines) — chat-style panel
  that slides in from the right. Calls /api/advisor. Suggested questions on empty state.
  Conversation history kept client-side (last 10 turns). Auto-sends questions from Tutor Mode.
  Toggle button in GameHeader ("ADVISOR" with sparkle icon).
- **New file:** `src/components/game/AIEventButton.tsx` (~180 lines) — button in the
  simulation screen (below stage execute). Generates an AI event, shows it in a dialog
  with choices + educational note. On choice pick, applies effects via
  `applyAIEventEffects` store action.
- **Modified:** `src/store/gameStore.ts` — added `applyAIEventEffects` action that applies
  numeric deltas (fuel, science, data, reliability, powerStress, landingQuality) directly
  to the simulation state.
- **Modified:** `src/components/game/GameApp.tsx` — renders AdvisorPanel, manages
  advisorOpen + tutorQuestion state.
- **Modified:** `src/components/game/GameHeader.tsx` — accepts advisorOpen/onToggleAdvisor
  props, renders AdvisorToggleButton.

### D. Tutor Mode (third game mode)
- **Modified:** `src/store/gameStore.ts` — `GameMode` type extended to `"single" | "multiplayer" | "tutor"`.
- **Modified:** `src/components/game/screens/DashboardScreen.tsx` — added "TUTOR — LEARN
  AS YOU PLAY" button (purple, GraduationCap icon).
- **New file:** `src/components/game/TutorOverlay.tsx` (~180 lines) — collapsible panel
  fixed at bottom-left. Shows phase-specific educational content: "Why this matters"
  explanation, key concepts (term + explanation), and an "Ask the tutor" button that
  opens the AdvisorPanel with a pre-filled phase-specific question. Keyed by phase in
  GameApp so state resets on phase change. Can be dismissed (shows "SHOW TUTOR" button).
- **Modified:** `src/components/game/GameApp.tsx` — renders TutorOverlay when mode ===
  "tutor". Footer shows "TUTOR MODE (LEARN AS YOU PLAY)". handleAskTutor sets the
  tutorQuestion and opens the advisor; AdvisorPanel auto-sends the question via the
  initialQuestion prop.

### Verification (all 2026-11-15)
- ESLint clean (`bun run lint` — 0 errors, 0 warnings)
- Dev server compiles all changes, HTTP 200
- Agent Browser verified:
  - Arrival scene: full playthrough to stage 5 with event overlay, zero console errors
  - Sound: mute toggle + volume slider work, state persists to localStorage
  - Advisor: API returns context-aware responses, UI panel renders, suggested questions work
  - AI events: API generates validated events with choices, effects apply to sim state
  - Tutor mode: overlay renders per-phase, "Ask the tutor" auto-sends to advisor, AI responds
- All existing tests preserved (91 engine tests + 22 multiplayer e2e tests unchanged)

## 10b. v2.3 Session record (2026-11-15, web-8a23945e)

**User's own v2.3 additions carried in the 7th attempt tar (all preserved):**
- Fixed fuel-tank joint glitch between different tank models (spacecraft model).
- Mission events can be chosen by difficulty + custom event presets.
- Sound effects with customizable volume (SoundControl in GameHeader, soundStore).
- "Made by AI" watermark on all visuals (`Watermark.tsx` — SvgWatermark + ImageWatermark).
- LEARN BASICS screen + PROGRESS/achievements screen (`progression.ts`).

**Fixed / added this session (all re-applied after the sandbox revert):**
1. **Turbopack font build error** — self-hosted variable fonts
   (`src/app/fonts/{orbitron,space-grotesk,jetbrains-mono}-variable.woff2`, latin subsets,
   weight axes 400–900 / 300–700 / 100–800) via `next/font/local`, same CSS variables.
   Re-download with `python3 scripts/fetch_fonts.py` if ever needed.
2. **gameStore.ts** — `computeResources` imported (was missing, TS2304).
3. **FlightHud.tsx** — stageMetric `value: string | number`.
4. **SimulationScreen.tsx** — sound cue reads `choice.effects.quality` (contract fix).
5. **ProgressScreen.tsx** — lucide icon map cast through `unknown`.
6. **tsconfig.json** — exclude `upload/` + `download/` from typecheck.
7. **.env** — `DATABASE_URL=file:../db/custom.db` (relative, works on Windows/macOS/Linux).
8. **multiplayer-server.ts UX** — the server runs in the foreground and used to look
   frozen. Now: auto-detected LAN IPv4 in the banner ("READY — teammates join at
   ws://192.168.x.x:3001"), a 30-second heartbeat line (uptime + rooms + players),
   and a graceful Ctrl+C message. NOTE: heartbeat line deliberately does NOT start
   with "[h" — Bun's console strips that prefix (cursor-home ANSI sanitizer quirk).
9. **Windows packaging** — `download/MissionControl-Windows.zip` (lean, no .git) and
   `download/Z.ai 9th attempt.tar` (full, with .git). Install guide given to the user:
   Bun on Windows → `bun install` → `bun run dev` → localhost:3000.

**Verification baseline:** `bunx tsc --noEmit` clean · `bun run lint` clean · 182 unit
tests · 22 mp e2e · dev server 200 · multiplayer /health OK + heartbeat verified.

**If the font error ever reappears:** stop dev server, `rm -rf .next`, restart.

## 11. Known opportunities / likely next work

The user has not yet specified what they want to work on next. Likely directions (ask before
assuming):

0. **Re-merge the AI features** from `upload/Z.ai 5th attempt.tar` (advisor, AI events,
   tutor overlay) if the user wants them back alongside their new v2.3 systems.

1. **More missions / equipment** — extend `missions.ts` or `equipment.ts`.
2. **Polish visuals** — the `MissionVisualizer` (970 lines) and `parts.tsx` (1,057 lines) are the
   biggest UI surfaces and the most likely place to add new animations or stage scenes.
3. **Multiplayer improvements** — `MultiplayerApp.tsx` (1,412 lines) + `multiplayer-server.ts`
   (669 lines); e.g. internet relay (not just LAN), matchmaking, persistence of team scores.
4. **Persistence / accounts** — Prisma schema exists but is barely used; could add user accounts,
   saved spacecraft, mission history, leaderboards.
5. **AI features** — `z-ai-web-dev-sdk` is already a dep; could add an AI mission advisor,
   natural-language mission briefings, AI-generated events, or a tutor mode.
6. **Sound / music** — none present.
7. **Mobile / touch UX** — current build is desktop-oriented.
8. **Localization (i18n)** — `next-intl` is a dep but no locales are wired up.
9. **Deploy / Docker / hosting** — Caddyfile exists; production build script exists.

## 11. Conventions to preserve

- The engine stays **pure and deterministic**. No I/O, no hidden state, no `Date.now()` or
  `Math.random()` outside `rng.ts`. Same `(seed, spacecraft, decisions)` ⇒ identical flight.
- Server is **host-authoritative** — clients send intents, render received state. Don't duplicate
  simulation logic on the client.
- Every numeric field on `Equipment` always exists; inapplicable ones are `0` (not undefined).
- Objective point totals are fixed: **400 primary + 150 secondary** per mission.
- Tests must stay green: `bun test` (182) + `bun run test:mp` (22) + `bunx tsc --noEmit` clean.
- Accessibility: keep `prefers-reduced-motion` support; keep contrast-audited button styles.
- Document engine changes in this file's section 7 if they affect the v2.0/v2.1 contracts.

## 12. When picking the project back up

1. Re-read this file.
2. `cd /home/z/my-project/game && bun install` (deps may have been pruned between sessions).
3. Run `bunx tsc --noEmit && bun test` to confirm a clean baseline before changing anything.
4. Ask the user what they want to work on this session before writing code.
5. Update section 9 (git state) and section 10 (next-work) at the end of each session.


---

## Co-op LAN join fix (2026-11-15)

Symptom: host could create a room, but a second player "couldn't connect" using `ws://localhost:3001`.
Root causes (all fixed):
1. `ws://` URLs are not browsable pages, and `localhost` on another device = that device. Invite is now an
   http link: `http://<host-lan-ip>:3000/?join=CODE` (lobby `InvitePanel`; LAN IP read from server `/health`).
2. Next 16 dev server blocks dev resources from non-localhost origins → page never hydrates for joiners.
   Fixed via `allowedDevOrigins` in `next.config.ts` and `next dev -H 0.0.0.0`.
3. Reconnect token/room code were in localStorage → a second tab silently rejoined as the HOST seat. Now
   sessionStorage (per tab); token only sent for the room it belongs to.
4. Server URL input is normalised (`normalizeServerUrl`); stale `localhost` is ignored on LAN pages;
   `GET http://host:3001/` returns an explanatory HTML page; `/health` returns `lan`, `wsPort`, `webPort`.
