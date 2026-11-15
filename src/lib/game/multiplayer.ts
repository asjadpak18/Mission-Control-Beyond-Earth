/**
 * ============================================================================
 * MULTIPLAYER ENGINE — pure cooperative-session logic (v2.0)
 * ============================================================================
 * Everything a host-authoritative multiplayer server needs to run a shared
 * mission, expressed as pure functions over an MPSession state:
 *
 * - Role definitions and role ↔ player assignment (players may hold
 *   multiple roles when fewer than four people join).
 * - Event routing: which players may act on a pending event.
 * - Cooperative decision modes: proposal → approval, and team voting.
 * - Per-player contribution statistics that supplement the shared team score.
 *
 * The WebSocket server (server/multiplayer-server.ts) is a thin transport
 * around these functions; the browser client mirrors the session state.
 * No I/O and no hidden randomness live here — the underlying simulation
 * stays fully deterministic for a given (seed, spacecraft, decisions).
 * ============================================================================
 */

import {
  PlayerRole,
  RoleDefinition,
  MissionEvent,
  SimulationState,
  SpacecraftConfig,
  SimulationResult,
  ContributionStats,
  DifficultySetting,
  emptyContributionStats,
} from "./types";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES: RoleDefinition[] = [
  {
    id: "commander",
    title: "Mission Commander",
    shortTitle: "COMMANDER",
    description:
      "Holds overall mission authority. Approves critical decisions, arbitrates conflicting priorities and owns the objectives.",
    responsibilities: [
      "Approve or reject critical cooperative decisions",
      "Arbitrate conflicting mission priorities",
      "Monitor mission objectives and team focus",
      "Call team votes to a close",
    ],
    accent: "cyan",
  },
  {
    id: "engineer",
    title: "Chief Engineer",
    shortTitle: "ENGINEER",
    description:
      "Owns the spacecraft. Watches health telemetry, manages equipment failures, power and thermal systems.",
    responsibilities: [
      "Receive engineering emergencies (power, thermal, engines)",
      "Recommend solutions for cooperative technical decisions",
      "Monitor reliability and structural integrity",
      "Manage the shared spacecraft design",
    ],
    accent: "amber",
  },
  {
    id: "navigator",
    title: "Navigation & Flight Director",
    shortTitle: "NAVIGATION",
    description:
      "Owns the trajectory. Manages course corrections, propellant, navigation accuracy and arrival decisions.",
    responsibilities: [
      "Receive trajectory and propellant events",
      "Recommend burns and corrections",
      "Watch the fuel gauge and arrival windows",
      "Own landing-sequence decisions",
    ],
    accent: "sky",
  },
  {
    id: "scientist",
    title: "Science & Communications Officer",
    shortTitle: "SCIENCE & COMMS",
    description:
      "Owns the data. Runs instruments, prioritises research, manages communications and the downlink.",
    responsibilities: [
      "Receive discoveries and instrument events",
      "Prioritise scientific objectives",
      "Manage communication interruptions",
      "Maximise the science data that reaches Earth",
    ],
    accent: "emerald",
  },
];

export const ROLES_BY_ID: Record<PlayerRole, RoleDefinition> = Object.fromEntries(
  ROLES.map((r) => [r.id, r])
) as Record<PlayerRole, RoleDefinition>;

export const ALL_ROLES: PlayerRole[] = ["commander", "engineer", "navigator", "scientist"];

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export const MAX_PLAYERS = 4;

export interface MPPlayer {
  id: string;
  name: string;
  roles: PlayerRole[];
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  stats: ContributionStats;
}

export type MPPhase = "lobby" | "design" | "simulation" | "report";

export interface MPProposal {
  eventId: string;
  choiceId: string;
  byPlayerId: string;
  byPlayerName: string;
}

export interface MPVote {
  playerId: string;
  playerName: string;
  choiceId: string;
}

/** Routing + cooperation state for the currently pending event, if any. */
export interface MPEventRouting {
  eventId: string;
  eventTitle: string;
  /** Roles the event is addressed to (empty = whole team). */
  targetRoles: PlayerRole[];
  /** ids of players allowed to act (role holders; everyone if unaddressed). */
  eligiblePlayerIds: string[];
  /** "solo" (eligible player decides), "proposal" (propose → approve) or "vote". */
  mode: "solo" | "proposal" | "vote";
  proposal: MPProposal | null;
  votes: MPVote[];
}

