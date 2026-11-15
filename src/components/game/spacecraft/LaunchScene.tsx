"use client";

/**
 * ============================================================================
 * LAUNCH SCENE — dynamic liftoff simulation (v2.1, SYSTEM B)
 * ============================================================================
 * NOT an image, GIF or video: every element here is rendered and animated
 * live from the player's ACTUAL spacecraft configuration (shared model).
 *
 * Timeline (JS state machine + CSS transitions, ~10 s):
 *   count    T-3 / T-2 / T-1 countdown digits
 *   ignite   engines light — flame ramp, pad floodlights, smoke billowing,
 *            hold-down clamps shaking
 *   liftoff  clamps release — the assembled spacecraft rises, the pad and
 *            tower fall away below, the sky gradient fades to black, stars
 *            appear, telemetry (altitude / velocity) climbs
 *   ascent   steady climb — speed lines, shrinking vehicle, atmosphere thinning
 *
 * Weak-device / reduced-motion fallback: the scene jumps to a static ascent
 * frame with steady flames and frozen telemetry — still a live render of the
 * real spacecraft, just without motion.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpacecraftConfig } from "@/lib/game/types";
import { buildSpacecraftModel } from "./model";
import { SpacecraftDiagram } from "./SpacecraftDiagram";

type LaunchPhase = "pending" | "count" | "ignite" | "liftoff" | "ascent";

/** Wall-clock durations (ms) of each timeline beat — compressed so the
 *  countdown / ignition / liftoff drama fits inside the stage-1 reveal. */
const T_IGNITE = 1950;
const T_LIFTOFF = 2800;
const T_ASCENT = 8200;

export interface LaunchSceneProps {
  config: SpacecraftConfig;
  /** "pending" = armed on the pad (stage not executed yet), "running" = go. */
  active: boolean;
  motionOk: boolean;
  failed?: boolean;
}

