"use client";

/**
 * ============================================================================
 * MULTIPLAYER STORE — client side of the cooperative session (v2.0)
 * ============================================================================
 * Owns the WebSocket connection to the multiplayer server and mirrors the
 * authoritative session state. ALL game logic stays on the server; this store
 * only sends intents (set_role, decide, vote…) and renders what comes back.
 *
 * Identity (name + reconnection token + last server URL) is kept in
 * localStorage so a page reload can rejoin the same seat.
 * ============================================================================
 */

import { create } from "zustand";
import type { MPSession, MPEventRouting } from "@/lib/game/multiplayer";
import type { DifficultySetting } from "@/lib/game/types";

export type MPConnection = "idle" | "connecting" | "connected" | "error";

interface MPIdentity {
  name: string;
  token: string | null;
  roomCode: string | null;
}

const IDENTITY_KEY = "mission-control-mp-identity";
const SERVER_KEY = "mission-control-mp-server";
const DEFAULT_PORT = 3001;

/**
 * Identity is split on purpose:
 *  - the callsign (name) lives in localStorage so it is remembered everywhere;
 *  - the reconnection token + room code live in sessionStorage, i.e. PER TAB.
 *    If they were shared through localStorage, a second tab (or a second
 *    window of the same browser) would silently "rejoin" as the host's own
 *    seat instead of joining as a new player.
 */
function loadIdentity(): MPIdentity {
  const empty: MPIdentity = { name: "", token: null, roomCode: null };
  if (typeof window === "undefined") return empty;
  const identity = { ...empty };
  try {
    const rawName = window.localStorage.getItem(IDENTITY_KEY);
    if (rawName) identity.name = String((JSON.parse(rawName) as Partial<MPIdentity>).name ?? "");
  } catch {
    /* ignore */
  }
  try {
    const rawSeat = window.sessionStorage.getItem(IDENTITY_KEY);
    if (rawSeat) {
      const seat = JSON.parse(rawSeat) as Partial<MPIdentity>;
      identity.token = seat.token ?? null;
      identity.roomCode = seat.roomCode ?? null;
    }
  } catch {
    /* ignore */
  }
  return identity;
}

function saveIdentity(identity: MPIdentity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify({ name: identity.name }));
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.setItem(IDENTITY_KEY, JSON.stringify({ token: identity.token, roomCode: identity.roomCode }));
  } catch {
    /* ignore */
  }
}

function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || h === "0.0.0.0" || h.startsWith("127.");
}

/**
 * Turn whatever a player typed into a valid WebSocket URL.
 * Accepts: ws://1.2.3.4:3001 · wss://… · http://1.2.3.4:3001 · 1.2.3.4 · 1.2.3.4:3001
 * (http/https are mapped to ws/wss, a missing port defaults to 3001, any path is dropped).
 */
export function normalizeServerUrl(input: string): string {
  let raw = input.trim();
  if (!raw) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `ws://${raw}`;
  try {
    const u = new URL(raw);
    const secure = u.protocol === "wss:" || u.protocol === "https:";
    const port = u.port || String(DEFAULT_PORT);
    const host = u.hostname.includes(":") ? `[${u.hostname}]` : u.hostname;
    return `${secure ? "wss" : "ws"}://${host}:${port}`;
  } catch {
    return input.trim();
  }
}

/** The WebSocket URL's host, or "" if it cannot be parsed. */
function hostOf(wsUrl: string): string {
  try {
    return new URL(wsUrl).hostname;
  } catch {
    return "";
  }
}

/**
 * Where to connect by default: the SAME machine that served this page.
 * Someone who opened http://192.168.1.10:3000 gets ws://192.168.1.10:3001 with
 * no typing. A remembered address is only reused if it still makes sense — a
 * leftover "localhost" must never win when the page itself came from a LAN IP,
 * because "localhost" on a joiner's device is the joiner's own device.
 */
