/**
 * ============================================================================
 * v2.0 TESTS — difficulty settings, random constraints, expanded events
 * ============================================================================
 * Covers:
 * - applyDifficulty transforms (budget/mass/fuel/power/eventRate/science goals)
 * - Deterministic constraint rolling (same seed → same set; different seed
 *   may differ)
 * - Constraint-driven validation gates (redundant comms, banned equipment)
 * - Expanded event pool integrity (unique ids, choice qualities, role tags)
 * ============================================================================
 */

import { describe, test, expect } from "bun:test";
import { getMission, MISSIONS } from "../missions";
import { applyDifficulty, rollConstraints, CONSTRAINT_POOL, CONSTRAINTS_BY_ID } from "../constraints";
import { GENERIC_EVENTS, ROLE_EVENTS, ALL_POOLED_EVENTS } from "../events";
import { validateSpacecraft } from "../validation";
import { config } from "./helpers";

describe("difficulty & constraints", () => {
  test("Beginner grants a budget bonus and calms events", () => {
    const base = getMission("lunar_research")!;
    const { mission } = applyDifficulty(base, "Beginner", [], 1);
    expect(mission.budget).toBe(Math.round(base.budget * 1.15));
    expect(mission.eventRate).toBeCloseTo(0.6, 5);
  });

  test("Expert cuts budget & mass and rolls two constraints deterministically", () => {
    const base = getMission("lunar_research")!;
    const a = applyDifficulty(base, "Expert", [], 777);
    const b = applyDifficulty(base, "Expert", [], 777);
    expect(a.applied.length).toBe(2);
    expect(b.applied.map((c) => c.id)).toEqual(a.applied.map((c) => c.id));
    // Budget = preset 0.82 × any rolled budget multipliers.
    const rolledBudget = a.applied.reduce((m, c) => m * (c.effects.budgetMultiplier ?? 1), 1);
    const rolledMass = a.applied.reduce((m, c) => m * (c.effects.massMultiplier ?? 1), 1);
    expect(a.mission.budget).toBe(Math.round(base.budget * 0.82 * rolledBudget));
    expect(a.mission.maxMass).toBe(Math.round(base.maxMass * 0.9 * rolledMass));
    // different seed may produce a different set (12 choose 2 = 66 combinations)
    const c = applyDifficulty(base, "Expert", [], 424242);
    expect(c.applied.length).toBe(2);
  });

  test("constraint rolling is deterministic per seed", () => {
    const s1 = rollConstraints(99, 3).map((c) => c.id);
    const s2 = rollConstraints(99, 3).map((c) => c.id);
    expect(s1).toEqual(s2);
    expect(new Set(s1).size).toBe(3);
  });

  test("Custom Challenge applies exactly the player-picked constraints", () => {
    const base = getMission("mars_survey")!;
    const { mission, applied } = applyDifficulty(base, "Custom Challenge", ["reduced_budget", "mandatory_redundant_comms"], 0);
    expect(applied.map((c) => c.id).sort()).toEqual(["mandatory_redundant_comms", "reduced_budget"]);
    expect(mission.budget).toBe(Math.round(base.budget * 0.8));
    expect(mission.requireRedundantComms).toBe(true);
  });

  test("reduced_power_availability derates solar output", () => {
    const base = getMission("mars_survey")!;
    const { mission } = applyDifficulty(base, "Custom Challenge", ["reduced_power_availability"], 0);
    expect(mission.solarDerate).toBeCloseTo(base.solarDerate * 0.75, 5);
  });

  test("additional_objectives raises science-data targets", () => {
    const base = getMission("lunar_research")!;
    const { mission } = applyDifficulty(base, "Custom Challenge", ["additional_objectives"], 0);
    const baseGoal = base.objectives.find((o) => o.target.kind === "scienceData")!.target as { minimum: number };
    const newGoal = mission.objectives.find((o) => o.target.kind === "scienceData")!.target as { minimum: number };
    expect(newGoal.minimum).toBe(Math.min(100, baseGoal.minimum + 8));
  });

  test("mandatory redundant comms blocks a single-antenna design at validation", () => {
    const base = getMission("lunar_research")!;
    const { mission } = applyDifficulty(base, "Custom Challenge", ["mandatory_redundant_comms"], 0);
    const single = config("lunar_research", [
      ["science_instrument", 1],
      ["communication_antenna", 1],
      ["chemical_engine", 1],
      ["fuel_tank_large", 1],
      ["solar_array", 1],
    ]);
    const v1 = validateSpacecraft(mission, single);
    expect(v1.errors.find((e) => e.id === "redundant_comms")).toBeDefined();

    const dual = config("lunar_research", [
      ["science_instrument", 1],
      ["communication_antenna", 1],
      ["low_gain_antenna", 1],
      ["chemical_engine", 1],
      ["fuel_tank_large", 1],
      ["solar_array", 1],
    ]);
    const v2 = validateSpacecraft(mission, dual);
    expect(v2.errors.find((e) => e.id === "redundant_comms")).toBeUndefined();
  });

  test("restricted equipment constraint bans RTGs at validation", () => {
    const base = getMission("lunar_research")!;
    const { mission } = applyDifficulty(base, "Custom Challenge", ["restricted_equipment"], 0);
    const withRtg = config("lunar_research", [
      ["science_instrument", 1],
      ["communication_antenna", 1],
      ["chemical_engine", 1],
      ["fuel_tank_large", 1],
      ["solar_array", 1],
      ["rtg", 1],
    ]);
    const v = validateSpacecraft(mission, withRtg);
    expect(v.errors.find((e) => e.id === "restricted_equipment")).toBeDefined();
  });

  test("every constraint id in the pool resolves and has effects", () => {
    for (const c of CONSTRAINT_POOL) {
      expect(CONSTRAINTS_BY_ID[c.id]).toBeDefined();
      expect(Object.keys(c.effects).length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(20);
    }
  });

  test("every mission remains winnable at Intermediate difficulty", () => {
    // Intermediate applies no multipliers beyond nominal event rate 1.0.
    for (const base of MISSIONS) {
      const { mission } = applyDifficulty(base, "Intermediate", [], 5);
      expect(mission.budget).toBe(base.budget);
      expect(mission.maxMass).toBe(base.maxMass);
    }
  });
});

describe("expanded event pool", () => {
  test("all pooled event ids are unique", () => {
    const ids = ALL_POOLED_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every event has 2+ choices with quality ratings", () => {
    for (const e of ALL_POOLED_EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2);
      for (const c of e.choices) {
        expect(c.effects.quality).toBeGreaterThan(0);
        expect(c.effects.quality).toBeLessThanOrEqual(1);
        expect(c.description.length).toBeGreaterThan(15);
      }
    }
  });

  test("every role has at least two dedicated events", () => {
    const roles: Array<"commander" | "engineer" | "navigator" | "scientist"> = ["commander", "engineer", "navigator", "scientist"];
    for (const role of roles) {
      const count = ROLE_EVENTS.filter((e) => e.roles?.includes(role)).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test("generic pool keeps the five v1.0 events", () => {
    for (const id of ["power_demand", "solar_degradation", "instrument_fault", "comm_delay", "serendipity"]) {
      expect(GENERIC_EVENTS.find((e) => e.id === id)).toBeDefined();
    }
  });

  test("cooperative events declare valid modes", () => {
    for (const e of ALL_POOLED_EVENTS) {
      if (e.cooperative) {
        expect(["proposal", "vote"]).toContain(e.cooperative);
        expect(e.roles).toBeDefined();
      }
    }
  });

  test("mission events have unique ids per mission and valid stages", () => {
    for (const m of MISSIONS) {
      const ids = m.events.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const e of m.events) {
        expect(e.stage).toBeGreaterThanOrEqual(1);
        expect(e.stage).toBeLessThanOrEqual(8);
      }
    }
  });
});