export interface MPSession {
  code: string;
  hostId: string;
  players: MPPlayer[];
  phase: MPPhase;
  missionId: string | null;
  difficulty: DifficultySetting;
  constraintIds: string[];
  constraintSeed: number;
  seed: number;
  design: SpacecraftConfig;
  simulation: SimulationState | null;
  result: SimulationResult | null;
  routing: MPEventRouting | null;
  log: string[];
}

export function createSession(code: string, host: MPPlayer): MPSession {
  return {
    code,
    hostId: host.id,
    players: [host],
    phase: "lobby",
    missionId: null,
    difficulty: "Intermediate",
    constraintIds: [],
    constraintSeed: 0,
    seed: 0,
    design: { missionId: "none", components: [] },
    simulation: null,
    result: null,
    routing: null,
    log: [`${host.name} opened room ${code}.`],
  };
}

export function makePlayer(id: string, name: string, isHost = false): MPPlayer {
  return { id, name, roles: [], ready: false, connected: true, isHost, stats: emptyContributionStats() };
}

export function getPlayer(session: MPSession, playerId: string): MPPlayer | undefined {
  return session.players.find((p) => p.id === playerId);
}

/** Roles currently held by at least one connected player. */
export function assignedRoles(session: MPSession): PlayerRole[] {
  const set = new Set<PlayerRole>();
  for (const p of session.players) if (p.connected) p.roles.forEach((r) => set.add(r));
  return [...set];
}

/** Roles with no connected holder — their events open to the whole team. */
export function unassignedRoles(session: MPSession): PlayerRole[] {
  const assigned = new Set(assignedRoles(session));
  return ALL_ROLES.filter((r) => !assigned.has(r));
}

// ---------------------------------------------------------------------------
// Event routing
// ---------------------------------------------------------------------------

export interface RoutingDecision {
  targetRoles: PlayerRole[];
  eligiblePlayerIds: string[];
  mode: "solo" | "proposal" | "vote";
}

/**
 * Decide who acts on a pending event.
 * - No roles tagged → whole team; cooperative mode decides the mechanics.
 * - Tagged roles → players holding those roles. If nobody connected holds
 *   the role, the event opens to the whole team (unassigned responsibility).
 * - "proposal": a role holder proposes; any connected commander approves.
 *   If no commander is connected, the proposal applies directly.
 * - "vote": every connected player casts one vote; majority wins.
 */
export function routeEvent(event: MissionEvent, session: MPSession): RoutingDecision {
  const targetRoles = (event.roles ?? []) as PlayerRole[];
  const connected = session.players.filter((p) => p.connected);
  let eligible: MPPlayer[];

  if (targetRoles.length === 0) {
    eligible = connected;
  } else {
    const holders = connected.filter((p) => p.roles.some((r) => targetRoles.includes(r)));
    eligible = holders.length > 0 ? holders : connected;
  }

  const mode: RoutingDecision["mode"] = event.cooperative === "proposal" ? "proposal" : event.cooperative === "vote" ? "vote" : "solo";
  return { targetRoles, eligiblePlayerIds: eligible.map((p) => p.id), mode };
}

export function canActOn(routing: MPEventRouting | null, playerId: string): boolean {
  if (!routing) return false;
  if (routing.mode === "proposal") {
    // Eligible players may propose; commanders (and the proposer) may act on the proposal.
    return routing.eligiblePlayerIds.includes(playerId);
  }
  if (routing.mode === "vote") return true;
  return routing.eligiblePlayerIds.includes(playerId);
}

/** Whether the approval step is required for a proposal (i.e. a commander is present). */
export function proposalNeedsCommander(session: MPSession): boolean {
  return session.players.some((p) => p.connected && p.roles.includes("commander"));
}

/** All connected players have voted → the vote can be tallied. */
export function voteComplete(session: MPSession, routing: MPEventRouting): boolean {
  const connected = session.players.filter((p) => p.connected);
  if (connected.length === 0) return false;
  return connected.every((p) => routing.votes.some((v) => v.playerId === p.id));
}

