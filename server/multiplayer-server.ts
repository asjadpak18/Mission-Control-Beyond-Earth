/**
 * ============================================================================
 * MISSION CONTROL: BEYOND EARTH — MULTIPLAYER SERVER (v2.0)
 * ============================================================================
 * A dedicated, host-authoritative WebSocket game server for cooperative
 * missions with up to four players on a local network.
 *
 * Architecture:
 * - This PROCESS is the single authority: it owns every room's official
 *   mission state, generates seeds, rolls events, validates decisions and
 *   runs the deterministic game engine. Clients never compute outcomes.
 * - Rooms are identified by a 4-character code. Players receive a
 *   reconnection token; a dropped player keeps their slot and can rejoin.
 * - The "host" player only holds lobby privileges (mission/difficulty/start);
 *   if the host disconnects, the role migrates to the next connected player.
 * - All game logic is imported from the pure engine in src/lib/game — no
 *   duplicated simulation code.
 *
 * Run with:  bun server/multiplayer-server.ts   (or `bun run multiplayer`)
 * Port:      3001 by default (env MULTIPLAYER_PORT)
 * ============================================================================
 */

import {
  MPSession,
  createSession,
  makePlayer,
  getPlayer,
  routeEvent,
  proposalNeedsCommander,
  voteComplete,
  tallyVotes,
  creditDecision,
  creditScienceObjective,
  lobbyReady,
  migrateHost,
  MAX_PLAYERS,
} from "../src/lib/game/multiplayer";
import { getMission, MISSIONS } from "../src/lib/game/missions";
import { applyDifficulty } from "../src/lib/game/constraints";
import { createSimulation, runStage, resolveEvent, finalizeSimulation } from "../src/lib/game/simulation";
import { validateSpacecraft } from "../src/lib/game/validation";
import { withQuantity, emptyConfig } from "../src/lib/game/calculations";
import { makeSeed } from "../src/lib/game/rng";
import type { DifficultySetting } from "../src/lib/game/types";
import os from "node:os";

const PORT = Number(process.env.MULTIPLAYER_PORT ?? 3001);
/** Port the Next.js game page is served on (only used to print/build invite links). */
const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);
const ROOM_TTL_MS = 15 * 60 * 1000; // keep empty rooms 15 minutes for rejoins

/** Minimal structural type satisfied by Bun's ServerWebSocket. */
interface WsLike {
  readyState: number;
  send(data: string): void;
}
const WS_OPEN = 1;

// ---------------------------------------------------------------------------
// Room bookkeeping
// ---------------------------------------------------------------------------

interface Room {
  session: MPSession;
  sockets: Map<string, Set<WsLike>>; // playerId → connected sockets (1 normally)
  lastEmpty: number | null;
}

const rooms = new Map<string, Room>();

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let tries = 0; tries < 200; tries++) {
    let code = "";
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error("Could not allocate a room code");
}

function effectiveMission(session: MPSession) {
  const base = session.missionId ? getMission(session.missionId) : null;
  if (!base) return null;
  return applyDifficulty(base, session.difficulty, session.constraintIds, session.constraintSeed).mission;
}

function broadcast(room: Room, message: unknown) {
  const payload = JSON.stringify(message);
  for (const sockets of room.sockets.values()) {
    for (const ws of sockets) if (ws.readyState === WS_OPEN) ws.send(payload);
  }
}

function sendTo(ws: WsLike, message: unknown) {
  if (ws.readyState === WS_OPEN) ws.send(JSON.stringify(message));
}

function pushLog(room: Room, line: string) {
  room.session = { ...room.session, log: [...room.session.log.slice(-80), line] };
}

function broadcastSession(room: Room, extra?: Record<string, unknown>) {
  broadcast(room, { t: "session", session: room.session, ...extra });
}

// ---------------------------------------------------------------------------
// Connection identity (per-socket)
// ---------------------------------------------------------------------------

const connInfo = new WeakMap<WsLike, { roomCode: string; playerId: string }>();

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

