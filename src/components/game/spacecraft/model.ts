/**
 * ============================================================================
 * SHARED SPACECRAFT MODEL — the single source of visual truth (v2.2)
 * ============================================================================
 * Pure layout engine (no React, fully deterministic) that turns a live
 * SpacecraftConfig into an ordered set of visual parts:
 *
 *   engines at the BOTTOM of the stack hanging from an engine bay (boat-tail
 *   thrust structure), fuel tanks as domed body sections above them, a conic
 *   adapter joining the tank stack to the wider equipment bus, solar wings
 *   extending HORIZONTALLY, antennas / nav sensors on top and instrument pods
 *   / power pods / radiators attached to the sides on visible brackets.
 *
 * v2.2 — Spacecraft Design System Refinement:
 *   - EXPLICIT attachment system: every part declares the direction it
 *     approaches from when assembled (`approach`); side-mounted parts carry a
 *     `standoff` (the gap between hull edge and part, bridged by a visible
 *     bracket in the artwork) plus the hull geometry they fix to.
 *   - SYNTHETIC structure parts: an engine bay (thrust structure the engines
 *     bolt onto) and a conic adapter (tank stack ↔ bus junction). Both borrow
 *     an already-installed equipment id, so no ghost visuals are ever drawn.
 *   - INTEGRATED protection: the heat shield is a mounting collar at the
 *     engine-mount plane with support struts rising to the engine bay — not a
 *     free-floating dish underneath the craft. Radiation shielding renders as
 *     an armoured shell hugging the bus section.
 *   - COLLISION-FREE side bands: instruments (upper), wings (middle),
 *     pods (lower) and radiators (base) are laid out top-to-bottom in strict
 *     kind order so nothing overlaps, whatever the configuration.
 *
 * The SAME model is consumed by:
 *   A. Design Lab        (SpacecraftCanvas  — interactive assembly)
 *   B. Liftoff           (LaunchScene       — dynamic launch simulation)
 *   C. Mission events    (MissionVisualizer — dynamic flight simulations)
 *
 * so the rocket assembled in the Design Lab IS the rocket that flies.
 *
 * Coordinate convention: x = 0 on the craft centreline (positive right);
 * y = 0 at the engine mount plane and grows UPWARD. Renderers convert to
 * SVG space (y down) themselves — see SpacecraftDiagram.
 * ============================================================================
 */

import { EQUIPMENT_BY_ID } from "@/lib/game/equipment";
import type { ComponentSelection, EquipmentCategory, SpacecraftConfig } from "@/lib/game/types";

export type PartKind =
  | "engine" // bell / ion / thruster cluster at the bottom
  | "engine_bay" // boat-tail thrust structure the engines hang from
  | "tank" // propellant body section stacked above the engines
  | "adapter" // conic frustum joining the tank stack (or bay) to the bus
  | "bus" // structural equipment bus
  | "wing" // deployable solar wing (one per side)
  | "antenna" // comm mast / dish / laser terminal on top
  | "instrument" // science sensor pod on the side
  | "nav" // navigation sensor on the bus top
  | "pod" // RTG / battery / fuel-cell pod on the side
  | "radiator" // active thermal radiator fins
  | "shield" // ablative heat shield integrated into the base
  | "aura" // radiation shielding: armoured shell around the bus
  | "skirt" // dust protection shroud around the engine section
  | "legs"; // landing gear (with optional airbags)

export interface SpacecraftPart {
  /** Stable animation key — deterministic for a given config. */
  key: string;
  kind: PartKind;
  equipmentId: string;
  label: string;
  category: EquipmentCategory;
  /** Horizontal offset from the centreline. */
  x: number;
  /** Vertical centre, measured upward from the engine mount plane. */
  y: number;
  w: number;
  h: number;
  side?: "l" | "r";
  /** Visual variant discriminator (engine style, tank colour…). */
  variant?: string;
  /** Extra render flags (blanket tint, whipple plates, synthetic…). */
  flags: string[];
  index: number;
  /** Bottom-tank interstage neck width (matches the engine cluster). */
  neckW?: number;
  /** Gap between the hull edge and this part's inner edge — bracket length. */
  standoff?: number;
  /** Direction the part arrives from when assembled / its attachment axis. */
  approach?: "l" | "r" | "t" | "b";
  /** Hull half-width at the bracket foot (side-mounted parts). */
  hullEdgeX?: number;
  /** Model-y of the hull bottom edge when the part hangs below the section. */
  hullBottomY?: number;
  /** Shield: width of the mounting collar bolted to the bay / base section. */
  collarW?: number;
  /** Shield: model-y where the support struts terminate (engine bay flare). */
  strutTop?: number;
  /** Shield: |x| of the support struts (clears the bells and the dust shroud). */
  strutX?: number;
}

