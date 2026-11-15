"use client";

/**
 * ============================================================================
 * ARRIVAL SCENE — v2.2 phased destination arrival (stage 5)
 * ============================================================================
 * Replaces the inline stage-5 case in MissionVisualizer with a standalone,
 * multi-beat scene component modelled on LaunchScene.
 *
 * Two choreographic branches keyed on mission.type:
 *
 *   ORBITER / FLYBY  — approach → capture_burn → orbit_insertion → orbit_trace
 *   LANDER / PROBE   — approach → atmospheric_entry → powered_descent → touchdown
 *
 * Each beat has its own SVG composition, wall-clock timing, and live engine
 * state. Destination-specific flourishes are layered on top via mission.imageId:
 *   - saturn : ring-plane crossing during orbit insertion
 *   - sun    : perihelion pass with the solar shield facing the camera
 *   - titan  : methane haze bands during atmospheric entry
 *   - europa : ice-plume curtains during approach
 *   - mars/venus : hypersonic plasma sheath during entry (atmosphere bodies)
 *
 * All motion is CSS transform/opacity, fully disabled under
 * prefers-reduced-motion (the parent passes motionOk=false).
 * ============================================================================
 */

import { useEffect, useState } from "react";
import type { Mission, SpacecraftConfig, SimulationState } from "@/lib/game/types";
import { SpacecraftDiagram } from "../SpacecraftDiagram";

/** Destination colour palette — kept local to avoid a circular import with MissionVisualizer. */
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

/** Wall-clock durations (ms) for each beat — compressed for stage reveal. */
const T_APPROACH = 1800;
const T_BURN = 3600;
const T_INSERTION = 5400;

type OrbiterPhase = "approach" | "capture_burn" | "orbit_insertion" | "orbit_trace";
type LanderPhase = "approach" | "atmospheric_entry" | "powered_descent" | "touchdown";

export interface ArrivalSceneProps {
  mission: Mission;
  config: SpacecraftConfig;
  /** The full live simulation state — used for telemetry-driven flourishes. */
  simulation: SimulationState;
  /** "running" = stage is active; "pending" = armed but not started; "over" = mission ended. */
  phase: SimulationState["stagePhase"] | "over";
  motionOk: boolean;
  failed: boolean;
  /** Live craft visual state (engine on, throttle, deploy, etc.) from MissionVisualizer. */
  craft: {
    engineOn: boolean;
    throttle: number;
    sputter: boolean;
    deploy: number;
    commFail: boolean;
    damagedIds: string[];
    stormShake: boolean;
  };
  /** Destination palette (passed from MissionVisualizer to avoid recomputation). */
  palette: DestPalette;
}