function handleCreate(ws: WsLike, msg: any) {
  const name = String(msg.name ?? "Commander").slice(0, 24) || "Commander";
  if (rooms.size > 200) {
    sendTo(ws, { t: "error", message: "Server is full. Try again later." });
    return;
  }
  const code = makeRoomCode();
  const playerId = crypto.randomUUID();
  const host = makePlayer(playerId, name, true);
  const session = createSession(code, host);
  session.design = emptyConfig("none");
  const room: Room = { session, sockets: new Map([[playerId, new Set([ws])]]), lastEmpty: null };
  rooms.set(code, room);
  connInfo.set(ws, { roomCode: code, playerId });
  sendTo(ws, { t: "joined", roomCode: code, playerId, token: playerId, session });
  console.log(`[room ${code}] created by ${name}`);
}

function handleJoin(ws: WsLike, msg: any) {
  const code = String(msg.roomCode ?? "").toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    sendTo(ws, { t: "error", message: `No room "${code}" on this server. Check the code and the host IP.` });
    return;
  }

  // Reconnection path: token matches an existing player slot.
  const token = String(msg.token ?? "");
  if (token) {
    const player = room.session.players.find((p) => p.id === token);
    if (player) {
      connInfo.set(ws, { roomCode: code, playerId: player.id });
      const set = room.sockets.get(player.id) ?? new Set();
      set.add(ws);
      room.sockets.set(player.id, set);
      room.session = {
        ...room.session,
        players: room.session.players.map((p) => (p.id === player.id ? { ...p, connected: true } : p)),
      };
      room.lastEmpty = null;
      pushLog(room, `${player.name} reconnected.`);
      broadcastSession(room);
      sendTo(ws, { t: "joined", roomCode: code, playerId: player.id, token: player.id, session: room.session });
      console.log(`[room ${code}] ${player.name} reconnected`);
      return;
    }
  }

  // Fresh join path — respect the 4-player cap, reusing dropped slots first.
  const connectedCount = room.session.players.filter((p) => p.connected).length;
  if (connectedCount >= MAX_PLAYERS) {
    sendTo(ws, { t: "error", message: "Room is full (4 players)." });
    return;
  }
  const name = String(msg.name ?? "Operator").slice(0, 24) || "Operator";
  const playerId = crypto.randomUUID();
  const player = makePlayer(playerId, name, false);
  room.session = { ...room.session, players: [...room.session.players, player] };
  const set = room.sockets.get(playerId) ?? new Set();
  set.add(ws);
  room.sockets.set(playerId, set);
  room.lastEmpty = null;
  connInfo.set(ws, { roomCode: code, playerId });
  pushLog(room, `${name} joined the room.`);
  broadcastSession(room);
  sendTo(ws, { t: "joined", roomCode: code, playerId, token: playerId, session: room.session });
  console.log(`[room ${code}] ${name} joined`);
}

function requireRoom(ws: WsLike): { room: Room; playerId: string } | null {
  const info = connInfo.get(ws);
  if (!info) {
    sendTo(ws, { t: "error", message: "Not in a room." });
    return null;
  }
  const room = rooms.get(info.roomCode);
  if (!room) {
    sendTo(ws, { t: "error", message: "Room no longer exists." });
    return null;
  }
  return { room, playerId: info.playerId };
}

function isHost(room: Room, playerId: string): boolean {
  return room.session.hostId === playerId && !!getPlayer(room.session, playerId)?.connected;
}

// ---------------------------------------------------------------------------
// Simulation helpers (authoritative)
// ---------------------------------------------------------------------------

function applyChoice(room: Room, playerId: string, choiceId: string, via: "solo" | "proposal" | "vote") {
  const session = room.session;
  if (!session.simulation?.pendingEvent) return;
  const mission = effectiveMission(session);
  if (!mission) return;

  const event = session.simulation.pendingEvent.event;
  const nextSim = resolveEvent(session.simulation, mission, session.design, choiceId);
  let next: MPSession = { ...session, simulation: nextSim, routing: null };

  // Credit the deciding player.
  next = creditDecision(next, { playerId, event, choiceId, via });
  pushLog(room, `${getPlayer(next, playerId)?.name ?? "Player"} resolved "${event.title}".`);

  room.session = next;
  broadcastSession(room);
}

