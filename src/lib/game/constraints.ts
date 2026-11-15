/**
 * ============================================================================
 * DIFFICULTY SETTINGS & RANDOM MISSION CONSTRAINTS — v2.0 game systems
 * ============================================================================
 * Pure, deterministic transformations of Mission objects.
 *
 * A "difficulty setting" (Beginner … Custom Challenge) applies baseline
 * multipliers and, at higher settings, a deterministic number of randomly
 * rolled constraints drawn from the pool below. Players can also hand-pick
 * constraints in Custom Challenge mode.
 *
 * The returned Mission feeds straight into the EXISTING calculation and
 * validation modules — constraints affect real numbers, never descriptions.
 *
 * Randomness rule: any random pick uses the seeded PRNG with `constraintSeed`,
 * so the same seed always produces the same constraint set (verifiable in
 * tests), while a different seed produces a different valid experience.
 * ============================================================================
 */

import { Mission, MissionConstraint, DifficultySetting } from "./types";
import { nextRandom } from "./rng";

// ---------------------------------------------------------------------------
// Constraint pool
// ---------------------------------------------------------------------------

export const CONSTRAINT_POOL: MissionConstraint[] = [
  {
    id: "reduced_budget",
    name: "Reduced Mission Budget",
    description: "Congress trimmed the programme: the budget is cut by 20%.",
    educationalNote:
      "Real missions are descoped late in development all the time — tighter money forces sharper engineering.",
    effects: { budgetMultiplier: 0.8 },
  },
  {
    id: "strict_mass_limit",
    name: "Strict Launch Mass Limit",
    description: "Only a smaller launch vehicle slot is available: the mass limit drops by 15%.",
    educationalNote:
      "Rideshare missions must fit whatever mass allocation the rocket can spare — mass discipline becomes the whole design.",
    effects: { massMultiplier: 0.85 },
  },
  {
    id: "limited_fuel_capacity",
    name: "Limited Propellant Manifest",
    description: "Hazardous-propellant loading rules tighten: propellant requirements rise by 20%.",
    educationalNote:
      "Fuelling a spacecraft is a carefully choreographed, risky operation — safety rules can shrink how much propellant you may load.",
    effects: { minFuelMultiplier: 1.2 },
  },
  {
    id: "reduced_power_availability",
    name: "Power-Generation Degradation",
    description: "A solar-cell shortage means weaker arrays: solar output at destination falls by 25%.",
    educationalNote:
      "Supply-chain problems have delayed real missions: Pereverance's pixel supply shaped what its cameras could do.",
    effects: { solarDerateMultiplier: 0.75 },
  },
  {
    id: "mandatory_redundant_comms",
    name: "Mandatory Redundant Communications",
    description: "Mission rules now require two independent communication systems.",
    educationalNote:
      "Flight rules often demand redundancy on any single-point-of-failure system — losing comm means losing the mission.",
    effects: { requireRedundantComms: true },
  },
  {
    id: "increased_radiation",
    name: "Increased Radiation Environment",
    description: "Solar maximum is forecast: the radiation shielding requirement rises by 15 points.",
    educationalNote:
      "The Sun follows an 11-year cycle; missions launched near solar maximum take a bigger radiation beating.",
    effects: { minRadiationBonus: 15 },
  },
  {
    id: "restricted_equipment",
    name: "Restricted Equipment Availability",
    description: "Supply chain issues: no RTGs and no nuclear thermal engines can be delivered in time.",
    educationalNote:
      "Plutonium-238 for RTGs is scarce — flagship missions queue for years for their power sources.",
    effects: { bannedEquipmentIds: ["rtg", "rtg_advanced", "nuclear_engine"] },
  },
  {
    id: "additional_objectives",
    name: "Additional Scientific Objectives",
    description: "The science community added demands: every science-data goal requires 8 more points.",
    educationalNote:
      "Science teams always want one more measurement — each addition costs power, mass and money somewhere else.",
    effects: { scienceGoalBonus: 8 },
  },
  {
    id: "operational_complications",
    name: "Operational Complications",
    description: "A busy operations schedule means more in-flight anomalies: event probability rises 35%.",
    educationalNote:
      "Crowded mission calendars and shared ground stations leave less slack for careful, slow operations.",
    effects: { eventRateMultiplier: 1.35 },
  },
  {
    id: "lean_programme",
    name: "Lean Programme Funding",
    description: "A cost-capped programme: budget −10% and the mass limit −10%.",
    educationalNote:
      "Discovery-class missions fly under strict cost caps — creativity under constraint is the whole game.",
    effects: { budgetMultiplier: 0.9, massMultiplier: 0.9 },
  },
  {
    id: "aggressive_schedule",
    name: "Aggressive Launch Schedule",
    description: "The launch window is tight: fuel requirements +15% (faster transfer) and events +20%.",
    educationalNote:
      "Fast transfers burn more propellant. Real missions often trade time for fuel — or the reverse.",
    effects: { minFuelMultiplier: 1.15, eventRateMultiplier: 1.2 },
  },
  {
    id: "hardened_baseline",
    name: "Hardened Baseline Required",
    description: "Lessons from a failed predecessor: +10 points of radiation shielding required.",
    educationalNote:
      "Every failure board makes the next spacecraft heavier — robustness is bought in kilograms.",
    effects: { minRadiationBonus: 10 },
  },
];

