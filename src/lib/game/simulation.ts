/**
 * ============================================================================
 * SIMULATION ENGINE — owned by the Simulation developer (AI 3)
 * ============================================================================
 * Turns a validated spacecraft into an interactive 8-stage mission:
 *   1 Rocket launch → 2 Separation → 3 Journey → 4 Navigation adjustments
 *   → 5 Arrival → 6 Science → 7 Communication → 8 Final evaluation.
 *
 * Design rules:
 * - Pure functions: (state, mission, config) → new state. No hidden globals.
 * - All randomness flows through the seeded PRNG in SimulationState.rngState.
 * - Outcomes depend on the spacecraft's engineering margins, not on luck alone.
 * - A failed mission still produces a full, useful report.
 *
 * Scoring (exactly 1,000 points):
 *   Primary objectives 400 + Secondary objectives 150 + Engineering 200
 *   + Resource efficiency 150 + Decision-making 100.
 * ============================================================================
 */

import {
  Mission,
  SpacecraftConfig,
  SimulationState,
  SimulationResult,
  StageRecord,
  ObjectiveResult,
  MissionReport,
  EventChoice,
} from "./types";
import { computeResources, computeReliability, installedQuantity } from "./calculations";
import { nextRandom } from "./rng";
import { GENERIC_EVENTS, ROLE_EVENTS, ALL_POOLED_EVENTS } from "./events";

// ---------------------------------------------------------------------------
// Stage definitions
// ---------------------------------------------------------------------------

export interface StageDef {
  stage: number;
  title: string;
  short: string;
  description: string;
  educational: string;
}

export const STAGE_DEFS: StageDef[] = [
  {
    stage: 1,
    title: "Rocket Launch",
    short: "LAUNCH",
    description: "The launch vehicle climbs through the atmosphere carrying your spacecraft.",
    educational:
      "Rockets must fight both gravity and air resistance. A heavier spacecraft makes every second of the ascent harder.",
  },
  {
    stage: 2,
    title: "Spacecraft Separation",
    short: "SEPARATION",
    description: "The upper stage releases the spacecraft and it deploys its first systems in vacuum.",
    educational:
      "Deployment mechanisms — antennas, panels, booms — are single points of failure; they must work perfectly, once.",
  },
  {
    stage: 3,
    title: "Journey Through Space",
    short: "CRUISE",
    description: "Months of coasting through interplanetary space toward the target.",
    educational:
      "During cruise the spacecraft faces radiation, temperature swings and dust — reliability is what keeps it alive.",
  },
  {
    stage: 4,
    title: "Navigation Adjustments",
    short: "NAVIGATION",
    description: "Tiny course corrections steer the spacecraft onto a precise arrival corridor.",
    educational:
      "A few metres per second of correction, applied early, saves tonnes of propellant later. Navigation is leverage.",
  },
  {
    stage: 5,
    title: "Destination Arrival",
    short: "ARRIVAL",
    description: "The critical moment: orbit insertion, atmospheric entry or flyby — depending on the mission.",
    educational:
      "Arrival is the point of no return. Everything spent on fuel, shielding and landing gear pays off — or doesn't — now.",
  },
  {
    stage: 6,
    title: "Scientific Data Collection",
    short: "SCIENCE",
    description: "The science campaign begins: instruments observe, sample and measure.",
    educational:
      "Science return scales with instrument capability — but instruments drink power, and power is mass is fuel.",
  },
  {
    stage: 7,
    title: "Communication with Earth",
    short: "DOWNLINK",
    description: "Antennas beam the data home across hundreds of millions of kilometres.",
    educational:
      "Data only counts once it reaches Earth. A stronger antenna returns more of what your instruments collected.",
  },
  {
    stage: 8,
    title: "Final Mission Evaluation",
    short: "EVALUATION",
    description: "Mission control reviews the telemetry and closes out the flight.",
    educational:
      "Real missions end with a review: what worked, what failed, and what the next spacecraft should do differently.",
  },
];

/** Fraction of the mission's propellant budget burned in each stage. */
const FUEL_SCHEDULE = [0.3, 0.05, 0.23, 0.1, 0.3, 0.02, 0, 0];