function handleAdvance(room: Room, _playerId: string) {
  const session = room.session;
  if (session.phase !== "simulation" || !session.simulation) return;
  if (session.simulation.stagePhase === "awaiting_event") return;
  if (session.simulation.stagePhase === "complete" || session.simulation.status === "failure") return;

  const mission = effectiveMission(session);
  if (!mission) return;
  const nextSim = runStage(session.simulation, mission, session.design);

  let next: MPSession = { ...session, simulation: nextSim };

  if (nextSim.pendingEvent) {
    const event = nextSim.pendingEvent.event;
    const routing = routeEvent(event, next);
    next = {
      ...next,
      simulation: nextSim,
      routing: {
        eventId: event.id,
        eventTitle: event.title,
        targetRoles: routing.targetRoles,
        eligiblePlayerIds: routing.eligiblePlayerIds,
        mode: routing.mode,
        proposal: null,
        votes: [],
      },
    };
    pushLog(room, `EVENT — ${event.title} (${routing.mode}).`);
  } else {
    next = { ...next, routing: null };
    pushLog(room, `Stage ${Math.min(8, nextSim.stageIndex + 1)} executed.`);
  }

  room.session = next;
  broadcastSession(room);
}

// ---------------------------------------------------------------------------
// Main message dispatcher
// ---------------------------------------------------------------------------