export function tallyVotes(routing: MPEventRouting): string | null {
  if (routing.votes.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of routing.votes) counts.set(v.choiceId, (counts.get(v.choiceId) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [choiceId, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && choiceId < best)) {
      best = choiceId;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Contributions
// ---------------------------------------------------------------------------

export interface DecisionCredit {
  playerId: string;
  event: MissionEvent;
  choiceId: string;
  via: "solo" | "proposal" | "vote";
}

/** Quality of the chosen option, used for contribution scoring. */
function choiceQuality(event: MissionEvent, choiceId: string): number {
  return event.choices.find((c) => c.id === choiceId)?.effects.quality ?? 0.6;
}

/** Whether an event counts as an "emergency" for contribution stats. */
function isEmergency(event: MissionEvent): boolean {
  const emergencyHints = [
    "malfunction", "failure", "fault", "anomaly", "emergency", "damage", "storm",
    "impact", "strike", "undervoltage", "overheating", "leak", "stuck", "concern",
    "degradation", "deviation", "dropouts", "interruption", "crunch", "tightening",
  ];
  const text = `${event.title} ${event.description}`.toLowerCase();
  return emergencyHints.some((h) => text.includes(h));
}

export function creditDecision(session: MPSession, credit: DecisionCredit): MPSession {
  const players = session.players.map((p) => {
    if (p.id !== credit.playerId) return p;
    const stats: ContributionStats = {
      decisions: p.stats.decisions + 1,
      recommendationsAccepted:
        p.stats.recommendationsAccepted + (credit.via === "proposal" ? 1 : 0),
      emergenciesResolved:
        p.stats.emergenciesResolved + (isEmergency(credit.event) ? 1 : 0),
      scienceObjectives: p.stats.scienceObjectives,
      choiceQualities: [...p.stats.choiceQualities, choiceQuality(credit.event, credit.choiceId)],
    };
    return { ...p, stats };
  });
  return { ...session, players };
}

/** Science/comms officers earn science credit for completed science objectives. */
export function creditScienceObjective(session: MPSession, objectiveDescription: string): MPSession {
  const players = session.players.map((p) =>
    p.roles.includes("scientist")
      ? { ...p, stats: { ...p.stats, scienceObjectives: p.stats.scienceObjectives + 1 } }
      : p
  );
  void objectiveDescription;
  return { ...session, players };
}

export interface PlayerContributionReport {
  playerId: string;
  name: string;
  roles: PlayerRole[];
  decisions: number;
  recommendationsAccepted: number;
  emergenciesResolved: number;
  scienceObjectives: number;
  averageQuality: number;
}

export function contributionReports(session: MPSession): PlayerContributionReport[] {
  return session.players.map((p) => {
    const q = p.stats.choiceQualities;
    return {
      playerId: p.id,
      name: p.name,
      roles: p.roles,
      decisions: p.stats.decisions,
      recommendationsAccepted: p.stats.recommendationsAccepted,
      emergenciesResolved: p.stats.emergenciesResolved,
      scienceObjectives: p.stats.scienceObjectives,
      averageQuality: q.length > 0 ? q.reduce((a, b) => a + b, 0) / q.length : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Lobby helpers
// ---------------------------------------------------------------------------

/** A lobby is launch-ready when every connected player is ready and at least one player holds a role. */
export function lobbyReady(session: MPSession): { ok: boolean; reason?: string } {
  const connected = session.players.filter((p) => p.connected);
  if (!session.missionId) return { ok: false, reason: "Select a mission first." };
  if (assignedRoles(session).length === 0) return { ok: false, reason: "At least one player must claim a role." };
  const notReady = connected.filter((p) => !p.ready);
  if (notReady.length > 0) return { ok: false, reason: `Waiting for: ${notReady.map((p) => p.name).join(", ")}.` };
  return { ok: true };
}

/** Promote the first connected non-host player to host (host migration). */
export function migrateHost(session: MPSession): MPSession {
  if (session.players.some((p) => p.id === session.hostId && p.connected)) return session;
  const nextHost = session.players.find((p) => p.connected && p.id !== session.hostId);
  if (!nextHost) return session;
  return {
    ...session,
    hostId: nextHost.id,
    players: session.players.map((p) => ({ ...p, isHost: p.id === nextHost.id })),
    log: [...session.log, `${nextHost.name} promoted to host.`],
  };
}

/** Default role assignment when players claim none: give each player a share. */
export function autoAssignRoles(session: MPSession): MPSession {
  const connected = session.players.filter((p) => p.connected);
  if (connected.length === 0) return session;
  const per = Math.max(1, Math.ceil(ALL_ROLES.length / connected.length));
  const players = session.players.map((p) => {
    if (!p.connected || p.roles.length > 0) return p;
    const idx = connected.findIndex((c) => c.id === p.id);
    if (idx < 0) return p;
    return { ...p, roles: ALL_ROLES.slice(idx * per, (idx + 1) * per) };
  });
  return { ...session, players };
}
