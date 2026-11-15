"use client";

/**
 * ============================================================================
 * MULTIPLAYER APP — cooperative mission flow (v2.0)
 * ============================================================================
 * Phases, all mirrored from the authoritative server session:
 *   entry → lobby (roles / mission / difficulty) → design (shared spacecraft)
 *   → simulation (role dashboards, cooperative decisions) → report (team +
 *   individual contributions).
 *
 * Every action is an intent sent to the host-authoritative server; the UI
 * never computes game outcomes itself.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleCheck, CircleDashed, CircleX, Coins,
  Copy, Dices, Flame, Gauge, Info, Link2, Lock, Microscope, Minus, Play, Plus, RadioTower, RotateCcw, Scale,
  ScrollText, Signal, TriangleAlert, Users, Wifi, WifiOff, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MISSIONS } from "@/lib/game/missions";
import { EQUIPMENT, EQUIPMENT_BY_ID, EQUIPMENT_CATEGORIES, getEquipment } from "@/lib/game/equipment";
import { computeResources, formatMoney, installedQuantity, withQuantity } from "@/lib/game/calculations";
import { validateSpacecraft } from "@/lib/game/validation";
import { applyDifficulty, DIFFICULTY_SETTINGS, CONSTRAINT_POOL } from "@/lib/game/constraints";
import { STAGE_DEFS } from "@/lib/game/simulation";
import { ROLES, ROLES_BY_ID, contributionReports, type PlayerContributionReport } from "@/lib/game/multiplayer";
import type { DifficultySetting, PlayerRole, MissionEvent } from "@/lib/game/types";
import { useGameStore } from "@/store/gameStore";
import {
  useMultiplayerStore, me, canIAct, waitingOnMe, defaultServerUrl, normalizeServerUrl, serverHttpOrigin,
} from "@/store/multiplayerStore";
import { Chip, DifficultyBadge, EduTooltip, SectionHeading, StatBar, StatusBadge } from "@/components/game/shared";
import { SpacecraftCanvas } from "@/components/game/SpacecraftCanvas";
import { MissionVisualizer } from "@/components/game/MissionVisualizer";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function effectiveMissionOf(session: NonNullable<ReturnType<typeof useMultiplayerStore.getState>["session"]>) {
  const base = MISSIONS.find((m) => m.id === session.missionId);
  if (!base) return null;
  return applyDifficulty(base, session.difficulty, session.constraintIds, session.constraintSeed).mission;
}

const ROLE_ACCENTS: Record<PlayerRole, { border: string; text: string; bg: string }> = {
  commander: { border: "border-cyan-400/50", text: "text-cyan-300", bg: "bg-cyan-400/10" },
  engineer: { border: "border-amber-400/50", text: "text-amber-300", bg: "bg-amber-400/10" },
  navigator: { border: "border-sky-400/50", text: "text-sky-300", bg: "bg-sky-400/10" },
  scientist: { border: "border-emerald-400/50", text: "text-emerald-300", bg: "bg-emerald-400/10" },
};

// ---------------------------------------------------------------------------
// Entry screen — connect, host or join
// ---------------------------------------------------------------------------

function EntryScreen() {
  const setMode = useGameStore((s) => s.setMode);
  const connection = useMultiplayerStore((s) => s.connection);
  const serverUrl = useMultiplayerStore((s) => s.serverUrl);
  const identity = useMultiplayerStore((s) => s.identity);
  const lastError = useMultiplayerStore((s) => s.lastError);
  const connect = useMultiplayerStore((s) => s.connect);
  const setName = useMultiplayerStore((s) => s.setName);
  const setServerUrl = useMultiplayerStore((s) => s.setServerUrl);
  const createRoom = useMultiplayerStore((s) => s.createRoom);
  const joinRoom = useMultiplayerStore((s) => s.joinRoom);
  const session = useMultiplayerStore((s) => s.session);
  const inviteCode = useMultiplayerStore((s) => s.inviteCode);
  const setInviteCode = useMultiplayerStore((s) => s.setInviteCode);

  const [url, setUrl] = useState(serverUrl || defaultServerUrl());
  const [name, setNameLocal] = useState(identity.name);
  const [roomCode, setRoomCode] = useState(inviteCode ?? "");

  // A loopback address (localhost / 127.x) only ever means "this very device".
  // On a joiner's machine that is NOT the host, so flag it before it fails.
  const [pageHost, setPageHost] = useState("");
  useEffect(() => setPageHost(window.location.hostname), []);
  const urlHost = (() => {
    try {
      return new URL(normalizeServerUrl(url)).hostname;
    } catch {
      return "";
    }
  })();
  const isLoopback = (h: string) => h === "localhost" || h === "::1" || h === "[::1]" || h.startsWith("127.") || h === "0.0.0.0";
  const urlPointsAtSelf = !!urlHost && !!pageHost && isLoopback(urlHost) && !isLoopback(pageHost);

  // An invite link (?join=CODE) pre-fills the room code.
  useEffect(() => {
    if (inviteCode) setRoomCode(inviteCode);
  }, [inviteCode]);

  const doJoin = () => {
    if (!connected || roomCode.length !== 4 || name.trim().length === 0) return;
    setName(name);
    joinRoom(roomCode);
    setInviteCode(null);
  };

  useEffect(() => {
    if (connection === "idle" || connection === "error") {
      void connect(url).catch(() => undefined);
    }
     
  }, []);

  // If the server knows our seat (reconnection token), auto-rejoin.
  useEffect(() => {
    // Auto-rejoin our old seat after a reload — unless an invite to a DIFFERENT room was just opened.
    if (connection === "connected" && identity.token && identity.roomCode && !session && (!inviteCode || inviteCode === identity.roomCode)) {
      joinRoom(identity.roomCode);
    }
     
  }, [connection]);

  const connected = connection === "connected";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
      <div className="mt-8 flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">COOPERATIVE MISSION</div>
          <h1 className="font-display mt-1 text-2xl font-bold text-foreground">Multiplayer Mission Control</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Up to four players crew one mission: Commander, Chief Engineer, Navigation &amp; Flight Director, and Science
            &amp; Comms Officer. Fly a shared spacecraft over your local network.
          </p>
        </div>
        <Button variant="ghost" className="text-muted-foreground" onClick={() => setMode("single")}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Single player
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Connection card */}
        <section className="panel hud-corners space-y-4 p-5">
          <SectionHeading kicker="STEP 01" title="Join the Network" />
          {inviteCode ? (
            <div className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-[12px] leading-relaxed text-emerald-200">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                <Link2 className="h-3 w-3" aria-hidden="true" /> You were invited to room {inviteCode}
              </div>
              Enter your callsign below and press <span className="font-mono font-bold">JOIN</span>.
            </div>
          ) : null}
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Your callsign</span>
              <Input
                value={name}
                onChange={(e) => setNameLocal(e.target.value.slice(0, 24))}
                onBlur={() => setName(name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doJoin();
                }}
                placeholder="e.g. Flight Director Vega"
                className="border-primary/30 bg-secondary/40"
                aria-label="Your player name"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Multiplayer server</span>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => {
                  const clean = normalizeServerUrl(url);
                  if (clean && clean !== url) setUrl(clean);
                  setServerUrl(clean || url);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void connect(url).catch(() => undefined);
                }}
                placeholder="ws://192.168.1.10:3001"
                className="border-primary/30 bg-secondary/40 font-mono text-[12px]"
                aria-label="Multiplayer server WebSocket URL"
              />
            </label>
            {urlPointsAtSelf ? (
              <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[12px] leading-relaxed text-amber-200">
                <b>&quot;{urlHost}&quot; means this device, not the host.</b> Use the host&apos;s LAN address instead, e.g.{" "}
                <span className="font-mono text-amber-100">ws://192.168.1.10:3001</span> — or simply open the game page at the
                host&apos;s address (<span className="font-mono">http://HOST-IP:3000</span>) and this field fills itself in.
              </div>
            ) : null}
            <div className="flex items-center gap-2 font-mono text-[11px]">
              {connected ? (
                <>
                  <Wifi className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <span className="text-emerald-300">CONNECTED</span>
                </>
              ) : connection === "connecting" ? (
                <>
                  <CircleDashed className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
                  <span className="text-accent">CONNECTING…</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-rose-300" aria-hidden="true" />
                  <span className="text-rose-300">OFFLINE</span>
                  <Button variant="outline" size="sm" className="ml-2 h-6 px-2 font-mono text-[10px]" onClick={() => void connect(url).catch(() => undefined)}>
                    RETRY
                  </Button>
                </>
              )}
            </div>
            {lastError ? (
              <div className="rounded-md border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[12px] leading-relaxed text-rose-200">
                {lastError}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-primary/15 pt-4 sm:flex-row">
            <Button
              className="launch-glow font-display flex-1 bg-gradient-to-r from-primary to-accent text-sm font-bold tracking-wider text-[#03101d] hover:from-primary/90 hover:to-accent/90"
              disabled={!connected || name.trim().length === 0}
              onClick={() => {
                setName(name);
                createRoom();
              }}
            >
              HOST A SESSION
            </Button>
            <div className="flex flex-1 gap-2">
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doJoin();
                }}
                placeholder="CODE"
                className="w-24 border-primary/30 bg-secondary/40 font-mono tracking-[0.3em]"
                aria-label="Room code"
              />
              <Button
                variant="outline"
                className="flex-1 border-primary/50 font-mono text-xs font-bold"
                disabled={!connected || roomCode.length !== 4 || name.trim().length === 0}
                onClick={doJoin}
              >
                JOIN
              </Button>
            </div>
          </div>
        </section>

        {/* LAN instructions */}
        <section className="panel space-y-3 p-5">
          <SectionHeading kicker="HOW TO PLAY ON LAN" title="Connection Instructions" />
          <ol className="space-y-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-mono font-bold text-accent">1.</span>
              <span>
                On the host machine, start the multiplayer server:{" "}
                <code className="rounded bg-secondary/70 px-1.5 py-0.5 font-mono text-[11px] text-cyan-200">bun run multiplayer</code>{" "}
                (port 3001 by default).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-bold text-accent">2.</span>
              <span>
                Find the host&apos;s LAN IPv4 address:{" "}
                <code className="rounded bg-secondary/70 px-1.5 py-0.5 font-mono text-[11px] text-cyan-200">ipconfig</code> on
                Windows (look for &quot;IPv4 Address&quot;),{" "}
                <code className="rounded bg-secondary/70 px-1.5 py-0.5 font-mono text-[11px] text-cyan-200">ipconfig getifaddr en0</code>{" "}
                on macOS, or <code className="rounded bg-secondary/70 px-1.5 py-0.5 font-mono text-[11px] text-cyan-200">hostname -I</code> on Linux.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-bold text-accent">3.</span>
              <span>
                Other players open the <b>game page</b> at the host&apos;s address —{" "}
                <span className="font-mono text-cyan-200">http://HOST-IP:3000</span> — and choose Multiplayer. The server field fills
                itself in. <b>Never type a <span className="font-mono">ws://</span> address into the browser&apos;s address bar</b>; it only
                works inside the game, and <span className="font-mono">localhost</span> on another device means that device.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-bold text-accent">4.</span>
              <span>
                The host creates a room and shares the <b>invite link</b> shown in the lobby (or just the 4-letter code). Opening the
                link pre-fills the code — enter a callsign, press JOIN and pick a role.
              </span>
            </li>
          </ol>
          <div className="rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-[11.5px] leading-relaxed text-amber-200/90">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
              <Lock className="h-3 w-3" aria-hidden="true" /> Windows firewall
            </div>
            The first time the server starts, Windows asks to allow Bun/Node through the firewall — allow it on
            <span className="font-mono"> private networks</span>. Otherwise, open inbound TCP port 3001 manually in
            Windows Defender Firewall. No internet access is needed: everything runs on your Wi-Fi.
          </div>
          <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden="true" />
            Fewer than four players? Each of you can hold multiple roles, and events for unclaimed roles open to the whole team.
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Invite panel — a link that actually works from another device
// ---------------------------------------------------------------------------

/**
 * Builds shareable invite links for the current room.
 *
 * The link points at the GAME PAGE (http://<host-lan-ip>:3000/?join=CODE), never at
 * the WebSocket port: browsers can't open ws:// addresses, and "localhost" on a
 * teammate's device is the teammate's own device. If the host opened the game as
 * "localhost", the real LAN address is read from the multiplayer server's /health.
 */
function InvitePanel({ code }: { code: string }) {
  const serverUrl = useMultiplayerStore((s) => s.serverUrl);
  const [lan, setLan] = useState<string[]>([]);
  const [lookupDone, setLookupDone] = useState(false);
  const [loc, setLoc] = useState<{ protocol: string; hostname: string; port: string } | null>(null);
  const [webPort, setWebPort] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setLoc({ protocol: window.location.protocol, hostname: window.location.hostname, port: window.location.port });
    const origin = serverHttpOrigin(serverUrl);
    if (!origin) {
      setLookupDone(true);
      return;
    }
    const ctrl = new AbortController();
    fetch(`${origin}/health`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { lan?: string[]; webPort?: number }) => {
        setLan(Array.isArray(d.lan) ? d.lan : []);
        if (d.webPort) setWebPort(String(d.webPort));
      })
      .catch(() => undefined)
      .finally(() => setLookupDone(true));
    return () => ctrl.abort();
  }, [serverUrl]);

  if (!loc) return null;

  const isLoopback = (h: string) => h === "localhost" || h === "::1" || h === "[::1]" || h.startsWith("127.") || h === "0.0.0.0";
  const pageIsLoopback = isLoopback(loc.hostname);
  const hosts = pageIsLoopback ? lan : [loc.hostname];
  const port = loc.port || webPort || "3000";
  const links = hosts.map((h) => `${loc.protocol}//${h}:${port}/?join=${code}`);
  const wsAddrs = hosts.map((h) => `ws://${h}:${(() => { try { return new URL(serverUrl).port || "3001"; } catch { return "3001"; } })()}`);

  const copy = async (text: string) => {
    let done = false;
    try {
      // navigator.clipboard only exists on https/localhost; LAN pages are plain http.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        done = true;
      }
    } catch {
      /* fall through */
    }
    if (!done) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        done = document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(done ? text : null);
    if (done) window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <section className="panel mt-4 space-y-3 p-5" aria-label="Invite players">
      <SectionHeading kicker="INVITE YOUR CREW" title="Share This Link" />
      {links.length > 0 ? (
        <div className="space-y-2">
          {links.map((link) => (
            <div key={link} className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="border-primary/30 bg-secondary/40 font-mono text-[12px]"
                aria-label="Invite link"
              />
              <Button variant="outline" className="shrink-0 border-primary/50 font-mono text-xs font-bold" onClick={() => void copy(link)}>
                {copied === link ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> COPIED
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> COPY LINK
                  </>
                )}
              </Button>
            </div>
          ))}
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Players on the same Wi-Fi/LAN paste this into their browser&apos;s address bar. It opens the game with room{" "}
            <span className="font-mono text-cyan-200">{code}</span> pre-filled. (If they&apos;d rather type it:{" "}
            <span className="font-mono text-cyan-200">{wsAddrs[0]}</span> goes into the game&apos;s <i>Multiplayer server</i> field —
            never into the address bar.)
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-200">
          {lookupDone
            ? <>Couldn&apos;t detect this computer&apos;s LAN address automatically. Find your IPv4 address (<span className="font-mono">ipconfig</span> on Windows) and have players open{" "}
                <span className="font-mono">http://YOUR-IPV4:{port}/?join={code}</span>. Don&apos;t use <span className="font-mono">localhost</span> — on their device it points to themselves.</>
            : <>Detecting this computer&apos;s network address…</>}
        </div>
      )}
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
        Room code {code} · Make sure both the game (port {port}) and the multiplayer server (port 3001) are running on this computer
      </p>
    </section>
  );
}

