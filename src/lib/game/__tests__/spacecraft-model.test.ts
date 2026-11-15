/**
 * ============================================================================
 * SHARED SPACECRAFT MODEL TESTS (v2.1 visual systems revision)
 * ============================================================================
 * The model is the single source of visual truth shared by the Design Lab,
 * the liftoff simulation and the mission-event simulations. These tests pin
 * the sync contract between the live spacecraft configuration and what every
 * renderer draws:
 *
 *   - empty config  → nothing drawn
 *   - adding equipment instantly produces its visual part
 *   - removing equipment instantly removes the part
 *   - engines sit at the BOTTOM, tanks stack ABOVE them, bus on top,
 *     wings extend horizontally
 *   - quantities are honest (labels carry true counts, caps limit drawings)
 *   - the model is deterministic (same config → identical model)
 * ============================================================================
 */

import { describe, test, expect } from "bun:test";
import { buildSpacecraftModel, VISUAL_CAPS, STACK_LAYOUT } from "../../../components/game/spacecraft/model";
import { config } from "./helpers";
import { EQUIPMENT_BY_ID } from "../equipment";
import { withQuantity } from "../calculations";

const LUNAR_LANDER = config("lunar_outpost", [
  ["chemical_engine", 1],
  ["fuel_tank_large", 1],
  ["structural_frame", 1],
  ["solar_array", 1],
  ["battery", 1],
  ["communication_antenna", 1],
  ["science_instrument", 1],
  ["star_tracker", 1],
]);

