/**
 * ============================================================================
 * MISSION CONTROL: BEYOND EARTH — FROZEN SHARED DATA CONTRACT (v1.0)
 * ============================================================================
 * Established by the Lead Architect (AI 0) before implementation.
 * All modules (game systems, simulation, frontend, QA) MUST consume these
 * structures. Field names and semantics are frozen; additive changes only.
 *
 * Extension rationale (fields added on top of the master specification):
 * - powerStorage ........ battery buffer (Wh) used during eclipse/peak demand
 * - scienceOutput ....... scientific capability points of instruments
 * - radiationShielding .. protection (%) against radiation environments
 * - thermalProtection ... protection (%) against heat / atmospheric entry
 * - landingAssist ....... landing capability points for surface missions
 * - commCapability ...... communication capability points (data downlink)
 * - navigation .......... navigation accuracy points (course corrections)
 * - structural .......... structural robustness points (impact resistance)
 *
 * Units (consistent everywhere):
 * - cost ............ US dollars ($)
 * - mass ............ kilograms (kg)
 * - fuel ............ kilograms of propellant (kg)
 * - power ........... watts (W)
 * - reliability ..... percent (0-100)
 * - capability ...... dimensionless points
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Catalogue data
// ---------------------------------------------------------------------------

export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type EquipmentCategory =
  | "Propulsion"
  | "Fuel"
  | "Power"
  | "Communication"
  | "Science"
  | "Navigation"
  | "Thermal"
  | "Protection"
  | "Landing"
  | "Structure";

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  /** Beginner-friendly explanation of what this component does. */
  description: string;
  /** The engineering trade-off this component represents (educational). */
  tradeoff: string;
  /** true if powerGeneration comes from sunlight (derated by mission.solarDerate). */
  isSolar: boolean;
  cost: number; // $
  mass: number; // kg
  powerGeneration: number; // W (nominal, at 1 AU for solar)
  powerConsumption: number; // W
  fuelCapacity: number; // kg of propellant storable
  /** kg of propellant burned per propulsion point over a full mission. Lower = more efficient. */
  fuelConsumption: number;
  propulsion: number; // thrust capability points
  reliability: number; // % base reliability
  powerStorage: number; // Wh of battery buffer
  scienceOutput: number; // science capability points
  radiationShielding: number; // %
  thermalProtection: number; // %
  landingAssist: number; // landing capability points
  commCapability: number; // communication capability points
  navigation: number; // navigation accuracy points
  structural: number; // structural robustness points
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

export type MissionType = "orbiter" | "lander" | "flyby" | "probe";

/** Completion criteria for a mission objective. */
export type ObjectiveTarget =
  | { kind: "stage"; stage: number } // stage (1-8) completed successfully
  | { kind: "scienceData"; minimum: number } // science data collected (points)
  | { kind: "dataTransmitted"; minimum: number } // data downlinked to Earth (points)
  | { kind: "fuelRemaining"; minimum: number } // propellant left at mission end (kg)
  | { kind: "powerMargin"; minimum: number } // power margin at destination (W)
  | { kind: "equipment"; equipmentId: string } // equipment installed and functional
  | { kind: "landingQuality"; minimum: number }; // landing precision achieved (0-100)

export interface MissionObjective {
  id: string;
  description: string;
  /** true = primary objective, false = secondary objective */
  required: boolean;
  points: number;
  target: ObjectiveTarget;
}

/** Condition that must hold for a mission event to be able to trigger. */
export interface EventCondition {
  /** Trigger when the metric is below this value. */
  metric?: "powerMargin" | "fuelMargin" | "reliability" | "scienceCapability" | "radiation";
  below?: number;
  /** Trigger only when the metric is at or above this value. */
  atLeast?: number;
}

export interface EventChoice {
  id: string;
  label: string;
  /** Beginner-friendly explanation of what this choice means. */
  description: string;
  /** Deterministic consequences applied when this choice is taken. */
  effects: {
    fuelDelta?: number; // kg (+ = extra burn / - = fuel recovered)
    scienceDelta?: number; // science data points
    dataDelta?: number; // transmitted data points
    reliabilityDelta?: number; // percentage points
    powerStress?: number; // W of extra sustained power draw
    riskDelta?: number; // added failure risk (0-1) during resolution
    landingQualityDelta?: number; // landing precision points
    /** Planning quality of this choice (0-1); drives the decision score. */
    quality?: number;
  };
}