export function defaultServerUrl(): string {
  if (typeof window === "undefined") return `ws://localhost:${DEFAULT_PORT}`;
  const pageHost = window.location.hostname || "localhost";
  const fallback = `ws://${pageHost.includes(":") ? `[${pageHost}]` : pageHost}:${DEFAULT_PORT}`;
  try {
    const stored = window.localStorage.getItem(SERVER_KEY);
    if (stored) {
      const storedHost = hostOf(stored);
      if (storedHost && !(isLoopbackHost(storedHost) && !isLoopbackHost(pageHost))) return stored;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** The http(s) origin of the multiplayer server (for /health lookups). */
export function serverHttpOrigin(wsUrl: string): string {
  try {
    const u = new URL(wsUrl);
    return `${u.protocol === "wss:" ? "https" : "http"}://${u.host}`;
  } catch {
    return "";
  }
}

interface MultiplayerStore {
  connection: MPConnection;
  serverUrl: string;
  identity: MPIdentity;
  session: MPSession | null;
  /** my player id in the session */
  myId: string | null;
  lastError: string | null;
  ws: WebSocket | null;
  /** Room code taken from an invite link (?join=CODE); consumed by the entry screen. */
  inviteCode: string | null;

  setInviteCode: (code: string | null) => void;
  setServerUrl: (url: string) => void;
  setName: (name: string) => void;
  connect: (url?: string) => Promise<void>;
  disconnect: () => void;
  createRoom: () => void;
  joinRoom: (roomCode: string) => void;
  send: (message: Record<string, unknown>) => void;

  // intents
  setRole: (role: string, on: boolean) => void;
  setReady: (ready: boolean) => void;
  selectMission: (missionId: string) => void;
  setDifficulty: (difficulty: DifficultySetting, constraintIds: string[], constraintSeed: number) => void;
  rerollConstraints: () => void;
  startSession: () => void;
  setQuantity: (equipmentId: string, quantity: number) => void;
  clearDesign: () => void;
  launch: () => void;
  advance: () => void;
  decide: (choiceId: string) => void;
  propose: (choiceId: string) => void;
  approve: (accept: boolean) => void;
  vote: (choiceId: string) => void;
  resolveVote: () => void;
  finish: () => void;
  playAgain: () => void;
  clearError: () => void;
}

export const useMultiplayerStore = create<MultiplayerStore>()((set, get) => ({
  connection: "idle",
  serverUrl: "",
  identity: { name: "", token: null, roomCode: null },
  session: null,
  myId: null,
  lastError: null,
  ws: null,
  inviteCode: null,

  setInviteCode: (code) => set({ inviteCode: code ? code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || null : null }),

  setServerUrl: (url) => {
    const clean = normalizeServerUrl(url);
    set({ serverUrl: clean });
    if (typeof window !== "undefined") window.localStorage.setItem(SERVER_KEY, clean);
  },

  setName: (name) => {
    const identity = { ...get().identity, name };
    set({ identity });
    saveIdentity(identity);
  },

  connect: async (url) => {
    const target = normalizeServerUrl(url ?? (get().serverUrl || defaultServerUrl())) || defaultServerUrl();
    get().disconnect();
    set({ connection: "connecting", lastError: null, serverUrl: target });
    if (typeof window !== "undefined") window.localStorage.setItem(SERVER_KEY, target);

    // Explain the two classic mistakes BEFORE the browser gives a vague failure.
    const pageHost = typeof window !== "undefined" ? window.location.hostname : "";
    const targetHost = hostOf(target);
    const pointsAtSelf = isLoopbackHost(targetHost) && !!pageHost && !isLoopbackHost(pageHost);
    const mixedContent = typeof window !== "undefined" && window.location.protocol === "https:" && target.startsWith("ws://");
    const failureHint = pointsAtSelf
      ? `"${targetHost}" means THIS device, not the host. Use the host's LAN address instead (e.g. ws://192.168.1.10:3001).`
      : mixedContent
        ? `This page is served over https, so the browser blocks plain ws:// sockets. Open the game over http://<host-ip>:3000 on the local network.`
        : null;

    return new Promise<void>((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(target);
      } catch (err) {
        set({ connection: "error", lastError: `Could not open a socket to ${target}.` });
        reject(err);
        return;
      }

      const openTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          set({ connection: "error", lastError: failureHint ?? `Connection to ${target} timed out. Is the multiplayer server running (bun run multiplayer) and port ${DEFAULT_PORT} open in the firewall?` });
          reject(new Error("timeout"));
        }
      }, 6000);

      ws.onopen = () => {
        clearTimeout(openTimer);
        set({ ws, connection: "connected", lastError: null });
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(openTimer);
        set({ connection: "error", lastError: failureHint ?? `Could not reach ${target}. Check that the host is running "bun run multiplayer", the IP is right, and port ${DEFAULT_PORT} is allowed through the firewall.` });
        reject(new Error("socket error"));
      };
      ws.onclose = () => {
        if (get().ws === ws) {
          set({ ws: null, connection: "idle" });
        }
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          switch (msg.t) {
            case "session": {
              set({ session: msg.session as MPSession });
              break;
            }
            case "joined": {
              const identity = { ...get().identity, token: msg.token, roomCode: msg.roomCode };
              saveIdentity(identity);
              set({
                session: msg.session as MPSession,
                myId: msg.playerId,
                identity,
                lastError: null,
              });
              break;
            }
            case "error": {
              set({ lastError: String(msg.message ?? "Unknown error") });
              break;
            }
            case "pong":
              break;
          }
        } catch {
          /* ignore malformed */
        }
      };

      set({ ws });
    });
  },

  disconnect: () => {
    const ws = get().ws;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.close();
    }
    set({ ws: null, connection: "idle", session: null, myId: null });
  },

  createRoom: () => {
    const { identity, ws } = get();
    if (!ws) return;
    ws.send(JSON.stringify({ t: "create", name: identity.name || "Commander" }));
  },

  joinRoom: (roomCode) => {
    const { identity, ws } = get();
    if (!ws) return;
    const code = roomCode.toUpperCase().trim();
    // A reconnection token only means something in the room it was issued for.
    // Sending it with a different code would be wrong (and, in a shared tab,
    // could reclaim someone else's seat), so a fresh room gets a fresh seat.
    const token = identity.roomCode === code ? identity.token : null;
    ws.send(JSON.stringify({ t: "join", roomCode: code, name: identity.name || "Operator", token }));
  },

  send: (message) => {
    const ws = get().ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(message));
  },

  // ---------------------------------------------------------------- intents
  setRole: (role, on) => get().send({ t: "set_role", role, on }),
  setReady: (ready) => get().send({ t: "set_ready", ready }),
  selectMission: (missionId) => get().send({ t: "select_mission", missionId }),
  setDifficulty: (difficulty, constraintIds, constraintSeed) =>
    get().send({ t: "set_difficulty", difficulty, constraintIds, constraintSeed }),
  rerollConstraints: () => get().send({ t: "reroll_constraints" }),
  startSession: () => get().send({ t: "start" }),
  setQuantity: (equipmentId, quantity) => get().send({ t: "set_quantity", equipmentId, quantity }),
  clearDesign: () => get().send({ t: "clear_design" }),
  launch: () => get().send({ t: "launch" }),
  advance: () => get().send({ t: "advance" }),
  decide: (choiceId) => get().send({ t: "decide", choiceId }),
  propose: (choiceId) => get().send({ t: "propose", choiceId }),
  approve: (accept) => get().send({ t: "approve", accept }),
  vote: (choiceId) => get().send({ t: "vote", choiceId }),
  resolveVote: () => get().send({ t: "resolve_vote" }),
  finish: () => get().send({ t: "finish" }),
  playAgain: () => get().send({ t: "again" }),
  clearError: () => set({ lastError: null }),
}));

