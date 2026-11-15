"use client";

/**
 * ============================================================================
 * SPACECRAFT CANVAS — Design Lab interactive assembly (v2.1 shared system)
 * ============================================================================
 * SYSTEM A of the visual architecture: an interactive, component-based
 * spacecraft assembly preview.
 *
 * - Starts EMPTY (dashed assembly outline) and constructs the spacecraft as
 *   the player adds or removes components — engine at the bottom, fuel tanks
 *   as body sections above it, bus, horizontally extending solar wings,
 *   antennas, instruments, batteries, RTGs, nav sensors, thermal protection.
 * - Updates IMMEDIATELY with every design change (driven straight from the
 *   live store config through the shared model — same model that flies).
 * - Component labels are displayed BELOW the spacecraft preview.
 * - Smooth mount/unmount transitions; optional rotation; honours
 *   prefers-reduced-motion.
 * ============================================================================
 */

import { useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { Boxes, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_BY_ID } from "@/lib/game/equipment";
import type { SpacecraftConfig } from "@/lib/game/types";
import { buildSpacecraftModel } from "./spacecraft/model";
import { SpacecraftDiagram } from "./spacecraft/SpacecraftDiagram";
import { SvgWatermark } from "./Watermark";
import { cn } from "@/lib/utils";

const PANEL_EDGE = "#66caff";

/** Category accent colours for the component labels below the preview. */
const CATEGORY_COLORS: Record<string, string> = {
  Propulsion: "#ffb020",
  Fuel: "#d9a441",
  Power: "#57e6ff",
  Communication: "#66caff",
  Science: "#2dd4a7",
  Navigation: "#9fb4d4",
  Thermal: "#ff8a5c",
  Protection: "#c084fc",
  Landing: "#8fb4d6",
  Structure: "#a8b8c8",
};

export interface SpacecraftCanvasProps {
  config: SpacecraftConfig;
  missionName?: string;
  className?: string;
  /** Compact height variant for multiplayer panels. */
  compact?: boolean;
}

export function SpacecraftCanvas({ config, missionName, className, compact = false }: SpacecraftCanvasProps) {
  const reducedMotion = useReducedMotion();
  const motionOk = !reducedMotion;
  const [spin, setSpin] = useState(false);

  const model = useMemo(() => buildSpacecraftModel(config), [config]);
  const unitCount = config.components.reduce((s, c) => s + c.quantity, 0);
  const hasEngines = model.metrics.engineCount > 0;
  const hasShield = model.parts.some((p) => p.kind === "shield");
  const hasArmour = model.parts.some((p) => p.kind === "aura");

  // Preview drawing area: viewBox 400×470, craft centred at x=200.
  const targetHeight = compact ? 300 : 350;
  const craftCx = 200;
  const craftCy = compact ? 165 : 195;

  // Actual rendered geometry (mirrors SpacecraftDiagram's auto-fit math) so the
  // datum / ground line hugs the real engine exit plane instead of floating.
  const natural = Math.max(model.metrics.height, 1);
  const fitScale = Math.min(compact ? 1.35 : 1.5, targetHeight / natural);
  const craftBottomY = craftCy + (natural * fitScale) / 2;
  const craftHalfW = (Math.min(model.metrics.width, 190) * fitScale) / 2;
  /** Empty bay: fix the datum below the dashed outline. */
  const datumY = model.parts.length === 0 ? 330 : craftBottomY;
  const datumHalfW = model.parts.length === 0 ? 60 : craftHalfW;

  return (
    <div className={cn("panel hud-corners relative flex flex-col overflow-hidden", className)}>
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-primary/15 px-4 py-2.5">
        <div>
          <div className="font-display text-[13px] font-bold text-foreground">Spacecraft Assembly</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {missionName ? `${missionName.toUpperCase()} · ` : ""}LIVE MODEL — {unitCount} UNIT{unitCount === 1 ? "" : "S"} INSTALLED
          </div>
        </div>
        <Button
          variant={spin ? "default" : "outline"}
          size="sm"
          className="h-7 px-2.5 font-mono text-[10px]"
          onClick={() => setSpin((v) => !v)}
          aria-pressed={spin}
          aria-label={spin ? "Stop spacecraft rotation" : "Rotate spacecraft model"}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          {spin ? "SPINNING" : "ROTATE"}
        </Button>
      </div>

      {/* ---------------- Spacecraft preview panel ---------------- */}
      <div className="blueprint-grid relative flex-1" style={{ perspective: "900px" }}>
        <svg
          viewBox="0 0 400 470"
          className={cn("h-full w-full", spin && motionOk && "model-spin")}
          role="img"
          aria-label={
            unitCount === 0
              ? "Empty assembly bay — no equipment installed yet"
              : `Spacecraft with ${unitCount} installed component units across ${config.components.length} equipment types`
          }
        >
          {/* Assembly datum: centreline + engine exit plane (engineering drawing feel) */}
          <g opacity="0.3">
            <line x1="200" y1="26" x2="200" y2={datumY - 6} stroke={PANEL_EDGE} strokeWidth="0.8" strokeDasharray="10 7" />
            <line x1={craftCx - datumHalfW - 14} y1={datumY + 4} x2={craftCx + datumHalfW + 14} y2={datumY + 4} stroke={PANEL_EDGE} strokeWidth="0.8" />
            <text x={craftCx - datumHalfW - 12} y={datumY + 14} textAnchor="start" fontSize="7.5" fill="#8fb4d6" fontFamily="monospace">
              {hasEngines ? "ENGINE EXIT PLANE" : "SPACECRAFT BASE PLANE"}
            </text>
          </g>

          {/* Empty state — the preview starts truly empty */}
          {model.parts.length === 0 ? (
            <g>
              <rect x="158" y="120" width="84" height="150" rx="10" fill="none" stroke={PANEL_EDGE} strokeWidth="1.6" strokeDasharray="7 6" opacity="0.55" />
              <text x="200" y="188" textAnchor="middle" fontSize="11" fill="#8fb4d6" fontFamily="monospace">
                NO EQUIPMENT
              </text>
              <text x="200" y="204" textAnchor="middle" fontSize="9.5" fill="#5f7794" fontFamily="monospace">
                ADD AN ENGINE TO BEGIN ASSEMBLY
              </text>
              {/* Ghost engine hint resting on the datum line */}
              <path d="M 190 302 L 186 322 L 214 322 L 210 302 Z" fill="none" stroke="#5f7794" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.6" />
            </g>
          ) : (
            <>
              {/* Pad glow under the stack */}
              <ellipse cx="200" cy={craftBottomY + 5} rx={craftHalfW + 26} ry="13" fill="rgba(0,229,255,0.08)" />
              <SpacecraftDiagram
                config={config}
                cx={craftCx}
                cy={craftCy}
                targetHeight={targetHeight}
                maxScale={compact ? 1.35 : 1.5}
                mode="design"
                deploy={1}
                motionOk={motionOk}
              />
            </>
          )}
          <SvgWatermark width={400} height={470} fontSize={8} />
        </svg>
      </div>

      {/* ---------------- Component labels BELOW the preview ---------------- */}
      <div className="border-t border-primary/15">
        <div className="flex items-center gap-1.5 px-4 pt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          <Boxes className="h-3 w-3 text-primary/60" aria-hidden="true" />
          Installed Components
        </div>
        {model.labels.length === 0 ? (
          <div className="px-4 pb-2 pt-1 font-mono text-[10px] text-muted-foreground/70">
            THE MODEL UPDATES WITH EVERY COMPONENT YOU ADD OR REMOVE
          </div>
        ) : (
          <div className={cn("flex flex-wrap gap-1.5 px-4 pb-2.5 pt-1.5", !compact && "max-h-28 overflow-y-auto")}>
            {model.labels.map((l) => {
              const color = CATEGORY_COLORS[l.category] ?? "#8fb4d6";
              const capped = l.count > l.drawn;
              return (
                <span
                  key={l.equipmentId}
                  className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold"
                  style={{ borderColor: `${color}55`, color, background: `${color}12` }}
                  title={capped ? `${l.drawn} of ${l.count} shown in the preview` : `${l.count} installed`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: color }} aria-hidden="true" />
                  {l.name}
                  <span className="opacity-80">×{l.count}</span>
                  {capped ? <span className="text-amber-300/90">({l.drawn} drawn)</span> : null}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      {!compact ? (
        <div className="pointer-events-none absolute right-2 top-12 flex flex-col items-end gap-1 font-mono text-[8.5px] text-muted-foreground/80">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#d9a441" }} /> PROPELLANT</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#1f5fa8" }} /> SOLAR CELLS</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#5f7794" }} /> STRUCTURE</span>
          {hasShield ? (
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#54463a" }} /> HEAT SHIELD</span>
          ) : null}
          {hasArmour ? (
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#6b6187" }} /> RAD ARMOUR</span>
          ) : null}
          {hasEngines ? (
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: "#3b3f4a" }} /> ENGINES AT BOTTOM</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