/** Small helper — wraps the spacecraft diagram with a tilt + optional shake. */
function Craft({
  config,
  cx,
  cy,
  h,
  tilt = 0,
  craft,
  motionOk,
  shake = false,
}: {
  config: SpacecraftConfig;
  cx: number;
  cy: number;
  h: number;
  tilt?: number;
  craft: ArrivalSceneProps["craft"];
  motionOk: boolean;
  shake?: boolean;
}) {
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`} className={shake && motionOk ? "pad-shake" : undefined}>
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
}

/** A reusable status chip identical to the one in MissionVisualizer. */
function StatusChip({ x, y, w, text, color }: { x: number; y: number; w: number; text: string; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="20" rx="4" fill="rgba(4,7,15,0.78)" stroke={color} strokeWidth="1" />
      <text x={x + w / 2} y={y + 14} textAnchor="middle" fontSize="9.5" fill={color} fontFamily="monospace" fontWeight="bold">
        {text}
      </text>
    </g>
  );
}

/** Lightweight star field — local to the scene so it can parallax during approach. */
function Stars({ motionOk }: { motionOk: boolean }) {
  return (
    <g className={motionOk ? "star-drift" : undefined}>
      {Array.from({ length: 34 }).map((_, i) => (
        <circle
          key={i}
          cx={(i * 137.5) % 300}
          cy={(i * 89.3) % 200}
          r={(i % 3) * 0.45 + 0.6}
          fill="#d6ecff"
          opacity={0.35 + ((i * 7) % 10) / 18}
        />
      ))}
    </g>
  );
}

/** Destination planet — local copy preserving the MissionVisualizer look. */
function DestinationBody({ palette, cx, cy, r, motionOk }: { palette: DestPalette; cx: number; cy: number; r: number; motionOk: boolean }) {
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

/** Destination-specific approach flourishes. */
function ApproachFlourish({ mission, motionOk }: { mission: Mission; motionOk: boolean }) {
  if (mission.imageId === "europa") {
    // Ice plume curtains rising from the surface as we approach
    return (
      <g opacity="0.55">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M ${210 + i * 14} ${110} Q ${214 + i * 14} ${86} ${218 + i * 14} ${110}`}
            stroke="#bff4ff"
            strokeWidth="1.4"
            fill="none"
            className={motionOk ? "exhaust-rise" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.5}s`, animationDuration: "2.4s" } : undefined}
          />
        ))}
      </g>
    );
  }
  if (mission.imageId === "sun") {
    // Solar wind particles streaming toward the camera
    return (
      <g opacity="0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <line
            key={i}
            x1={250}
            y1={20 + i * 38}
            x2={210}
            y2={50 + i * 38}
            stroke="#ffb020"
            strokeWidth="1.2"
            className={motionOk ? "storm-particle" : undefined}
            style={motionOk ? { animationDelay: `${i * 0.22}s` } : undefined}
          />
        ))}
      </g>
    );
  }
  return null;
}

/** Destination-specific entry plasma — only for atmosphere bodies. */
function EntryPlasma({ mission, motionOk, intensity }: { mission: Mission; motionOk: boolean; intensity: number }) {
  // Mars, Venus, Titan, Earth-relative landers with atmosphere
  const atmosphereBodies = new Set(["mars", "venus", "titan"]);
  if (!atmosphereBodies.has(mission.imageId)) return null;
  const hue = mission.imageId === "titan" ? "#ffb066" : mission.imageId === "venus" ? "#ffd27a" : "#ff8a4a";
  return (
    <g className={motionOk ? "hull-glow" : undefined}>
      <path
        d="M 132 64 Q 150 48 168 64 Q 150 84 132 64 Z"
        fill={hue}
        opacity={0.35 + intensity * 0.4}
      />
      {/* Plasma streaks streaming past the heat shield */}
      {[-1, 0, 1].map((s) => (
        <line
          key={s}
          x1={150 + s * 10}
          y1={52}
          x2={150 + s * 18}
          y2={28}
          stroke={hue}
          strokeWidth="1.8"
          opacity={0.7 * intensity}
          className={motionOk ? "speed-lines" : undefined}
          style={motionOk ? { animationDelay: `${s * 0.12}s`, animationDuration: "0.6s" } : undefined}
        />
      ))}
    </g>
  );
}

// ============================================================================
// ORBITER / FLYBY scene
// ============================================================================

function OrbiterArrival({
  mission,
  config,
  phase,
  motionOk,
  craft,
  palette,
}: ArrivalSceneProps) {
  const active = phase === "running" || phase === "awaiting_event";
  // Initial state derives from props at mount — the parent keys this scene
  // by `active` so it remounts on the pending→running transition.
  const [beat, setBeat] = useState<OrbiterPhase>(() => active ? "approach" : "orbit_trace");

  useEffect(() => {
    if (!active || !motionOk) return;
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setBeat("capture_burn"), T_APPROACH),
      setTimeout(() => setBeat("orbit_insertion"), T_BURN),
      setTimeout(() => setBeat("orbit_trace"), T_INSERTION),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active, motionOk]);

  // Live craft placement — the spacecraft flies the approach path, then locks
  // onto the capture orbit.
  const onApproach = beat === "approach";
  const onBurn = beat === "capture_burn";
  const onInsertion = beat === "orbit_insertion";
  const onTrace = beat === "orbit_trace";

  // Approach path: a curve from upper-left down to the orbit entry point.
  // Orbit entry point is at the leftmost extent of the capture ellipse.
  const planetCx = 150;
  const planetCy = 104;
  const planetR = 56;
  const orbitRx = 92;
  const orbitRy = 32;
  const orbitEntry = { x: planetCx - orbitRx, y: planetCy };

  // Craft position interpolates between approach start and orbit entry during
  // the approach beat, then rides the orbit during trace.
  const craftCx = onApproach ? 30 : onBurn || onInsertion ? orbitEntry.x : 236;
  const craftCy = onApproach ? 30 : onBurn || onInsertion ? orbitEntry.y : planetCy;
  const craftH = onApproach ? 56 : 64;

  // Engine state per beat — capture burn fires hard, insertion eases off,
  // trace is coasting.
  const engineFiring = onBurn || onInsertion;
  const beatThrottle = onBurn ? 1 : onInsertion ? 0.65 : 0;

  return (
    <g>
      <Stars motionOk={motionOk} />
      <DestinationBody palette={palette} cx={planetCx} cy={planetCy} r={planetR} motionOk={motionOk} />

      {/* Approach trajectory — drawn progressively during approach, full afterwards */}
      <path
        d={`M 6 30 Q 70 22 ${orbitEntry.x} ${orbitEntry.y}`}
        stroke="#8fb4d6"
        strokeWidth="1.3"
        strokeDasharray="4 4"
        fill="none"
        opacity={onApproach ? 0.5 : 0.7}
        className={onApproach && motionOk ? "trajectory-draw" : undefined}
        pathLength={1}
      />

      {/* Capture orbit ellipse — revealed at the burn */}
      {(onBurn || onInsertion || onTrace) && (
        <ellipse
          cx={planetCx}
          cy={planetCy}
          rx={orbitRx}
          ry={orbitRy}
          fill="none"
          stroke="#00e5ff"
          strokeWidth="1.4"
          strokeDasharray="6 5"
          opacity={onTrace ? 0.85 : 0.55}
          className={onInsertion && motionOk ? "orbit-reveal" : undefined}
        />
      )}

      {/* Burn marker — flares at orbit entry during capture_burn */}
      {onBurn && motionOk ? (
        <g className="impact-flash">
          <circle cx={orbitEntry.x} cy={orbitEntry.y} r="6" fill="#ffb020" opacity="0.85" />
        </g>
      ) : null}

      {/* Destination-specific flourish during approach */}
      {onApproach ? <ApproachFlourish mission={mission} motionOk={motionOk} /> : null}

      {/* The spacecraft — on the orbit during trace, else at the entry point */}
      {onTrace ? (
        <g className={motionOk ? "orbit-spin" : undefined} style={{ transformOrigin: `${planetCx}px ${planetCy}px` }}>
          <Craft config={config} cx={236} cy={planetCy} h={craftH} craft={{ ...craft, engineOn: engineFiring, throttle: beatThrottle }} motionOk={motionOk} shake={craft.stormShake} />
        </g>
      ) : (
        <g className={motionOk ? "cruise-bob" : undefined} style={{ transformOrigin: `${craftCx}px ${craftCy}px` }}>
          <Craft config={config} cx={craftCx} cy={craftCy} h={craftH} tilt={onBurn ? -8 : 0} craft={{ ...craft, engineOn: engineFiring, throttle: beatThrottle }} motionOk={motionOk} shake={craft.stormShake} />
        </g>
      )}

      <StatusChip
        x={86}
        y={196}
        w={132}
        text={
          onApproach ? `APPROACH — ${mission.destination.toUpperCase()}` :
          onBurn ? "CAPTURE BURN FIRING" :
          onInsertion ? "ORBIT INSERTION" :
          mission.type === "flyby" ? "FLYBY UNDERWAY" : "ORBIT ESTABLISHED"
        }
        color={onBurn ? "#ffd27a" : onInsertion ? "#ffb020" : "#66caff"}
      />
    </g>
  );
}

// ============================================================================
// LANDER / PROBE scene
// ============================================================================

function LanderArrival({
  mission,
  config,
  simulation,
  phase,
  motionOk,
  failed,
  craft,
  palette,
}: ArrivalSceneProps) {
  const active = phase === "running" || phase === "awaiting_event";
  // Initial state derives from props at mount — the parent keys this scene
  // by `active` so it remounts on the pending→running transition.
  const [beat, setBeat] = useState<LanderPhase>(() => active ? "approach" : "touchdown");

  useEffect(() => {
    if (!active || !motionOk) return;
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setBeat("atmospheric_entry"), T_APPROACH),
      setTimeout(() => setBeat("powered_descent"), T_BURN),
      setTimeout(() => setBeat("touchdown"), T_INSERTION),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active, motionOk]);

  const onApproach = beat === "approach";
  const onEntry = beat === "atmospheric_entry";
  const onDescent = beat === "powered_descent";
  const onTouchdown = beat === "touchdown";

  // Surface spans the bottom of the scene. Craft descends from top to surface.
  const planetCx = 150;
  const planetCy = 220;
  const planetR = 96;

  // Craft y position descends through the beats.
  const craftCx = 150;
  const craftCy = onApproach ? 60 : onEntry ? 88 : onDescent ? 140 : 168;
  const craftH = onApproach ? 56 : onEntry ? 64 : onDescent ? 80 : 74;

  // At touchdown, lean the craft if the landing was rough — ties the visual
  // to the actual sim result (landingQuality < 50 = tilted landing).
  const landingQuality = simulation.landingQuality ?? 100;
  const roughLanding = onTouchdown && landingQuality < 50;
  const craftTilt = (onEntry || onDescent) ? 180 : roughLanding ? (landingQuality < 25 ? 22 : 11) : 0;

  // Engine fires during powered descent; cuts at touchdown.
  const engineFiring = onDescent;
  const beatThrottle = onDescent ? 0.85 : 0;

  // Plasma intensity peaks during entry, fades during descent.
  const plasmaIntensity = onEntry ? 1 : onDescent ? 0.4 : 0;

  return (
    <g>
      <Stars motionOk={motionOk} />
      <DestinationBody palette={palette} cx={planetCx} cy={planetCy} r={planetR} motionOk={motionOk} />

      {/* Atmospheric haze for titan/mars/venus — a translucent band above the surface */}
      {(mission.imageId === "titan" || mission.imageId === "venus") && (onEntry || onDescent) ? (
        <ellipse cx={planetCx} cy={planetCy - planetR * 0.55} rx={planetR * 0.92} ry={planetR * 0.18}
          fill={mission.imageId === "titan" ? "rgba(255, 176, 102, 0.22)" : "rgba(240, 215, 140, 0.22)"}
          opacity={onEntry ? 0.9 : 0.5}
        />
      ) : null}

      {/* Entry plasma sheath around the heat shield */}
      {(onEntry || onDescent) && plasmaIntensity > 0 ? (
        <EntryPlasma mission={mission} motionOk={motionOk} intensity={plasmaIntensity} />
      ) : null}

      {/* Descent trajectory — a dashed vertical line from entry to touchdown */}
      {(onDescent || onTouchdown) && (
        <line
          x1={craftCx}
          y1={88}
          x2={craftCx}
          y2={168}
          stroke="#ffd27a"
          strokeWidth="1.2"
          strokeDasharray="3 4"
          opacity={0.6}
        />
      )}

      {/* Touchdown dust kick — bigger for rough landings */}
      {onTouchdown && motionOk ? (
        <g className={roughLanding ? "dust-kick-heavy" : "dust-kick"}>
          {[-1, 0, 1].map((s) => (
            <circle key={s} cx={craftCx + s * (roughLanding ? 30 : 22)} cy={178} r={roughLanding ? 6 : 4} fill={palette.light} opacity="0.5" />
          ))}
        </g>
      ) : null}

      {/* The lander — descends through the beats, heat shield down during entry/descent */}
      <g className={onApproach && motionOk ? "cruise-bob" : undefined} style={{ transformOrigin: `${craftCx}px ${craftCy}px` }}>
        <Craft config={config} cx={craftCx} cy={craftCy} h={craftH} tilt={craftTilt} craft={{ ...craft, engineOn: engineFiring, throttle: beatThrottle }} motionOk={motionOk} shake={craft.stormShake} />
      </g>

      <StatusChip
        x={86}
        y={26}
        w={132}
        text={
          onApproach ? `APPROACH — ${mission.destination.toUpperCase()}` :
          onEntry ? "ATMOSPHERIC ENTRY" :
          onDescent ? "POWERED DESCENT" :
          failed ? "TOUCHDOWN LOST" :
          roughLanding ? "ROUGH LANDING" : "TOUCHDOWN CONFIRMED"
        }
        color={onEntry ? "#ff8a4a" : onDescent ? "#ffd27a" : failed ? "#ff4d6a" : roughLanding ? "#ffd27a" : "#2dd4a7"}
      />
    </g>
  );
}

// ============================================================================
// Main export
// ============================================================================

export function ArrivalScene(props: ArrivalSceneProps) {
  const { mission } = props;
  if (mission.type === "orbiter" || mission.type === "flyby") {
    return <OrbiterArrival {...props} />;
  }
  return <LanderArrival {...props} />;
}
