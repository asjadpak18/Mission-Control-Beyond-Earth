"use client";

/**
 * ============================================================================
 * FLIGHT HUD — v2.2 live telemetry overlay for the MissionVisualizer
 * ============================================================================
 * Surfaces the actual numbers from `SimulationState` on top of the flight
 * view, so the player can see their fuel, power, reliability and stage-
 * specific metric change as the mission progresses — instead of just
 * watching a static SVG.
 *
 * The HUD is an absolutely-positioned HTML overlay (NOT inside the SVG)
 * so the text stays crisp and easy to style. It is compact, monospace,
 * dark-translucent, and fades out on the evaluation stage so it never
 * clashes with the final score reveal.
 *
 * Hidden when `prefers-reduced-motion`? No — telemetry is information,
 * not animation. Always shown (except on stage 8 / mission over).
 * ============================================================================
 */

import type { Mission, SimulationState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export interface FlightHudProps {
  mission: Mission;
  simulation: SimulationState;
  /** Current stage 1-8 (matches the visualizer's stageNum). */
  stageNum: number;
  /** True when the mission is over (stage 8 / failure). */
  missionOver: boolean;
  className?: string;
}

/** A single labelled readout with an optional progress bar (0-1). */
function Readout({
  label,
  value,
  unit,
  bar,
  barColor = "#66caff",
  warn = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  bar?: number; // 0..1
  barColor?: string;
  warn?: boolean;
}) {
  const pct = bar !== undefined ? Math.max(0, Math.min(1, bar)) * 100 : null;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        <span className={cn("font-mono text-[10px] font-bold tabular-nums", warn ? "text-amber-300" : "text-foreground")}>
          {value}
          {unit ? <span className="ml-0.5 text-[8px] font-normal text-muted-foreground">{unit}</span> : null}
        </span>
      </div>
      {pct !== null ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-primary/15">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Pick the stage-specific metric to feature prominently. */
function stageMetric(mission: Mission, sim: SimulationState, stageNum: number): {
  label: string;
  value: string | number;
  unit?: string;
  bar?: number;
  barColor?: string;
  warn?: boolean;
} | null {
  switch (stageNum) {
    case 1: // LAUNCH — altitude/velocity handled by LaunchScene itself
      return null;
    case 2: // SEPARATION — deploy progress
      return { label: "DEPLOY", value: "ARMED", barColor: "#66caff" };
    case 3: // CRUISE — science data accumulated so far
      return {
        label: "SCIENCE",
        value: Math.round(sim.scienceData),
        unit: "/100",
        bar: sim.scienceData / 100,
        barColor: "#7ff0d3",
      };
    case 4: // NAVIGATION — reliability (drives correction quality)
      return {
        label: "NAV ACCY",
        value: Math.round(sim.reliability),
        unit: "%",
        bar: sim.reliability / 100,
        barColor: "#00e5ff",
      };
    case 5: // ARRIVAL — landing quality for landers, otherwise data transmitted
      if (mission.type === "lander" || mission.type === "probe") {
        const lq = sim.landingQuality ?? 0;
        return {
          label: "LANDING",
          value: Math.round(lq),
          unit: "/100",
          bar: lq / 100,
          barColor: lq >= 70 ? "#2dd4a7" : lq >= 40 ? "#ffd27a" : "#ff8a4a",
          warn: lq < 40,
        };
      }
      return {
        label: "DATA TX",
        value: Math.round(sim.dataTransmitted),
        bar: Math.min(1, sim.dataTransmitted / 100),
        barColor: "#8fe9ff",
      };
    case 6: // SCIENCE — science data
      return {
        label: "SCIENCE",
        value: Math.round(sim.scienceData),
        unit: "/100",
        bar: sim.scienceData / 100,
        barColor: "#7ff0d3",
      };
    case 7: // COMMUNICATION — data transmitted
      return {
        label: "DOWNLINK",
        value: Math.round(sim.dataTransmitted),
        unit: "pts",
        bar: Math.min(1, sim.dataTransmitted / 100),
        barColor: "#8fe9ff",
      };
    default:
      return null;
  }
}

export function FlightHud({ mission, simulation, stageNum, missionOver, className }: FlightHudProps) {
  if (missionOver) return null;

  // Fuel as a 0..1 fraction of capacity. The sim tracks fuelRemaining but not
  // fuelCapacity directly in SimulationState — derive capacity from the
  // spacecraft config would require the config prop; we approximate using
  // the initial fuelRemaining plus used. For a clean readout we show kg.
  const fuel = simulation.fuelRemaining;
  const fuelLow = fuel < 50;
  const fuelBar = Math.max(0, Math.min(1, fuel / 500)); // heuristic scale

  const powerStress = simulation.powerStress;
  const powerWarn = powerStress > 50;

  const reliability = simulation.reliability;
  const reliabilityWarn = reliability < 70;

  const metric = stageMetric(mission, simulation, stageNum);

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-2 top-2 w-[124px] rounded-md border border-cyan-400/25 bg-[#04070f]/82 px-2 py-1.5 backdrop-blur-sm",
        className,
      )}
      aria-hidden="true"
    >
      <div className="mb-1 flex items-center justify-between border-b border-cyan-400/15 pb-1">
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-cyan-300">TELEMETRY</span>
        <span className="font-mono text-[8px] text-muted-foreground">S{String(stageNum).padStart(2, "0")}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Readout
          label="FUEL"
          value={Math.round(fuel)}
          unit="kg"
          bar={fuelBar}
          barColor={fuelLow ? "#ff8a4a" : "#ffd27a"}
          warn={fuelLow}
        />
        <Readout
          label="PWR DRAW"
          value={Math.round(powerStress)}
          unit="W"
          barColor={powerWarn ? "#ff8a4a" : "#57e6ff"}
          warn={powerWarn}
        />
        <Readout
          label="RELIAB"
          value={Math.round(reliability)}
          unit="%"
          bar={reliability / 100}
          barColor={reliabilityWarn ? "#ff8a4a" : "#2dd4a7"}
          warn={reliabilityWarn}
        />
        {metric ? (
          <Readout
            label={metric.label}
            value={metric.value}
            unit={metric.unit}
            bar={metric.bar}
            barColor={metric.barColor}
            warn={metric.warn}
          />
        ) : null}
      </div>
    </div>
  );
}