export function LaunchScene({ config, active, motionOk, failed = false }: LaunchSceneProps) {
  const model = useMemo(() => buildSpacecraftModel(config), [config]);

  // Initial visual state derives from the props at mount (the parent remounts
  // this scene with a key when `active` flips, so no synchronous resets are
  // ever needed inside effects — every transition below fires from a timer).
  const [phase, setPhase] = useState<LaunchPhase>(() =>
    active ? (motionOk ? "count" : "ascent") : "pending"
  );
  const [count, setCount] = useState(3);
  const [altitude, setAltitude] = useState(() => (active && !motionOk ? 62 : 0));
  const [velocity, setVelocity] = useState(() => (active && !motionOk ? 1640 : 0));
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- timeline (all state transitions fire from async callbacks) -----------
  useEffect(() => {
    if (!active || !motionOk) return;
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setCount(2), 650),
      setTimeout(() => setCount(1), 1300),
      setTimeout(() => setPhase("ignite"), T_IGNITE),
      setTimeout(() => {
        setPhase("liftoff");
        const liftoffAt = Date.now();
        ticker.current = setInterval(() => {
          const t = (Date.now() - liftoffAt) / 1000;
          // Illustrative ascent model: quadratic altitude, linear velocity.
          setAltitude(Math.min(999, Math.round(1.55 * t * t + 3 * t)));
          setVelocity(Math.min(9999, Math.round(280 * t + 40)));
        }, 90);
      }, T_LIFTOFF),
      setTimeout(() => {
        setPhase("ascent");
        if (ticker.current) clearInterval(ticker.current);
        ticker.current = null;
      }, T_ASCENT),
    ];
    return () => {
      timers.forEach(clearTimeout);
      if (ticker.current) clearInterval(ticker.current);
      ticker.current = null;
    };
  }, [active, motionOk]);

  const flying = phase === "liftoff" || phase === "ascent";
  const engineOn = phase === "ignite" || flying;
  const throttle = phase === "ignite" ? 0.75 : flying ? 1 : 0;

  // Craft placement: sits ON the pad before liftoff, then climbs away.
  const padY = 216;
  const craftH = 128;
  const craftCx = 152;
  const craftCyPad = padY - craftH / 2;
  const climbY = phase === "ascent" ? -64 : -8;
  const climbScale = phase === "ascent" ? 0.55 : 0.8;

  const smokePuffs = Math.min(8, 4 + model.metrics.engineCount);

  return (
    <g>
      {/* ===================== SKY → SPACE TRANSITION ===================== */}
      {/* The panel supplies a blue sky gradient for stage 1; as the vehicle
          climbs this black overlay fades in and the stars fade in with it. */}
      <rect
        x="0"
        y="0"
        width="300"
        height="250"
        fill="#04070f"
        opacity={flying ? (phase === "ascent" ? 0.94 : 0.6) : 0}
        style={motionOk ? { transition: "opacity 4.5s ease-in" } : undefined}
        pointerEvents="none"
      />
      <g
        opacity={flying ? (phase === "ascent" ? 1 : 0.55) : 0}
        style={motionOk ? { transition: "opacity 4.5s ease-in" } : undefined}
      >
        {[
          [24, 30], [58, 68], [90, 22], [128, 52], [166, 18], [204, 60], [236, 34], [268, 72],
          [40, 108], [96, 132], [212, 116], [262, 148], [30, 170], [160, 158], [246, 190],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.3 : 0.8} fill="#d6ecff" opacity={0.75} />
        ))}
      </g>
      {/* Ascent speed lines */}
      {flying && motionOk ? (
        <g className="speed-lines">
          {[70, 110, 190, 230].map((x, i) => (
            <line key={x} x1={x} y1="30" x2={x} y2="86" stroke="#9ed8ff" strokeWidth="1" opacity="0.35" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </g>
      ) : null}

      {/* ===================== LAUNCH PAD (falls away) ===================== */}
      <g
        transform={flying ? `translate(0 ${phase === "ascent" ? 210 : 120}) scale(${phase === "ascent" ? 0.72 : 0.9})` : "translate(0 0) scale(1)"}
        style={
          motionOk
            ? { transition: "transform 5.5s cubic-bezier(0.45,0.05,0.7,0.4), opacity 5.5s ease-in", transformOrigin: "152px 216px", opacity: phase === "ascent" ? 0.25 : 1 }
            : { opacity: phase === "ascent" ? 0.25 : 1 }
        }
      >
        {/* Ground */}
        <rect x="0" y={padY + 6} width="300" height="34" fill="#0c1830" />
        <rect x="0" y={padY + 6} width="300" height="2.5" fill="#66caff" opacity="0.35" />
        {/* Service tower */}
        <rect x="86" y={padY - 118} width="10" height="124" fill="#31435c" />
        {[padY - 108, padY - 88, padY - 68, padY - 48, padY - 28].map((y) => (
          <line key={y} x1="86" y1={y} x2="96" y2={y} stroke="#5f7794" strokeWidth="1.6" />
        ))}
        {/* Gantry arm reaching for the vehicle */}
        <rect x="96" y={padY - 78} width="26" height="5" fill="#5f7794" />
        {/* Launch mount + hold-down clamps */}
        <rect x={craftCx - 34} y={padY - 2} width="68" height="9" rx="2" fill="#31435c" />
        <rect x={craftCx - 30} y={padY - 8} width="7" height="7" fill="#5f7794" />
        <rect x={craftCx + 23} y={padY - 8} width="7" height="7" fill="#5f7794" />
        {/* Pad floodlights */}
        <path d={`M ${craftCx - 52} ${padY + 2} L ${craftCx - 26} ${padY - 96} L ${craftCx - 14} ${padY - 96} L ${craftCx - 40} ${padY + 2} Z`} fill="#9ed8ff" opacity={engineOn ? "0.16" : "0.06"} style={motionOk ? { transition: "opacity 0.8s" } : undefined} />
        <path d={`M ${craftCx + 52} ${padY + 2} L ${craftCx + 26} ${padY - 96} L ${craftCx + 14} ${padY - 96} L ${craftCx + 40} ${padY + 2} Z`} fill="#9ed8ff" opacity={engineOn ? "0.16" : "0.06"} style={motionOk ? { transition: "opacity 0.8s" } : undefined} />
        {/* Ignition glare on the pad */}
        {engineOn ? (
          <ellipse cx={craftCx} cy={padY + 2} rx="46" ry="12" fill="#ffb020" opacity="0.28" className={motionOk ? "hull-glow" : undefined} />
        ) : null}
      </g>

      {/* ===================== SMOKE (at ignition) ===================== */}
      {engineOn ? (
        <g opacity={flying && phase === "ascent" ? 0.4 : 1}>
          {Array.from({ length: smokePuffs }).map((_, i) => {
            const side = i % 2 === 0 ? -1 : 1;
            const cx = craftCx + side * (10 + (i % 4) * 11);
            return (
              <circle
                key={i}
                cx={cx}
                cy={padY - 2}
                r={9 + (i % 3) * 3}
                fill="#8fb4d6"
                opacity="0.34"
                className={motionOk ? "smoke-billow" : undefined}
                style={
                  motionOk
                    ? {
                        animationDelay: `${(i % 5) * 0.22}s`,
                        animationIterationCount: flying ? "infinite" : "2",
                      }
                    : undefined
                }
              />
            );
          })}
        </g>
      ) : (
        /* Pre-launch venting */
        <g>
          {[0, 1].map((i) => (
            <circle
              key={i}
              cx={craftCx + (i === 0 ? -16 : 18)}
              cy={padY - 44}
              r="4.5"
              fill="#d6ecff"
              opacity="0.3"
              className={motionOk ? "vent-steam" : undefined}
              style={motionOk ? { animationDelay: `${i * 1.1}s` } : undefined}
            />
          ))}
        </g>
      )}

      {/* ===================== THE SPACECRAFT ===================== */}
      {/* The player's actual assembled vehicle — same parts as the Design Lab. */}
      <g
        transform={
          flying
            ? `translate(${craftCx} ${climbY}) scale(${climbScale}) translate(${-craftCx} ${-craftCyPad}) translate(0 ${phase === "ascent" ? -26 : 0})`
            : `translate(0 0)`
        }
        style={
          motionOk && flying
            ? {
                transition:
                  phase === "liftoff"
                    ? "transform 5.2s cubic-bezier(0.5,0.04,0.75,0.5)"
                    : "transform 2.8s ease-out",
                transformOrigin: `${craftCx}px ${padY}px`,
              }
            : undefined
        }
      >
        {/* Ignition shake while clamped */}
        <g className={motionOk && phase === "ignite" ? "pad-shake" : undefined} style={{ transformOrigin: `${craftCx}px ${padY}px` }}>
          <SpacecraftDiagram
            config={config}
            cx={craftCx}
            cy={craftCyPad}
            targetHeight={craftH}
            maxScale={2.4}
            mode="flight"
            engineOn={engineOn}
            throttle={throttle}
            deploy={0.08}
            motionOk={motionOk}
          />
        </g>
      </g>

      {/* ===================== STATUS / TELEMETRY ===================== */}
      <g>
        <rect x="18" y="14" width="122" height="30" rx="4" fill="rgba(4,7,15,0.78)" stroke="#66caff" strokeWidth="1" />
        {phase === "pending" ? (
          <text x="79" y="33" textAnchor="middle" fontSize="9.5" fill={failed ? "#ff9fb0" : "#66caff"} fontFamily="monospace" fontWeight="bold">
            {failed ? "LAUNCH ABORTED" : "T-00:00:30 — ALL SYSTEMS GO"}
          </text>
        ) : phase === "count" ? (
          <text x="79" y="34" textAnchor="middle" fontSize="13" fill="#ffd27a" fontFamily="monospace" fontWeight="bold" className={motionOk ? "count-pop" : undefined}>
            T-{count}
          </text>
        ) : phase === "ignite" ? (
          <text x="79" y="33" textAnchor="middle" fontSize="9.5" fill="#ffb020" fontFamily="monospace" fontWeight="bold">
            IGNITION — ENGINES AT {Math.round(throttle * 100)}%
          </text>
        ) : (
          <>
            <text x="26" y="26" fontSize="8" fill="#8fb4d6" fontFamily="monospace">ALT</text>
            <text x="26" y="37" fontSize="10.5" fill="#e6f1ff" fontFamily="monospace" fontWeight="bold">{altitude} km</text>
            <text x="86" y="26" fontSize="8" fill="#8fb4d6" fontFamily="monospace">VEL</text>
            <text x="86" y="37" fontSize="10.5" fill="#e6f1ff" fontFamily="monospace" fontWeight="bold">{velocity} m/s</text>
          </>
        )}
      </g>

      {/* Mission patch chip */}
      <g>
        <rect x="212" y="14" width="70" height="30" rx="4" fill="rgba(4,7,15,0.78)" stroke="#00e5ff" strokeWidth="1" />
        <text x="247" y="26" textAnchor="middle" fontSize="7.5" fill="#8fb4d6" fontFamily="monospace">LAUNCH VEHICLE</text>
        <text x="247" y="37" textAnchor="middle" fontSize="8.5" fill="#00e5ff" fontFamily="monospace" fontWeight="bold">
          {model.metrics.engineCount} ENG · {model.metrics.tankSections} TANK
        </text>
      </g>

      {flying ? (
        <text x="150" y="242" textAnchor="middle" fontSize="9" fill={phase === "ascent" ? "#7ff0d3" : "#ffd27a"} fontFamily="monospace" fontWeight="bold">
          {phase === "ascent" ? "▲ ASCENT NOMINAL — LEAVING THE ATMOSPHERE" : "▲ LIFTOFF — CLEARING THE TOWER"}
        </text>
      ) : phase === "ignite" ? (
        <text x="150" y="242" textAnchor="middle" fontSize="9" fill="#ffb020" fontFamily="monospace" fontWeight="bold" className={motionOk ? "blink" : undefined}>
          ⚠ HOLD-DOWN CLAMPS ENGAGED — BUILDING THRUST
        </text>
      ) : (
        <text x="150" y="242" textAnchor="middle" fontSize="9" fill="#8fb4d6" fontFamily="monospace">
          VEHICLE ENERGIZED — AWAITING FLIGHT COMMAND
        </text>
      )}
    </g>
  );
}