function handleMessage(ws: WsLike, raw: string | Buffer) {
  let msg: any;
  try {
    msg = JSON.parse(String(raw));
  } catch {
    sendTo(ws, { t: "error", message: "Malformed message." });
    return;
  }

  switch (msg.t) {
    case "create":
      handleCreate(ws, msg);
      return;
    case "join":
      handleJoin(ws, msg);
      return;
    case "ping":
      sendTo(ws, { t: "pong" });
      return;
  }

  const ctx = requireRoom(ws);
  if (!ctx) return;
  const { room, playerId } = ctx;
  const session = room.session;
  const player = getPlayer(session, playerId);
  if (!player || !player.connected) {
    sendTo(ws, { t: "error", message: "You are not registered in this room." });
    return;
  }

  switch (msg.t) {
    // ---------------------------------------------------------------- lobby
    case "set_role": {
      if (session.phase !== "lobby") return;
      const role = String(msg.role);
      const on = !!msg.on;
      const players = session.players.map((p) => {
        if (p.id !== playerId) return p;
        const roles = on
          ? p.roles.includes(role as never) ? p.roles : [...p.roles, role as never]
          : p.roles.filter((r) => r !== role);
        return { ...p, roles, ready: false };
      });
      room.session = { ...session, players };
      broadcastSession(room);
      return;
    }
    case "set_ready": {
      const players = session.players.map((p) => (p.id === playerId ? { ...p, ready: !!msg.ready } : p));
      room.session = { ...session, players };
      broadcastSession(room);
      return;
    }
    case "select_mission": {
      if (!isHost(room, playerId)) {
        sendTo(ws, { t: "error", message: "Only the host can select the mission." });
        return;
      }
      if (session.phase !== "lobby") return;
      const missionId = String(msg.missionId);
      if (!MISSIONS.some((m) => m.id === missionId)) return;
      room.session = { ...session, missionId, design: emptyConfig(missionId) };
      pushLog(room, `Mission selected: ${getMission(missionId)?.name}.`);
      broadcastSession(room);
      return;
    }
    case "set_difficulty": {
      if (!isHost(room, playerId)) {
        sendTo(ws, { t: "error", message: "Only the host can change difficulty." });
        return;
      }
      if (session.phase !== "lobby") return;
      const difficulty = msg.difficulty as DifficultySetting;
      const constraintIds = Array.isArray(msg.constraintIds) ? msg.constraintIds.map(String) : [];
      room.session = {
        ...session,
        difficulty,
        constraintIds,
        constraintSeed: Number(msg.constraintSeed) || session.constraintSeed,
      };
      broadcastSession(room);
      return;
    }
    case "reroll_constraints": {
      if (!isHost(room, playerId)) return;
      if (session.phase !== "lobby") return;
      room.session = { ...session, constraintSeed: makeSeed() };
      broadcastSession(room);
      return;
    }
    case "start": {
      if (!isHost(room, playerId)) {
        sendTo(ws, { t: "error", message: "Only the host can start the session." });
        return;
      }
      const ready = lobbyReady(session);
      if (!ready.ok) {
        sendTo(ws, { t: "error", message: ready.reason ?? "Lobby is not ready." });
        return;
      }
      room.session = {
        ...session,
        phase: "design",
        design: session.design.components.length ? session.design : emptyConfig(session.missionId!),
      };
      pushLog(room, "Mission design phase started.");
      broadcastSession(room);
      return;
    }

    // --------------------------------------------------------------- design
    case "set_quantity": {
      if (session.phase !== "design") return;
      const equipmentId = String(msg.equipmentId);
      const quantity = Math.max(0, Math.min(9, Math.floor(Number(msg.quantity) || 0)));
      const design = withQuantity(session.design, equipmentId, quantity);
      room.session = { ...session, design };
      broadcastSession(room);
      return;
    }
    case "clear_design": {
      if (session.phase !== "design") return;
      room.session = { ...session, design: emptyConfig(session.missionId!) };
      broadcastSession(room);
      return;
    }
    case "launch": {
      if (session.phase !== "design") return;
      const mission = effectiveMission(session);
      if (!mission) return;
      const validation = validateSpacecraft(mission, session.design);
      if (!validation.ready) {
        const blocker = validation.errors[0]?.message ?? "Spacecraft is not ready.";
        broadcast(room, { t: "error", message: `Launch blocked — ${blocker}` });
        return;
      }
      const seed = makeSeed();
      const simulation = createSimulation(mission, session.design, seed);
      room.session = { ...session, simulation, result: null, routing: null, phase: "simulation", seed };
      pushLog(room, `LAUNCH — seed ${seed}. Good luck, team.`);
      broadcastSession(room);
      return;
    }

    // ----------------------------------------------------------- simulation
    case "advance": {
      handleAdvance(room, playerId);
      return;
    }
    case "decide":
    case "propose": {
      const routing = session.routing;
      if (session.phase !== "simulation" || !routing) return;
      if (!session.simulation?.pendingEvent) return;
      const choiceId = String(msg.choiceId);
      const event = session.simulation.pendingEvent.event;
      if (!event.choices.some((c) => c.id === choiceId)) return;

      if (routing.mode === "solo") {
        if (msg.t !== "decide") return;
        if (!routing.eligiblePlayerIds.includes(playerId)) {
          sendTo(ws, { t: "error", message: "This decision belongs to another station." });
          return;
        }
        applyChoice(room, playerId, choiceId, "solo");
        return;
      }
      if (routing.mode === "proposal") {
        if (msg.t !== "propose") return;
        if (!routing.eligiblePlayerIds.includes(playerId)) {
          sendTo(ws, { t: "error", message: "Only the responsible station can recommend a course of action." });
          return;
        }
        const proposal = { eventId: routing.eventId, choiceId, byPlayerId: playerId, byPlayerName: player.name };
        room.session = { ...session, routing: { ...routing, proposal } };
        pushLog(room, `${player.name} recommends: ${event.choices.find((c) => c.id === choiceId)?.label}.`);
        broadcastSession(room);
        // Without a connected commander, the recommendation applies directly.
        if (!proposalNeedsCommander(room.session)) {
          applyChoice(room, playerId, choiceId, "proposal");
        }
        return;
      }
      return; // vote mode uses "vote"
    }
    case "approve": {
      const routing = session.routing;
      if (session.phase !== "simulation" || !routing || routing.mode !== "proposal") return;
      if (!routing.proposal) return;
      const isCommander = player.roles.includes("commander");
      const isProposer = routing.proposal.byPlayerId === playerId;
      if (!isCommander && !isProposer) {
        sendTo(ws, { t: "error", message: "Only the Mission Commander can approve recommendations." });
        return;
      }
      if (!isCommander && !msg.accept) {
        // the proposer may withdraw their own recommendation
        room.session = { ...session, routing: { ...routing, proposal: null } };
        broadcastSession(room);
        return;
      }
      if (msg.accept) {
        applyChoice(room, routing.proposal.byPlayerId, routing.proposal.choiceId, "proposal");
      } else {
        pushLog(room, `${player.name} rejected the recommendation.`);
        room.session = { ...session, routing: { ...routing, proposal: null } };
        broadcastSession(room);
      }
      return;
    }
    case "vote": {
      const routing = session.routing;
      if (session.phase !== "simulation" || !routing || routing.mode !== "vote") return;
      if (!session.simulation?.pendingEvent) return;
      const choiceId = String(msg.choiceId);
      const event = session.simulation.pendingEvent.event;
      if (!event.choices.some((c) => c.id === choiceId)) return;
      if (routing.votes.some((v) => v.playerId === playerId)) return; // one vote each

      const votes = [...routing.votes, { playerId, playerName: player.name, choiceId }];
      const next: MPSession = { ...session, routing: { ...routing, votes } };
      room.session = next;
      broadcastSession(room);

      if (voteComplete(next, next.routing!)) {
        const winner = tallyVotes(next.routing!) ?? event.choices[0].id;
        const supporters = votes.filter((v) => v.choiceId === winner);
        applyChoice(room, supporters[0]?.playerId ?? playerId, winner, "vote");
      }
      return;
    }
    case "resolve_vote": {
      const routing = session.routing;
      if (session.phase !== "simulation" || !routing || routing.mode !== "vote") return;
      if (routing.votes.length === 0) return;
      const event = session.simulation?.pendingEvent?.event;
      if (!event) return;
      const winner = tallyVotes(routing) ?? event.choices[0].id;
      const supporters = routing.votes.filter((v) => v.choiceId === winner);
      applyChoice(room, supporters[0]?.playerId ?? playerId, winner, "vote");
      return;
    }
    case "finish": {
      if (session.phase !== "simulation" || !session.simulation) return;
      if (session.simulation.stagePhase !== "complete" && session.simulation.status !== "failure") return;
      const mission = effectiveMission(session);
      if (!mission) return;
      const result = finalizeSimulation(session.simulation, mission, session.design);

      // Science objective credit for scientist-role players (match by objective
      // id against the mission definition — ObjectiveResult carries no target).
      let next = session;
      for (const o of result.completedObjectives) {
        const target = mission.objectives.find((mo) => mo.id === o.id)?.target;
        if (target && (target.kind === "scienceData" || target.kind === "dataTransmitted")) {
          next = creditScienceObjective(next, o.description);
        }
      }
      room.session = { ...next, result, phase: "report" };
      pushLog(room, `Mission closed — ${result.status.toUpperCase()} — ${result.score}/1000.`);
      broadcastSession(room);
      return;
    }

    // ---------------------------------------------------------------- report
    case "again": {
      if (!isHost(room, playerId)) {
        sendTo(ws, { t: "error", message: "Only the host can return the team to the lobby." });
        return;
      }
      const players = session.players.map((p) => ({
        ...p,
        ready: false,
        stats: { decisions: 0, recommendationsAccepted: 0, emergenciesResolved: 0, scienceObjectives: 0, choiceQualities: [] },
      }));
      const host = players.find((p) => p.id === session.hostId) ?? players[0];
      room.session = { ...createSession(session.code, host), players, hostId: session.hostId, design: emptyConfig("none") };
      pushLog(room, "Team returned to the lobby.");
      broadcastSession(room);
      return;
    }

    case "leave": {
      handleDisconnect(ws);
      return;
    }

    default:
      return;
  }
}

