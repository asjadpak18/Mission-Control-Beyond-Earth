"use client";

/**
 * ============================================================================
 * MISSION VISUALIZER — v2.1 dynamic flight simulations (SYSTEM C)
 * ============================================================================
 * The right-hand panel of the simulation screen. Every stage renders a LIVE
 * SIMULATION built from the shared spacecraft model — the exact vehicle the
 * player assembled in the Design Lab (and launched in the LaunchScene):
 *
 *   1 LAUNCH      dynamic countdown / ignition / smoke / ascent (LaunchScene)
 *   2 SEPARATION  booster drifts away; solar wings UNFOLD; masts rise
 *   3 CRUISE      deployed craft coasting toward the destination
 *   4 NAVIGATION  tilted craft, RCS puffs, corrected trajectory
 *   5 ARRIVAL     orbital insertion burn onto a real orbit path / powered
 *                 descent with glowing heat shield for landers
 *   6 SCIENCE     scanning cone sweeping the target, data pulses
 *   7 DOWNLINK    signal waves + packets to Earth (they DIE on comm loss)
 *   8 EVALUATION  mission outcome
 *
 * Every mission event gets its own DYNAMIC simulation that reacts to the
 * actual engine state (never a random animation): solar storms wash over the
 * hull, asteroids tumble past, engine malfunctions visibly cut thrust,
 * comm failures kill the signal, impacts visibly damage parts, fuel
 * emergencies lean the flame.
 *
 * All motion is CSS-driven (transform/opacity) and disabled under
 * prefers-reduced-motion, leaving clean static scenes as the fallback.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Mission, SpacecraftConfig, SimulationState, MissionEvent } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { buildSpacecraftModel } from "./spacecraft/model";
import { SpacecraftDiagram } from "./spacecraft/SpacecraftDiagram";
import { LaunchScene } from "./spacecraft/LaunchScene";
import { ArrivalScene } from "./spacecraft/scenes/ArrivalScene";
import { FlightHud } from "./FlightHud";
import { SvgWatermark } from "./Watermark";
import { useCue, useSoundStore } from "@/store/soundStore";

// ---------------------------------------------------------------------------
// Destination palettes (per mission imageId)
// ---------------------------------------------------------------------------

export interface DestPalette {
  base: string;
  light: string;
  dark: string;
  detail: string;
  glow: string;
  rings?: boolean;
  bands?: boolean;
  craters?: boolean;
  sun?: boolean;
}

const DESTINATIONS: Record<string, DestPalette> = {
  moon: { base: "#9aa3ad", light: "#d7dce2", dark: "#5c646e", detail: "#7b838d", glow: "rgba(200,210,225,0.25)", craters: true },
  mars: { base: "#c1553b", light: "#e8895f", dark: "#7e3018", detail: "#a3412a", glow: "rgba(230,120,80,0.3)" },
  venus: { base: "#d9b25f", light: "#f2dc9c", dark: "#9c7a2e", detail: "#c39b45", glow: "rgba(240,215,140,0.35)", bands: true },
  asteroid: { base: "#8a7f70", light: "#b3a795", dark: "#574f44", detail: "#6e6557", glow: "rgba(180,170,150,0.25)", craters: true },
  jupiter: { base: "#c9a97a", light: "#e8cfa5", dark: "#8a6a44", detail: "#a97f52", glow: "rgba(220,180,120,0.35)", bands: true },
  comet: { base: "#a8c6d8", light: "#e2f2fa", dark: "#5f8296", detail: "#87adc2", glow: "rgba(190,230,250,0.4)" },
  mercury: { base: "#8f8578", light: "#c2b8a8", dark: "#57503f", detail: "#746c5c", glow: "rgba(200,190,170,0.25)", craters: true },
  sun: { base: "#ffb020", light: "#ffe9a0", dark: "#e06a10", detail: "#ff9430", glow: "rgba(255,180,60,0.5)", sun: true },
  europa: { base: "#b8ccd8", light: "#e8f4fa", dark: "#7195a8", detail: "#93b4c4", glow: "rgba(200,235,250,0.35)" },
  saturn: { base: "#d9c08a", light: "#f0e0b0", dark: "#9a7f4e", detail: "#c0a770", glow: "rgba(235,215,160,0.35)", bands: true, rings: true },
  titan: { base: "#d98f3e", light: "#f0bb70", dark: "#93581c", detail: "#c17a2e", glow: "rgba(235,170,90,0.4)" },
  deepspace: { base: "#3c2a5c", light: "#6e5a9c", dark: "#1c1230", detail: "#513e78", glow: "rgba(140,110,220,0.3)" },
};

function destPalette(mission: Mission): DestPalette {
  return DESTINATIONS[mission.imageId] ?? DESTINATIONS.moon;
}

// ---------------------------------------------------------------------------
// Scene atoms
// ---------------------------------------------------------------------------

function Stars({ motionOk }: { motionOk: boolean }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        x: (i * 137.5) % 300,
        y: (i * 89.3) % 200,
        r: (i % 3) * 0.45 + 0.6,
        o: 0.35 + ((i * 7) % 10) / 18,
      })),
    []
  );
  return (
    <g className={motionOk ? "star-drift" : undefined}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#d6ecff" opacity={s.o} />
      ))}
    </g>
  );
}

function DestinationPlanet({ palette, cx, cy, r, motionOk }: { palette: DestPalette; cx: number; cy: number; r: number; motionOk: boolean }) {
  const gid = `dest-${palette.base.replace("#", "")}`;
  return (
    <g className={motionOk ? "dest-approach" : undefined}>
      <circle cx={cx} cy={cy} r={r + 14} fill={palette.glow} opacity="0.35" />
      {palette.rings ? (
        <ellipse cx={cx} cy={cy} rx={r * 1.75} ry={r * 0.42} fill="none" stroke={palette.detail} strokeWidth="5" opacity="0.7" transform={`rotate(-14 ${cx} ${cy})`} />
      ) : null}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${gid})`} />
      {palette.bands ? (
        <>
          <rect x={cx - r} y={cy - r * 0.4} width={2 * r} height={r * 0.22} fill={palette.dark} opacity="0.4" clipPath={`circle(${r}px at ${cx}px ${cy}px)`} />
          <rect x={cx - r} y={cy - r * 0.02} width={2 * r} height={r * 0.3} fill={palette.light} opacity="0.35" clipPath={`circle(${r}px at ${cx}px ${cy}px)`} />
          <rect x={cx - r} y={cy + r * 0.42} width={2 * r} height={r * 0.2} fill={palette.dark} opacity="0.45" clipPath={`circle(${r}px at ${cx}px ${cy}px)`} />
        </>
      ) : null}
      {palette.craters ? (
        <>
          <circle cx={cx - r * 0.35} cy={cy - r * 0.2} r={r * 0.16} fill={palette.dark} opacity="0.5" />
          <circle cx={cx + r * 0.25} cy={cy + r * 0.3} r={r * 0.11} fill={palette.dark} opacity="0.45" />
          <circle cx={cx + r * 0.05} cy={cy - r * 0.45} r={r * 0.08} fill={palette.dark} opacity="0.4" />
        </>
      ) : null}
      {palette.sun ? (
        <>
          <path className={motionOk ? "flare-arc" : undefined} d={`M ${cx - r * 0.4} ${cy - r} Q ${cx - r * 0.75} ${cy - r * 1.6} ${cx - r * 0.2} ${cy - r * 1.3}`} stroke="#ffd27a" strokeWidth="3" fill="none" opacity="0.8" />
          <path className={motionOk ? "flare-arc" : undefined} d={`M ${cx + r * 0.3} ${cy - r} Q ${cx + r * 0.65} ${cy - r * 1.7} ${cx + r * 0.1} ${cy - r * 1.4}`} stroke="#ffb020" strokeWidth="3.4" fill="none" opacity="0.75" />
        </>
      ) : null}
    </g>
  );
}

function Earth({ x, y, r = 13 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 5} fill="rgba(0,163,255,0.2)" />
      <circle cx={x} cy={y} r={r} fill="#1a5fb4" stroke="#66caff" strokeWidth="1" />
      <path d={`M ${x - r} ${y + r * 0.2} Q ${x} ${y + r * 0.55} ${x + r} ${y + r * 0.1}`} stroke="#2dd4a7" strokeWidth="2" fill="none" opacity="0.8" />
      <path d={`M ${x - r * 0.6} ${y - r * 0.4} Q ${x} ${y - r * 0.15} ${x + r * 0.7} ${y - r * 0.5}`} stroke="#2dd4a7" strokeWidth="1.6" fill="none" opacity="0.7" />
    </g>
  );
}

function StatusChip({ x, y, w, text, color }: { x: number; y: number; w: number; text: string; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="20" rx="4" fill="rgba(4,7,15,0.75)" stroke={color} strokeWidth="1" />
      <text x={x + w / 2} y={y + 14} textAnchor="middle" fontSize="9.5" fill={color} fontFamily="monospace" fontWeight="bold">
        {text}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Event classification (drives the dynamic event simulations)
// ---------------------------------------------------------------------------

type OverlayKind =
  | "storm" | "malfunction" | "comm_loss" | "impact" | "asteroid"
  | "fuel" | "discovery" | "panel_deploy" | "advisory" | "eclipse" | null;

function classifyText(t: string): OverlayKind {
  if (/storm|radiation|flare|coronal/.test(t)) return "storm";
  if (/eclipse|shadow|blackout|night ?side/.test(t)) return "eclipse";
  if (/asteroid|boulder/.test(t)) return "asteroid";
  if (/micrometeor|impact|strike|dust\b|debris/.test(t)) return "impact";
  if (/panel|array deploy|deploy.*panel|unfold/.test(t)) return "panel_deploy";
  if (/comm|downlink|antenna|conjunction|occultation|signal/.test(t)) return "comm_loss";
  if (/fuel|propellant|tank|leak/.test(t)) return "fuel";
  if (/discovery|serendipity|opportunity|plume|quake|organic|unexpected.*science/.test(t)) return "discovery";
  if (/objective|re-?scop|re-?task|ground control|team on site|e-?mail|directive/.test(t)) return "advisory";
  return "malfunction";
}

function classifyEvent(event: MissionEvent): OverlayKind {
  return classifyText(`${event.id} ${event.title}`.toLowerCase());
}

/** Engine-specific malfunction? (drives the visible thrust loss) */
function isEngineMalfunction(event: MissionEvent | null): boolean {
  if (!event) return false;
  // Word-bounded: "reaction" must NOT match the "ion" engine pattern.
  return /\b(engine|thruster|propulsion|nozzle|burn|ion)\b/i.test(`${event.id} ${event.title}`);
}