export interface ComponentLabel {
  equipmentId: string;
  name: string;
  category: EquipmentCategory;
  count: number;
  /** How many of these units are actually drawn (visual cap). */
  drawn: number;
}

export interface SpacecraftModelMetrics {
  /** Topmost point of the stack above the mount plane. */
  topY: number;
  /** Deepest point below the mount plane (heat shield / landing gear). */
  bottomY: number;
  /** Full vertical extent (topY − bottomY). */
  height: number;
  /** Widest horizontal extent (wings included). */
  width: number;
  engineTop: number;
  stackTop: number;
  busBottom: number;
  busTop: number;
  busWidth: number;
  hasBus: boolean;
  hasSolar: boolean;
  engineCount: number;
  tankSections: number;
}

export interface SpacecraftModel {
  parts: SpacecraftPart[];
  labels: ComponentLabel[];
  metrics: SpacecraftModelMetrics;
  /** Every equipment id that is visually present (parts + bus variants). */
  visualEquipmentIds: string[];
}

// ---------------------------------------------------------------------------
// Layout constants (model units; renderers scale to fit)
// ---------------------------------------------------------------------------

export const STACK_LAYOUT = {
  engineH: 42,
  /** Top of the boat-tail thrust structure (bay occupies engineBayTop..engineH). */
  engineBayTop: 28,
  tankHeights: { fuel_tank_large: 34, fuel_tank_drop: 30, xenon_tank: 26, fuel_tank_small: 24 } as Record<string, number>,
  busHeights: {
    heavy_spacecraft_bus: 66,
    structural_frame_reinforced: 58,
    deployable_platform: 56,
    structural_frame: 54,
    modular_mounting: 50,
    structural_frame_light: 42,
  } as Record<string, number>,
  busWidths: {
    heavy_spacecraft_bus: 78,
    structural_frame_reinforced: 66,
    deployable_platform: 62,
    structural_frame: 56,
    modular_mounting: 52,
    structural_frame_light: 44,
  } as Record<string, number>,
  mastH: 34,
  /** Default ablative depth below the mount plane (variant table overrides). */
  shieldDepth: 20,
  shieldDepths: { reinforced_heat_shield: 24, thermal_protection_system: 22, heat_shield: 20 } as Record<string, number>,
} as const;

/** Bus equipment priority — strongest structure wins the main hull. */
const BUS_PRIORITY = [
  "heavy_spacecraft_bus",
  "structural_frame_reinforced",
  "deployable_platform",
  "structural_frame",
  "modular_mounting",
  "structural_frame_light",
];

/** How many units of each kind are actually drawn (labels keep true counts). */
export const VISUAL_CAPS: Record<string, number> = {
  engine: 3,
  tank: 4,
  wing: 3,
  antenna: 2,
  instrument: 4,
  pod: 2,
  nav: 2,
};

/** Total instrument slots across ALL science types (keeps the bus readable). */
const INSTRUMENT_SLOTS = 6;