function handleDisconnect(ws: WsLike) {
  const info = connInfo.get(ws);
  if (!info) return;
  const room = rooms.get(info.roomCode);
  if (!room) return;
  const sockets = room.sockets.get(info.playerId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) room.sockets.delete(info.playerId);
  }

  // Still connected through another socket? Then nothing changed.
  if (room.sockets.has(info.playerId)) return;

  const player = getPlayer(room.session, info.playerId);
  room.session = {
    ...room.session,
    players: room.session.players.map((p) => (p.id === info.playerId ? { ...p, connected: false } : p)),
  };
  if (player) pushLog(room, `${player.name} disconnected — their seat is held for reconnection.`);

  // Host migration keeps the lobby alive if the host drops.
  room.session = migrateHost(room.session);

  const anyConnected = room.session.players.some((p) => p.connected);
  if (!anyConnected && room.lastEmpty === null) room.lastEmpty = Date.now();

  broadcastSession(room);
  console.log(`[room ${info.roomCode}] ${player?.name ?? info.playerId} disconnected`);
}

// ---------------------------------------------------------------------------
// Garbage collection of abandoned rooms
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyConnected = room.session.players.some((p) => p.connected);
    if (!anyConnected && room.lastEmpty !== null && now - room.lastEmpty > ROOM_TTL_MS) {
      rooms.delete(code);
      console.log(`[room ${code}] expired (empty for ${Math.round(ROOM_TTL_MS / 60000)} min)`);
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

/** LAN IPv4 addresses teammates can connect to (excludes loopback addresses). */
function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const addr of list ?? []) {
      // `family` is "IPv4" on Node/older Bun and the number 4 on some Bun versions.
      const isV4 = (addr.family as string | number) === "IPv4" || (addr.family as string | number) === 4;
      if (isV4 && !addr.internal) out.push(addr.address);
    }
  }
  return [...new Set(out)];
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-private-network": "true" };