// ---------------------------------------------------------------------------
// Shared flight-craft visual state
// ---------------------------------------------------------------------------

interface CraftVisualState {
  engineOn: boolean;
  throttle: number;
  sputter: boolean;
  deploy: number;
  commFail: boolean;
  damagedIds: string[];
  stormShake: boolean;
}

// ---------------------------------------------------------------------------
// Stage scenes — every one renders the ACTUAL spacecraft (shared model)
// ---------------------------------------------------------------------------

function StageScene({
  stage,
  mission,
  config,
  simulation,
  phase,
  motionOk,
  failed,
  craft,
}: {
  stage: number;
  mission: Mission;
  config: SpacecraftConfig;
  simulation: SimulationState;
  phase: SimulationState["stagePhase"] | "over";
  motionOk: boolean;
  failed: boolean;
  craft: CraftVisualState;
}) {
  const palette = destPalette(mission);
  const running = phase === "running";
  const diagram = (cx: number, cy: number, h: number, tilt = 0, extra?: React.SVGProps<SVGGElement>) => (
    <g transform={`rotate(${tilt} ${cx} ${cy})`} {...extra}>
      <SpacecraftDiagram
        config={config}
        cx={cx}
        cy={cy}
        targetHeight={h}
        mode="flight"
        engineOn={craft.engineOn}
        throttle={craft.throttle}
        sputter={craft.sputter}
        deploy={craft.deploy}
        damagedEquipmentIds={craft.damagedIds}
        commFail={craft.commFail}
        motionOk={motionOk}
      />
    </g>
  );

  switch (stage) {
    case 1: {
      // LAUNCH — fully dynamic launch simulation (LaunchScene). It is keyed
      // on `active` so arming the vehicle remounts the timeline cleanly.
      const launchActive = phase === "running" || phase === "awaiting_event";
      return (
        <LaunchScene
          key={launchActive ? "go" : "hold"}
          config={config}
          active={launchActive}
          motionOk={motionOk}
          failed={failed}
        />
      );
    }
    case 2: {
      // SEPARATION — booster drifts away, the real craft deploys its systems
      return (
        <g>
          <Stars motionOk={motionOk} />
          {/* Separation flash */}
          <g className={motionOk && running ? "impact-flash" : undefined} opacity={running ? 0.9 : 0.3}>
            <line x1="118" y1="70" x2="118" y2="180" stroke="#bff4ff" strokeWidth="2" strokeDasharray="3 6" />
          </g>
          {/* Spent booster stage tumbling away */}
          <g className={motionOk ? "booster-drift" : undefined} style={{ transformOrigin: "66px 120px" }}>
            <g transform="translate(56 84) rotate(24)">
              <rect x="0" y="0" width="20" height="70" rx="9" fill="#e8eef5" stroke="#9fb8d4" strokeWidth="1.2" opacity="0.85" />
              <rect x="0" y="28" width="20" height="5" fill="#00a3ff" opacity="0.5" />
              <path d="M 2 70 L 6 80 L 14 80 L 18 70 Z" fill="#3b3f4a" />
              <ellipse cx="10" cy="84" rx="7" ry="10" fill="#8fb4d6" opacity="0.3" />
            </g>
          </g>
          <text x="66" y="58" textAnchor="middle" fontSize="8" fill="#8fb4d6" fontFamily="monospace">
            SPENT STAGE
          </text>
          {/* The deployed spacecraft — wings unfold, masts rise (deploy prop) */}
          <g className={motionOk ? "cruise-bob" : undefined} style={{ transformOrigin: "188px 128px" }}>
            {diagram(188, 128, 118, 0, craft.stormShake && motionOk ? { className: "pad-shake" } : undefined)}
          </g>
          <StatusChip x={122} y={196} w={136} text={running ? "DEPLOYING SOLAR ARRAYS…" : "SEPARATION CONFIRMED"} color="#66caff" />
        </g>
      );
    }
    case 3: {
      // CRUISE — coasting through interplanetary space
      return (
        <g>
          <Stars motionOk={motionOk} />
          {/* Distant destination */}
          <DestinationPlanet palette={palette} cx={252} cy={62} r={14} motionOk={motionOk} />
          {/* Dashed route */}
          <path d="M 132 122 Q 190 80 238 68" stroke="#66caff" strokeWidth="1.4" strokeDasharray="5 5" fill="none" opacity="0.6" />
          {/* The cruising spacecraft */}
          <g className={motionOk ? "cruise-bob" : undefined} style={{ transformOrigin: "110px 130px" }}>
            {diagram(110, 130, 100, 0, craft.stormShake && motionOk ? { className: "pad-shake" } : undefined)}
          </g>
          <StatusChip x={86} y={196} w={150} text={`CRUISE — ${mission.destination.toUpperCase()} AHEAD`} color="#66caff" />
        </g>
      );
    }
    case 4: {
      // NAVIGATION — orientation change + RCS puffs + correction burn
      return (
        <g>
          <Stars motionOk={motionOk} />
          {/* Old trajectory */}
          <path d="M 40 190 L 250 60" stroke="#5f7794" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.55" />
          {/* Corrected trajectory */}
          <path d="M 40 190 Q 150 130 244 44" stroke="#00e5ff" strokeWidth="2" fill="none" opacity="0.9" />
          <g className={motionOk ? "cruise-bob" : undefined} style={{ transformOrigin: "120px 140px" }}>
            {diagram(120, 140, 96, -32, craft.stormShake && motionOk ? { className: "pad-shake" } : undefined)}
          </g>
          {/* RCS puffs */}
          {[0, 1].map((i) => (
            <circle
              key={i}
              cx={142}
              cy={128}
              r="5"
              fill="#bff4ff"
              className={motionOk ? "nav-thrust" : undefined}
              style={motionOk ? { animationDelay: `${i * 0.45}s` } : undefined}
            />
          ))}
          <StatusChip x={88} y={200} w={132} text={running ? "CORRECTION BURN UNDERWAY" : "COURSE CORRECTION BURN"} color="#00e5ff" />
        </g>
      );
    }
    case 5: {
      // ARRIVAL — delegated to the v2.2 standalone phased scene component.
      // Orbiter/flyby: approach → capture_burn → orbit_insertion → orbit_trace
      // Lander/probe:  approach → atmospheric_entry → powered_descent → touchdown
      // Plus destination-specific flourishes (Saturn rings, Titan haze, etc.)
      // Keyed by activation so the scene remounts on the pending→running
      // transition (matches LaunchScene's remount pattern).
      const arrivalActive = phase === "running" || phase === "awaiting_event";
      return (
        <ArrivalScene
          key={arrivalActive ? "go" : "hold"}
          mission={mission}
          config={config}
          simulation={simulation}
          phase={phase}
          motionOk={motionOk}
          failed={failed}
          craft={craft}
          palette={palette}
        />
      );
    }
    case 6: {
      // SCIENCE — instruments scanning the target
      return (
        <g>
          <Stars motionOk={motionOk} />
          <DestinationPlanet palette={palette} cx={226} cy={92} r={44} motionOk={motionOk} />
          <g className={motionOk ? "cruise-bob" : undefined} style={{ transformOrigin: "88px 110px" }}>
            {diagram(88, 110, 96, 0, craft.stormShake && motionOk ? { className: "pad-shake" } : undefined)}
          </g>
          {/* Scan cone */}
          <path d="M 104 118 L 192 76 L 192 112 Z" fill="rgba(0,229,255,0.12)" />
          <g className={motionOk ? "scan-sweep" : undefined}>
            <line x1="150" y1="70" x2="150" y2="130" stroke="#00e5ff" strokeWidth="2" opacity="0.85" />
          </g>
          {/* Data points */}
          {[
            [176, 84], [188, 96], [170, 104],
          ].map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r="2.4" fill="#2dd4a7" className={motionOk ? "event-pulse" : undefined} style={motionOk ? { animationDelay: `${i * 0.3}s` } : undefined} />
          ))}
          <StatusChip x={88} y={182} w={140} text="SCIENCE CAMPAIGN ACTIVE" color="#7ff0d3" />
        </g>
      );
    }
    case 7: {
      // COMMUNICATION — waves + packets to Earth; signal DIES on comm loss
      const ok = !craft.commFail;
      return (
        <g>
          <Stars motionOk={motionOk} />
          <Earth x={252} y={54} />
          <g className={motionOk ? "cruise-bob" : undefined} style={{ transformOrigin: "96px 120px" }}>
            {diagram(96, 120, 100)}
          </g>
          {/* Signal waves — vanish when the link fails */}
          {ok ? (
            <>
              {[0, 1, 2].map((i) => (
                <circle
                  key={i}
                  cx="112"
                  cy="108"
                  r="10"
                  fill="none"
                  stroke="#00e5ff"
                  strokeWidth="1.8"
                  className={motionOk ? "comm-wave" : undefined}
                  style={motionOk ? { animationDelay: `${i * 0.55}s` } : undefined}
                  opacity="0.8"
                />
              ))}
              {[0, 1, 2].map((i) => (
                <rect
                  key={i}
                  x="140"
                  y="86"
                  width="5"
                  height="5"
                  fill="#2dd4a7"
                  className={motionOk ? "data-stream" : undefined}
                  style={motionOk ? { animationDelay: `${i * 0.6}s` } : undefined}
                />
              ))}
            </>
          ) : (
            <g>
              {/* Static noise replacing the carrier */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect
                  key={i}
                  x={132 + i * 9}
                  y={100 - (i % 3) * 6}
                  width="4"
                  height={10 + (i % 3) * 7}
                  fill="#ff4d6a"
                  opacity="0.7"
                  className={motionOk ? "static-noise" : undefined}
                  style={motionOk ? { animationDelay: `${i * 0.09}s` } : undefined}
                />
              ))}
            </g>
          )}
          <StatusChip
            x={88}
            y={182}
            w={140}
            text={ok ? "DOWNLINK TO EARTH IN PROGRESS" : "▓▒░ SIGNAL LOST ░▒▓"}
            color={ok ? "#8fe9ff" : "#ff9fb0"}
          />
        </g>
      );
    }
    default: {
      // 8 — EVALUATION
      const success = !failed;
      return (
        <g>
          <Stars motionOk={motionOk} />
          <DestinationPlanet palette={palette} cx={150} cy={86} r={40} motionOk={motionOk} />
          {diagram(150, 168, 74)}
          <rect
            x="52"
            y="14"
            width="196"
            height="30"
            rx="6"
            fill={success ? "rgba(45,212,167,0.16)" : "rgba(255,77,106,0.16)"}
            stroke={success ? "#2dd4a7" : "#ff4d6a"}
            strokeWidth="1.6"
          />
          <text x="150" y="34" textAnchor="middle" fontSize="12" fill={success ? "#7ff0d3" : "#ff9fb0"} fontFamily="monospace" fontWeight="bold">
            {success ? "MISSION COMPLETE" : "MISSION LOST"}
          </text>
          <text x="150" y="214" textAnchor="middle" fontSize="9.5" fill="#8fb4d6" fontFamily="monospace">
            FINAL FLIGHT REVIEW IN PROGRESS
          </text>
        </g>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Dynamic event simulations — every overlay is a live simulation that
// changes the spacecraft / environment, tied to the ACTUAL pending event
// ---------------------------------------------------------------------------

function EventSimulation({
  kind,
  event,
  motionOk,
  commFail,
}: {
  kind: OverlayKind;
  event: MissionEvent;
  motionOk: boolean;
  commFail: boolean;
}) {
  if (kind === "eclipse") {
    return (
      <g>
        {/* The scene darkens as the craft enters the body's shadow */}
        <rect x="0" y="0" width="300" height="250" fill="#04070f" opacity="0.45" className={motionOk ? "hull-glow" : undefined} />
        {/* Solar wings go dark; battery buffer takes the load */}
        <g>
          <rect x="96" y="104" width="108" height="18" rx="3" fill="rgba(4,7,15,0.8)" stroke="#57e6ff" strokeWidth="1.4" />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={100 + i * 26}
              y="108"
              width="20"
              height="10"
              rx="1.5"
              fill="#57e6ff"
              opacity={0.85 - i * 0.16}
              className={motionOk && i === 3 ? "event-pulse" : undefined}
            />
          ))}
          <text x="150" y="99" textAnchor="middle" fontSize="8" fill="#8fb4d6" fontFamily="monospace">BATTERY BUFFER</text>
        </g>
        {/* Sun crossed out behind the target body */}
        <g opacity="0.9">
          <circle cx="258" cy="40" r="10" fill="#ffb020" opacity="0.35" />
          <line x1="248" y1="30" x2="268" y2="50" stroke="#ff4d6a" strokeWidth="2.4" />
        </g>
        <StatusChip x={78} y={138} w={144} text="IN THE SHADOW — ARRAYS OFFLINE" color="#8fb4d6" />
      </g>
    );
  }
  if (kind === "advisory") {
    return (
      <g>
        {/* Ground control directive — informational, no hardware fault */}
        {[0, 1].map((i) => (
          <circle
            key={i}
            cx="150"
            cy="120"
            r={16 + i * 10}
            fill="none"
            stroke="#66caff"
            strokeWidth="1.6"
            opacity={0.6 - i * 0.22}
            className={motionOk ? "comm-wave" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.5}s` } : undefined}
          />
        ))}
        <circle cx="150" cy="120" r="5" fill="#66caff" className={motionOk ? "event-pulse" : undefined} />
        <StatusChip x={84} y={150} w={132} text="GROUND CONTROL DIRECTIVE" color="#8fb4d6" />
      </g>
    );
  }
  if (kind === "storm") {
    return (
      <g>
        {/* Environment change: radiation washing over the scene */}
        <rect x="0" y="0" width="300" height="250" fill="rgba(255,176,32,0.10)" className={motionOk ? "hull-glow" : undefined} />
        {/* Particle stream from the Sun */}
        {Array.from({ length: 7 }).map((_, i) => (
          <line
            key={i}
            x1={300}
            y1={-6 + i * 34}
            x2={252}
            y2={18 + i * 34}
            stroke="#ffb020"
            strokeWidth="1.6"
            opacity="0.55"
            className={motionOk ? "storm-particle" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.18}s` } : undefined}
          />
        ))}
        <circle cx="272" cy="30" r="13" fill="#ffb020" opacity="0.9" />
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="272"
            cy="30"
            r="19"
            fill="none"
            stroke="#ffb020"
            strokeWidth="2"
            className={motionOk ? "comm-wave" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.5}s` } : undefined}
            opacity="0.7"
          />
        ))}
        <StatusChip x={66} y={150} w={168} text="SOLAR STORM — RADIATION WASHING OVER THE HULL" color="#ffd27a" />
      </g>
    );
  }
  if (kind === "asteroid" || kind === "impact") {
    const asteroid = (
      <g className={motionOk ? "asteroid-drift" : undefined} style={{ transformOrigin: "center", transformBox: "fill-box" }}>
        <g className={motionOk ? "asteroid-tumble" : undefined} style={{ transformOrigin: "center", transformBox: "fill-box" }}>
          <path
            d="M 0 -11 L 9 -7 L 12 2 L 6 10 L -5 11 L -11 3 L -8 -6 Z"
            fill="#8a7f70"
            stroke="#574f44"
            strokeWidth="1.4"
          />
          <circle cx="2" cy="-2" r="2.6" fill="#574f44" opacity="0.7" />
          <circle cx="-4" cy="4" r="1.7" fill="#574f44" opacity="0.6" />
        </g>
      </g>
    );
    return (
      <g>
        {asteroid}
        {/* Impact flash on the hull when it reaches the craft */}
        {motionOk ? (
          <circle cx="150" cy="140" r="8" fill="#ff4d6a" className="impact-flash" style={{ animationDelay: "1.6s", animationIterationCount: "3" }} />
        ) : (
          <circle cx="150" cy="140" r="6" fill="#ff4d6a" opacity="0.8" />
        )}
        <StatusChip
          x={96}
          y={96}
          w={108}
          text={kind === "asteroid" ? "ASTEROID ENCOUNTER" : "IMPACT DETECTED"}
          color="#ff9fb0"
        />
      </g>
    );
  }
  if (kind === "comm_loss") {
    return (
      <g>
        {/* Dying signal near the craft */}
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="150"
            cy="118"
            r={8 + i * 6}
            fill="none"
            stroke="#ff4d6a"
            strokeWidth="1.6"
            opacity={0.6 - i * 0.18}
            className={motionOk ? "comm-wave" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.3}s` } : undefined}
          />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={136 + i * 8}
            y={146}
            width="4"
            height={8 + (i % 3) * 6}
            fill="#ff4d6a"
            opacity="0.7"
            className={motionOk ? "static-noise" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.1}s` } : undefined}
          />
        ))}
        <StatusChip x={90} y={182} w={120} text="▓▒░ SIGNAL LOST ░▒▓" color="#ff9fb0" />
        {commFail ? null : null}
      </g>
    );
  }
  if (kind === "fuel") {
    return (
      <g>
        {/* Draining propellant gauge */}
        <rect x="112" y="104" width="76" height="18" rx="3" fill="none" stroke="#ffb020" strokeWidth="1.6" />
        <rect
          x="115"
          y="107"
          width="34"
          height="12"
          fill="#ffb020"
          opacity="0.85"
          className={motionOk ? "gauge-drain" : undefined}
          style={{ transformOrigin: "115px 107px", transformBox: "view-box" }}
        />
        {/* Vapor venting from the tanks */}
        {[0, 1].map((i) => (
          <circle
            key={i}
            cx={146 + i * 12}
            cy="128"
            r="3.4"
            fill="#ffd27a"
            opacity="0.5"
            className={motionOk ? "exhaust-rise" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.5}s` } : undefined}
          />
        ))}
        <StatusChip x={104} y={148} w={92} text="LOW PROPELLANT" color="#ffd27a" />
      </g>
    );
  }
  if (kind === "discovery") {
    return (
      <g>
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="216"
            cy="72"
            r="12"
            fill="none"
            stroke="#2dd4a7"
            strokeWidth="2"
            className={motionOk ? "comm-wave" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.4}s` } : undefined}
          />
        ))}
        <circle cx="216" cy="72" r="6" fill="#2dd4a7" className={motionOk ? "event-pulse" : undefined} />
        {[
          [188, 96], [240, 60], [232, 92],
        ].map(([x, y], i) => (
          <path key={i} d={`M ${x} ${y - 3} L ${x + 2.2} ${y} L ${x} ${y + 3} L ${x - 2.2} ${y} Z`} fill="#7ff0d3" className={motionOk ? "event-pulse" : undefined} style={motionOk ? { animationDelay: `${i * 0.25}s` } : undefined} />
        ))}
        <text x="216" y="104" textAnchor="middle" fontSize="9" fill="#7ff0d3" fontFamily="monospace" fontWeight="bold">
          DISCOVERY
        </text>
      </g>
    );
  }
  if (kind === "panel_deploy") {
    return (
      <g>
        {/* Deployment markers flare at the wing tips while panels unfold */}
        {[-1, 1].map((s) => (
          <g key={s}>
            <circle
              cx={150 + s * 54}
              cy={126}
              r="10"
              fill="none"
              stroke="#2dd4a7"
              strokeWidth="2"
              className={motionOk ? "comm-wave" : undefined}
              style={motionOk ? { animationDelay: `${s > 0 ? 0.2 : 0}s` } : undefined}
            />
            <circle cx={150 + s * 54} cy={126} r="3" fill="#2dd4a7" />
          </g>
        ))}
        <StatusChip x={98} y={168} w={104} text="SOLAR PANEL DEPLOYMENT" color="#7ff0d3" />
      </g>
    );
  }
  // malfunction — sparks at the failing subsystem, vapor jets
  return (
    <g>
      <path d="M 142 104 L 152 104 L 146 120 L 158 120 L 140 146 L 146 124 L 136 124 Z" fill="#ffb020" className={motionOk ? "event-pulse" : undefined} />
      {/* Vapor jet from the faulty unit */}
      {[0, 1].map((i) => (
        <circle
          key={i}
          cx={168 + i * 8}
          cy={132}
          r="3"
          fill="#d6ecff"
          opacity="0.6"
          className={motionOk ? "exhaust-rise" : undefined}
          style={motionOk ? { animationDelay: `${i * 0.4}s` } : undefined}
        />
      ))}
      <circle cx="150" cy="160" r="4" fill="#ff4d6a" className={motionOk ? "event-pulse" : undefined} />
      <text x="150" y="180" textAnchor="middle" fontSize="9.5" fill="#ffd27a" fontFamily="monospace" fontWeight="bold">
        {isEngineMalfunction(event) ? "ENGINE FAULT — THRUST FALLING" : "SUBSYSTEM FAULT"}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface MissionVisualizerProps {
  mission: Mission;
  config: SpacecraftConfig;
  simulation: SimulationState;
  /** true while the console is revealing the current stage's log lines */
  revealing?: boolean;
  className?: string;
}

export function MissionVisualizer({ mission, config, simulation, revealing = false, className }: MissionVisualizerProps) {
  const reducedMotion = useReducedMotion();
  const motionOk = !reducedMotion;
  const model = useMemo(() => buildSpacecraftModel(config), [config]);

  const missionOver = simulation.stagePhase === "complete" || simulation.status === "failure";
  // While the console reveals a stage's log lines, the flight view shows THAT
  // stage's live simulation (the engine advances stageIndex immediately, but
  // the player should watch the launch while the launch log prints — not the
  // next stage already).
  const revealingStage =
    revealing && !missionOver && simulation.stageLog.length > 0
      ? simulation.stageLog[simulation.stageLog.length - 1].stage
      : null;
  const stageNum = missionOver ? 8 : revealingStage ?? simulation.stageIndex + 1;
  const phase: SimulationState["stagePhase"] | "over" = missionOver
    ? "over"
    : revealing && simulation.stagePhase !== "awaiting_event"
      ? "running"
      : simulation.stagePhase;

  const pending = simulation.pendingEvent?.event ?? null;
  const overlayKind = pending && !missionOver ? classifyEvent(pending) : null;

  // --- dynamic damage bookkeeping: resolved impacts scar the craft ---------
  const damagedIds = useMemo(() => {
    const pastEvents = simulation.eventLog.map((r) => `${r.eventId} ${r.title}`.toLowerCase());
    const pendingText = pending ? `${pending.id} ${pending.title}`.toLowerCase() : null;
    const impacts =
      pastEvents.filter((t) => classifyText(t) === "impact" || classifyText(t) === "asteroid").length +
      (pendingText && (classifyText(pendingText) === "impact" || classifyText(pendingText) === "asteroid") ? 1 : 0);
    if (impacts === 0) return [] as string[];
    const candidates = Array.from(
      new Set([
        ...model.parts.filter((p) => p.kind === "wing").map((p) => p.equipmentId),
        ...model.parts.filter((p) => p.kind === "instrument").map((p) => p.equipmentId),
        ...model.parts.filter((p) => p.kind === "bus").map((p) => p.equipmentId),
      ])
    );
    return candidates.slice(0, impacts);
  }, [simulation.eventLog, pending, model]);

  // --- panel-deploy events replay the unfolding motion ---------------------
  // The wings fold briefly, then the CSS transition unfolds them again —
  // both state changes fire from timer callbacks (no sync setState).
  const [foldPulse, setFoldPulse] = useState(false);
  useEffect(() => {
    if (overlayKind !== "panel_deploy") return;
    const fold = setTimeout(() => setFoldPulse(true), 40);
    const unfold = setTimeout(() => setFoldPulse(false), 620);
    return () => {
      clearTimeout(fold);
      clearTimeout(unfold);
    };
  }, [overlayKind]);

  // --- the craft's live visual state, derived from the ACTUAL simulation ---
  const craft: CraftVisualState = useMemo(() => {
    const executed = phase !== "pending";
    let deploy = 1;
    if (stageNum === 1) deploy = 0.08;
    else if (stageNum === 2) deploy = executed ? 1 : 0.08;
    if (overlayKind === "panel_deploy" && foldPulse) deploy = 0.12;

    let engineOn = false;
    let throttle = 1;
    if (stageNum === 4) {
      engineOn = true;
      throttle = 0.5;
    } else if (stageNum === 5) {
      if (mission.type === "orbiter" || mission.type === "flyby") {
        engineOn = phase === "running";
        throttle = 0.9;
      } else {
        engineOn = executed;
        throttle = 0.85;
      }
    } else if (stageNum === 3 && overlayKind === "malfunction") {
      // The failing engine fires erratically during cruise
      engineOn = true;
      throttle = 0.6;
    }

    const sputter = overlayKind === "malfunction" && isEngineMalfunction(pending);
    if (sputter) {
      engineOn = true;
      throttle = Math.min(throttle, 0.45);
    }
    if (overlayKind === "fuel") throttle *= 0.45;

    return {
      engineOn,
      throttle,
      sputter,
      deploy,
      commFail: overlayKind === "comm_loss",
      damagedIds,
      stormShake: overlayKind === "storm",
    };
  }, [stageNum, phase, mission.type, overlayKind, pending, foldPulse, damagedIds]);

  const palette = destPalette(mission);

  // v2.2 — stage-specific ambient sound cues. Fires once per stage entry
  // (after the launch cue has already played from SimulationScreen). The
  // touchdown cue fires only for landers at stage 5.
  const cue = useCue();
  const audioUnlocked = useSoundStore((s) => s.audioUnlocked);
  const prevStage = useRef(stageNum);
  useEffect(() => {
    if (!audioUnlocked || stageNum === prevStage.current) return;
    prevStage.current = stageNum;
    if (stageNum === 2) cue("separation");
    else if (stageNum === 4) cue("engine_burn");
    else if (stageNum === 5) {
      if (mission.type === "lander" || mission.type === "probe") {
        // Touchdown thud fires after the descent animation completes.
        setTimeout(() => cue("touchdown"), 5500);
      } else {
        cue("engine_burn");
      }
    } else if (stageNum === 6) cue("scan_sweep");
    else if (stageNum === 7) cue("comm_signal");
  }, [stageNum, audioUnlocked, mission.type, cue]);

  return (
    <div className={cn("panel hud-corners relative flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-primary/15 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", missionOver ? "bg-amber-400" : "bg-emerald-400 live-dot")} aria-hidden="true" />
          <span className="font-display text-[13px] font-bold text-foreground">Flight View</span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
          CAM-{String(stageNum).padStart(2, "0")} · {mission.destination.toUpperCase()}
        </span>
      </div>

      <div
        className="relative flex-1"
        style={{
          background:
            stageNum === 1 && phase !== "over"
              ? "linear-gradient(180deg, #0a1e3f 0%, #123358 65%, #1c4a72 100%)"
              : "linear-gradient(180deg, #04070f 0%, #071022 100%)",
        }}
      >
        <svg viewBox="0 0 300 250" className="h-full w-full" role="img" aria-label={`Mission simulation — stage ${stageNum} of 8 at ${mission.destination}${overlayKind ? `, active event simulation: ${pending?.title}` : ""}`}>
          <defs>
            <radialGradient id={`dest-${palette.base.replace("#", "")}`} cx="38%" cy="34%" r="72%">
              <stop offset="0%" stopColor={palette.light} />
              <stop offset="62%" stopColor={palette.base} />
              <stop offset="100%" stopColor={palette.dark} />
            </radialGradient>
          </defs>
          <StageScene
            stage={stageNum}
            mission={mission}
            config={config}
            simulation={simulation}
            phase={phase}
            motionOk={motionOk}
            failed={simulation.status === "failure"}
            craft={craft}
          />
          {overlayKind && pending ? (
            <EventSimulation kind={overlayKind} event={pending} motionOk={motionOk} commFail={craft.commFail} />
          ) : null}
          <SvgWatermark width={300} height={250} />
        </svg>

        {/* v2.2 — Live telemetry HUD overlay */}
        <FlightHud
          mission={mission}
          simulation={simulation}
          stageNum={stageNum}
          missionOver={missionOver}
        />

        {/* Pending event banner */}
        {simulation.pendingEvent && !missionOver ? (
          <div className="absolute inset-x-3 bottom-3 rounded-md border border-amber-400/50 bg-[#0a1526]/90 px-3 py-2 backdrop-blur">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
              EVENT — {simulation.pendingEvent.event.title}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug text-cyan-100/80 line-clamp-2">
              {simulation.pendingEvent.event.description}
            </div>
          </div>
        ) : null}

        {/* Failure ribbon */}
        {missionOver && simulation.status === "failure" ? (
          <div className="absolute inset-x-3 bottom-3 rounded-md border border-rose-400/50 bg-[#1a0a12]/90 px-3 py-2 backdrop-blur">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">MISSION FAILURE</div>
            <div className="mt-0.5 text-[11px] leading-snug text-rose-100/85 line-clamp-2">{simulation.failureReason}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