/** Convenience selector: my player record, or null. */
export function me(session: MPSession | null, myId: string | null) {
  if (!session || !myId) return null;
  return session.players.find((p) => p.id === myId) ?? null;
}

/** Do I hold the given role? */
export function iHoldRole(session: MPSession | null, myId: string | null, role: string): boolean {
  return !!me(session, myId)?.roles.includes(role as never);
}

/** Can I act on the current routing? */
export function canIAct(session: MPSession | null, myId: string | null): boolean {
  if (!session?.routing || !myId) return false;
  const r = session.routing;
  if (r.mode === "vote") return true;
  return r.eligiblePlayerIds.includes(myId);
}

/** Is the current routing waiting specifically on me? */
export function waitingOnMe(session: MPSession | null, myId: string | null): boolean {
  if (!session?.routing || !myId) return false;
  const r: MPEventRouting = session.routing;
  if (!session.simulation?.pendingEvent) return false;
  if (r.mode === "solo") return r.eligiblePlayerIds.includes(myId);
  if (r.mode === "proposal") {
    if (!r.proposal) return r.eligiblePlayerIds.includes(myId);
    // waiting for commander approval
    return iHoldRole(session, myId, "commander") && r.proposal.byPlayerId !== myId;
  }
  if (r.mode === "vote") {
    return !r.votes.some((v) => v.playerId === myId);
  }
  return false;
}