describe("shared spacecraft model", () => {
  test("an empty configuration produces an empty preview", () => {
    const model = buildSpacecraftModel(config("none", []));
    expect(model.parts.length).toBe(0);
    expect(model.labels.length).toBe(0);
    expect(model.metrics.height).toBeGreaterThanOrEqual(0);
    expect(model.metrics.engineCount).toBe(0);
  });

  test("adding an engine draws it at the bottom of the stack", () => {
    const model = buildSpacecraftModel(config("none", [["chemical_engine", 1]]));
    const engines = model.parts.filter((p) => p.kind === "engine");
    expect(engines.length).toBe(1);
    expect(engines[0].equipmentId).toBe("chemical_engine");
    // Engine band: centre within the engine section height.
    expect(engines[0].y).toBeGreaterThan(0);
    expect(engines[0].y).toBeLessThanOrEqual(STACK_LAYOUT.engineH);
    expect(model.metrics.engineCount).toBe(1);
  });

  test("removing the engine removes its visual part immediately", () => {
    let cfg = config("none", [["chemical_engine", 1]]);
    expect(buildSpacecraftModel(cfg).parts.some((p) => p.equipmentId === "chemical_engine")).toBe(true);
    cfg = withQuantity(cfg, "chemical_engine", 0);
    expect(buildSpacecraftModel(cfg).parts.some((p) => p.equipmentId === "chemical_engine")).toBe(false);
  });

  test("fuel tanks stack as body sections ABOVE the engines", () => {
    const model = buildSpacecraftModel(config("none", [
      ["chemical_engine", 1],
      ["fuel_tank_large", 2],
      ["fuel_tank_small", 1],
    ]));
    const tanks = model.parts.filter((p) => p.kind === "tank");
    expect(tanks.length).toBe(3);
    for (const tank of tanks) {
      expect(tank.y).toBeGreaterThan(STACK_LAYOUT.engineH);
    }
    // Sections are stacked in order — each higher section has a larger y.
    const ys = tanks.map((t) => t.y).sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBeGreaterThan(10);
    expect(ys[2] - ys[1]).toBeGreaterThan(5);
    expect(model.metrics.tankSections).toBe(3);
    // The stack grows with more tanks.
    const oneTank = buildSpacecraftModel(config("none", [
      ["chemical_engine", 1],
      ["fuel_tank_large", 1],
    ]));
    expect(model.metrics.topY).toBeGreaterThan(oneTank.metrics.topY);
  });

  test("solar wings extend horizontally on BOTH sides", () => {
    const model = buildSpacecraftModel(config("none", [
      ["structural_frame", 1],
      ["solar_array", 1],
    ]));
    const wings = model.parts.filter((p) => p.kind === "wing");
    expect(wings.length).toBe(2);
    expect(wings.some((w) => w.side === "l" && w.x < 0)).toBe(true);
    expect(wings.some((w) => w.side === "r" && w.x > 0)).toBe(true);
    expect(model.metrics.hasSolar).toBe(true);
    expect(model.metrics.width).toBeGreaterThan(80);

    const noSolar = buildSpacecraftModel(config("none", [["structural_frame", 1]]));
    expect(noSolar.parts.filter((p) => p.kind === "wing").length).toBe(0);
    expect(noSolar.metrics.hasSolar).toBe(false);
  });

  test("multiple engines are each drawn (up to the visual cap)", () => {
    const model = buildSpacecraftModel(config("none", [["chemical_engine", 2], ["vacuum_engine", 1]]));
    expect(model.parts.filter((p) => p.kind === "engine").length).toBe(3);
    const capped = buildSpacecraftModel(config("none", [["chemical_engine", 5]]));
    expect(capped.parts.filter((p) => p.kind === "engine").length).toBe(VISUAL_CAPS.engine);
    // The label still reports the TRUE count.
    const label = capped.labels.find((l) => l.equipmentId === "chemical_engine");
    expect(label?.count).toBe(5);
    expect(label?.drawn).toBe(VISUAL_CAPS.engine);
  });

  test("engine clusters spread horizontally — no overlapping nozzles", () => {
    const two = buildSpacecraftModel(config("none", [["chemical_engine", 1], ["heavy_chemical_engine", 1]]));
    const xs = two.parts.filter((p) => p.kind === "engine").map((p) => p.x);
    expect(xs.length).toBe(2);
    expect(new Set(xs).size).toBe(2); // distinct positions
    expect(xs.some((x) => x < 0)).toBe(true);
    expect(xs.some((x) => x > 0)).toBe(true);
    const three = buildSpacecraftModel(config("none", [["chemical_engine", 3]]));
    const xs3 = three.parts.filter((p) => p.kind === "engine").map((p) => p.x);
    expect(new Set(xs3).size).toBe(3);
  });

  test("structure equipment defines the bus width", () => {
    const heavy = buildSpacecraftModel(config("none", [["heavy_spacecraft_bus", 1]]));
    const light = buildSpacecraftModel(config("none", [["structural_frame_light", 1]]));
    expect(heavy.metrics.busWidth).toBeGreaterThan(light.metrics.busWidth);
    expect(heavy.parts.find((p) => p.kind === "bus")?.equipmentId).toBe("heavy_spacecraft_bus");
    const bare = buildSpacecraftModel(config("none", [["chemical_engine", 1]]));
    expect(bare.metrics.hasBus).toBe(false);
  });

  test("every drawn part maps to installed equipment (no ghost visuals)", () => {
    const model = buildSpacecraftModel(LUNAR_LANDER);
    const installed = new Set(
      LUNAR_LANDER.components.filter((c) => c.quantity > 0).map((c) => c.equipmentId)
    );
    for (const part of model.parts) {
      expect(installed.has(part.equipmentId)).toBe(true);
      expect(EQUIPMENT_BY_ID[part.equipmentId]).toBeDefined();
    }
    expect(model.parts.length).toBeGreaterThan(4);
  });

  test("labels list every installed component with honest counts", () => {
    const model = buildSpacecraftModel(withQuantity(LUNAR_LANDER, "fuel_tank_small", 7));
    for (const c of LUNAR_LANDER.components) {
      const label = model.labels.find((l) => l.equipmentId === c.equipmentId);
      expect(label).toBeDefined();
      expect(label!.count).toBe(c.quantity);
      expect(label!.drawn).toBeLessThanOrEqual(c.quantity);
    }
    const small = model.labels.find((l) => l.equipmentId === "fuel_tank_small");
    expect(small!.count).toBe(7);
    expect(small!.drawn).toBe(VISUAL_CAPS.tank);
  });

  test("the model is deterministic — same config, identical model", () => {
    const a = buildSpacecraftModel(LUNAR_LANDER);
    const b = buildSpacecraftModel(LUNAR_LANDER);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("vertical ordering: engines below tanks below bus, wings at the sides", () => {
    const model = buildSpacecraftModel(LUNAR_LANDER);
    const engine = model.parts.find((p) => p.kind === "engine")!;
    const tank = model.parts.find((p) => p.kind === "tank")!;
    const bus = model.parts.find((p) => p.kind === "bus")!;
    expect(engine.y).toBeLessThan(tank.y);
    expect(tank.y).toBeLessThan(bus.y);
    const wing = model.parts.find((p) => p.kind === "wing")!;
    expect(Math.abs(wing.x)).toBeGreaterThan(model.metrics.busWidth / 2);
  });

  test("protection and thermal equipment get their own visuals", () => {
    const model = buildSpacecraftModel(config("jupiter_orbiter", [
      ["structural_frame", 1],
      ["radiation_shield_advanced", 1],
      ["heat_shield", 1],
      ["active_thermal_control", 1],
      ["dust_protection", 1],
      ["micrometeorite_shield", 1],
    ]));
    expect(model.parts.some((p) => p.kind === "aura")).toBe(true);
    expect(model.parts.some((p) => p.kind === "shield")).toBe(true);
    expect(model.parts.some((p) => p.kind === "radiator")).toBe(true);
    expect(model.parts.some((p) => p.kind === "skirt")).toBe(true);
    // Whipple plates are bus flags (visual variants), still represented.
    expect(model.parts.find((p) => p.kind === "bus")?.flags).toContain("whipple");
  });

  test("landing gear appears for landing equipment", () => {
    const model = buildSpacecraftModel(config("none", [
      ["chemical_engine", 1],
      ["landing_legs", 1],
      ["airbag_system", 1],
    ]));
    const legs = model.parts.find((p) => p.kind === "legs");
    expect(legs).toBeDefined();
    expect(legs!.flags).toContain("airbag");
  });

  test("a realistic mission design produces a complete, sane stack", () => {
    const model = buildSpacecraftModel(LUNAR_LANDER);
    expect(model.metrics.engineCount).toBe(1);
    expect(model.metrics.tankSections).toBe(1);
    expect(model.metrics.hasBus).toBe(true);
    expect(model.metrics.hasSolar).toBe(true);
    expect(model.metrics.height).toBeGreaterThan(80);
    // Every category of the design is visually present.
    for (const id of ["chemical_engine", "fuel_tank_large", "structural_frame", "solar_array", "communication_antenna"]) {
      expect(model.visualEquipmentIds).toContain(id);
    }
  });
});
