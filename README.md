# MISSION CONTROL: BEYOND EARTH

An educational space mission design simulator built for the **NASA Space Apps Challenge 2026**.

You are the Mission Director. Select a mission, engineer a spacecraft within real budgets, validate its
flight readiness, fly an eight-stage mission, manage emergencies, and earn your score out of 1,000 —
learning the engineering trade-offs of real space missions along the way.

**Version 2.0** upgrades the game with an interactive spacecraft visualizer, an animated flight view,
15 missions, a 54-component equipment catalogue, difficulty settings with random mission constraints,
a full UI accessibility pass, and **four-player cooperative LAN multiplayer** with distinct crew roles.

**Core gameplay loop:** `PLAN → DESIGN → VALIDATE → LAUNCH → MANAGE → EVALUATE`

---

## Challenge alignment

This project directly addresses the official 2026 NASA Space Apps Challenge statement
[**Space Mission Design Game**](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game):

> "Your challenge is to create an interactive game that allows participants to design, manage, and
> simulate a complete space mission while making engineering decisions, managing limited resources,
> and evaluating how each choice shapes the success of their mission."

How this build answers the statement's considerations:

| Challenge consideration | Implementation |
| --- | --- |
| Accessible to different knowledge levels | Beginner-friendly language everywhere, difficulty ladder across 15 missions, educational tooltips and "why this happens" notes on every event |
| Every design decision has a consequence | Budget, mass, power, fuel, science, comms, navigation, thermal, radiation and landing capabilities all interact |
| No single perfect solution | Multiple viable configurations per mission; the report recommends different refits depending on your weaknesses |
| Realistic constraints | Launch mass limits, propellant budgets, power generation vs. consumption, solar derating by distance from the Sun |
| Random events / decisions | Seeded, deterministic event system with meaningful choices and real consequences |
| Scoring system | 1,000 points: primary objectives (400), secondary (150), engineering (200), resource efficiency (150), decision-making (100) |
| Mission dashboard | Live resource panel updates with every equipment change; live telemetry during flight |
| Mission report + post-mission analysis | Full report: score breakdown, objectives, decisions, strengths, weaknesses, recommendations, educational notes |
| Multiple scenarios and difficulty levels | 15 missions (Moon → Mars → NEA → Comet → Venus → Asteroid Belt → Mercury → Sun → Jupiter → Europa → Saturn → Titan → Mars Sample Return → Deep Space), plus 5 game difficulty settings with random constraints |

---

## Running the project