/** Base probability that an eligible event fires in a stage (v2.0: scaled by mission.eventRate). */
const BASE_EVENT_CHANCE = 0.65;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function pushLog(state: SimulationState, line: string): string[] {
  const next = [...state.log, line];
  return next.slice(-60);
}

function failStage(state: SimulationState, mission: Mission, reason: string): SimulationState {
  const stageNum = state.stageIndex + 1;
  const def = STAGE_DEFS[state.stageIndex];
  const record: StageRecord = {
    stage: stageNum,
    title: def.title,
    status: "failed",
    log: pushLog(state, `FATAL — ${reason}`),
    fuelUsed: 0,
    scienceGained: 0,
    dataGained: 0,
  };
  const remaining: StageRecord[] = STAGE_DEFS.slice(stageNum).map((d) => ({
    stage: d.stage,
    title: d.title,
    status: "skipped" as const,
    log: [],
    fuelUsed: 0,
    scienceGained: 0,
    dataGained: 0,
  }));
  return {
    ...state,
    status: "failure",
    stagePhase: "complete",
    failureReason: reason,
    stageLog: [...state.stageLog, record, ...remaining],
    log: pushLog({ ...state, log: record.log }, `Mission failed during ${def.title}: ${reason}`),
    pendingEvent: null,
  };
}

/** Effective power metrics including stress accumulated from decisions. */
function powerMetrics(mission: Mission, config: SpacecraftConfig, stress: number) {
  const r = computeResources(mission, config);
  const margin = r.powerGeneratedEffective - r.powerConsumed - stress;
  return { summary: r, margin };
}

export function createSimulation(mission: Mission, config: SpacecraftConfig, seed: number): SimulationState {
  const r = computeResources(mission, config);
  return {
    missionId: mission.id,
    seed,
    rngState: seed,
    stageIndex: 0,
    stagePhase: "pending",
    status: "running",
    fuelRemaining: r.fuelCapacity,
    powerStress: 0,
    scienceData: 0,
    dataTransmitted: 0,
    reliability: r.reliability,
    landingQuality: null,
    stageLog: [],
    eventLog: [],
    decisions: [],
    pendingEvent: null,
    failureReason: null,
    log: [`Mission ${mission.name} initialised. Seed ${seed}.`, `Propellant loaded: ${r.fuelCapacity} kg.`],
  };
}

