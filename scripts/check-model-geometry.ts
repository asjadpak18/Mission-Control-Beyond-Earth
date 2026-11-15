/** Geometry sanity checks for the v2.2 attachment system (dev only). */
import { buildSpacecraftModel } from "../src/components/game/spacecraft/model";
import { config } from "../src/lib/game/__tests__/helpers";

function overlap(a: { x: number; y: number; w: number; h: number; kind: string }, b: { x: number; y: number; w: number; h: number; kind: string }) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.5 &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 0.5
  );
}

const cases: Array<[string, Array<[string, number]>]> = [
  ["empty", []],
  ["engine only", [["chemical_engine", 1]]],
  ["3 engines + tanks", [["chemical_engine", 3], ["fuel_tank_large", 2]]],
  ["lander", [
    ["chemical_engine", 1], ["fuel_tank_large", 1], ["structural_frame", 1],
    ["solar_array", 1], ["battery", 1], ["communication_antenna", 1],
    ["science_instrument", 1], ["star_tracker", 1], ["landing_legs", 1], ["heat_shield", 1],
  ]],
  ["full stack", [
    ["chemical_engine", 1], ["fuel_tank_large", 1], ["structural_frame", 1],
    ["solar_array", 1], ["battery", 1], ["spectrometer", 1], ["radar_sounder", 1],
    ["magnetometer", 1], ["dust_analyzer", 1], ["heat_shield", 1],
    ["radiation_shield", 1], ["landing_legs", 1], ["active_thermal_control", 1],
    ["deep_space_antenna", 1], ["star_tracker", 1], ["micrometeorite_shield", 1],
  ]],
  ["no bus, tanks only", [["chemical_engine", 1], ["fuel_tank_large", 2], ["solar_array", 1], ["battery", 1], ["spectrometer", 1]]],
  ["protection only", [["structural_frame", 1], ["radiation_shield_advanced", 1], ["heat_shield", 1], ["active_thermal_control", 1], ["dust_protection", 1], ["micrometeorite_shield", 1]]],
];

for (const [name, comps] of cases) {
  const model = buildSpacecraftModel(config("none", comps));
  const m = model.metrics;
  console.log(`\n=== ${name} ===`);
  console.log(`parts=${model.parts.length} height=${m.height.toFixed(1)} topY=${m.topY} bottomY=${m.bottomY} width=${m.width.toFixed(0)} engineCount=${m.engineCount} tanks=${m.tankSections}`);
  for (const p of model.parts) {
    console.log(
      `  ${p.kind.padEnd(11)} x=${p.x.toFixed(1).padStart(6)} y=${p.y.toFixed(1).padStart(6)} w=${p.w.toFixed(0).padStart(3)} h=${p.h.toFixed(0).padStart(3)} ${p.side ?? ""} ${p.approach ?? ""} ${p.flags.join(",")}`
    );
  }
  // Collision check between side-mounted parts and wings (same side only)
  const sideParts = model.parts.filter((p) => ["wing", "pod", "instrument", "radiator"].includes(p.kind));
  for (let i = 0; i < sideParts.length; i++) {
    for (let j = i + 1; j < sideParts.length; j++) {
      const a = sideParts[i], b = sideParts[j];
      if (a.side && b.side && a.side !== b.side) continue;
      if (overlap(a, b)) {
        console.log(`  !! OVERLAP: ${a.kind}#${a.index} vs ${b.kind}#${b.index}`);
      }
    }
  }
  // Ghost visual check: every part maps to installed equipment
  const installed = new Set(comps.filter(([, q]) => q > 0).map(([id]) => id));
  for (const p of model.parts) {
    if (!installed.has(p.equipmentId)) console.log(`  !! GHOST: ${p.kind} → ${p.equipmentId}`);
  }
}