export interface MissionEvent {
  id: string;
  /** Simulation stage (1-8) in which this event can occur. */
  stage: number;
  title: string;
  description: string;
  /** Educational note: why this happens on a real mission. */
  educationalNote: string;
  /** Optional trigger condition; when omitted the event is always considered. */
  trigger?: EventCondition;
  choices: EventChoice[];
  /** v2.0 — roles this event primarily addresses (multiplayer routing; flavour in single player). */
  roles?: PlayerRole[];
  /** v2.0 — cooperative resolution mode (multiplayer). Omitted = any recipient decides solo. */
  cooperative?: "proposal" | "vote";
}

export interface Mission {
  id: string;
  name: string;
  destination: string;
  difficulty: Difficulty;
  type: MissionType;
  description: string;
  scientificPurpose: string;
  budget: number; // $
  maxMass: number; // kg
  minFuel: number; // kg — minimum propellant for the mission delta-v budget
  minPower: number; // W — minimum effective power generation at destination
  minPropulsion: number; // total thrust capability points required
  /** Solar array derating at this destination (1.0 = Earth/Moon, 0.12 = Jupiter). */
  solarDerate: number;
  /** Mission-specific capability floors. 0 = not required. */
  minLanding: number; // landingAssist points (landers)
  minThermal: number; // thermalProtection % (atmospheric entry)
  minRadiation: number; // radiationShielding % (radiation environments)
  minNavigation: number; // navigation points (precision trajectories)
  requiredEquipment: string[]; // equipment ids that MUST be installed
  objectives: MissionObjective[]; // primary points sum to 400, secondary to 150
  events: MissionEvent[]; // mission-specific events
  /** Artwork identifier used to select the destination image. */
  imageId: string;
  /** v2.0 — event trigger probability multiplier (1 = nominal). Applied by difficulty/constraints. */
  eventRate?: number;
  /** v2.0 — constraint flags applied by the difficulty system (see constraints.ts). */
  requireRedundantComms?: boolean;
  bannedEquipmentIds?: string[];
  appliedConstraintIds?: string[];
}

// ---------------------------------------------------------------------------
// v2.0 — Difficulty settings & random mission constraints
// ---------------------------------------------------------------------------

/** Game-level difficulty setting (independent of each mission's own difficulty). */
export type DifficultySetting =
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Expert"
  | "Custom Challenge";

export interface ConstraintEffects {
  /** Budget multiplier (0.8 = 20% cut). */
  budgetMultiplier?: number;
  /** Launch mass limit multiplier. */
  massMultiplier?: number;
  /** Propellant requirement multiplier (tightened fuel budget). */
  minFuelMultiplier?: number;
  /** Solar output multiplier at destination (power availability cut). */
  solarDerateMultiplier?: number;
  /** Require at least two communication units (redundant comm systems). */
  requireRedundantComms?: boolean;
  /** Extra radiation shielding floor (percentage points). */
  minRadiationBonus?: number;
  /** Equipment ids unavailable for this attempt. */
  bannedEquipmentIds?: string[];
  /** Extra science-data points required on every science objective. */
  scienceGoalBonus?: number;
  /** Event probability multiplier (more operational complications). */
  eventRateMultiplier?: number;
}

export interface MissionConstraint {
  id: string;
  name: string;
  description: string;
  /** Beginner-friendly explanation of why such constraints exist on real missions. */
  educationalNote: string;
  effects: ConstraintEffects;
}

// ---------------------------------------------------------------------------
// Spacecraft configuration
// ---------------------------------------------------------------------------

export interface ComponentSelection {
  equipmentId: string;
  quantity: number; // positive integer
}

export interface SpacecraftConfig {
  missionId: string;
  components: ComponentSelection[];
}

// ---------------------------------------------------------------------------
// Resource calculation result (deterministic)
// ---------------------------------------------------------------------------

export interface ResourceSummary {
  totalCost: number; // $
  totalMass: number; // kg
  powerGenerated: number; // W nominal
  /** W after solar derating at the mission destination (used for validation). */
  powerGeneratedEffective: number;
  powerConsumed: number; // W
  powerBalance: number; // effective generation − consumption
  powerStorage: number; // Wh battery buffer
  fuelCapacity: number; // kg
  /** kg of propellant this engine configuration needs for the mission. */
  fuelRequired: number; // kg
  propulsion: number; // total thrust capability points
  scienceCapability: number; // total science points
  commCapability: number; // total communication points
  navigation: number; // total navigation points
  radiationShielding: number; // % (max, not sum — shielding does not stack linearly)
  thermalProtection: number; // % (max)
  landingAssist: number; // total landing points
  structural: number; // total structural points
  reliability: number; // % weighted-average component reliability
  massRemaining: number; // kg (maxMass − totalMass)
  budgetRemaining: number; // $ (budget − totalCost)
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type CheckSeverity = "error" | "warning";

export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: CheckSeverity;
  /** Beginner-friendly explanation of the result. */
  message: string;
  /** Optional educational hint shown when the check fails or warns. */
  hint?: string;
}