/** Run the current stage. May pause with a pending event for the player. */
export function runStage(state: SimulationState, mission: Mission, config: SpacecraftConfig): SimulationState {
  if (state.stagePhase === "complete" || state.status === "failure") return state;

  const stageNum = state.stageIndex + 1;
  const def = STAGE_DEFS[state.stageIndex];
  const r = computeResources(mission, config);
  let s: SimulationState = { ...state };
  let draw = nextRandom(s.rngState);
  s.rngState = draw.next;

  // --- Propellant burn for this stage -----------------------------------
  let burn = Math.round(r.fuelRequired * FUEL_SCHEDULE[s.stageIndex]);
  if (stageNum === 4) {
    // Navigation surplus makes corrections cheaper (precision = efficiency).
    const navSurplus = r.navigation - mission.minNavigation;
    const efficiency = Math.min(0.3, Math.max(0, navSurplus) / 400);
    burn = Math.round(burn * (1 - efficiency));
  }
  if (stageNum === 3 && r.propulsion > mission.minPropulsion * 1.5) {
    burn = Math.round(burn * 0.95); // generous thrust → shorter, cleaner transfers
  }

  if (burn > 0 && s.fuelRemaining < burn) {
    const needed = burn - s.fuelRemaining;
    return failStage(
      { ...s, fuelRemaining: Math.max(0, s.fuelRemaining) },
      mission,
      `The spacecraft ran out of propellant during ${def.title.toLowerCase()} — short by ${needed} kg.`
    );
  }

  // --- Risk assessment ----------------------------------------------------
  let risk = 0.012 + ((100 - s.reliability) / 100) * 0.25;

  switch (stageNum) {
    case 1:
      risk += (r.totalMass / mission.maxMass) * 0.03;
      break;
    case 2:
      risk += 0.005;
      break;
    case 3:
      if (mission.minRadiation > 0) {
        risk += (Math.max(0, mission.minRadiation - r.radiationShielding) / 100) * 0.3;
      }
      break;
    case 4: {
      const navSurplus = r.navigation - mission.minNavigation;
      risk -= Math.min(0.03, Math.max(0, navSurplus) / 400);
      break;
    }
    case 5:
      if (mission.type === "lander") {
        const surplus = r.landingAssist - mission.minLanding;
        risk += surplus >= 0 ? -Math.min(0.05, (surplus / 100) * 0.15) : Math.min(0.3, (-surplus / 60) * 0.3);
      } else if (mission.type === "probe") {
        risk += (Math.max(0, mission.minThermal - r.thermalProtection) / 100) * 0.5;
      } else {
        const propSurplus = r.propulsion - mission.minPropulsion;
        risk += propSurplus >= 0 ? -Math.min(0.04, (propSurplus / 100) * 0.04) : 0.2;
      }
      break;
    case 6:
    case 7:
      risk *= 0.5;
      break;
  }
  risk = Math.max(0.008, Math.min(0.5, risk));

  const stageFailed = draw.value < risk;
  // Only arrival (stage 5) and propellant exhaustion end a mission outright;
  // earlier anomalies degrade systems but the mission fights on.
  const catastrophic = stageNum === 5;

  if (stageFailed && catastrophic) {
    return failStage(
      { ...s, fuelRemaining: s.fuelRemaining - Math.min(s.fuelRemaining, burn) },
      mission,
      "Arrival failure — the spacecraft missed its critical manoeuvre and sailed past the target."
    );
  }

  // --- Stage effects -------------------------------------------------------
  s.fuelRemaining -= burn;

  let scienceGained = 0;
  let dataGained = 0;
  let degraded = stageFailed;
  const log: string[] = [];

  switch (stageNum) {
    case 1:
      log.push("Liftoff. The launch vehicle pitches downrange, engines at full thrust.");
      log.push(`Spacecraft mass ${r.totalMass} kg of ${mission.maxMass} kg capacity — ascent nominal.`);
      break;
    case 2:
      log.push("Separation confirmed. Solar arrays and antennas deploy on schedule.");
      log.push(`Power bus at ${r.powerGeneratedEffective} W effective at ${mission.destination}.`);
      break;
    case 3:
      scienceGained = Math.round(r.scienceCapability * 0.1);
      log.push(`Cruise phase. ${r.fuelRequired} kg mission propellant budget, ${s.fuelRemaining} kg remaining.`);
      log.push(`Cruise science (particles, fields): +${scienceGained} data points.`);
      break;
    case 4:
      log.push("Deep Space Network ranging fixes the trajectory to within metres.");
      log.push(`Correction burn of ${burn} kg executed cleanly.`);
      break;
    case 5: {
      if (mission.type === "lander") {
        let quality = 55 + Math.min(30, (r.landingAssist - mission.minLanding) * 1.2) + r.navigation * 0.15;
        quality += (s.reliability - 90) * 0.5;
        s.landingQuality = Math.max(0, Math.min(100, Math.round(quality)));
        log.push(`Entry, descent and landing complete. Touchdown quality ${s.landingQuality}/100.`);
      } else if (mission.type === "probe") {
        log.push(`Atmospheric entry survived. Heat shield performance ${r.thermalProtection}%.`);
      } else {
        log.push(
          mission.type === "flyby"
            ? `Flyby trajectory confirmed — ${mission.destination} arrival nominal.`
            : `Orbit insertion burn complete. ${mission.destination} orbit achieved.`
        );
      }
      scienceGained = Math.round(r.scienceCapability * 0.15);
      break;
    }
    case 6: {
      const stressPenalty = 1 - Math.min(0.4, s.powerStress / 300);
      scienceGained = Math.round(r.scienceCapability * 1.0 * stressPenalty * (degraded ? 0.6 : 1));
      s.scienceData = Math.min(100, s.scienceData + scienceGained);
      log.push(
        `Science campaign ${degraded ? "degraded" : "nominal"}: +${scienceGained} points (total ${s.scienceData}).`
      );
      if (s.powerStress > 0) log.push(`Sustained power stress of ${s.powerStress} W is eating into observations.`);
      break;
    }
    case 7: {
      const rate = r.commCapability / 70;
      dataGained = Math.round(s.scienceData * rate * (degraded ? 0.7 : 1));
      s.dataTransmitted = Math.max(0, s.dataTransmitted + dataGained);
      log.push(
        `Downlink at ${r.commCapability} comm capability — ${dataGained} points of data delivered to Earth.`
      );
      break;
    }
    case 8:
      log.push("Flight review in progress. Compiling mission report...");
      break;
  }

  if (stageNum !== 6) s.scienceData = Math.min(100, s.scienceData + scienceGained);
  if (stageFailed && !catastrophic) {
    s.reliability = Math.max(5, s.reliability - 8);
    log.push("Anomaly resolved in contingency mode — systems degraded but the mission continues.");
  }

  const record: StageRecord = {
    stage: stageNum,
    title: def.title,
    status: degraded ? "degraded" : "success",
    log,
    fuelUsed: burn,
    scienceGained,
    dataGained,
  };
  s.stageLog = [...s.stageLog, record];
  s.log = pushLog(s, `${def.short}: ${record.status.toUpperCase()} — ${burn} kg propellant, +${scienceGained} science.`);

  // --- Event check ---------------------------------------------------------
  const { margin } = powerMetrics(mission, config, s.powerStress);
  const fuelMarginRatio = r.fuelRequired > 0 ? s.fuelRemaining / r.fuelRequired : 1;
  const candidates = [...mission.events, ...GENERIC_EVENTS, ...ROLE_EVENTS].filter(
    (e) => e.stage === stageNum && s.eventLog.every((rec) => rec.eventId !== e.id)
  );
  const eventChance = Math.max(0.2, Math.min(0.95, BASE_EVENT_CHANCE * (mission.eventRate ?? 1)));
  for (const event of candidates) {
    let eligible = true;
    if (event.trigger?.metric === "powerMargin") eligible = margin < (event.trigger.below ?? Infinity);
    if (event.trigger?.metric === "fuelMargin") eligible = fuelMarginRatio < (event.trigger.below ?? Infinity);
    if (event.trigger?.metric === "reliability") eligible = s.reliability < (event.trigger.below ?? Infinity);
    if (event.trigger?.metric === "scienceCapability") eligible = r.scienceCapability >= (event.trigger.atLeast ?? 0);
    if (event.trigger?.metric === "radiation") eligible = mission.minRadiation > 0;
    if (!eligible) continue;

    const evtDraw = nextRandom(s.rngState);
    s.rngState = evtDraw.next;
    if (evtDraw.value < eventChance) {
      s.pendingEvent = { event, resolved: false };
      s.stagePhase = "awaiting_event";
      s.eventLog = [...s.eventLog, { eventId: event.id, title: event.title, stage: stageNum, resolved: false }];
      s.log = pushLog(s, `EVENT — ${event.title}`);
      return s;
    }
  }

  // No event: continue to next stage (or complete).
  if (stageNum >= 8) {
    s.stagePhase = "complete";
  } else {
    s.stageIndex = state.stageIndex + 1;
    s.stagePhase = "pending";
  }
  return s;
}

