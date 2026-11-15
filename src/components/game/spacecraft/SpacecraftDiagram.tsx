"use client";

/**
 * ============================================================================
 * SPACECRAFT DIAGRAM — renders the shared model as ONE assembled craft
 * ============================================================================
 * This is the bridge between the pure model (model.ts) and the three visual
 * systems. The SAME diagram is embedded in:
 *
 *   - the Design Lab preview (mode="design", animated add/remove),
 *   - the liftoff simulation (mode="flight", engines firing),
 *   - every mission-event scene (mode="flight", deploy/damage states).
 *
 * It draws a <g> so it can be dropped into any parent <svg>, scaled to the
 * requested height and positioned at (cx, cy).
 *
 * v2.2 assembly animation: every part knows the direction it approaches from
 * (`part.approach`). On mount it slides in from that direction into its final
 * position; when the design changes and positions are recalculated, the parts
 * SPRING to their new positions instead of snapping.
 * ============================================================================
 */

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import type { SpacecraftConfig } from "@/lib/game/types";
import { buildSpacecraftModel, type PartKind, type SpacecraftPart } from "./model";
import { SpacecraftPartView, type PartRenderState } from "./parts";

/** Back-to-front draw order (armour shell and base shield sit deepest). */
const Z_ORDER: Record<PartKind, number> = {
  aura: 0,
  shield: 1,
  skirt: 2,
  legs: 3,
  tank: 4,
  adapter: 5,
  bus: 6,
  wing: 7,
  radiator: 8,
  pod: 9,
  instrument: 10,
  engine_bay: 11,
  nav: 12,
  antenna: 13,
  engine: 14,
};

/** Where a part flies in from during assembly, per approach direction. */
const APPROACH_VEC: Record<string, { x: number; y: number }> = {
  l: { x: -64, y: 0 },
  r: { x: 64, y: 0 },
  t: { x: 0, y: -56 },
  b: { x: 0, y: 56 },
};

export interface SpacecraftDiagramProps {
  config: SpacecraftConfig;
  /** Craft centre in the parent SVG user space. */
  cx: number;
  cy: number;
  /** Rendered height of the full stack, in parent user units. */
  targetHeight: number;
  /** Never scale up beyond this (keeps single engines from looking giant). */
  maxScale?: number;
  /** design = animated part mount/unmount; flight = lean static mount. */
  mode?: "design" | "flight";
  engineOn?: boolean;
  throttle?: number;
  sputter?: boolean;
  /** 0 = stowed wings/masts, 1 = deployed. */
  deploy?: number;
  damagedEquipmentIds?: string[];
  commFail?: boolean;
  motionOk?: boolean;
}

export function SpacecraftDiagram({
  config,
  cx,
  cy,
  targetHeight,
  maxScale = Infinity,
  mode = "flight",
  engineOn = false,
  throttle = 1,
  sputter = false,
  deploy = 1,
  damagedEquipmentIds = [],
  commFail = false,
  motionOk = true,
}: SpacecraftDiagramProps) {
  const model = useMemo(() => buildSpacecraftModel(config), [config]);

  const natural = Math.max(model.metrics.height, 1);
  const scale = Math.min(maxScale, targetHeight / natural);

  // Centre the craft's full extent (heat shield may reach below the mount
  // plane). Model y grows UPWARD while SVG y grows DOWNWARD, so the origin
  // sits BELOW the craft centre by half the extent.
  const extentTop = model.metrics.topY;
  const extentBottom = model.metrics.bottomY;
  const offsetY = cy + ((extentTop + extentBottom) / 2) * scale;

  const state: PartRenderState = {
    motionOk,
    engineOn,
    throttle,
    sputter,
    deploy,
    damaged: false,
    commFail,
  };

  const ordered = useMemo(
    () => [...model.parts].sort((a, b) => (Z_ORDER[a.kind] ?? 5) - (Z_ORDER[b.kind] ?? 5)),
    [model.parts]
  );

  const place = (part: SpacecraftPart) => {
    const px = cx + part.x * scale;
    const py = offsetY - part.y * scale;
    return { px, py };
  };

  return (
    <g>
      <defs>
        <linearGradient id="scBusGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9fb8d4" />
          <stop offset="55%" stopColor="#5f7794" />
          <stop offset="100%" stopColor="#31435c" />
        </linearGradient>
        {/* Cylindrical body shading for the tank sections (horizontal sweep) */}
        <linearGradient id="scTankGold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ecc572" />
          <stop offset="42%" stopColor="#d9a441" />
          <stop offset="100%" stopColor="#8a6420" />
        </linearGradient>
        <linearGradient id="scTankXenon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a8bcd9" />
          <stop offset="42%" stopColor="#7d93b8" />
          <stop offset="100%" stopColor="#48597a" />
        </linearGradient>
        <linearGradient id="scTankDrop" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8f0f7" />
          <stop offset="42%" stopColor="#c9d6e4" />
          <stop offset="100%" stopColor="#8296ad" />
        </linearGradient>
      </defs>

      {mode === "design" ? (
        <AnimatePresence mode="popLayout">
          {ordered.map((part) => {
            const { px, py } = place(part);
            const vec = APPROACH_VEC[part.approach ?? "t"];
            const partState = { ...state, damaged: damagedEquipmentIds.includes(part.equipmentId) };
            return (
              <motion.g
                key={part.key}
                // Position is carried by the animated x/y (parent user units);
                // the nested <g> below applies only the fit scale. Framer
                // springs x/y to new values whenever the layout recalculates,
                // so parts glide to their recalculated positions.
                initial={motionOk ? { opacity: 0, scale: 0.55, x: px + vec.x, y: py + vec.y } : { opacity: 0, x: px, y: py }}
                animate={{ opacity: 1, scale: 1, x: px, y: py }}
                exit={motionOk ? { opacity: 0, scale: 0.45 } : { opacity: 0 }}
                transition={
                  motionOk
                    ? { type: "spring", stiffness: 230, damping: 24, mass: 0.75 }
                    : { duration: 0 }
                }
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <g transform={`scale(${scale})`}>
                  <SpacecraftPartView part={part} state={partState} />
                </g>
              </motion.g>
            );
          })}
        </AnimatePresence>
      ) : (
        ordered.map((part) => {
          const { px, py } = place(part);
          const partState = { ...state, damaged: damagedEquipmentIds.includes(part.equipmentId) };
          return (
            <g key={part.key} transform={`translate(${px} ${py}) scale(${scale})`}>
              <SpacecraftPartView part={part} state={partState} />
            </g>
          );
        })
      )}
    </g>
  );
}