export interface ValidationResult {
  ready: boolean;
  checks: ValidationCheck[];
  warnings: ValidationCheck[];
  errors: ValidationCheck[];
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export type MissionStatus = "running" | "success" | "partial" | "failure";

export interface StageRecord {
  stage: number; // 1-8
  title: string;
  status: "success" | "degraded" | "failed" | "skipped";
  /** Narrative log lines produced while the stage ran. */
  log: string[];
  fuelUsed: number; // kg consumed during this stage
  scienceGained: number; // science data points gained
  dataGained: number; // data transmitted points gained
}

export interface DecisionRecord {
  eventId: string;
  eventTitle: string;
  choiceId: string;
  choiceLabel: string;
  stage: number;
  outcome: string; // explanation of what happened
}

export interface EventRecord {
  eventId: string;
  title: string;
  stage: number;
  resolved: boolean;
}

export interface ObjectiveResult {
  id: string;
  description: string;
  required: boolean;
  points: number;
  earned: number;
  completed: boolean;
}

export interface MissionReport {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  educationalNotes: string[];
}

export interface ScoreBreakdown {
  objectivesPrimary: number; // /400
  objectivesSecondary: number; // /150
  engineering: number; // /200
  efficiency: number; // /150
  decisions: number; // /100
}

export interface SimulationResult {
  missionId: string;
  seed: number;
  status: MissionStatus;
  completedStages: number;
  scoreBreakdown: ScoreBreakdown;
  completedObjectives: ObjectiveResult[];
  failedObjectives: ObjectiveResult[];
  decisions: DecisionRecord[];
  scientificData: number; // 0-100
  dataTransmitted: number; // points
  score: number; // 0-1000
  events: EventRecord[];
  stageLog: StageRecord[];
  /** Live telemetry snapshot at mission end. */
  telemetry: {
    fuelRemaining: number;
    fuelCapacity: number;
    powerMargin: number;
    reliability: number;
    landingQuality: number | null;
  };
  report: MissionReport;
}

/** Interactive simulation state machine (advanced stage by stage by the UI). */
export interface SimulationState {
  missionId: string;
  seed: number;
  rngState: number; // current PRNG state (mutable engine bookkeeping)
  stageIndex: number; // 0-7 (stage = stageIndex + 1)
  stagePhase: "pending" | "running" | "awaiting_event" | "complete";
  status: MissionStatus;
  fuelRemaining: number; // kg
  powerStress: number; // W extra sustained draw from decisions
  scienceData: number; // 0-100
  dataTransmitted: number; // points
  reliability: number; // current composite reliability %
  landingQuality: number | null; // 0-100 for landers
  stageLog: StageRecord[];
  eventLog: EventRecord[];
  decisions: DecisionRecord[];
  pendingEvent: {
    event: MissionEvent;
    resolved: boolean;
  } | null;
  failureReason: string | null;
  log: string[]; // recent telemetry lines for the console UI
}

// ---------------------------------------------------------------------------
// v2.0 — Multiplayer roles, sessions and contributions
// ---------------------------------------------------------------------------

export type PlayerRole = "commander" | "engineer" | "navigator" | "scientist";

export interface RoleDefinition {
  id: PlayerRole;
  title: string;
  shortTitle: string;
  description: string;
  responsibilities: string[];
  /** Tailwind accent classes for role-coloured UI. */
  accent: string;
}

/** Per-player contribution statistics (supplements the shared team score). */
export interface ContributionStats {
  decisions: number;
  recommendationsAccepted: number;
  emergenciesResolved: number;
  scienceObjectives: number;
  choiceQualities: number[];
}

export function emptyContributionStats(): ContributionStats {
  return { decisions: 0, recommendationsAccepted: 0, emergenciesResolved: 0, scienceObjectives: 0, choiceQualities: [] };
}

export function averageChoiceQuality(stats: ContributionStats): number {
  if (stats.choiceQualities.length === 0) return 0;
  return stats.choiceQualities.reduce((a, b) => a + b, 0) / stats.choiceQualities.length;
}

// ---------------------------------------------------------------------------
// Mission log (persistence)
// ---------------------------------------------------------------------------

export interface MissionLogEntry {
  missionId: string;
  missionName: string;
  date: string; // ISO timestamp
  status: MissionStatus;
  score: number;
  scientificData: number;
  seed: number;
  /** v2.3 — Optional fields for achievement tracking (additive; older log entries default to undefined). */
  budgetRemaining?: number; // $ remaining at mission end
  engineeringScore?: number; // /200 engineering category
  efficiencyScore?: number; // /150 resource efficiency category
  destination?: string; // mission destination (for "distinct planets" achievement)
}