/** Resolve a pending event with the player's choice and resume the mission. */
export function resolveEvent(
  state: SimulationState,
  mission: Mission,
  config: SpacecraftConfig,
  choiceId: string
): SimulationState {
  if (!state.pendingEvent) return state;
  const event = state.pendingEvent.event;
  const choice: EventChoice | undefined = event.choices.find((c) => c.id === choiceId);
  if (!choice) return state;

  const r = computeResources(mission, config);
  let s: SimulationState = { ...state };
  const e = choice.effects;
  const outcomeParts: string[] = [];

  if (e.fuelDelta && e.fuelDelta > 0) {
    const burn = Math.min(s.fuelRemaining, e.fuelDelta);
    s.fuelRemaining -= burn;
    outcomeParts.push(`${burn} kg of propellant spent`);
  }
  if (e.powerStress) {
    s.powerStress += e.powerStress;
    outcomeParts.push(`${e.powerStress} W added to the sustained power load`);
  }
  if (typeof e.scienceDelta === "number") {
    s.scienceData = Math.max(0, Math.min(100, s.scienceData + e.scienceDelta));
    outcomeParts.push(`${e.scienceDelta > 0 ? "+" : ""}${e.scienceDelta} science points`);
  }
  if (typeof e.reliabilityDelta === "number") {
    s.reliability = Math.max(5, Math.min(99, s.reliability + e.reliabilityDelta));
    outcomeParts.push(`reliability now ${s.reliability}%`);
  }
  if (typeof e.landingQualityDelta === "number" && s.landingQuality !== null) {
    s.landingQuality = Math.max(0, Math.min(100, s.landingQuality + e.landingQualityDelta));
    outcomeParts.push(`landing quality now ${s.landingQuality}/100`);
  }

  // Risky choices: a battery buffer halves the danger of power-related risks.
  let risk = e.riskDelta ?? 0;
  if (risk > 0 && e.powerStress && r.powerStorage >= 400) {
    risk = risk / 2;
    outcomeParts.push("battery buffer absorbed much of the danger");
  }

  let outcome = outcomeParts.join(", ");
  if (risk > 0) {
    const draw = nextRandom(s.rngState);
    s.rngState = draw.next;
    if (draw.value < risk) {
      s.reliability = Math.max(5, s.reliability - 10);
      outcome += " — the gamble backfired and systems took damage";
    } else {
      outcome += " — the risk paid off without incident";
    }
  }

  s.decisions = [
    ...s.decisions,
    {
      eventId: event.id,
      eventTitle: event.title,
      choiceId: choice.id,
      choiceLabel: choice.label,
      stage: state.stageIndex + 1,
      outcome: outcome.length > 0 ? `${outcome}.` : "No measurable consequence.",
    },
  ];
  s.eventLog = s.eventLog.map((rec) => (rec.eventId === event.id ? { ...rec, resolved: true } : rec));
  s.pendingEvent = null;
  s.log = pushLog(s, `DECISION — ${choice.label}: ${outcome}.`);

  // Fuel exhausted as a consequence?
  if (s.fuelRemaining <= 0) {
    const stageNum = state.stageIndex + 1;
    if (stageNum < 5) {
      return failStage(s, mission, "Propellant exhausted before arrival — the spacecraft drifts silently past its target.");
    }
    s.log = pushLog(s, "Propellant tanks are dry. The mission coasts on stored momentum.");
  }

  if (state.stageIndex + 1 >= 8) {
    s.stagePhase = "complete";
  } else {
    s.stageIndex = state.stageIndex + 1;
    s.stagePhase = "pending";
  }
  return s;
}