Requirements: [Bun](https://bun.sh) (or Node.js 20+) and a modern browser.

```bash
bun install          # install dependencies
bun run dev          # start the game on http://localhost:3000
bun test             # run the game-engine test suite (91 tests)
bun run test:mp      # run the multiplayer end-to-end test (real server + 4 clients)
bun run lint         # ESLint
bun run build        # production build
bunx tsc --noEmit    # full TypeScript check
```

The single-player game runs entirely in the browser; all mission data and calculations are local.

---

## Multiplayer (cooperative LAN missions, up to 4 players)

Four players crew one mission from their own browsers on the same Wi-Fi network:

| Station | Responsibility |
| --- | --- |
| **Mission Commander** | Approves critical cooperative decisions, arbitrates priorities, owns objectives |
| **Chief Engineer** | Engineering emergencies (power, thermal, engines), spacecraft health, recommends fixes |
| **Navigation & Flight Director** | Trajectory, course corrections, propellant, arrival and landing decisions |
| **Science & Comms Officer** | Discoveries, instruments, communication interruptions, downlink |

Role-specific events route to the right station; some decisions require **recommend → approve**
cooperation or a **team vote**. Fewer than four players? Each of you can hold multiple roles, and
events for unclaimed stations open to the whole team. The mission ends with a shared team score
plus per-player contribution statistics.

### Starting the multiplayer server

The game's web page cannot host a TCP/WebSocket server itself, so multiplayer uses a small dedicated
server process (zero extra dependencies — it uses Bun's built-in WebSockets):

```bash
bun run multiplayer                 # listens on ws://0.0.0.0:3001
MULTIPLAYER_PORT=3005 bun run multiplayer   # custom port
```

The server is **host-authoritative**: it owns the official mission state, generates the mission seed,
rolls events, validates every decision and runs the same deterministic game engine as single-player.
Clients only send intents and render the state they receive.

### Connecting players on your LAN

1. On the host machine, start both the web app (`bun run dev`) and the multiplayer server
   (`bun run multiplayer`).
2. Find the host machine's LAN IPv4 address:
   - **Windows:** run `ipconfig` and look for "IPv4 Address" (e.g. `192.168.1.10`)
   - **macOS:** `ipconfig getifaddr en0`
   - **Linux:** `hostname -I`
3. Other players open the **game page** in their browser (e.g. `http://192.168.1.10:3000`) and choose
   Multiplayer — the server field defaults to `ws://<same-hostname>:3001`, so joining needs only a
   callsign and the room code.
4. The host clicks **HOST A SESSION**. The lobby shows a ready-made **invite link**
   (`http://192.168.1.10:3000/?join=ABCD`) — copy it to your teammates. Opening it pre-fills the room
   code; they enter a callsign and press JOIN. Everyone picks a station and readies up. The host
   selects mission and difficulty, then starts the design phase.

> **Never put a `ws://` address in the browser's address bar.** `ws://…:3001` is the game's
> WebSocket, not a web page — browsers cannot display it (they report the site as "down" or
> "moved"). It is only typed *inside* the game's "Multiplayer server" field, and normally
> not even there. Likewise `localhost` on another device means *that* device, not the host: always
> use the host's LAN IPv4 address. Opening `http://<host-ip>:3001` in a browser now shows a short
> page explaining this.

### Windows firewall and port configuration

- The first time the multiplayer server starts, Windows Firewall will ask to allow Bun (or Node.js)
  through — allow it **on private networks**.
- If the prompt does not appear or players cannot connect, create an inbound rule for
  **TCP port 3001** (or your chosen `MULTIPLAYER_PORT`) in *Windows Defender Firewall with Advanced
  Security*.
- The web app itself (port 3000) must also be reachable (allow inbound TCP 3000 too): `bun run dev`
  binds to all interfaces (`-H 0.0.0.0`), and `next.config.ts` lists LAN addresses in
  `allowedDevOrigins` — without that, Next.js 16's dev server blocks pages opened from another
  device and the page never becomes interactive. No cloud server or internet access
  is required; everything runs on the local network.
- Players behind VPN adapters may need to pick the physical adapter's IP.

### Reconnection and robustness

- Every player receives a reconnection token; a dropped player's seat is held and they rejoin with
  the same identity, stats and contributions when they reconnect.
- If the host player disconnects, host privileges migrate to the next connected player — the
  session continues.
- Empty rooms are kept for 15 minutes, then garbage-collected.

---

## What's new in 2.0

- **Interactive spacecraft visualizer** — the designer shows an animated SVG model of your actual
  spacecraft (engines, tanks, solar wings, dishes, instruments, shields, legs), updating with every
  component you add or remove, with rotation and honest ×N quantity badges.
- **Animated flight view** — the simulation screen is reorganized into three areas
  (stages/telemetry/controls · console · flight view) with a dedicated visual scene for every stage:
  launch countdown and ascent with exhaust, stage separation, cruise, navigation burns, arrival
  (destination-specific planets with orbit insertion or powered descent), science scanning, Earth
  downlink and final evaluation. Events draw their own overlays (solar storms, impacts, faults,
  comm loss, low fuel, discoveries). All animations are CSS transform/opacity and fully disabled
  under `prefers-reduced-motion`.
- **UI accessibility pass** — contrast-audited button system (primary/secondary/outline/success/
  warning/destructive + readable disabled states), brighter secondary surfaces, consistent focus
  rings, and a fix for the modal-positioning defect caused by unlayered custom CSS.
- **15 missions** — from Lunar Cargo Delivery to a Deep-Space Interstellar Precursor, each with its
  own briefing, objectives (400 primary + 150 secondary points), environmental conditions and events.
- **Difficulty settings & random constraints** — Beginner / Intermediate / Advanced / Expert /
  Custom Challenge. Higher difficulties roll deterministic constraints from a pool of 12 (budget
  cuts, mass limits, redundant comms requirements, restricted equipment, extra science goals…).
  Constraints change the real numbers: the same validation engine enforces them.
- **54-component equipment catalogue** — full ladders in every category (7 engines, 4 tanks, 8 power
  systems, 5 antennas, 6 science instruments, 4 navigation suites, 5 thermal options, 9 protection
  and structure options…) with per-mission compatibility indicators.
- **Expanded seeded events** — 27 pooled events plus mission-specific ones, tagged by crew role and
  cooperation mode. Same seed + spacecraft + decisions ⇒ identical flight.
- **Four-player cooperative multiplayer** — see above.

Everything from 1.0 is preserved: the six original missions (same parameters), original equipment
and scoring, readiness checks, educational explanations, mission reports, flight logs and the seeded
RNG.

## What's new in 2.1 — Visual Systems Revision

One **shared spacecraft component system** now drives all three visual layers, so the rocket you
assemble in the Design Lab is the exact rocket that launches and flies:

- `src/components/game/spacecraft/model.ts` — pure, deterministic layout engine that turns the live
  `SpacecraftConfig` into ordered visual parts (engines at the bottom, fuel tanks as body sections
  stacked above them, structural bus, horizontally extending solar wings, antennas and nav sensors
  on top, instrument/RTG/battery pods on the sides, heat shields, radiators, radiation auras,
  landing gear). 14 model tests pin the config→visuals sync contract.
- `src/components/game/spacecraft/parts.tsx` — SVG artwork for every part with live flight states
  (engine flames that scale with throttle and sputter on malfunctions, wings that unfold, damage
  scorch and flicker, dishes that stop tracking on comm loss).

**A. Design Lab** (`SpacecraftCanvas`) — the preview starts empty and constructs the spacecraft as
you add or remove components, updates instantly, shows per-component labels with honest quantities
below the preview, animates every mount/unmount, and can rotate.

**B. Liftoff simulation** (`LaunchScene`) — a real, dynamically rendered launch: T-3 countdown,
ignition with flame ramp and pad shake, billowing smoke (volume scales with your engine count),
hold-down release, the assembled vehicle ascending as the pad and tower fall away, the sky
transitioning to star-filled space, and climbing ALT/VEL telemetry. No images, GIFs or videos.

**C. Mission event simulations** (`MissionVisualizer`) — every stage renders your actual
spacecraft: solar wings visibly unfold at separation, RCS puffs and correction burns at navigation,
orbital insertion burns onto a capture orbit (powered descent with glowing heat shield for landers),
scanning cones at the science stage, signal waves and packets to Earth. Events are dynamic
simulations tied to the engine state: solar storms wash radiation over the hull, asteroids tumble
past and flash on impact, engine faults visibly cut thrust, comm failures kill the signal into
static, eclipses darken the arrays and drain the battery buffer, fuel emergencies lean the flame and
drain the gauge, resolved impacts scar the actual wings/instruments for the rest of the flight.

Also fixed along the way: the flight view now shows the stage being revealed (you watch the launch
while the launch log prints, instead of skipping ahead), and the multiplayer lobby gives the host a
ready toggle (previously a solo host could deadlock the ready check).

---

## Architecture

Next.js 16 (App Router, single route) · TypeScript 5 (strict, clean `tsc --noEmit`) · Tailwind CSS 4 ·
shadcn/ui · Zustand (state + persistence) · framer-motion (transitions) · Bun WebSocket server
(multiplayer).

The game logic is a set of **pure, deterministic TypeScript modules** — no I/O, no hidden state —
which makes every calculation unit-testable and the whole simulation reproducible for a given
`(seed, spacecraft, decisions)` triple. The multiplayer server imports these same modules; the
simulation is never duplicated between client and server.

```
src/
├── app/                        Next.js app shell (layout, page, theme)
├── components/
│   ├── game/
│   │   ├── GameApp.tsx         Mode router: single-player phases | multiplayer
│   │   ├── GameHeader.tsx      Identity + phase stepper + mode indicator
│   │   ├── StarfieldBackground.tsx
│   │   ├── SpacecraftCanvas.tsx   v2.0 animated SVG spacecraft visualizer
│   │   ├── MissionVisualizer.tsx  v2.0 animated stage/event flight view
│   │   ├── MultiplayerApp.tsx     v2.0 cooperative flow (entry/lobby/design/sim/report)
│   │   ├── shared.tsx          Stat bars, badges, educational tooltips
│   │   └── screens/
│   │       ├── DashboardScreen.tsx     Mode selection + missions + flight log
│   │       ├── BriefingScreen.tsx      Requirements + difficulty & constraints
│   │       ├── DesignerScreen.tsx      Construction (live stats + visualizer)
│   │       ├── ReadinessScreen.tsx     Validation checklist + launch gate
│   │       ├── SimulationScreen.tsx    8-stage flight (3-area layout)
│   │       └── ReportScreen.tsx        Score, analysis, recommendations
│   └── ui/                     shadcn/ui primitives (contrast-audited buttons)
├── lib/game/                   THE GAME ENGINE (pure, tested)
│   ├── types.ts                Frozen shared data contract (v2.0 additions)
│   ├── equipment.ts            54-component catalogue
│   ├── missions.ts             15 missions with objectives & events
│   ├── events.ts               v2.0 pooled generic + role events
│   ├── constraints.ts          v2.0 difficulty settings + 12 random constraints
│   ├── calculations.ts         Deterministic resource calculations
│   ├── validation.ts           Readiness validation (errors vs. warnings)
│   ├── rng.ts                  Seeded, serializable PRNG (mulberry32)
│   ├── simulation.ts           8-stage engine, events, scoring, reports
│   ├── multiplayer.ts          v2.0 roles, routing, votes, contributions (pure)
│   └── __tests__/              76 engine tests
├── store/
│   ├── gameStore.ts            Single-player session (mode, difficulty, constraints)
│   └── multiplayerStore.ts     v2.0 WebSocket client + session mirror
server/
└── multiplayer-server.ts       v2.0 host-authoritative WebSocket game server
tests/
└── multiplayer-e2e.ts          Full 4-player session test over real sockets
scripts/
└── generate-destination-art.ts Generates the destination artwork from SVG
```

### Frozen data contract (summary)

Every module consumes the shared interfaces in `src/lib/game/types.ts`:

- **`Equipment`** — one catalogue entry. All numeric attributes always exist; inapplicable ones are `0`.
  Fields: `isSolar`, `cost`, `mass`, `powerGeneration`, `powerConsumption`, `fuelCapacity`,
  `fuelConsumption`, `propulsion`, `reliability`, `powerStorage`, `scienceOutput`,
  `radiationShielding`, `thermalProtection`, `landingAssist`, `commCapability`, `navigation`,
  `structural`.
- **`Mission`** — budget, mass/fuel/power/propulsion floors, solar derating, capability floors,
  required equipment, objectives (primary points total 400, secondary 150), events, and v2.0:
  `eventRate`, constraint flags (`requireRedundantComms`, `bannedEquipmentIds`).
- **`MissionConstraint` / `DifficultySetting`** — v2.0 constraint pool and the five settings that
  transform a base mission into the effective mission every screen actually uses.
- **`SpacecraftConfig`** — `{ missionId, components: [{ equipmentId, quantity }] }`.
- **`ResourceSummary`** — the deterministic calculation result.
- **`ValidationResult`** — `{ ready, checks, warnings, errors }`; launch is impossible while any
  error-severity check fails.
- **`SimulationResult`** — status, score (`/1000`) with category breakdown, objectives, decisions,
  events, stage log, telemetry and the narrative `MissionReport`.
- **Multiplayer types** — `PlayerRole`, `RoleDefinition`, `ContributionStats`, `MPSession`,
  routing and proposal/vote structures.

### Calculation rules (deterministic)

```
totalCost          = Σ (component cost × quantity)
totalMass          = Σ (component mass × quantity)
powerGenerated     = Σ (powerGeneration × quantity)          // solar derated at destination
powerBalance       = effectiveGeneration − Σ (powerConsumption × quantity)
fuelCapacity       = Σ (fuelCapacity × quantity)
fuelRequired       = max(mission.minFuel, Σ (propulsion × fuelConsumption × qty))
massRemaining      = mission.maxMass − totalMass
budgetRemaining    = mission.budget − totalCost
reliability        = quantity-weighted average + redundancy bonuses (engine, antenna, battery)
```

Difficulty and constraints multiply `budget`, `maxMass`, `minFuel`, `solarDerate`, `minRadiation`
and the event rate, and can require redundant comms, ban equipment or raise science goals — all
applied by the pure `applyDifficulty()` transform before any calculation or validation runs.

### Simulation design

- Eight stages: rocket launch → separation → cruise → navigation adjustments → arrival →
  science → communication → final evaluation.
- All randomness flows through a seeded PRNG stored inside the simulation state; identical
  seed + spacecraft + decisions ⇒ identical flight (verified by tests).
- Outcomes depend on engineering margins: reliability drives failure risk, navigation surplus trims
  propellant burns, landing/thermal/radiation margins decide arrival, science capability drives data.
- Only arrival failures and propellant exhaustion end a mission outright — earlier anomalies degrade
  systems, and a failed mission still produces a full report with recommendations.

---

## Testing

`bun test` runs **91 tests** covering the master specification's scenarios plus every v2.0 system:

- **A–G** — valid spacecraft completes its mission; over-budget/over-mass/missing-equipment/
  insufficient-power/insufficient-fuel designs are blocked with explanations; different engineering
  produces different outcomes; determinism given the same seed.
- **Data integrity** — objective point totals (400/150) for all 15 missions, complete equipment
  field sets, unique ids, category coverage.
- **Mission viability** — all 15 missions have verified flight-proven configurations.
- **Constraints** — difficulty transforms, deterministic constraint rolling, redundant-comms and
  banned-equipment validation gates, science-goal adjustments.
- **Events** — unique ids, choice quality bounds, per-role coverage, cooperative mode validity.
- **Shared spacecraft model (v2.1)** — the config→visuals sync contract: empty config draws nothing,
  adding/removing equipment instantly adds/removes its part, engines sit at the bottom with tanks
  stacked above and the bus on top, wings extend on both sides, engine clusters spread without
  overlapping, labels carry true (capped-drawing) quantities, and the model is deterministic.
- **Multiplayer engine** — role claiming, event routing (role holders, whole-team fallback),
  proposal/vote flows, contributions, host migration, auto role assignment.
- **PRNG** — determinism and uniformity.

`bun run test:mp` (**22 checks**) spawns the real multiplayer server and drives a complete
four-player cooperative session over actual WebSockets: room creation, joins, the 4-player cap,
role claiming, mission/difficulty selection, host permissions, shared design, authoritative launch,
a full flight with solo/proposal/vote decisions, identical state across all four clients, the team
report with matching contribution totals, disconnection, reconnection into the held seat, host
migration and return-to-lobby.

End-to-end verification of the full single-player gameplay loop (selection → briefing →
construction with the visualizer → validation → launch → simulation with event decisions → report)
was additionally performed in a headless browser with zero console errors, including contrast and
layout audits.

---

## Credits & third-party assets

- [Next.js](https://nextjs.org) (MIT), [React](https://react.dev) (MIT), [TypeScript](https://www.typescriptlang.org) (Apache-2.0)
- [Tailwind CSS](https://tailwindcss.com) (MIT), [shadcn/ui](https://ui.shadcn.com) (MIT), [Radix UI](https://www.radix-ui.com) (MIT)
- [Zustand](https://zustand.docs.pmnd.rs) (MIT), [framer-motion](https://www.framer.com/motion/) (MIT), [lucide-react](https://lucide.dev) (ISC)
- Fonts: Orbitron, Space Grotesk, JetBrains Mono (SIL Open Font License 1.1, via Google Fonts — bundled at build time)
- Destination artwork for the six original missions (`public/images/dest-{moon,mars,venus,asteroid,jupiter,comet}.png`,
  `hero-earth.png`) was generated with AI image generation for this project. Artwork for the new
  v2.0 destinations (`dest-{mercury,sun,europa,saturn,titan,deepspace}.png`) is deterministic SVG
  art rendered to PNG by `scripts/generate-destination-art.ts`. All artwork is released with the
  project under the license below.

## License

Released under the [Apache License 2.0](./LICENSE). All original code, data and artwork in this
repository are freely available without restriction, consistent with the NASA Space Apps Challenge
open-source IP rules.