/** Side-mount geometry: bracket standoff and band spacing (model units). */
const SIDE = {
  standoff: 5, // hull edge → inner edge of pods / instruments / radiators
  wingStandoff: 4, // hull edge → wing hinge
  instRowGap: 17, // vertical distance between instrument rows
  wingGap: 19, // clearance below the lowest instrument before the wing band
  podGap: 3, // clearance below the wing panel / radiator before pods
  radGap: 3,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function active(components: ComponentSelection[]): ComponentSelection[] {
  return components.filter((c) => c.quantity > 0 && EQUIPMENT_BY_ID[c.equipmentId]);
}

function ofCategory(components: ComponentSelection[], category: EquipmentCategory): ComponentSelection[] {
  return active(components).filter((c) => EQUIPMENT_BY_ID[c.equipmentId].category === category);
}

function isEngine(id: string): boolean {
  const eq = EQUIPMENT_BY_ID[id];
  if (!eq) return false;
  return eq.category === "Propulsion" || id === "descent_thruster";
}

function engineVariant(id: string): string {
  if (id === "ion_engine" || id === "advanced_ion_engine") return "ion";
  if (id === "monoprop_thrusters") return "monoprop";
  if (id === "nuclear_engine") return "nuclear";
  if (id === "heavy_chemical_engine") return "heavy";
  if (id === "vacuum_engine") return "vacuum";
  return "chemical";
}

/** Horizontal layouts for the engine cluster, keyed by TOTAL engine count. */
const ENGINE_SPREAD: Record<number, number[]> = { 1: [0], 2: [-13, 13], 3: [-22, 0, 22] };

// ---------------------------------------------------------------------------
// Model builder
// ---------------------------------------------------------------------------

export function buildSpacecraftModel(config: SpacecraftConfig): SpacecraftModel {
  const parts: SpacecraftPart[] = [];
  const components = active(config.components);

  // ---- labels (true quantities for EVERY installed component) -------------
  const labels: ComponentLabel[] = components.map((c) => {
    const eq = EQUIPMENT_BY_ID[c.equipmentId];
    return { equipmentId: c.equipmentId, name: eq.name, category: eq.category, count: c.quantity, drawn: 0 };
  });
  const labelOf = (id: string) => labels.find((l) => l.equipmentId === id);
  const markDrawn = (id: string, n: number) => {
    const l = labelOf(id);
    if (l) l.drawn = Math.max(l.drawn, n);
  };

  // ---- engine cluster (bottom of the stack) -------------------------------
  const engineComponents = components.filter((c) => isEngine(c.equipmentId));
  // Spread depends on the TOTAL cluster size so 2 engines flank, 3 form a row.
  const totalEngines = Math.min(
    VISUAL_CAPS.engine,
    engineComponents.reduce((s, c) => s + c.quantity, 0)
  );
  const engineLayout = ENGINE_SPREAD[totalEngines] ?? [0];
  let engineSlot = 0;
  for (const c of engineComponents) {
    const n = Math.min(c.quantity, VISUAL_CAPS.engine);
    const eq = EQUIPMENT_BY_ID[c.equipmentId];
    for (let i = 0; i < n; i++) {
      parts.push({
        key: `engine-${c.equipmentId}-${i}`,
        kind: "engine",
        equipmentId: c.equipmentId,
        label: eq.name,
        category: eq.category,
        x: engineLayout[engineSlot] ?? 0,
        y: STACK_LAYOUT.engineH / 2,
        w: c.equipmentId === "heavy_chemical_engine" || c.equipmentId === "nuclear_engine" ? 30 : 22,
        h: STACK_LAYOUT.engineH,
        variant: engineVariant(c.equipmentId),
        flags: [],
        index: engineSlot,
        approach: "b",
      });
      engineSlot++;
    }
    markDrawn(c.equipmentId, n);
  }
  const engineCount = engineSlot;
  const engineTop = engineCount > 0 ? STACK_LAYOUT.engineH : 0;
  const engineNeckW = 9 + (engineCount - 1) * 10;

  // ---- engine bay (boat-tail thrust structure behind the engines) ---------
  // Synthetic part: borrows the first installed engine's id — no ghost visuals.
  let engineBayW = 0;
  let engineClusterHalf = 0;
  if (engineCount > 0) {
    const engineParts = parts.filter((p) => p.kind === "engine");
    engineClusterHalf = Math.max(...engineParts.map((p) => Math.abs(p.x) + p.w / 2));
    engineBayW = Math.max(34, engineClusterHalf * 2 + 10);
    const bayEq = EQUIPMENT_BY_ID[engineComponents[0].equipmentId];
    parts.push({
      key: "engine-bay",
      kind: "engine_bay",
      equipmentId: engineComponents[0].equipmentId,
      label: bayEq.name,
      category: bayEq.category,
      x: 0,
      y: (STACK_LAYOUT.engineBayTop + STACK_LAYOUT.engineH) / 2,
      w: engineBayW,
      h: STACK_LAYOUT.engineH - STACK_LAYOUT.engineBayTop,
      variant: "bay",
      flags: ["synthetic"],
      index: 0,
      neckW: engineNeckW + 6,
      approach: "b",
    });
  }

  // ---- tank stack (body sections above the engines) ------------------------
  // Tanks of different types have different diameters (small=17, xenon=19,
  // large/drop=25). When the diameter changes between consecutive sections,
  // we insert a short conic INTERSTAGE ADAPTER so the join is a smooth frustum
  // instead of a visible "step" or cut. This mirrors how real rockets handle
  // diameter transitions (e.g. Falcon 9 interstage, Saturn V taper).
  const tankComponents = ofCategory(config.components, "Fuel");
  let tankCursor = engineTop;
  let tankSections = 0;
  let maxTankW = 0;
  let prevTankW = 0; // width of the previous tank section (0 = none yet)
  const INTERSTAGE_H = 6; // compact frustum height
  const INTERSTAGE_THRESHOLD = 3; // only add an adapter if widths differ by more than this
  for (const c of tankComponents) {
    const n = Math.min(c.quantity, VISUAL_CAPS.tank);
    const h = STACK_LAYOUT.tankHeights[c.equipmentId] ?? 28;
    const eq = EQUIPMENT_BY_ID[c.equipmentId];
    const w = c.equipmentId === "fuel_tank_small" ? 17 : c.equipmentId === "xenon_tank" ? 19 : 25;
    // Insert an interstage adapter if the previous tank had a different diameter.
    if (prevTankW > 0 && Math.abs(w - prevTankW) > INTERSTAGE_THRESHOLD) {
      parts.push({
        key: `interstage-${tankSections}`,
        kind: "adapter",
        equipmentId: c.equipmentId,
        label: "Interstage Adapter",
        category: "Structure",
        x: 0,
        y: tankCursor + INTERSTAGE_H / 2,
        w, // top edge = current tank width (the tank above the adapter)
        h: INTERSTAGE_H,
        variant: "interstage",
        flags: ["synthetic", "interstage"],
        index: tankSections,
        neckW: prevTankW, // bottom edge = previous tank width (the tank below)
        approach: "t",
      });
      tankCursor += INTERSTAGE_H;
    }
    for (let i = 0; i < n; i++) {
      // Insert an interstage adapter between consecutive sections of DIFFERENT
      // widths within the same component type loop (only relevant if the loop
      // runs multiple component types — the inner loop is same-width by
      // definition, so no adapter is needed between iterations here).
      parts.push({
        key: `tank-${c.equipmentId}-${i}`,
        kind: "tank",
        equipmentId: c.equipmentId,
        label: eq.name,
        category: eq.category,
        x: 0,
        y: tankCursor + h / 2,
        w,
        h,
        variant: c.equipmentId === "xenon_tank" ? "xenon" : c.equipmentId === "fuel_tank_drop" ? "drop" : "fuel",
        flags: i === 0 ? ["bottom"] : [],
        index: tankSections,
        // Interstage neck hugs the engine cluster below (9 per engine).
        neckW: i === 0 ? engineNeckW : undefined,
        approach: "t",
      });
      tankCursor += h;
      tankSections++;
      maxTankW = Math.max(maxTankW, w);
    }
    prevTankW = w;
    markDrawn(c.equipmentId, n);
  }
  const stackTop = tankCursor; // top of the propellant stack (== engineTop if no tanks)

  // ---- structural bus -------------------------------------------------------
  const busPick = BUS_PRIORITY.find((id) => components.some((c) => c.equipmentId === id && c.quantity > 0));
  const busFlags: string[] = [];
  if (components.some((c) => c.equipmentId === "thermal_blanket")) busFlags.push("blanket");
  if (components.some((c) => c.equipmentId === "micrometeorite_shield")) busFlags.push("whipple");
  if (components.some((c) => c.equipmentId === "modular_mounting" && busPick !== "modular_mounting")) busFlags.push("rails");

  let busBottom = stackTop;
  let busTop = stackTop;
  let busWidth = tankSections > 0 ? maxTankW + 4 : 34;
  const hasBus = !!busPick;
  if (busPick) {
    const h = STACK_LAYOUT.busHeights[busPick] ?? 54;
    busWidth = STACK_LAYOUT.busWidths[busPick] ?? 56;
    const eq = EQUIPMENT_BY_ID[busPick];
    parts.push({
      key: `bus-${busPick}`,
      kind: "bus",
      equipmentId: busPick,
      label: eq.name,
      category: eq.category,
      x: 0,
      y: stackTop + h / 2,
      w: busWidth,
      h,
      variant: busPick,
      flags: busFlags,
      index: 0,
      approach: "t",
    });
    markDrawn(busPick, 1);
    busTop = stackTop + h;
  }

  // ---- conic adapter (tank stack / engine bay → wider bus) ------------------
  // Synthetic part: borrows the bus id — no ghost visuals.
  // The frustum overlaps the section BELOW the bus: its wide edge sits at the
  // bus bottom ring, tapering down to the tank / bay width over 10 units.
  if (hasBus && busBottom > 0) {
    const lowerW = tankSections > 0 ? maxTankW : engineBayW;
    if (busWidth - lowerW > 8) {
      const eq = EQUIPMENT_BY_ID[busPick!];
      parts.push({
        key: `adapter-${busPick}`,
        kind: "adapter",
        equipmentId: busPick!,
        label: eq.name,
        category: eq.category,
        x: 0,
        y: busBottom - 5,
        w: busWidth,
        h: 10,
        variant: "adapter",
        flags: ["synthetic"],
        index: 0,
        neckW: lowerW,
        approach: "t",
      });
    }
  }

  // ---- attachment section: what side components fix to ----------------------
  // With a bus: the bus body itself. Without: the upper tank stack. Without
  // either: the engine section (service module around the propulsion).
  const secBottom = hasBus ? stackTop : engineTop;
  const secTop = hasBus ? busTop : stackTop;
  const secH = Math.max(0, secTop - secBottom);
  const attachWidth = hasBus ? busWidth : tankSections > 0 ? maxTankW + 2 : 24;
  const attachTop = secTop; // antennas / nav mount here (unchanged behaviour)

  // ---- science instruments (upper band, bracket-mounted) --------------------
  const instrumentComponents = ofCategory(config.components, "Science");
  const instTopY = secTop - 8;
  let instSlot = 0;
  let instLowest: number | null = null;
  for (const c of instrumentComponents) {
    if (instSlot >= INSTRUMENT_SLOTS) break;
    const n = Math.min(c.quantity, INSTRUMENT_SLOTS - instSlot);
    const eq = EQUIPMENT_BY_ID[c.equipmentId];
    for (let i = 0; i < n; i++) {
      const side = instSlot % 2 === 0 ? "l" : "r";
      const row = Math.floor(instSlot / 2);
      const y = instTopY - row * SIDE.instRowGap;
      parts.push({
        key: `inst-${c.equipmentId}-${i}`,
        kind: "instrument",
        equipmentId: c.equipmentId,
        label: eq.name,
        category: eq.category,
        x: (side === "l" ? -1 : 1) * (attachWidth / 2 + SIDE.standoff + 15 / 2),
        y,
        w: 15,
        h: 14,
        side,
        variant: c.equipmentId,
        flags: [],
        index: instSlot,
        standoff: SIDE.standoff,
        approach: side,
        hullEdgeX: attachWidth / 2,
        hullBottomY: secBottom,
      });
      instLowest = y;
      instSlot++;
    }
    markDrawn(c.equipmentId, n);
  }

  // ---- solar wings (extend horizontally; band below the instruments) --------
  const solarComponents = components.filter((c) => EQUIPMENT_BY_ID[c.equipmentId]?.isSolar);
  let wingSlot = 0;
  let wingSpan = attachWidth;
  let wingY = instLowest !== null ? instLowest - SIDE.wingGap : secBottom + secH * 0.55;
  for (const c of solarComponents) {
    const big = c.equipmentId === "solar_array_large";
    const n = Math.min(c.quantity, VISUAL_CAPS.wing);
    const eq = EQUIPMENT_BY_ID[c.equipmentId];
    const len = big ? 62 : c.equipmentId === "solar_blanket" ? 54 : 46;
    for (let i = 0; i < n; i++) {
      const y = wingY - wingSlot * 26;
      for (const side of ["l", "r"] as const) {
        parts.push({
          key: `wing-${c.equipmentId}-${side}-${i}`,
          kind: "wing",
          equipmentId: c.equipmentId,
          label: eq.name,
          category: eq.category,
          x: (side === "l" ? -1 : 1) * (attachWidth / 2 + SIDE.wingStandoff),
          y,
          w: len,
          h: big ? 26 : 20,
          side,
          variant: big ? "large" : c.equipmentId === "solar_blanket" ? "blanket" : "standard",
          flags: [],
          index: wingSlot,
          standoff: SIDE.wingStandoff,
          approach: side,
          hullEdgeX: attachWidth / 2,
          hullBottomY: secBottom,
        });
      }
      wingSpan = Math.max(wingSpan, attachWidth + SIDE.wingStandoff * 2 + len);
      wingSlot++;
    }
    markDrawn(c.equipmentId, n);
  }
  const hasSolar = wingSlot > 0;
  const wingLowest = hasSolar ? wingY - (wingSlot - 1) * 26 : null;

  // ---- power pods (lower band, right under the wing panel) ------------------
  const podComponents = components.filter((c) =>
    ["rtg", "rtg_advanced", "battery", "battery_large", "fuel_cell"].includes(c.equipmentId)
  );
  let podSlot = 0;
  let podBottomY: number | null = null;
  for (const c of podComponents) {
    const n = Math.min(c.quantity, VISUAL_CAPS.pod);
    const eq = EQUIPMENT_BY_ID[c.equipmentId];
    const podH = c.equipmentId === "rtg" || c.equipmentId === "rtg_advanced" ? 24 : 16;
    for (let i = 0; i < n; i++) {
      const side = podSlot % 2 === 0 ? "l" : "r";
      const row = Math.floor(podSlot / 2);
      // First row tucks under the wing panel (or the instruments); further
      // rows continue straight down.
      const anchor =
        wingLowest !== null
          ? wingLowest - 10
          : instLowest !== null
            ? instLowest - 7
            : secBottom + 10 + podH / 2;
      const y = Math.max(anchor - SIDE.podGap - podH / 2 - row * 18, secBottom - 26);
      parts.push({
        key: `pod-${c.equipmentId}-${i}`,
        kind: "pod",
        equipmentId: c.equipmentId,
        label: eq.name,
        category: eq.category,
        x: (side === "l" ? -1 : 1) * (attachWidth / 2 + SIDE.standoff + 14 / 2),
        y,
        w: 14,
        h: podH,
        side,
        variant: c.equipmentId,
        flags: [],
        index: podSlot,
        standoff: SIDE.standoff,
        approach: side,
        hullEdgeX: attachWidth / 2,
        hullBottomY: secBottom,
      });
      podBottomY = y - podH / 2;
      podSlot++;
    }
    markDrawn(c.equipmentId, n);
  }

  // ---- thermal: radiators (base band, under the pods) ------------------------
  let radiatorDrawn = false;
  if (components.some((c) => c.equipmentId === "active_thermal_control")) {
    const eq = EQUIPMENT_BY_ID.active_thermal_control;
    const radH = 26;
    const ideal =
      podBottomY !== null
        ? podBottomY - SIDE.radGap - radH / 2
        : wingLowest !== null
          ? wingLowest - 10 - SIDE.radGap - radH / 2
          : secBottom + secH * 0.3;
    // Keep the radiator within a believable overhang below the hull.
    const radY = Math.max(ideal, secBottom - 24);
    // If the clamp squeezed it into the pod overhang zone, shift it outboard
    // onto a longer boom so the two never overlap.
    const conflicts = podBottomY !== null && radY - radH / 2 < secBottom && podBottomY < secBottom;
    const radStandoff = conflicts ? SIDE.standoff + 16 : SIDE.standoff;
    for (const side of ["l", "r"] as const) {
      parts.push({
        key: `radiator-${side}`,
        kind: "radiator",
        equipmentId: "active_thermal_control",
        label: eq.name,
        category: eq.category,
        x: (side === "l" ? -1 : 1) * (attachWidth / 2 + radStandoff + 10 / 2),
        y: radY,
        w: 10,
        h: radH,
        side,
        variant: "radiator",
        flags: [],
        index: side === "l" ? 0 : 1,
        standoff: radStandoff,
        approach: side,
        hullEdgeX: attachWidth / 2,
        hullBottomY: secBottom,
      });
    }
    radiatorDrawn = true;
    markDrawn("active_thermal_control", 2);
  }

  // ---- antennas (on top of the stack) — PRESERVED visual placement ----------
  const antennaComponents = ofCategory(config.components, "Communication");
  const totalAntennaSlots = antennaComponents.reduce((s, k) => s + Math.min(k.quantity, VISUAL_CAPS.antenna), 0);
  let antennaSlot = 0;
  for (const c of antennaComponents) {
    const n = Math.min(c.quantity, VISUAL_CAPS.antenna);
    const eq = EQUIPMENT_BY_ID[c.equipmentId];
    // Base extent of each mast/box so it stands EXACTLY on the stack top.
    const baseExtent: Record<string, number> = {
      deep_space_antenna: 12.8,
      communication_antenna: 8.8,
      low_gain_antenna: 6,
      relay_transponder: 8,
      optical_terminal: 9,
    };
    for (let i = 0; i < n; i++) {
      const x = totalAntennaSlots === 1 ? 0 : antennaSlot % 2 === 0 ? -15 : 15;
      parts.push({
        key: `ant-${c.equipmentId}-${i}`,
        kind: "antenna",
        equipmentId: c.equipmentId,
        label: eq.name,
        category: eq.category,
        x,
        y: attachTop + (baseExtent[c.equipmentId] ?? 9),
        w: c.equipmentId === "deep_space_antenna" ? 34 : c.equipmentId === "low_gain_antenna" ? 8 : 22,
        h: STACK_LAYOUT.mastH,
        variant: c.equipmentId,
        flags: [],
        index: antennaSlot,
        approach: "t",
      });
      antennaSlot++;
    }
    markDrawn(c.equipmentId, n);
  }

  // ---- navigation sensors (bus top corners) ---------------------------------
  const navComponents = ofCategory(config.components, "Navigation");
  let navSlot = 0;
  for (const c of navComponents) {
    const n = Math.min(c.quantity, VISUAL_CAPS.nav);
    const eq = EQUIPMENT_BY_ID[c.equipmentId];
    for (let i = 0; i < n; i++) {
      const x = attachWidth / 2 - 9;
      parts.push({
        key: `nav-${c.equipmentId}-${i}`,
        kind: "nav",
        equipmentId: c.equipmentId,
        label: eq.name,
        category: eq.category,
        x: navSlot % 2 === 0 ? -x : x,
        y: attachTop - 8,
        w: 14,
        h: 12,
        variant: c.equipmentId,
        flags: [],
        index: navSlot,
        approach: "t",
      });
      navSlot++;
    }
    markDrawn(c.equipmentId, n);
  }

  // ---- heat shield: INTEGRATED into the base, not floating ------------------
  const shieldPick = ["reinforced_heat_shield", "thermal_protection_system", "heat_shield"].find((id) =>
    components.some((c) => c.equipmentId === id)
  );
  let bottomY = 0;
  if (shieldPick) {
    const eq = EQUIPMENT_BY_ID[shieldPick];
    const depth = STACK_LAYOUT.shieldDepths[shieldPick] ?? STACK_LAYOUT.shieldDepth;
    // The mounting collar width follows the structure the shield bolts to:
    // the engine bay when engines exist, otherwise the base section itself.
    const collarW =
      engineCount > 0
        ? Math.max(36, engineBayW)
        : hasBus && busBottom === 0
          ? busWidth
          : tankSections > 0
            ? maxTankW + 8
            : 34;
    // With engines the collar rises behind the bells (engines recess into the
    // shield); without engines it tucks 4 units up behind the base section.
    const rise = engineCount > 0 ? 8 : 4;
    // Struts bolt to the engine-bay flare, clearing the bells and the dust
    // shroud on their way up.
    const dustInstalled = components.some((c) => c.equipmentId === "dust_protection");
    const skirtHalf = dustInstalled ? Math.min(46, Math.max(28, engineBayW - 10)) / 2 : 0;
    const strutX =
      engineCount > 0
        ? Math.min(collarW / 2 - 2, Math.max(engineClusterHalf + 2, skirtHalf + 2, 12))
        : undefined;
    parts.push({
      key: `shield-${shieldPick}`,
      kind: "shield",
      equipmentId: shieldPick,
      label: eq.name,
      category: eq.category,
      x: 0,
      y: (rise - depth) / 2,
      w: collarW + 10,
      h: rise + depth,
      variant: shieldPick,
      flags: [],
      index: 0,
      collarW,
      strutTop: engineCount > 0 ? STACK_LAYOUT.engineBayTop + 6 : undefined,
      strutX,
      approach: "b",
    });
    markDrawn(shieldPick, 1);
    bottomY = -depth;
  }

  // ---- radiation shielding: armoured shell around the bus -------------------
  const radiationPick = ["radiation_shield_advanced", "radiation_shield", "radiation_shield_basic"].find((id) =>
    components.some((c) => c.equipmentId === id)
  );
  if (radiationPick) {
    const eq = EQUIPMENT_BY_ID[radiationPick];
    // The shell hugs the attachment section. Degenerate sections (engine-only
    // craft) wrap the engine section instead so the shell is never a flat band.
    const shellBottom = secH >= 12 ? secBottom : engineTop * 0.15;
    const shellTop = secH >= 12 ? secTop : engineTop;
    parts.push({
      key: `aura-${radiationPick}`,
      kind: "aura",
      equipmentId: radiationPick,
      label: eq.name,
      category: eq.category,
      x: 0,
      y: (shellTop + shellBottom) / 2,
      w: attachWidth + 8,
      h: shellTop - shellBottom + 4,
      variant: radiationPick,
      flags: [],
      index: 0,
      approach: "t",
    });
    markDrawn(radiationPick, 1);
  }

  // ---- dust protection: shroud clamped around the engine / base section ----
  if (components.some((c) => c.equipmentId === "dust_protection")) {
    const eq = EQUIPMENT_BY_ID.dust_protection;
    const skirtW = Math.min(46, Math.max(28, (engineCount > 0 ? engineBayW : attachWidth) - 10));
    parts.push({
      key: "skirt-dust_protection",
      kind: "skirt",
      equipmentId: "dust_protection",
      label: eq.name,
      category: eq.category,
      x: 0,
      y: 4,
      w: skirtW,
      h: 20,
      variant: "dust",
      flags: [],
      index: 0,
      approach: "b",
    });
    markDrawn("dust_protection", 1);
    bottomY = Math.min(bottomY, -6);
  }

  // ---- landing gear ----------------------------------------------------------
  const landingComponents = ofCategory(config.components, "Landing").filter((c) => c.equipmentId !== "descent_thruster");
  const hasLandingStructure = components.some((c) => c.equipmentId === "reinforced_landing_structure");
  if (landingComponents.length > 0 || hasLandingStructure) {
    const pick =
      landingComponents.find((c) => c.equipmentId === "landing_legs")?.equipmentId ??
      landingComponents[0]?.equipmentId ??
      "reinforced_landing_structure";
    const eq = EQUIPMENT_BY_ID[pick] ?? EQUIPMENT_BY_ID.reinforced_landing_structure;
    const airbag = landingComponents.some((c) => c.equipmentId === "airbag_system");
    parts.push({
      key: `legs-${pick}`,
      kind: "legs",
      equipmentId: pick,
      label: eq.name,
      category: eq.category,
      x: 0,
      y: 0,
      w: 64,
      h: 30,
      variant:
        landingComponents.some((c) => c.equipmentId === "airbag_system") || hasLandingStructure ? "heavy" : "standard",
      flags: airbag ? ["airbag"] : [],
      index: 0,
      approach: "b",
    });
    markDrawn(pick, 1);
    if (hasLandingStructure && pick !== "reinforced_landing_structure") markDrawn("reinforced_landing_structure", 1);
    if (airbag) markDrawn("airbag_system", 1);
    // Feet reach 30 below the plane; airbag keel reaches 38.
    bottomY = Math.min(bottomY, airbag ? -38 : -30);
  }

  // ---- metrics ----------------------------------------------------------------
  let topY = Math.max(stackTop, attachTop);
  for (const p of parts) {
    if (p.kind === "antenna" || p.kind === "nav") {
      topY = Math.max(topY, p.y + p.h / 2 + 6);
    }
  }
  const width = Math.max(wingSpan, busWidth, shieldPick ? (parts.find((p) => p.kind === "shield")?.w ?? 0) : 0, 68);

  const visualEquipmentIds = Array.from(
    new Set([
      ...parts.map((p) => p.equipmentId),
      ...components
        .filter((c) => ["thermal_blanket", "micrometeorite_shield", "modular_mounting"].includes(c.equipmentId))
        .map((c) => c.equipmentId),
    ])
  );

  return {
    parts,
    labels,
    metrics: {
      topY,
      bottomY,
      height: topY - bottomY,
      width,
      engineTop,
      stackTop,
      busBottom,
      busTop,
      busWidth,
      hasBus,
      hasSolar,
      engineCount,
      tankSections,
    },
    visualEquipmentIds,
  };
}

/** Convenience predicate used by the flight scenes. */
export function modelHasEquipment(model: SpacecraftModel, equipmentId: string): boolean {
  return model.parts.some((p) => p.equipmentId === equipmentId);
}