export const CONSTRAINTS_BY_ID: Record<string, MissionConstraint> = Object.fromEntries(
  CONSTRAINT_POOL.map((c) => [c.id, c])
);

export function getConstraint(id: string): MissionConstraint | undefined {
  return CONSTRAINTS_BY_ID[id];
}

// ---------------------------------------------------------------------------
// Difficulty presets
// ---------------------------------------------------------------------------

interface DifficultyPreset {
  budgetMultiplier: number;
  massMultiplier: number;
  eventRateMultiplier: number;
  /** Number of constraints rolled deterministically from the pool. */
  rolledConstraints: number;
}

const DIFFICULTY_PRESETS: Record<DifficultySetting, DifficultyPreset> = {
  Beginner: { budgetMultiplier: 1.15, massMultiplier: 1.0, eventRateMultiplier: 0.6, rolledConstraints: 0 },
  Intermediate: { budgetMultiplier: 1.0, massMultiplier: 1.0, eventRateMultiplier: 1.0, rolledConstraints: 0 },
  Advanced: { budgetMultiplier: 0.9, massMultiplier: 1.0, eventRateMultiplier: 1.2, rolledConstraints: 1 },
  Expert: { budgetMultiplier: 0.82, massMultiplier: 0.9, eventRateMultiplier: 1.35, rolledConstraints: 2 },
  "Custom Challenge": { budgetMultiplier: 1.0, massMultiplier: 1.0, eventRateMultiplier: 1.2, rolledConstraints: 0 },
};

export const DIFFICULTY_SETTINGS: DifficultySetting[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
  "Custom Challenge",
];

export interface EffectiveMissionResult {
  mission: Mission;
  applied: MissionConstraint[];
}

/** Deterministically roll `count` distinct constraints from the pool. */
export function rollConstraints(seed: number, count: number): MissionConstraint[] {
  const picked: MissionConstraint[] = [];
  let state = seed;
  const available = [...CONSTRAINT_POOL];
  while (picked.length < count && available.length > 0) {
    const draw = nextRandom(state);
    state = draw.next;
    const index = Math.floor(draw.value * available.length);
    picked.push(available.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * Apply a difficulty setting (plus optional player-picked constraints for
 * Custom Challenge) to a mission. Pure: the input mission is never mutated.
 */
export function applyDifficulty(
  mission: Mission,
  setting: DifficultySetting,
  customConstraintIds: string[] = [],
  constraintSeed = 0
): EffectiveMissionResult {
  const preset = DIFFICULTY_PRESETS[setting];

  const rolled = rollConstraints(constraintSeed, preset.rolledConstraints);
  const custom = customConstraintIds
    .map((id) => CONSTRAINTS_BY_ID[id])
    .filter((c): c is MissionConstraint => !!c && !rolled.some((r) => r.id === c.id));
  const applied = [...rolled, ...custom];

  let budget = mission.budget * preset.budgetMultiplier;
  let maxMass = mission.maxMass * preset.massMultiplier;
  let minFuel = mission.minFuel;
  let solarDerate = mission.solarDerate;
  let minRadiation = mission.minRadiation;
  let eventRate = preset.eventRateMultiplier;
  let requireRedundantComms = false;
  const banned = new Set<string>();
  let scienceGoalBonus = 0;

  for (const c of applied) {
    const e = c.effects;
    if (e.budgetMultiplier) budget *= e.budgetMultiplier;
    if (e.massMultiplier) maxMass *= e.massMultiplier;
    if (e.minFuelMultiplier) minFuel *= e.minFuelMultiplier;
    if (e.solarDerateMultiplier) solarDerate *= e.solarDerateMultiplier;
    if (e.minRadiationBonus) minRadiation += e.minRadiationBonus;
    if (e.eventRateMultiplier) eventRate *= e.eventRateMultiplier;
    if (e.requireRedundantComms) requireRedundantComms = true;
    if (e.bannedEquipmentIds) e.bannedEquipmentIds.forEach((id) => banned.add(id));
    if (e.scienceGoalBonus) scienceGoalBonus += e.scienceGoalBonus;
  }

  const objectives = mission.objectives.map((o) =>
    o.target.kind === "scienceData" && scienceGoalBonus > 0
      ? { ...o, target: { ...o.target, minimum: Math.min(100, o.target.minimum + scienceGoalBonus) } }
      : o
  );

  const effective: Mission = {
    ...mission,
    budget: Math.round(budget),
    maxMass: Math.round(maxMass),
    minFuel: Math.round(minFuel),
    solarDerate: Math.max(0.01, Math.min(3, solarDerate)),
    minRadiation: Math.round(Math.min(100, minRadiation)),
    objectives,
    eventRate: Math.max(0.2, Math.min(2, eventRate)),
    requireRedundantComms,
    bannedEquipmentIds: banned.size > 0 ? [...banned] : undefined,
    appliedConstraintIds: applied.map((c) => c.id),
  };

  return { mission: effective, applied };
}