// ---------------------------------------------------------------------------
// Scoring & finalisation
// ---------------------------------------------------------------------------

function evaluateObjectives(state: SimulationState, mission: Mission, config: SpacecraftConfig): ObjectiveResult[] {
  const r = computeResources(mission, config);
  return mission.objectives.map((o) => {
    const target = o.target;
    let completed = false;
    switch (target.kind) {
      case "stage": {
        const rec = state.stageLog.find((sr) => sr.stage === target.stage);
        completed = !!rec && (rec.status === "success" || rec.status === "degraded");
        break;
      }
      case "scienceData":
        completed = state.scienceData >= target.minimum;
        break;
      case "dataTransmitted":
        completed = state.dataTransmitted >= target.minimum;
        break;
      case "fuelRemaining":
        completed = state.fuelRemaining >= target.minimum;
        break;
      case "powerMargin":
        completed = r.powerGeneratedEffective - r.powerConsumed - state.powerStress >= target.minimum;
        break;
      case "equipment":
        completed = installedQuantity(config, target.equipmentId) > 0;
        break;
      case "landingQuality":
        completed = state.landingQuality !== null && state.landingQuality >= target.minimum;
        break;
    }
    return {
      id: o.id,
      description: o.description,
      required: o.required,
      points: o.points,
      earned: completed ? o.points : 0,
      completed,
    };
  });
}