function LobbyScreen() {
  const session = useMultiplayerStore((s) => s.session)!;
  const myId = useMultiplayerStore((s) => s.myId)!;
  const setRole = useMultiplayerStore((s) => s.setRole);
  const setReady = useMultiplayerStore((s) => s.setReady);
  const selectMission = useMultiplayerStore((s) => s.selectMission);
  const setDifficulty = useMultiplayerStore((s) => s.setDifficulty);
  const reroll = useMultiplayerStore((s) => s.rerollConstraints);
  const start = useMultiplayerStore((s) => s.startSession);
  const leave = useMultiplayerStore((s) => s.disconnect);
  const lastError = useMultiplayerStore((s) => s.lastError);

  const iAmHost = session.hostId === myId;
  const mePlayer = me(session, myId);
  const mission = MISSIONS.find((m) => m.id === session.missionId);
  const readyCheck = useMemo(() => {
    const connected = session.players.filter((p) => p.connected);
    if (!session.missionId) return { ok: false, reason: "The host must select a mission." };
    if (!session.players.some((p) => p.connected && p.roles.length > 0)) return { ok: false, reason: "At least one player must claim a role." };
    const notReady = connected.filter((p) => !p.ready);
    if (notReady.length > 0) return { ok: false, reason: `Waiting for: ${notReady.map((p) => p.name).join(", ")}` };
    return { ok: true, reason: "" };
     
  }, [session]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
            ROOM {session.code} · {session.players.filter((p) => p.connected).length}/4 CREW CONNECTED
          </div>
          <h1 className="font-display mt-1 text-2xl font-bold text-foreground">Crew Lobby</h1>
        </div>
        <Button variant="ghost" className="text-rose-300/80 hover:bg-rose-400/10 hover:text-rose-200" onClick={leave}>
          <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Leave room
        </Button>
      </div>

      {lastError ? (
        <div className="mt-4 rounded-md border border-rose-400/40 bg-rose-400/10 px-4 py-2.5 text-[12.5px] text-rose-200">{lastError}</div>
      ) : null}

      <InvitePanel code={session.code} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* Roles */}
        <section className="space-y-4">
          <div className="panel p-5">
            <SectionHeading kicker="STEP 02" title="Choose Your Station" className="mb-3" />
            <div className="grid gap-3 sm:grid-cols-2">
              {ROLES.map((role) => {
                const holders = session.players.filter((p) => p.roles.includes(role.id) && p.connected);
                const mine = !!mePlayer?.roles.includes(role.id);
                const accent = ROLE_ACCENTS[role.id];
                return (
                  <div key={role.id} className={cn("rounded-lg border p-3.5 transition-colors", mine ? `${accent.border} ${accent.bg}` : "border-primary/20 bg-secondary/30")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn("font-display text-[13px] font-bold", accent.text)}>{role.title}</div>
                      <Button
                        variant={mine ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2.5 font-mono text-[10px]"
                        onClick={() => setRole(role.id, !mine)}
                        aria-pressed={mine}
                      >
                        {mine ? "RELEASE" : "CLAIM"}
                      </Button>
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{role.description}</p>
                    <ul className="mt-2 space-y-0.5">
                      {role.responsibilities.slice(0, 3).map((r) => (
                        <li key={r} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-muted-foreground/85">
                          <span className={cn("mt-1 h-1 w-1 shrink-0 rounded-full", mine ? "bg-current" : "bg-primary/40")} />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2.5 border-t border-primary/10 pt-2 font-mono text-[10px]">
                      {holders.length > 0 ? (
                        <span className="text-cyan-200">MANNED — {holders.map((h) => h.name).join(", ")}</span>
                      ) : (
                        <span className="text-amber-300/80">UNMANNED — events open to the whole team</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              You may hold several stations when flying with fewer than four players.
            </p>
          </div>

          {/* Players */}
          <div className="panel p-5">
            <SectionHeading kicker="CREW" title="Flight Roster" className="mb-3" />
            <ul className="space-y-2">
              {session.players.map((p) => (
                <li key={p.id} className={cn("flex items-center gap-3 rounded-md border px-3 py-2.5", p.connected ? "border-primary/20 bg-secondary/40" : "border-rose-400/30 bg-rose-400/5 opacity-75")}>
                  <span className={cn("h-2 w-2 rounded-full", p.connected ? "bg-emerald-400" : "bg-rose-400")} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-foreground">
                      {p.name} {p.id === myId ? <span className="text-accent">(you)</span> : null}
                      {p.id === session.hostId ? <span className="ml-1.5 rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] text-accent">HOST</span> : null}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {p.roles.length > 0 ? p.roles.map((r) => ROLES_BY_ID[r].shortTitle).join(" · ") : "NO STATION"}
                      {p.connected ? "" : " · DISCONNECTED — seat held"}
                    </div>
                  </div>
                  {p.ready ? (
                    <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-300">
                      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> READY
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground">STANDING BY</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Mission + difficulty + start */}
        <section className="space-y-4">
          <div className="panel p-5">
            <SectionHeading
              kicker="STEP 03"
              title={iAmHost ? "Select Mission" : "Mission (host selects)"}
              className="mb-3"
            />
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {MISSIONS.map((m) => {
                const selected = session.missionId === m.id;
                const clickable = iAmHost;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => selectMission(m.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                      selected
                        ? "border-accent/60 bg-accent/10"
                        : clickable
                          ? "border-primary/20 bg-secondary/30 hover:border-primary/50"
                          : "border-primary/10 bg-secondary/20 opacity-80"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-cyan-100">{m.name}</span>
                      <span className="font-mono text-[9.5px] text-muted-foreground">
                        {m.difficulty.toUpperCase()} · {m.destination.toUpperCase()}
                      </span>
                    </span>
                    {selected ? <CircleCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel p-5">
            <SectionHeading kicker="STEP 04" title={iAmHost ? "Difficulty & Constraints" : "Difficulty (host sets)"} className="mb-3" />
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {DIFFICULTY_SETTINGS.map((d: DifficultySetting) => (
                <button
                  key={d}
                  type="button"
                  disabled={!iAmHost}
                  onClick={() => setDifficulty(d, session.difficulty === "Custom Challenge" ? session.constraintIds : [], session.constraintSeed)}
                  aria-pressed={session.difficulty === d}
                  className={cn(
                    "rounded-md border px-2.5 py-2 font-mono text-[10px] font-bold tracking-wide transition-colors",
                    session.difficulty === d
                      ? "border-accent/70 bg-accent/15 text-accent"
                      : iAmHost
                        ? "border-primary/25 bg-secondary/40 text-cyan-100/80 hover:border-primary/50"
                        : "border-primary/10 bg-secondary/20 text-cyan-100/50"
                  )}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
            {(() => {
              if (!mission) return null;
              const { applied } = applyDifficulty(mission, session.difficulty, session.constraintIds, session.constraintSeed);
              return (
                <div className="mt-3 space-y-1.5">
                  {applied.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300/90">
                          Applied constraints
                        </span>
                        {iAmHost ? (
                          <Button variant="outline" size="sm" className="h-6 px-2 font-mono text-[10px]" onClick={reroll}>
                            <Dices className="mr-1 h-3 w-3" aria-hidden="true" /> REROLL
                          </Button>
                        ) : null}
                      </div>
                      {applied.map((c) => (
                        <div key={c.id} className="rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-1.5 text-[11px] text-amber-200">
                          {c.name} — <span className="text-muted-foreground">{c.description}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="rounded-md border border-primary/20 bg-secondary/30 px-3 py-2 text-[11.5px] text-muted-foreground">
                      No constraints beyond the mission profile.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="panel hud-corners p-5">
            {/* Every crew member — the host included — must mark ready before
                the session can start (the ready check counts ALL connected
                players, so the host needs this toggle too). */}
            <Button
              size="lg"
              variant={mePlayer?.ready ? "success" : "default"}
              className="font-display h-12 w-full text-sm font-bold tracking-wider"
              onClick={() => setReady(!mePlayer?.ready)}
            >
              <Check className="mr-2 h-5 w-5" aria-hidden="true" />
              {mePlayer?.ready ? "READY — WAITING FOR TEAM" : "MARK READY"}
            </Button>
            {iAmHost ? (
              <Button
                size="lg"
                disabled={!readyCheck.ok}
                className={cn(
                  "font-display mt-2 h-12 w-full text-sm font-bold tracking-wider",
                  readyCheck.ok
                    ? "launch-glow bg-gradient-to-r from-primary to-accent text-[#03101d] hover:from-primary/90 hover:to-accent/90"
                    : "bg-primary/40 text-primary-foreground/70"
                )}
                onClick={start}
              >
                <Users className="mr-2 h-5 w-5" aria-hidden="true" />
                BEGIN COOPERATIVE DESIGN
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
            {!readyCheck.ok ? (
              <p className="mt-2 text-center font-mono text-[10.5px] text-amber-300/90">{readyCheck.reason}</p>
            ) : (
              <p className="mt-2 text-center font-mono text-[10.5px] text-emerald-300">ALL CREW READY</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Design phase — shared spacecraft construction
// ---------------------------------------------------------------------------

function MPEquipmentRow({ equipmentId }: { equipmentId: string }) {
  const session = useMultiplayerStore((s) => s.session)!;
  const setQuantity = useMultiplayerStore((s) => s.setQuantity);
  const eq = getEquipment(equipmentId);
  if (!eq) return null;
  const qty = installedQuantity(session.design, eq.id);
  const banned = effectiveMissionOf(session)?.bannedEquipmentIds?.includes(eq.id) ?? false;

  return (
    <div className={cn("flex items-center gap-2.5 rounded-md border px-3 py-2", qty > 0 ? "border-accent/40 bg-accent/5" : "border-primary/15 bg-secondary/30")}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold text-foreground">{eq.name}</div>
        <div className="font-mono text-[9.5px] text-muted-foreground">
          {formatMoney(eq.cost)} · {eq.mass} kg
          {eq.powerGeneration > 0 ? ` · +${eq.powerGeneration} W${eq.isSolar ? " solar" : ""}` : ""}
          {eq.powerConsumption > 0 ? ` · −${eq.powerConsumption} W` : ""}
          {eq.scienceOutput > 0 ? ` · ${eq.scienceOutput} sci` : ""}
          {eq.commCapability > 0 ? ` · ${eq.commCapability} comm` : ""}
          {eq.navigation > 0 ? ` · ${eq.navigation} nav` : ""}
          {eq.radiationShielding > 0 ? ` · ${eq.radiationShielding}% rad` : ""}
          {eq.thermalProtection > 0 ? ` · ${eq.thermalProtection}% thermal` : ""}
          {eq.landingAssist > 0 ? ` · ${eq.landingAssist} landing` : ""}
          {eq.fuelCapacity > 0 ? ` · ${eq.fuelCapacity.toLocaleString()} kg fuel` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          className="border-primary/40 text-cyan-100"
          disabled={qty === 0}
          onClick={() => setQuantity(eq.id, qty - 1)}
          aria-label={`Remove one ${eq.name}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-6 text-center font-mono text-sm font-bold text-accent">{qty}</span>
        <Button
          size="sm"
          className="h-7 bg-accent px-2.5 font-mono text-[10px] font-bold text-accent-foreground hover:bg-accent/90"
          disabled={banned}
          onClick={() => setQuantity(eq.id, qty + 1)}
          aria-label={banned ? `${eq.name} unavailable` : `Add one ${eq.name}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DesignScreen() {
  const session = useMultiplayerStore((s) => s.session)!;
  const myId = useMultiplayerStore((s) => s.myId)!;
  const launch = useMultiplayerStore((s) => s.launch);
  const clearDesign = useMultiplayerStore((s) => s.clearDesign);
  const lastError = useMultiplayerStore((s) => s.lastError);
  const [category, setCategory] = useState<string>("Propulsion");

  const iAmHost = session.hostId === myId;
  const mission = effectiveMissionOf(session);
  const design = session.design;

  const resources = useMemo(
    () => (mission ? computeResources(mission, design) : null),
    [mission, design]
  );
  const validation = useMemo(
    () => (mission ? validateSpacecraft(mission, design) : null),
    [mission, design]
  );

  if (!mission || !resources || !validation) return null;
  const installed = design.components.filter((c) => c.quantity > 0);
  const items = EQUIPMENT.filter((e) => e.category === category && !(mission.bannedEquipmentIds?.includes(e.id)));

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 pb-16 sm:px-6">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
            SHARED DESIGN · ROOM {session.code} · {mission.name.toUpperCase()}
          </div>
          <h1 className="font-display mt-1 text-xl font-bold text-foreground sm:text-2xl">Assembly Bay — Team Build</h1>
          <p className="mt-1 text-xs text-muted-foreground">Everyone can add and remove components; changes sync instantly.</p>
        </div>
      </div>

      {lastError ? (
        <div className="mt-4 rounded-md border border-rose-400/40 bg-rose-400/10 px-4 py-2.5 text-[12.5px] text-rose-200">{lastError}</div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_minmax(0,0.55fr)_340px]">
        {/* Catalogue */}
        <section className="panel flex flex-col overflow-hidden">
          <div className="flex flex-wrap gap-1.5 border-b border-primary/15 p-3">
            {EQUIPMENT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors",
                  category === cat
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-primary/20 text-muted-foreground hover:border-primary/40 hover:text-cyan-200"
                )}
              >
                {cat.toUpperCase()} ({EQUIPMENT.filter((e) => e.category === cat).length})
              </button>
            ))}
          </div>
          <div className="max-h-[calc(100vh-20rem)] space-y-2 overflow-y-auto p-3">
            {items.map((e) => (
              <MPEquipmentRow key={e.id} equipmentId={e.id} />
            ))}
          </div>
        </section>

        {/* Model + installed */}
        <section className="flex min-h-0 flex-col gap-4">
          <SpacecraftCanvas config={design} missionName={mission.name} />
          <div className="panel hidden min-h-0 flex-1 overflow-y-auto p-3 lg:block">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">
                MANIFEST — {installed.reduce((s, c) => s + c.quantity, 0)} UNITS
              </span>
              {installed.length > 0 ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 font-mono text-[10px] text-rose-300/80 hover:bg-rose-400/10 hover:text-rose-200" onClick={clearDesign}>
                  CLEAR
                </Button>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {EQUIPMENT_CATEGORIES.map((cat) => {
                const rows = installed.filter((c) => EQUIPMENT_BY_ID[c.equipmentId]?.category === cat);
                if (rows.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="pt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{cat}</div>
                    {rows.map((c) => (
                      <div key={c.equipmentId} className="flex items-center justify-between px-1 py-0.5 text-[11px]">
                        <span className="truncate text-cyan-100">{getEquipment(c.equipmentId)?.name}</span>
                        <span className="font-mono font-bold text-accent">×{c.quantity}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {installed.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-muted-foreground">Nothing installed yet.</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Stats + launch */}
        <section className="panel hud-corners space-y-3.5 p-4 xl:sticky xl:top-20">
          <div className="font-display text-sm font-bold text-foreground">Live Engineering Stats</div>
          <StatBar label="Budget used" value={resources.totalCost} max={mission.budget} display={`${formatMoney(resources.budgetRemaining)} remaining`} invert hint="Shared team budget." />
          <StatBar label="Mass" value={resources.totalMass} max={mission.maxMass} display={`${resources.massRemaining.toLocaleString()} kg remaining`} invert hint="Launch vehicle limit." />
          <StatBar
            label="Propellant"
            value={resources.fuelRequired}
            max={Math.max(resources.fuelCapacity, resources.fuelRequired, 1)}
            display={resources.fuelCapacity < resources.fuelRequired ? `short ${resources.fuelRequired - resources.fuelCapacity} kg` : `${(resources.fuelCapacity - resources.fuelRequired).toLocaleString()} kg reserve`}
            invert
          />
          <div className="grid grid-cols-2 gap-2">
            <Chip label="PWR" value={`${resources.powerBalance >= 0 ? "+" : ""}${resources.powerBalance} W`} tone={resources.powerBalance >= 0 ? "good" : "bad"} />
            <Chip label="THRUST" value={`${resources.propulsion}/${mission.minPropulsion}`} tone={resources.propulsion >= mission.minPropulsion ? "good" : "bad"} />
            <Chip label="SCIENCE" value={`${resources.scienceCapability}`} />
            <Chip label="COMM" value={`${resources.commCapability}`} />
          </div>
          <div className={cn("rounded-md border p-3", validation.errors.length > 0 ? "border-rose-400/40 bg-rose-400/5" : "border-emerald-400/40 bg-emerald-400/5")}>
            {validation.errors.length > 0 ? (
              <>
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-rose-300">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  {validation.errors.length} LAUNCH BLOCKER{validation.errors.length === 1 ? "" : "S"}
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {validation.errors.slice(0, 4).map((e) => (
                    <li key={e.id} className="text-[11px] leading-snug text-rose-200/80">· {e.label}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="font-mono text-[11px] font-bold text-emerald-300">✓ SPACECRAFT READY FOR LAUNCH</div>
            )}
          </div>
          <Button
            size="lg"
            disabled={validation.errors.length > 0}
            className={cn(
              "font-display h-12 w-full text-sm font-bold tracking-wider",
              validation.errors.length === 0
                ? "launch-glow bg-gradient-to-r from-primary to-accent text-[#03101d] hover:from-primary/90 hover:to-accent/90"
                : "bg-primary/40 text-primary-foreground/70"
            )}
            onClick={launch}
          >
            LAUNCH THE MISSION
          </Button>
          <p className="text-center font-mono text-[10px] text-muted-foreground">
            ANY CREW MEMBER MAY LAUNCH ONCE ALL CHECKS PASS
          </p>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulation — role dashboards + cooperative decisions
// ---------------------------------------------------------------------------

function EventDecisionPanel() {
  const session = useMultiplayerStore((s) => s.session)!;
  const myId = useMultiplayerStore((s) => s.myId)!;
  const decide = useMultiplayerStore((s) => s.decide);
  const propose = useMultiplayerStore((s) => s.propose);
  const approve = useMultiplayerStore((s) => s.approve);
  const vote = useMultiplayerStore((s) => s.vote);
  const resolveVote = useMultiplayerStore((s) => s.resolveVote);

  const sim = session.simulation;
  const routing = session.routing;
  if (!sim?.pendingEvent || !routing) return null;

  const event: MissionEvent = sim.pendingEvent.event;
  const mine = waitingOnMe(session, myId);
  const canAct = canIAct(session, myId);
  const myVote = routing.votes.find((v) => v.playerId === myId);
  const voteCounts = event.choices.map((c) => ({
    choice: c,
    count: routing.votes.filter((v) => v.choiceId === c.id).length,
  }));
  const allVoted = session.players.filter((p) => p.connected).every((p) => routing.votes.some((v) => v.playerId === p.id));

  const targetLabel =
    routing.targetRoles.length > 0
      ? routing.targetRoles.map((r) => ROLES_BY_ID[r].shortTitle).join(" / ")
      : "WHOLE TEAM";

  return (
    <div className="panel hud-corners border-amber-400/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          EVENT — {event.title}
        </div>
        <span className="font-mono text-[9.5px] text-muted-foreground">
          {targetLabel} ·{" "}
          {routing.mode === "solo" ? "DIRECT DECISION" : routing.mode === "proposal" ? "RECOMMEND → APPROVE" : "TEAM VOTE"}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-cyan-100/85">{event.description}</p>
      <p className="mt-1.5 flex items-start gap-2 border-t border-primary/15 pt-2 text-[11px] italic leading-relaxed text-cyan-200/70">
        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden="true" />
        {event.educationalNote}
      </p>

      {/* Routing state line */}
      <div className="mt-2.5 flex flex-wrap gap-2 font-mono text-[10px]">
        {routing.mode === "proposal" && routing.proposal ? (
          <span className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-amber-200">
            {routing.proposal.byPlayerName} RECOMMENDS: {event.choices.find((c) => c.id === routing.proposal!.choiceId)?.label}
          </span>
        ) : null}
        {routing.mode === "vote" ? (
          voteCounts.map(({ choice, count }) => (
            <span key={choice.id} className="rounded border border-primary/30 bg-secondary/50 px-2 py-1 text-cyan-200">
              {choice.label}: {count} vote{count === 1 ? "" : "s"}
            </span>
          ))
        ) : null}
      </div>

      {/* Actions */}
      <div className="mt-3 space-y-2">
        {routing.mode === "solo" ? (
          canAct ? (
            event.choices.map((choice, i) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => decide(choice.id)}
                className="flex w-full items-start gap-3 rounded-md border border-primary/40 bg-secondary/60 p-3 text-left transition-all hover:border-accent/70 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/50 font-mono text-[11px] font-bold text-accent">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">{choice.label}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">{choice.description}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-md border border-primary/25 bg-secondary/40 px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
              AWAITING DECISION FROM {targetLabel} — telemetry stays live on your console.
            </div>
          )
        ) : null}

        {routing.mode === "proposal" ? (
          !routing.proposal ? (
            canAct ? (
              event.choices.map((choice, i) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => propose(choice.id)}
                  className="flex w-full items-start gap-3 rounded-md border border-amber-400/40 bg-secondary/60 p-3 text-left transition-all hover:border-amber-300/70 hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-amber-400/50 font-mono text-[11px] font-bold text-amber-300">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-foreground">RECOMMEND: {choice.label}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">{choice.description}</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-md border border-primary/25 bg-secondary/40 px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                AWAITING A RECOMMENDATION FROM {targetLabel}.
              </div>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              {waitingOnMe(session, myId) ? (
                <>
                  <Button variant="success" className="flex-1 font-mono text-xs font-bold" onClick={() => approve(true)}>
                    <CircleCheck className="mr-1.5 h-4 w-4" aria-hidden="true" /> APPROVE (COMMANDER)
                  </Button>
                  <Button variant="destructive" className="flex-1 font-mono text-xs font-bold" onClick={() => approve(false)}>
                    <CircleX className="mr-1.5 h-4 w-4" aria-hidden="true" /> REJECT
                  </Button>
                </>
              ) : (
                <div className="w-full rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 font-mono text-[11px] text-amber-200/90">
                  AWAITING COMMANDER APPROVAL…
                </div>
              )}
            </div>
          )
        ) : null}

        {routing.mode === "vote" ? (
          <>
            <div className="space-y-2">
              {event.choices.map((choice, i) => {
                const voted = myVote?.choiceId === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={!!myVote}
                    onClick={() => vote(choice.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-all",
                      voted
                        ? "border-emerald-400/60 bg-emerald-400/10"
                        : myVote
                          ? "border-primary/15 bg-secondary/30 opacity-60"
                          : "border-primary/40 bg-secondary/60 hover:border-accent/70 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
                    )}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/50 font-mono text-[11px] font-bold text-accent">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-foreground">{choice.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">{choice.description}</span>
                    </span>
                    {voted ? <CircleCheck className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">
                {routing.votes.length}/{session.players.filter((p) => p.connected).length} VOTES CAST
                {allVoted ? " — CLOSING" : ""}
              </span>
              {routing.votes.length > 0 && !allVoted ? (
                <Button variant="outline" size="sm" className="h-7 border-primary/40 font-mono text-[10px]" onClick={resolveVote}>
                  CLOSE VOTE NOW
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SimulationScreenMP() {
  const session = useMultiplayerStore((s) => s.session)!;
  const myId = useMultiplayerStore((s) => s.myId)!;
  const advance = useMultiplayerStore((s) => s.advance);
  const finish = useMultiplayerStore((s) => s.finish);
  const consoleRef = useRef<HTMLDivElement>(null);

  const sim = session.simulation!;
  const mission = effectiveMissionOf(session);
  const resources = useMemo(
    () => (mission ? computeResources(mission, session.design) : null),
    [mission, session.design]
  );

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight, behavior: "smooth" });
  }, [sim?.stageLog.length, sim?.log.length, session.routing?.eventId]);

  if (!mission || !resources || !sim) return null;

  const missionOver = sim.stagePhase === "complete" || sim.status === "failure";
  const stageNum = missionOver ? 8 : sim.stageIndex + 1;
  const currentDef = STAGE_DEFS[missionOver ? 7 : sim.stageIndex];
  const mePlayer = me(session, myId);
  const awaiting = sim.stagePhase === "awaiting_event" && !!session.routing;
  const myTurn = waitingOnMe(session, myId);

  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 pb-16 sm:px-6">
      {/* Header */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
            COOPERATIVE FLIGHT · ROOM {session.code} · {mission.name.toUpperCase()} · SEED {sim.seed}
          </div>
          <h1 className="font-display mt-1 text-xl font-bold text-foreground sm:text-2xl">Mission Control Live — Team {session.code}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {session.players.map((p) => (
            <span
              key={p.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]",
                p.connected ? "border-primary/25 bg-secondary/50 text-cyan-100" : "border-rose-400/30 text-rose-300/70"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", p.connected ? "bg-emerald-400" : "bg-rose-400")} aria-hidden="true" />
              {p.name}
              {p.roles.length > 0 ? <span className="text-muted-foreground">· {p.roles.map((r) => ROLES_BY_ID[r].shortTitle).join("+")}</span> : null}
            </span>
          ))}
        </div>
      </div>

      {/* My station banner */}
      {mePlayer && mePlayer.roles.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {mePlayer.roles.map((role) => {
            const accent = ROLE_ACCENTS[role];
            return (
              <span key={role} className={cn("rounded-md border px-3 py-1.5 font-mono text-[10.5px] font-bold", accent.border, accent.bg, accent.text)}>
                YOUR STATION: {ROLES_BY_ID[role].title.toUpperCase()}
              </span>
            );
          })}
          {myTurn ? (
            <span className="flex items-center gap-1.5 rounded-md border border-amber-400/60 bg-amber-400/15 px-3 py-1.5 font-mono text-[10.5px] font-bold text-amber-300 blink">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> YOUR DECISION REQUIRED
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Compact stage timeline */}
      <div className="panel mt-4 overflow-x-auto p-3">
        <ol className="flex min-w-[680px] items-center gap-1">
          {STAGE_DEFS.map((def, i) => {
            const rec = sim.stageLog.find((r) => r.stage === def.stage);
            const isCurrent = !missionOver && def.stage === stageNum;
            const done = !!rec;
            return (
              <li key={def.stage} className="flex flex-1 items-center">
                <div className="flex min-w-16 flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border font-mono text-xs font-bold",
                      isCurrent
                        ? "border-accent bg-accent/15 text-accent text-glow"
                        : done
                          ? rec?.status === "failed"
                            ? "border-rose-400/60 bg-rose-400/10 text-rose-300"
                            : rec?.status === "degraded"
                              ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                              : "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                          : "border-primary/20 text-muted-foreground/60"
                    )}
                  >
                    {def.stage}
                  </div>
                  <span className={cn("whitespace-nowrap font-mono text-[9px] font-semibold", isCurrent ? "text-accent" : "text-muted-foreground/70")}>
                    {def.short}
                  </span>
                </div>
                {i < STAGE_DEFS.length - 1 ? (
                  <div className={cn("mx-1 h-px flex-1", done ? "bg-emerald-400/40" : isCurrent ? "bg-accent/40" : "bg-primary/15")} aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,430px)]">
        {/* LEFT: crew + telemetry + controls */}
        <aside className="flex flex-col gap-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-primary/15 px-4 py-2.5">
              <span className="font-display text-[13px] font-bold text-foreground">Crew Status</span>
            </div>
            <ul className="divide-y divide-primary/10">
              {session.players.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className={cn("h-2 w-2 rounded-full", p.connected ? "bg-emerald-400" : "bg-rose-400")} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-foreground">
                      {p.name}
                      {p.id === myId ? <span className="text-accent"> (you)</span> : null}
                    </div>
                    <div className="font-mono text-[9.5px] text-muted-foreground">
                      {p.roles.length > 0 ? p.roles.map((r) => ROLES_BY_ID[r].shortTitle).join("+") : "OBSERVER"}
                      {p.connected ? "" : " · OFFLINE"}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[10px] text-cyan-200">
                    <div>{p.stats.decisions} dec</div>
                    <div className="text-muted-foreground">{p.stats.emergenciesResolved} fixed</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel hud-corners space-y-4 p-4">
            <div className="font-display text-sm font-bold text-foreground">Telemetry</div>
            <StatBar
              label="Propellant remaining"
              value={Math.max(0, sim.fuelRemaining)}
              max={resources.fuelCapacity || 1}
              display={`${Math.max(0, Math.round(sim.fuelRemaining)).toLocaleString()} kg`}
              compact
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Microscope className="h-3 w-3" aria-hidden="true" /> SCIENCE
                </div>
                <div className="font-mono text-lg font-bold text-accent">{Math.round(sim.scienceData)}</div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Signal className="h-3 w-3" aria-hidden="true" /> DOWNLINK
                </div>
                <div className="font-mono text-lg font-bold text-cyan-200">{Math.round(sim.dataTransmitted)}</div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Gauge className="h-3 w-3" aria-hidden="true" /> RELIABILITY
                </div>
                <div className={cn("font-mono text-lg font-bold", sim.reliability >= 85 ? "text-emerald-300" : sim.reliability >= 70 ? "text-amber-300" : "text-rose-300")}>
                  {Math.round(sim.reliability)}%
                </div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Flame className="h-3 w-3" aria-hidden="true" /> POWER MARGIN
                </div>
                <div className={cn("font-mono text-lg font-bold", resources.powerBalance - sim.powerStress >= 0 ? "text-emerald-300" : "text-rose-300")}>
                  {Math.round(resources.powerBalance - sim.powerStress)} W
                </div>
              </div>
            </div>
          </section>

          <section className="panel p-4">
            {missionOver ? (
              <Button
                size="lg"
                className="launch-glow font-display h-12 w-full bg-gradient-to-r from-primary to-accent text-sm font-bold tracking-[0.2em] text-[#03101d] hover:from-primary/90 hover:to-accent/90"
                onClick={finish}
              >
                <ScrollText className="mr-2 h-5 w-5" aria-hidden="true" />
                CLOSE OUT THE MISSION
              </Button>
            ) : awaiting ? (
              <div className="flex items-center justify-center gap-2 py-2 font-mono text-xs tracking-[0.15em] text-amber-300">
                <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                {myTurn ? "YOUR DECISION REQUIRED" : "AWAITING CREW DECISION"}
              </div>
            ) : (
              <Button
                size="lg"
                onClick={advance}
                className="font-display h-12 w-full border border-accent/50 bg-secondary text-sm font-bold tracking-[0.2em] text-accent hover:bg-[#123156]"
              >
                <Play className="mr-2 h-5 w-5" aria-hidden="true" />
                EXECUTE STAGE {stageNum} — {currentDef?.short}
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <p className="mt-2 text-center font-mono text-[9.5px] text-muted-foreground">ANY CREW MEMBER MAY EXECUTE THE NEXT STAGE</p>
          </section>
        </aside>

        {/* MIDDLE: console + event decision panel */}
        <section className="flex min-h-0 flex-col gap-4">
          {awaiting ? <EventDecisionPanel /> : null}

          <div className="panel flex min-h-[420px] flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-primary/15 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", missionOver ? "bg-amber-400" : "bg-emerald-400 live-dot")} aria-hidden="true" />
                <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-emerald-300">
                  {missionOver ? "TRANSMISSION ENDED" : awaiting ? "EVENT IN PROGRESS" : "AWAITING COMMAND"}
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                STAGE {stageNum}/8 — {currentDef?.title.toUpperCase()}
              </span>
            </div>
            <div ref={consoleRef} className="grid-overlay flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: "52vh" }}>
              {sim.stageLog.map((rec) => (
                <div key={rec.stage}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-[11px] font-bold tracking-[0.15em]",
                        rec.status === "success" ? "text-emerald-300" : rec.status === "degraded" ? "text-amber-300" : rec.status === "failed" ? "text-rose-300" : "text-muted-foreground/50"
                      )}
                    >
                      [STAGE {rec.stage} — {rec.title.toUpperCase()}]
                    </span>
                  </div>
                  {rec.log.map((line, i) => (
                    <p key={i} className="console-line text-cyan-100/80">
                      <span className="mr-2 text-primary/50">{String(i + 1).padStart(2, "0")}</span>
                      {line}
                    </p>
                  ))}
                  {sim.decisions
                    .filter((d) => d.stage === rec.stage)
                    .map((d) => (
                      <div key={d.eventId} className="mt-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/90">DECISION · {d.eventTitle}</div>
                        <div className="mt-0.5 text-[12px] font-semibold text-cyan-100">{d.choiceLabel}</div>
                        <div className="console-line mt-0.5 text-cyan-200/60">{d.outcome}</div>
                      </div>
                    ))}
                </div>
              ))}
              {sim.stageLog.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Play className="h-8 w-8 text-accent/50" aria-hidden="true" />
                  <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                    All stations go. Any crew member may command the first stage.
                  </p>
                </div>
              ) : null}
              {sim.failureReason ? (
                <div className="rounded-md border border-rose-400/50 bg-rose-400/10 px-4 py-3">
                  <div className="font-mono text-xs font-bold tracking-widest text-rose-300">MISSION FAILURE</div>
                  <p className="mt-1 text-[13px] text-rose-100/90">{sim.failureReason}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* RIGHT: flight view */}
        <MissionVisualizer mission={mission} config={session.design} simulation={sim} className="min-h-[480px]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function ReportScreenMP() {
  const session = useMultiplayerStore((s) => s.session)!;
  const myId = useMultiplayerStore((s) => s.myId)!;
  const playAgain = useMultiplayerStore((s) => s.playAgain);
  const leave = useMultiplayerStore((s) => s.disconnect);

  const result = session.result;
  if (!result) return null;
  const iAmHost = session.hostId === myId;
  const reports: PlayerContributionReport[] = contributionReports(session);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
      <div className="mt-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
          COOPERATIVE MISSION REPORT · ROOM {session.code}
        </div>
        <h1 className="font-display mt-1 text-2xl font-bold text-foreground">Team Debriefing</h1>
      </div>

      {/* Team score */}
      <section className="panel hud-corners mt-6 p-6 text-center">
        <StatusBadge status={result.status} />
        <div className="font-display mt-4 text-5xl font-black text-foreground">
          {result.score}
          <span className="text-2xl text-muted-foreground">/1000</span>
        </div>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-cyan-100/85">{result.report.summary}</p>
        <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ["PRIMARY", result.scoreBreakdown.objectivesPrimary, 400],
            ["SECONDARY", result.scoreBreakdown.objectivesSecondary, 150],
            ["ENGINEERING", result.scoreBreakdown.engineering, 200],
            ["EFFICIENCY", result.scoreBreakdown.efficiency, 150],
            ["DECISIONS", result.scoreBreakdown.decisions, 100],
          ].map(([label, value, max]) => (
            <div key={label as string} className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
              <div className="font-mono text-[9px] text-muted-foreground">{label as string}</div>
              <div className="font-mono text-lg font-bold text-accent">{value as number}</div>
              <div className="font-mono text-[9px] text-muted-foreground">/ {max as number}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Individual contributions */}
      <section className="panel mt-6 p-6">
        <SectionHeading kicker="CREW PERFORMANCE" title="Individual Contributions" className="mb-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {reports.map((r) => {
            const isMe = r.playerId === myId;
            return (
              <div key={r.playerId} className={cn("rounded-lg border p-4", isMe ? "border-accent/50 bg-accent/5" : "border-primary/20 bg-secondary/30")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[14px] font-bold text-foreground">
                    {r.name}
                    {isMe ? <span className="text-accent"> (you)</span> : null}
                  </div>
                  <div className="flex gap-1">
                    {r.roles.map((role) => {
                      const accent = ROLE_ACCENTS[role];
                      return (
                        <span key={role} className={cn("rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-bold", accent.border, accent.text)}>
                          {ROLES_BY_ID[role].shortTitle}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["DECISIONS", r.decisions],
                    ["ACCEPTED REC.", r.recommendationsAccepted],
                    ["EMERGENCIES", r.emergenciesResolved],
                    ["SCI. OBJECTIVES", r.scienceObjectives],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded border border-primary/15 bg-secondary/40 py-1.5">
                      <div className="font-mono text-base font-bold text-cyan-200">{value as number}</div>
                      <div className="font-mono text-[8px] uppercase text-muted-foreground">{label as string}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 font-mono text-[10px] text-muted-foreground">
                  AVG DECISION QUALITY: <span className="text-cyan-200">{Math.round(r.averageQuality * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Contributions supplement the shared team score — the mission belongs to the whole crew.
        </p>
      </section>

      {/* Objectives + report highlights */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <SectionHeading kicker="OBJECTIVES" title="Scored Goals" className="mb-3" />
          <ul className="space-y-1.5">
            {[...result.completedObjectives, ...result.failedObjectives].map((o) => (
              <li key={o.id} className={cn("flex items-center justify-between gap-2 rounded-md border px-3 py-1.5", o.completed ? "border-emerald-400/20 bg-emerald-400/5" : "border-rose-400/20 bg-rose-400/5")}>
                <span className="flex items-center gap-2 text-[12px] text-cyan-100">
                  {o.completed ? <CircleCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> : <CircleX className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />}
                  {o.description}
                </span>
                <span className={cn("font-mono text-[11px] font-bold", o.completed ? "text-emerald-300" : "text-rose-300/70")}>{o.earned}/{o.points}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-5">
          <SectionHeading kicker="MISSION ANALYSIS" title="Flight Review" className="mb-3" />
          <div className="space-y-3 text-[12px] leading-relaxed">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Strengths</div>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {result.report.strengths.map((s) => <li key={s}>· {s}</li>)}
              </ul>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">Weaknesses</div>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {result.report.weaknesses.map((s) => <li key={s}>· {s}</li>)}
              </ul>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">Recommendations</div>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {result.report.recommendations.map((s) => <li key={s}>· {s}</li>)}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {iAmHost ? (
          <Button
            size="lg"
            className="launch-glow font-display bg-gradient-to-r from-primary to-accent text-sm font-bold tracking-wider text-[#03101d] hover:from-primary/90 hover:to-accent/90"
            onClick={playAgain}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> RETURN TEAM TO LOBBY
          </Button>
        ) : (
          <div className="font-mono text-[11px] text-muted-foreground">WAITING FOR HOST TO RETURN THE TEAM TO THE LOBBY…</div>
        )}
        <Button variant="outline" size="lg" className="border-primary/40 font-mono text-xs" onClick={leave}>
          <X className="mr-2 h-4 w-4" aria-hidden="true" /> LEAVE
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function MultiplayerApp() {
  const connection = useMultiplayerStore((s) => s.connection);
  const session = useMultiplayerStore((s) => s.session);
  const setMode = useGameStore((s) => s.setMode);

  // Leaving multiplayer from any screen returns to single-player dashboard.
  useEffect(() => {
    if (connection === "idle" && session === null) {
      // Only bounce if the user disconnected (not initial mount).
    }
     
  }, [connection]);

  let screen: React.ReactNode;
  if (!session) {
    screen = <EntryScreen />;
  } else if (session.phase === "lobby") {
    screen = <LobbyScreen />;
  } else if (session.phase === "design") {
    screen = <DesignScreen />;
  } else if (session.phase === "simulation") {
    screen = <SimulationScreenMP />;
  } else {
    screen = <ReportScreenMP />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={session?.phase ?? "entry"}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {screen}
        {/* Emergency exit for any phase */}
        {session ? (
          <div className="mx-auto max-w-5xl px-4 pb-6 text-center sm:px-6">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setMode("single")}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Back to single-player mission control
            </Button>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
