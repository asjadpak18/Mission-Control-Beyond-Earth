/**
 * ============================================================================
 * MISSION READINESS VALIDATION — owned by the Game Systems developer (AI 2)
 * ============================================================================
 * Deterministic validation of a spacecraft configuration against a mission.
 * Launch is blocked whenever any check with severity "error" fails.
 * Warnings never block launch but always explain themselves.
 * ============================================================================
 */

import { Mission, SpacecraftConfig, ValidationCheck, ValidationResult, ResourceSummary } from "./types";
import { computeResources, computeReliability, installedQuantity } from "./calculations";
import { getEquipment } from "./equipment";

function check(
  id: string,
  label: string,
  passed: boolean,
  message: string,
  severity: "error" | "warning",
  hint?: string
): ValidationCheck {
  return { id, label, passed, message, severity, hint };
}

export function validateSpacecraft(mission: Mission, config: SpacecraftConfig): ValidationResult {
  const r: ResourceSummary = computeResources(mission, config);
  const checks: ValidationCheck[] = [];

  // --- 1. Spacecraft must exist ------------------------------------------
  const unitCount = config.components.reduce((sum, c) => sum + c.quantity, 0);
  checks.push(
    check(
      "components",
      "Spacecraft assembled",
      unitCount > 0,
      unitCount > 0
        ? `${unitCount} component${unitCount === 1 ? "" : "s"} installed.`
        : "No equipment installed yet — open the designer and build your spacecraft.",
      "error",
      "A spacecraft needs at least one component before it can fly."
    )
  );

  // --- 2. Budget -----------------------------------------------------------
  checks.push(
    check(
      "budget",
      "Budget",
      r.totalCost <= mission.budget,
      r.totalCost <= mission.budget
        ? `Spacecraft costs $${(r.totalCost / 1_000_000).toFixed(2)}M of the $${(mission.budget / 1_000_000).toFixed(0)}M budget ($${((r.budgetRemaining) / 1_000_000).toFixed(2)}M remaining).`
        : `Over budget by $${((-r.budgetRemaining) / 1_000_000).toFixed(2)}M. Cost is $${(r.totalCost / 1_000_000).toFixed(2)}M but the budget is $${(mission.budget / 1_000_000).toFixed(0)}M.`,
      "error",
      "Remove expensive components or choose lighter alternatives to bring the cost down."
    )
  );

  // --- 3. Mass -------------------------------------------------------------
  checks.push(
    check(
      "mass",
      "Mass limit",
      r.totalMass <= mission.maxMass,
      r.totalMass <= mission.maxMass
        ? `Mass is ${r.totalMass.toLocaleString()} kg of a ${mission.maxMass.toLocaleString()} kg limit (${r.massRemaining.toLocaleString()} kg remaining).`
        : `Over mass by ${(-r.massRemaining).toLocaleString()} kg. The launch vehicle can lift at most ${mission.maxMass.toLocaleString()} kg.`,
      "error",
      "Every kilogram counts: swap heavy components for lighter ones, or remove equipment you may not need."
    )
  );

  // --- 4. Fuel -------------------------------------------------------------
  checks.push(
    check(
      "fuel",
      "Propellant",
      r.fuelCapacity >= r.fuelRequired,
      r.fuelCapacity >= r.fuelRequired
        ? `${r.fuelCapacity.toLocaleString()} kg of propellant aboard; the mission profile needs ${r.fuelRequired.toLocaleString()} kg.`
        : `Not enough propellant: tanks hold ${r.fuelCapacity.toLocaleString()} kg but this engine configuration needs ${r.fuelRequired.toLocaleString()} kg.`,
      "error",
      "Add fuel tanks — or switch to efficient ion engines, which need far less propellant for the same journey."
    )
  );

  // --- 5. Power ------------------------------------------------------------
  const powerOk = r.powerGeneratedEffective >= mission.minPower && r.powerBalance >= 0;
  let powerMessage: string;
  if (r.powerGeneratedEffective < mission.minPower) {
    powerMessage = `Power generation is only ${r.powerGeneratedEffective} W at ${mission.destination} — this mission needs at least ${mission.minPower} W.`;
    if (mission.solarDerate < 0.5) {
      powerMessage += ` Sunlight out there is weak: solar arrays deliver only ${Math.round(mission.solarDerate * 100)}% of their rating.`;
    }
  } else if (r.powerBalance < 0) {
    powerMessage = `The spacecraft consumes ${-r.powerBalance} W more than it generates (${r.powerGeneratedEffective} W available). Systems will brown out mid-flight.`;
  } else {
    powerMessage = `Generating ${r.powerGeneratedEffective} W at the destination, consuming ${r.powerConsumed} W — a healthy ${r.powerBalance} W margin.`;
  }
  checks.push(
    check(
      "power",
      "Electrical power",
      powerOk,
      powerMessage,
      "error",
      "Add solar arrays or an RTG, or reduce power-hungry components like the spectrometer and deep-space antenna."
    )
  );

  // --- 6. Propulsion -------------------------------------------------------
  checks.push(
    check(
      "propulsion",
      "Propulsion",
      r.propulsion >= mission.minPropulsion,
      r.propulsion >= mission.minPropulsion
        ? `${r.propulsion} thrust points available; the mission requires ${mission.minPropulsion}.`
        : `Only ${r.propulsion} thrust points installed — this mission needs at least ${mission.minPropulsion}.`,
      "error",
      "Install a main engine (chemical for thrust, ion for efficiency)."
    )
  );

  // --- 7. Required equipment ----------------------------------------------
  const missing = mission.requiredEquipment.filter((id) => installedQuantity(config, id) === 0);
  const requiredNames = mission.requiredEquipment.map((id) => getEquipment(id)?.name ?? id);
  checks.push(
    check(
      "equipment",
      "Required equipment",
      missing.length === 0,
      missing.length === 0
        ? `All required equipment installed (${requiredNames.join(", ")}).`
        : `Missing: ${missing.map((id) => getEquipment(id)?.name ?? id).join(", ")}.`,
      "error",
      "This equipment is mandatory for the mission's success criteria."
    )
  );

  // --- 8. Landing capability (mission-specific) -----------------------------
  if (mission.minLanding > 0) {
    checks.push(
      check(
        "landing",
        "Landing capability",
        r.landingAssist >= mission.minLanding,
        r.landingAssist >= mission.minLanding
          ? `Landing capability ${r.landingAssist} of ${mission.minLanding} required.`
          : `Landing capability is only ${r.landingAssist} — this surface mission needs at least ${mission.minLanding}.`,
        "error",
        "Combine landing legs with a powered descent module for a survivable touchdown."
      )
    );
  }

  // --- 9. Thermal protection (mission-specific) -----------------------------
  if (mission.minThermal > 0) {
    checks.push(
      check(
        "thermal",
        "Thermal protection",
        r.thermalProtection >= mission.minThermal,
        r.thermalProtection >= mission.minThermal
          ? `Thermal protection ${r.thermalProtection}% of ${mission.minThermal}% required for entry.`
          : `Thermal protection is ${r.thermalProtection}% — atmospheric entry needs at least ${mission.minThermal}%.`,
        "error",
        "An ablative heat shield is the only system that survives atmospheric entry."
      )
    );
  }

  // --- 10. Radiation shielding (mission-specific) ---------------------------
  if (mission.minRadiation > 0) {
    checks.push(
      check(
        "radiation",
        "Radiation shielding",
        r.radiationShielding >= mission.minRadiation,
        r.radiationShielding >= mission.minRadiation
          ? `Radiation shielding ${r.radiationShielding}% of ${mission.minRadiation}% required.`
          : `Radiation shielding is ${r.radiationShielding}% — this environment demands at least ${mission.minRadiation}%.`,
        "error",
        "Stack radiation shielding: protection adds up, and this mission crosses intense radiation belts."
      )
    );
  }

  // --- 11. Navigation (mission-specific) ------------------------------------
  if (mission.minNavigation > 0) {
    checks.push(
      check(
        "navigation",
        "Navigation accuracy",
        r.navigation >= mission.minNavigation,
        r.navigation >= mission.minNavigation
          ? `Navigation accuracy ${r.navigation} of ${mission.minNavigation} required.`
          : `Navigation accuracy is ${r.navigation} — this trajectory needs at least ${mission.minNavigation}.`,
        "error",
        "Install a navigation computer and a star tracker for precise deep-space manoeuvres."
      )
    );
  }

  // --- 12. Redundant communications (v2.0 constraint) ------------------------
  if (mission.requireRedundantComms) {
    const commUnits = config.components
      .filter((c) => getEquipment(c.equipmentId)?.category === "Communication")
      .reduce((s, c) => s + c.quantity, 0);
    checks.push(
      check(
        "redundant_comms",
        "Redundant communications",
        commUnits >= 2,
        commUnits >= 2
          ? `${commUnits} communication units installed — flight rule satisfied.`
          : `Only ${commUnits} communication unit${commUnits === 1 ? "" : "s"} installed — this attempt's flight rules require at least two independent systems.`,
        "error",
        "Add a low-gain antenna as a cheap second system, or double up on your main dish type."
      )
    );
  }

  // --- 13. Restricted equipment (v2.0 constraint) -----------------------------
  const bannedInstalled = config.components.filter(
    (c) => mission.bannedEquipmentIds?.includes(c.equipmentId) && c.quantity > 0
  );
  if ((mission.bannedEquipmentIds?.length ?? 0) > 0) {
    checks.push(
      check(
        "restricted_equipment",
        "Equipment availability",
        bannedInstalled.length === 0,
        bannedInstalled.length === 0
          ? "No restricted equipment in the design."
          : `Unavailable for this attempt: ${bannedInstalled.map((c) => getEquipment(c.equipmentId)?.name ?? c.equipmentId).join(", ")}.`,
        "error",
        "This attempt's constraints make some equipment unavailable — redesign around alternatives."
      )
    );
  }

  // ------------------------------------------------------------------
  // Warnings (never block launch, always explain)
  // ------------------------------------------------------------------
  const warnings: ValidationCheck[] = [];

  const fuelMargin = r.fuelRequired > 0 ? (r.fuelCapacity - r.fuelRequired) / r.fuelRequired : 0;
  if (r.fuelRequired > 0 && fuelMargin < 0.15) {
    warnings.push(
      check(
        "fuel_margin",
        "Thin propellant margin",
        false,
        `Only ${Math.round(fuelMargin * 100)}% more propellant than the mission profile requires.`,
        "warning",
        "Course corrections and emergencies consume extra fuel. A 15-25% reserve is good practice."
      )
    );
  }

  const powerMarginPct = r.powerGeneratedEffective > 0 ? r.powerBalance / r.powerGeneratedEffective : 0;
  if (powerOk && r.powerBalance >= 0 && powerMarginPct < 0.2) {
    warnings.push(
      check(
        "power_margin",
        "Thin power margin",
        false,
        `Only a ${r.powerBalance} W power margin (${Math.round(powerMarginPct * 100)}% of generation).`,
        "warning",
        "Unexpected power demands are the most common in-flight emergency. More generation or fewer consumers buys safety."
      )
    );
  }

  const reliability = computeReliability(config.components);
  if (unitCount > 0 && reliability < 85) {
    warnings.push(
      check(
        "reliability",
        "Low reliability",
        false,
        `Predicted reliability is ${reliability}% — below the 85% comfort zone.`,
        "warning",
        "Duplicate critical systems (a second engine or antenna) and simpler components raise reliability."
      )
    );
  }

  const engineCount = config.components
    .filter((c) => getEquipment(c.equipmentId)?.category === "Propulsion")
    .reduce((s, c) => s + c.quantity, 0);
  if (engineCount === 1) {
    warnings.push(
      check(
        "redundancy",
        "No engine redundancy",
        false,
        "Only one engine installed — a single failure would end the mission.",
        "warning",
        "Real missions weigh the cost of a second engine against the risk of losing the spacecraft."
      )
    );
  }

  if (unitCount > 0 && r.powerStorage === 0 && mission.minPower > 0) {
    warnings.push(
      check(
        "battery",
        "No battery buffer",
        false,
        "No batteries installed — eclipses and power spikes have no buffer.",
        "warning",
        "Batteries keep the spacecraft alive when generation dips (eclipses, storms, attitude changes)."
      )
    );
  }

  if (r.totalCost > mission.budget * 0.9) {
    warnings.push(
      check(
        "budget_margin",
        "Budget nearly exhausted",
        false,
        `The spacecraft consumes ${Math.round((r.totalCost / mission.budget) * 100)}% of the budget.`,
        "warning",
        "Holding a little budget in reserve keeps options open during the mission."
      )
    );
  }

  const scienceGoal = mission.objectives
    .filter((o): o is (typeof mission.objectives)[number] & { target: { kind: "scienceData"; minimum: number } } => o.target.kind === "scienceData")
    .reduce((max, o) => Math.max(max, o.target.minimum), 0);
  if (scienceGoal > 0 && r.scienceCapability < scienceGoal) {
    warnings.push(
      check(
        "science_capability",
        "Weak science suite",
        false,
        `Science capability ${r.scienceCapability} may not reach the ${scienceGoal}-point data goal of this mission.`,
        "warning",
        "Stronger instruments (spectrometer) collect more data per observation window."
      )
    );
  }

  const errors = checks.filter((c) => !c.passed);
  return {
    ready: errors.length === 0 && unitCount > 0,
    checks,
    warnings,
    errors,
  };
}
