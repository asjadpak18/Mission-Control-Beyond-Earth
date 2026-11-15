/**
 * ============================================================================
 * RESOURCE CALCULATIONS — owned by the Game Systems developer (AI 2)
 * ============================================================================
 * Pure, deterministic functions. No randomness, no I/O, no side effects.
 * Identical inputs always produce identical outputs (verified by tests).
 *
 * Core formulas:
 *   totalCost       = Σ (component cost × quantity)
 *   totalMass       = Σ (component mass × quantity)
 *   powerGenerated  = Σ (powerGeneration × quantity), solar derated at target
 *   powerConsumed   = Σ (powerConsumption × quantity)
 *   powerBalance    = effective generation − consumption
 *   fuelCapacity    = Σ (fuelCapacity × quantity)
 *   fuelRequired    = max(mission.minFuel, Σ (propulsion × fuelConsumption × qty))
 *   massRemaining   = maxMass − totalMass
 *   budgetRemaining = budget − totalCost
 * ============================================================================
 */

import { Mission, ResourceSummary, SpacecraftConfig, ComponentSelection, Equipment } from "./types";
import { EQUIPMENT_BY_ID, getEquipment } from "./equipment";

/** Cap for stacked protection values (percent). */
const PROTECTION_CAP = 100;

export function isValidConfig(config: SpacecraftConfig): boolean {
  return (
    Array.isArray(config.components) &&
    config.components.every(
      (c) => c && typeof c.equipmentId === "string" && Number.isInteger(c.quantity) && c.quantity > 0 && !!EQUIPMENT_BY_ID[c.equipmentId]
    )
  );
}

/** Quantity-weighted average reliability plus redundancy bonuses. */
export function computeReliability(components: ComponentSelection[]): number {
  let totalUnits = 0;
  let weighted = 0;
  const categoryUnits: Record<string, number> = {};
  let hasBattery = false;

  for (const c of components) {
    const eq = getEquipment(c.equipmentId);
    if (!eq) continue;
    totalUnits += c.quantity;
    weighted += eq.reliability * c.quantity;
    categoryUnits[eq.category] = (categoryUnits[eq.category] ?? 0) + c.quantity;
    if (eq.powerStorage > 0) hasBattery = true;
  }
  if (totalUnits === 0) return 0;

  let reliability = weighted / totalUnits;

  // Redundancy bonuses — duplicate critical systems increase effective reliability.
  if ((categoryUnits["Propulsion"] ?? 0) >= 2) reliability += 3;
  if ((categoryUnits["Communication"] ?? 0) >= 2) reliability += 2;
  if (hasBattery) reliability += 1;

  return Math.min(99, Math.round(reliability * 10) / 10);
}

/** Count of installed units for one equipment id. */
export function installedQuantity(config: SpacecraftConfig, equipmentId: string): number {
  const entry = config.components.find((c) => c.equipmentId === equipmentId);
  return entry ? entry.quantity : 0;
}

export function computeResources(mission: Mission, config: SpacecraftConfig): ResourceSummary {
  let totalCost = 0;
  let totalMass = 0;
  let powerGenerated = 0;
  let powerGeneratedEffective = 0;
  let powerConsumed = 0;
  let powerStorage = 0;
  let fuelCapacity = 0;
  let engineFuelBurn = 0;
  let propulsion = 0;
  let scienceCapability = 0;
  let commCapability = 0;
  let navigation = 0;
  let radiationShielding = 0;
  let thermalProtection = 0;
  let landingAssist = 0;
  let structural = 0;

  for (const c of config.components) {
    const eq: Equipment | undefined = EQUIPMENT_BY_ID[c.equipmentId];
    if (!eq || c.quantity <= 0) continue;
    const q = c.quantity;

    totalCost += eq.cost * q;
    totalMass += eq.mass * q;
    powerGenerated += eq.powerGeneration * q;
    powerGeneratedEffective +=
      (eq.isSolar ? eq.powerGeneration * mission.solarDerate : eq.powerGeneration) * q;
    powerConsumed += eq.powerConsumption * q;
    powerStorage += eq.powerStorage * q;
    fuelCapacity += eq.fuelCapacity * q;
    engineFuelBurn += eq.propulsion * eq.fuelConsumption * q;
    propulsion += eq.propulsion * q;
    scienceCapability += eq.scienceOutput * q;
    commCapability += eq.commCapability * q;
    navigation += eq.navigation * q;
    radiationShielding += eq.radiationShielding * q;
    thermalProtection += eq.thermalProtection * q;
    landingAssist += eq.landingAssist * q;
    structural += eq.structural * q;
  }

  const powerBalance = powerGeneratedEffective - powerConsumed;
  const fuelRequired = Math.max(mission.minFuel, Math.round(engineFuelBurn));

  return {
    totalCost,
    totalMass,
    powerGenerated,
    powerGeneratedEffective: Math.round(powerGeneratedEffective),
    powerConsumed,
    powerBalance: Math.round(powerBalance),
    powerStorage,
    fuelCapacity,
    fuelRequired,
    propulsion,
    scienceCapability,
    commCapability,
    navigation,
    radiationShielding: Math.min(PROTECTION_CAP, radiationShielding),
    thermalProtection: Math.min(PROTECTION_CAP, thermalProtection),
    landingAssist,
    structural,
    reliability: computeReliability(config.components),
    massRemaining: mission.maxMass - totalMass,
    budgetRemaining: mission.budget - totalCost,
  };
}

// ---------------------------------------------------------------------------
// Configuration manipulation (pure helpers used by the store / UI)
// ---------------------------------------------------------------------------

export function withQuantity(config: SpacecraftConfig, equipmentId: string, quantity: number): SpacecraftConfig {
  const clamped = Math.max(0, Math.min(9, Math.floor(quantity)));
  const others = config.components.filter((c) => c.equipmentId !== equipmentId);
  if (clamped === 0) return { ...config, components: others };
  return { ...config, components: [...others, { equipmentId, quantity: clamped }] };
}

export function addComponent(config: SpacecraftConfig, equipmentId: string, delta = 1): SpacecraftConfig {
  const current = installedQuantity(config, equipmentId);
  return withQuantity(config, equipmentId, current + delta);
}

export function emptyConfig(missionId: string): SpacecraftConfig {
  return { missionId, components: [] };
}

/** Human-friendly formatters (shared so the UI never invents its own units). */

export function formatMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}

export function formatMass(value: number): string {
  return `${value.toLocaleString("en-US")} kg`;
}

export function formatPower(value: number): string {
  return `${value.toLocaleString("en-US")} W`;
}