/**
 * What a person sees if they paste this server's address into a browser tab.
 * A WebSocket endpoint is not a web page — the game page lives on the web port —
 * so instead of a confusing dump we explain that and link to the real game.
 */
function landingPage(host: string): string {
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const hostname = esc(host.replace(/:\d+$/, ""));
  const game = `http://${hostname}:${WEB_PORT}/`;
  const ips = lanAddresses();
  const invites = (ips.length ? ips : [hostname])
    .map((ip) => `<li><code>http://${ip}:${WEB_PORT}/</code></li>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mission Control — multiplayer server</title>
<style>body{font:15px/1.55 system-ui,sans-serif;background:#050b16;color:#d6e4f5;margin:0;padding:32px;max-width:640px}
h1{font-size:20px;color:#7dd3fc}code{background:#0d1b2e;padding:2px 6px;border-radius:4px;color:#67e8f9}
a{color:#7dd3fc}.ok{color:#6ee7b7}.box{border:1px solid #1e3a5f;border-radius:8px;padding:14px 18px;margin:16px 0;background:#08142a}</style></head>
<body><h1>MISSION CONTROL — multiplayer server</h1>
<p class="ok">✔ The server is running (${rooms.size} room(s) open).</p>
<div class="box"><b>This port is the game's socket, not the game itself.</b><br>
You can't open <code>ws://…</code> addresses in a browser tab — nothing will ever load that way.
Players only type this address <i>inside</i> the game, if they type it at all.</div>
<p><b>To play:</b> open the game page in the browser, choose <i>Multiplayer</i>, and host or join a room.</p>
<ul><li>On the host: <a href="${game}">${game}</a></li>
<li>On other devices (same Wi-Fi/LAN), use the host's LAN address:<ul>${invites}</ul></li></ul>
<p>The host's lobby shows a ready-made invite link to share.</p>
</body></html>`;
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(req, srv) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...CORS, "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "*" },
      });
    }
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          rooms: rooms.size,
          players: [...rooms.values()].reduce((s, r) => s + r.session.players.filter((p) => p.connected).length, 0),
          // Lets the lobby build an invite link that works from OTHER devices.
          lan: lanAddresses(),
          wsPort: PORT,
          webPort: WEB_PORT,
        }),
        { headers: { "content-type": "application/json", ...CORS } }
      );
    }
    if (url.pathname === "/rooms") {
      return new Response(
        JSON.stringify({
          rooms: [...rooms.values()].map((r) => ({
            code: r.session.code,
            players: r.session.players.filter((p) => p.connected).length,
            phase: r.session.phase,
          })),
        }),
        { headers: { "content-type": "application/json", ...CORS } }
      );
    }
    if (srv.upgrade(req, { data: undefined })) return;
    // A plain browser visit (not a WebSocket upgrade): explain instead of dumping text.
    return new Response(landingPage(req.headers.get("host") ?? `localhost:${PORT}`), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", ...CORS },
    });
  },
  websocket: {
    open(_ws) {
      // nothing until the client sends create/join
    },
    message(ws, message) {
      try {
        handleMessage(ws as WsLike, message as string | Buffer);
      } catch (err) {
        console.error("message handler error:", err);
        sendTo(ws as WsLike, { t: "error", message: "Internal server error." });
      }
    },
    close(ws) {
      handleDisconnect(ws as WsLike);
    },
  },
});