export function finalizeSimulation(state: SimulationState, mission: Mission, config: SpacecraftConfig): SimulationResult {
  const r = computeResources(mission, config);
  const objectives = evaluateObjectives(state, mission, config);

  const primaryEarned = objectives.filter((o) => o.required).reduce((s, o) => s + o.earned, 0);
  const secondaryEarned = objectives.filter((o) => !o.required).reduce((s, o) => s + o.earned, 0);

  // Engineering performance (200)
  const reliabilityScore = (state.reliability / 100) * 80;
  const marginRatio = r.powerGeneratedEffective > 0
    ? Math.max(0, r.powerBalance - state.powerStress) / r.powerGeneratedEffective
    : 0;
  const powerScore = Math.min(1, marginRatio) * 40;
  const engineCount = config.components
    .filter((c) => {
      const eq = c.equipmentId;
      return eq === "chemical_engine" || eq === "heavy_chemical_engine" || eq === "ion_engine"
        || eq === "vacuum_engine" || eq === "nuclear_engine" || eq === "advanced_ion_engine" || eq === "monoprop_thrusters";
    })
    .reduce((s, c) => s + c.quantity, 0);
  const robustnessScore = Math.min(1, r.structural / 60) * 20 + (engineCount >= 2 ? 20 : r.powerStorage >= 400 ? 10 : 0);
  const engineeringScore = Math.round(reliabilityScore + powerScore + robustnessScore);

  // Resource efficiency (150)
  const fuelEfficiency = r.fuelRequired > 0 ? Math.min(1, Math.max(0, state.fuelRemaining) / r.fuelRequired) : 0.5;
  const budgetEfficiency = Math.min(1, Math.max(0, r.budgetRemaining) / mission.budget);
  const efficiencyScore = Math.round(fuelEfficiency * 75 + budgetEfficiency * 75);

  // Decision-making (100)
  const qualities = state.decisions.map((d) => {
    const evt = [...mission.events, ...ALL_POOLED_EVENTS].find((e) => e.id === d.eventId);
    const ch = evt?.choices.find((c) => c.id === d.choiceId);
    return ch?.effects.quality ?? 0.6;
  });
  const decisionScore = qualities.length > 0 ? Math.round((qualities.reduce((a, b) => a + b, 0) / qualities.length) * 100) : 75;

  const score = Math.min(1000, primaryEarned + secondaryEarned + engineeringScore + efficiencyScore + decisionScore);

  let status: SimulationResult["status"];
  if (state.status === "failure" || primaryEarned === 0) status = "failure";
  else if (primaryEarned < 400) status = "partial";
  else status = "success";

  const completedStages = state.stageLog.filter((sr) => sr.status === "success" || sr.status === "degraded").length;

  const completedObjectives = objectives.filter((o) => o.completed);
  const failedObjectives = objectives.filter((o) => !o.completed);

  // ---- Report -------------------------------------------------------------
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];
  const educationalNotes: string[] = [];

  if (state.reliability >= 92) strengths.push(`Excellent component reliability (${state.reliability}%).`);
  if (r.powerBalance - state.powerStress >= Math.max(120, mission.minPower * 0.4))
    strengths.push(`Healthy electrical margin of ${Math.round(r.powerBalance - state.powerStress)} W at the destination.`);
  if (fuelEfficiency >= 0.3) strengths.push(`Efficient propellant use — ${Math.round(state.fuelRemaining)} kg left over.`);
  if (engineCount >= 2) strengths.push("Engine redundancy carried the spacecraft through engine-level risk.");
  if (decisionScore >= 80) strengths.push("Sound decision-making under pressure.");
  const bestObjective = completedObjectives.filter((o) => o.required).length;
  if (bestObjective > 0) strengths.push(`${bestObjective} of ${mission.objectives.filter((o) => o.required).length} primary objectives achieved.`);

  if (state.reliability < 85) weaknesses.push(`Reliability degraded to ${state.reliability}% over the flight.`);
  if (state.powerStress > 0) weaknesses.push(`Decisions added ${state.powerStress} W of sustained power stress.`);
  if (fuelEfficiency < 0.15) weaknesses.push("Propellant margins were razor thin.");
  if (r.powerBalance < 0) weaknesses.push("The power budget was negative — the spacecraft flew on borrowed watts.");
  failedObjectives.slice(0, 4).forEach((o) => weaknesses.push(`Objective missed: ${o.description}.`));
  if (state.failureReason) weaknesses.push(state.failureReason);

  if (fuelEfficiency < 0.2) recommendations.push("Carry more propellant — or switch to ion engines, which need far less per mission.");
  if (r.powerBalance - state.powerStress < mission.minPower * 0.25)
    recommendations.push("Add power generation (solar near the Sun, RTG far out) or trim power-hungry components.");
  if (engineCount < 2 && state.reliability < 92)
    recommendations.push("Consider a second engine: redundancy directly reduces failure risk.");
  if (r.scienceCapability < 100 && mission.objectives.some((o) => o.target.kind === "scienceData" && !o.required))
    recommendations.push("Upgrade the science suite (a spectrometer roughly doubles data return).");
  if (r.commCapability < 120 && mission.objectives.some((o) => o.target.kind === "dataTransmitted" && o.points >= 45))
    recommendations.push("A deep-space antenna nearly doubles how much data reaches Earth.");
  if (recommendations.length === 0) recommendations.push("Fine-tune margins: every kilogram and watt you free up buys options during events.");

  const triggeredEvents = [...mission.events, ...ALL_POOLED_EVENTS].filter((e) =>
    state.eventLog.some((rec) => rec.eventId === e.id)
  );
  triggeredEvents.forEach((e) => educationalNotes.push(`${e.title}: ${e.educationalNote}`));
  if (mission.solarDerate < 0.5)
    educationalNotes.push(
      `Sunlight at ${mission.destination} is only ${Math.round(mission.solarDerate * 100)}% of Earth's — that is why far missions prefer RTGs.`
    );
  educationalNotes.push("Core trade-off: fuel and power buy capability, but mass and cost are the price. Every design is a balance.");

  const summary =
    status === "success"
      ? `Mission accomplished. ${mission.name} achieved all primary objectives with a score of ${score}/1000.`
      : status === "partial"
        ? `Mission partially successful. ${mission.name} achieved ${primaryEarned}/400 primary objective points (score ${score}/1000).`
        : state.failureReason
          ? `Mission failed. ${state.failureReason} (score ${score}/1000).`
          : `Mission failed — no primary objectives were achieved (score ${score}/1000).`;

  const report: MissionReport = {
    summary,
    strengths: strengths.length > 0 ? strengths : ["The mission reached the pad — every design flies lessons forward."],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["No significant weaknesses recorded."],
    recommendations,
    educationalNotes: educationalNotes.slice(0, 6),
  };

  return {
    missionId: mission.id,
    seed: state.seed,
    status,
    completedStages,
    scoreBreakdown: {
      objectivesPrimary: primaryEarned,
      objectivesSecondary: secondaryEarned,
      engineering: engineeringScore,
      efficiency: efficiencyScore,
      decisions: decisionScore,
    },
    completedObjectives,
    failedObjectives,
    decisions: state.decisions,
    scientificData: Math.round(state.scienceData),
    dataTransmitted: Math.round(state.dataTransmitted),
    score,
    events: state.eventLog,
    stageLog: state.stageLog,
    telemetry: {
      fuelRemaining: Math.max(0, Math.round(state.fuelRemaining)),
      fuelCapacity: r.fuelCapacity,
      powerMargin: Math.round(r.powerBalance - state.powerStress),
      reliability: Math.round(state.reliability),
      landingQuality: state.landingQuality,
    },
    report,
  };
}