// ---------------------------------------------------------------------------
// Startup banner + keep-alive heartbeat
//
// The server runs in the FOREGROUND and produces no output while idle —
// which is correct, but looks like a freeze if you don't know that. So:
// print a READY line with the auto-detected LAN address, and a heartbeat
// every 30 seconds so it is always visibly alive.
// ---------------------------------------------------------------------------

const startedAt = Date.now();

function uptime(): string {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

const lans = lanAddresses();

console.log(`\n  MISSION CONTROL: BEYOND EARTH — multiplayer server`);
console.log(`  Listening on ws://0.0.0.0:${server.port}`);
console.log(`  Health check:      http://localhost:${server.port}/health`);
if (lans.length > 0) {
  console.log(`\n  READY — teammates on this network open the GAME PAGE in their browser:`);
  for (const ip of lans) console.log(`    http://${ip}:${WEB_PORT}/        (multiplayer socket: ws://${ip}:${server.port})`);
  console.log(`\n  The host's lobby also shows a one-click invite link to share.`);
  console.log(`  NOTE: ws:// addresses are NOT typed into the browser's address bar —`);
  console.log(`  they only work inside the game.`);
} else {
  console.log(`\n  No LAN address auto-detected — find this machine's IPv4 manually:`);
  console.log(`    Windows:  ipconfig          (look for "IPv4 Address")`);
  console.log(`    macOS:    ipconfig getifaddr en0`);
  console.log(`    Linux:    hostname -I`);
}
console.log(`\n  KEEP THIS WINDOW OPEN while playing. The server runs in the`);
console.log(`  foreground and prints a heartbeat every 30 seconds. Ctrl+C stops it.`);
console.log(`  Windows Firewall: allow inbound TCP ${server.port} for Bun when prompted.`);
console.log(``);

setInterval(() => {
  const players = [...rooms.values()].reduce(
    (s, r) => s + r.session.players.filter((p) => p.connected).length,
    0
  );
  // NOTE: no leading "[h..." — Bun's console strips that prefix (cursor-home
  // ANSI sanitizer quirk), which mangles lines like "[heartbeat ...]".
  console.log(`heartbeat ${uptime()} · ${rooms.size} room(s), ${players} player(s) connected — server running`);
}, 30_000);

function shutdown() {
  console.log(`\n  Multiplayer server stopped (Ctrl+C) — goodbye.`);
  server.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { server };
