/**
 * ============================================================================
 * EVENT POOLS — v2.0 expanded random-event system
 * ============================================================================
 * Three pools feed the simulation's event selection:
 *
 * 1. GENERIC_EVENTS   — operational events any mission can encounter.
 * 2. ROLE_EVENTS      — events tied to a mission-control role (Commander,
 *                       Chief Engineer, Navigation/Flight Director, Science
 *                       & Communications Officer). In single player they
 *                       simply enrich the pool; in multiplayer the server
 *                       routes them to the players holding that role.
 * 3. Mission-specific events live on each Mission (see missions.ts).
 *
 * Every event uses the frozen MissionEvent contract. Every choice has
 * deterministic effects — no hidden randomness. Cooperative events declare
 * `cooperative: "proposal" | "vote"` for multiplayer shared decision-making.
 * ============================================================================
 */

import { MissionEvent } from "./types";

// ---------------------------------------------------------------------------
// Generic operational events (all missions)
// ---------------------------------------------------------------------------

export const GENERIC_EVENTS: MissionEvent[] = [
  {
    id: "power_demand",
    stage: 3,
    title: "Unexpected Power Demand",
    description:
      "A stuck heater circuit is drawing far more electricity than planned. The power bus is running hot.",
    educationalNote:
      "Electrical faults are the most common spacecraft emergency. Engineers design power margins precisely for days like this.",
    roles: ["engineer"],
    choices: [
      {
        id: "reduce",
        label: "Reduce non-essential instrument usage",
        description: "Power down the heater circuit and non-critical instruments. Some cruise science is lost.",
        effects: { scienceDelta: -8, quality: 0.9 },
      },
      {
        id: "continue",
        label: "Continue normal operations",
        description: "Ride out the fault at full capability. If the bus browns out, systems could reset.",
        effects: { powerStress: 60, riskDelta: 0.15, quality: 0.45 },
      },
    ],
  },
  {
    id: "solar_degradation",
    stage: 3,
    title: "Solar Array Degradation",
    description:
      "Micrometeorite pitting and UV darkening have reduced solar output by about 8%.",
    educationalNote:
      "All solar arrays age in space. Missions like Juno launched with arrays oversized for exactly this reason.",
    trigger: { metric: "powerMargin", below: 260 },
    roles: ["engineer"],
    choices: [
      {
        id: "attitude_burn",
        label: "Re-orient the arrays (spend propellant)",
        description: "A small attitude manoeuvre presents clean cells to the Sun.",
        effects: { fuelDelta: 120, quality: 0.85 },
      },
      {
        id: "accept_loss",
        label: "Accept the reduced output",
        description: "Fly on with a thinner power margin for the rest of the mission.",
        effects: { powerStress: 40, quality: 0.5 },
      },
    ],
  },
  {
    id: "instrument_fault",
    stage: 6,
    title: "Instrument Anomaly",
    description:
      "The primary instrument suite threw a voltage anomaly overnight and reset itself twice.",
    educationalNote:
      "Instruments fail more often than engines. Good missions carry margin: in capability, power and spares.",
    trigger: { metric: "reliability", below: 94 },
    roles: ["scientist"],
    choices: [
      {
        id: "safe_mode",
        label: "Restart the instrument in low-power mode",
        description: "Reduced sensitivity, but stable operation for the rest of the campaign.",
        effects: { scienceDelta: -6, reliabilityDelta: 3, quality: 0.9 },
      },
      {
        id: "push_on",
        label: "Keep running at full power",
        description: "Full science while it lasts — another reset could be permanent.",
        effects: { riskDelta: 0.12, scienceDelta: 4, quality: 0.45 },
      },
    ],
  },
  {
    id: "comm_delay",
    stage: 7,
    title: "Communication Delay",
    description:
      "Solar conjunction interferes with the downlink. Signals take longer and arrive garbled.",
    educationalNote:
      "When the Sun sits between Earth and the spacecraft, radios degrade. Mission planners schedule around conjunctions.",
    roles: ["scientist"],
    choices: [
      {
        id: "wait",
        label: "Pause downlink until the geometry improves",
        description: "Clean, complete data — delivered late.",
        effects: { dataDelta: -10, quality: 0.85 },
      },
      {
        id: "retransmit",
        label: "Autonomous retransmit with error correction",
        description: "The spacecraft fixes errors itself and keeps sending. Slight risk of corrupted packets.",
        effects: { dataDelta: 8, riskDelta: 0.05, quality: 0.6 },
      },
    ],
  },
  {
    id: "serendipity",
    stage: 6,
    title: "Unplanned Science Opportunity",
    description:
      "An unexpected target — a fresh impact crater, a passing moon, a burst of activity — is in range right now.",
    educationalNote:
      "Flexibility is a real spacecraft virtue: the best discoveries are often the ones nobody planned for.",
    trigger: { metric: "scienceCapability", atLeast: 80 },
    roles: ["scientist"],
    choices: [
      {
        id: "extended_obs",
        label: "Retask the instruments for an extended observation",
        description: "Extra power draw and a hotter bus, in exchange for bonus data.",
        effects: { powerStress: 30, scienceDelta: 10, dataDelta: 20, quality: 0.85 },
      },
      {
        id: "stick_to_plan",
        label: "Stick to the planned campaign",
        description: "The plan exists for a reason. Nominal operations continue.",
        effects: { quality: 0.7 },
      },
    ],
  },
  {
    id: "gyro_drift",
    stage: 4,
    title: "Reaction Wheel Drift",
    description:
      "A reaction wheel is spinning faster than expected trying to hold attitude. Momentum is building up.",
    educationalNote:
      "Spacecraft soak up angular momentum over time and must 'desaturate' their wheels with thruster firings.",
    roles: ["navigator"],
    choices: [
      {
        id: "desaturate",
        label: "Run a momentum desaturation burn",
        description: "Use propellant to spin the wheels down cleanly.",
        effects: { fuelDelta: 150, quality: 0.85 },
      },
      {
        id: "fuzzy_attitude",
        label: "Accept degraded pointing accuracy",
        description: "Save the propellant; instruments and antenna lose some precision.",
        effects: { scienceDelta: -6, dataDelta: -8, quality: 0.5 },
      },
    ],
  },
  {
    id: "thermal_swing",
    stage: 3,
    title: "Larger-Than-Expected Thermal Swing",
    description:
      "The spacecraft rolled into an attitude where one face bakes in sunlight and the other freezes.",
    educationalNote:
      "In vacuum there is no air to even out temperatures — orientation decides which side cooks.",
    roles: ["engineer"],
    choices: [
      {
        id: "spin_balance",
        label: "Enter a slow barbecue roll",
        description: "Rotate gently so heat spreads around the hull.",
        effects: { fuelDelta: 60, quality: 0.85 },
      },
      {
        id: "heaters",
        label: "Power heaters on the cold side",
        description: "Electric heat restores balance — at a sustained power cost.",
        effects: { powerStress: 45, quality: 0.6 },
      },
    ],
  },
  {
    id: "memory_scrub",
    stage: 6,
    title: "Solid-State Memory Errors",
    description:
      "Cosmic rays have flipped bits in the onboard memory banks. The file system wants a scrub.",
    educationalNote:
      "Single-event upsets from radiation corrupt spacecraft computers daily — error-correcting memory catches most of them.",
    trigger: { metric: "reliability", below: 95 },
    roles: ["engineer"],
    cooperative: "proposal",
    choices: [
      {
        id: "full_scrub",
        label: "Pause science for a full memory scrub",
        description: "Half a day of maintenance. Bulletproof memory afterwards.",
        effects: { scienceDelta: -5, reliabilityDelta: 4, quality: 0.9 },
      },
      {
        id: "background",
        label: "Scrub in the background",
        description: "Keep observing. Some data blocks may need retransmission later.",
        effects: { dataDelta: -8, quality: 0.6 },
      },
    ],
  },
  {
    id: "track_loss",
    stage: 4,
    title: "Brief DSN Track Loss",
    description:
      "A ground-station antenna fault cost six hours of tracking. The navigation solution is staler than usual.",
    educationalNote:
      "Deep Space Network time is scheduled months ahead — a lost track is a lost measurement.",
    roles: ["navigator"],
    choices: [
      {
        id: "onboard_nav",
        label: "Trust the onboard navigation filter",
        description: "Bridge the gap with inertial estimates. Slight targeting error possible.",
        effects: { scienceDelta: -3, quality: 0.7 },
      },
      {
        id: "corrective_burn",
        label: "Schedule an immediate corrective burn",
        description: "Wipe out the uncertainty with propellant.",
        effects: { fuelDelta: 180, quality: 0.75 },
      },
    ],
  },
  {
    id: "safe_mode_hit",
    stage: 5,
    title: "Safe-Mode Trip During Arrival",
    description:
      "A firmware watchdog tripped minutes before the arrival burn window. Systems defaulted to safe mode.",
    educationalNote:
      "Spacecraft protect themselves by shutting down — but a safe mode during a critical window is every flight director's nightmare.",
    trigger: { metric: "reliability", below: 93 },
    roles: ["commander"],
    cooperative: "vote",
    choices: [
      {
        id: "recover_full",
        label: "Full recovery, then the burn",
        description: "Bring every system back before committing to arrival. Costs time and a little fuel.",
        effects: { fuelDelta: 120, reliabilityDelta: 2, quality: 0.85 },
      },
      {
        id: "minimal_mode",
        label: "Burn in minimal configuration",
        description: "Execute arrival on core systems only. Instruments stay off through the manoeuvre.",
        effects: { scienceDelta: -8, quality: 0.6 },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Role-specific events — routed to the role holder in multiplayer
// ---------------------------------------------------------------------------

export const ROLE_EVENTS: MissionEvent[] = [
  // ---------------------------------------------------------- Commander
  {
    id: "role_conflicting_priorities",
    stage: 6,
    title: "Conflicting Mission Priorities",
    description:
      "The science team wants an extended observation campaign; flight operations wants conservative power management for the return leg.",
    educationalNote:
      "Mission directors spend most of their time arbitrating between teams who are all technically right.",
    roles: ["commander"],
    cooperative: "vote",
    choices: [
      {
        id: "science_first",
        label: "Back the science campaign",
        description: "Chase the data — accept a thinner engineering margin.",
        effects: { scienceDelta: 12, powerStress: 35, quality: 0.7 },
      },
      {
        id: "engineering_first",
        label: "Back conservative operations",
        description: "Protect the spacecraft — collect the planned data only.",
        effects: { reliabilityDelta: 2, scienceDelta: -4, quality: 0.8 },
      },
    ],
  },
  {
    id: "role_emergency_command",
    stage: 5,
    title: "Emergency Decision Point",
    description:
      "Two anomalies fire simultaneously and ground stations are 40 light-minutes away. Command authority is yours alone.",
    educationalNote:
      "Light-time delay means deep-space commanders often cannot phone home — autonomy and judgement decide.",
    roles: ["commander"],
    choices: [
      {
        id: "prioritise_safety",
        label: "Safe the spacecraft first",
        description: "Shed all risk before continuing. Mission continues in degraded mode.",
        effects: { reliabilityDelta: 4, scienceDelta: -6, quality: 0.85 },
      },
      {
        id: "press_on",
        label: "Hold the plan and press on",
        description: "Accept elevated risk to keep the arrival geometry.",
        effects: { riskDelta: 0.14, quality: 0.5 },
      },
    ],
  },
  {
    id: "role_objective_change",
    stage: 6,
    title: "Objective Re-Scoping From Ground",
    description:
      "Headquarters re-prioritised the mission: they now value transmitted data above raw science collection.",
    educationalNote:
      "Missions get re-scoped mid-flight. Adaptive teams win; rigid teams argue with reality.",
    roles: ["commander"],
    choices: [
      {
        id: "retask",
        label: "Retask the downlink strategy",
        description: "Re-allocate time and power from collection to transmission.",
        effects: { dataDelta: 22, scienceDelta: -5, quality: 0.8 },
      },
      {
        id: "keep_focus",
        label: "Keep the original focus",
        description: "The team on site knows best. Politely continue.",
        effects: { quality: 0.6 },
      },
    ],
  },

  // ---------------------------------------------------------- Chief Engineer
  {
    id: "role_engine_roughness",
    stage: 4,
    title: "Engine Turbopump Roughness",
    description:
      "Vibration telemetry from the main engine's turbopump is trending upward burn by burn.",
    educationalNote:
      "Engineers track vibration signatures like doctors read heartbeats — small changes tell big stories.",
    roles: ["engineer"],
    cooperative: "proposal",
    choices: [
      {
        id: "derate_engine",
        label: "Derate the engine for remaining burns",
        description: "Gentler burns are longer burns: extra propellant, kinder machinery.",
        effects: { fuelDelta: 160, reliabilityDelta: 3, quality: 0.85 },
      },
      {
        id: "monitor",
        label: "Keep nominal thrust and monitor",
        description: "Trust the margins. If the pump goes, it goes.",
        effects: { riskDelta: 0.15, quality: 0.45 },
      },
    ],
  },
  {
    id: "role_power_bus_fault",
    stage: 3,
    title: "Power Bus Undervoltage",
    description:
      "One of two power buses sagged below its floor for eleven seconds. The protection logic isolated it.",
    educationalNote:
      "Spacecraft split their electrical systems across redundant buses precisely so one fault cannot kill the ship.",
    roles: ["engineer"],
    choices: [
      {
        id: "load_shed",
        label: "Shed load and re-balance the buses",
        description: "Careful reconfiguration at the cost of some observation time.",
        effects: { scienceDelta: -5, reliabilityDelta: 3, quality: 0.9 },
      },
      {
        id: "ride_single_bus",
        label: "Fly on the healthy bus",
        description: "Faster, but with zero redundancy until the fault clears.",
        effects: { riskDelta: 0.12, quality: 0.5 },
      },
    ],
  },
  {
    id: "role_overheating",
    stage: 6,
    title: "Radiator Overheating",
    description:
      "A coolant loop is running hot; the radiator panel may be partially blocked by a deployed boom.",
    educationalNote:
      "In space you can only get rid of heat by radiating it — blocked radiators are a genuine emergency.",
    roles: ["engineer"],
    choices: [
      {
        id: "reconfigure",
        label: "Re-stow the boom and re-point radiators",
        description: "Clean thermal balance restored after a short interruption.",
        effects: { scienceDelta: -4, reliabilityDelta: 2, quality: 0.85 },
      },
      {
        id: "throttle",
        label: "Throttle instruments to reduce heat",
        description: "Less heat generated, less data collected.",
        effects: { scienceDelta: -9, quality: 0.7 },
      },
    ],
  },

  // ---------------------------------------------------------- Navigation & Flight Director
  {
    id: "role_traj_deviation",
    stage: 4,
    title: "Unexpected Trajectory Deviation",
    description:
      "Ranging data shows the spacecraft drifting off the nominal trajectory — outgassing or a small leak is suspected.",
    educationalNote:
      "Even a whisper of thrust from a venting tank bends a trajectory over millions of kilometres.",
    roles: ["navigator"],
    choices: [
      {
        id: "early_burn",
        label: "Correct now, while the error is small",
        description: "Early corrections are cheap corrections.",
        effects: { fuelDelta: 140, quality: 0.9 },
      },
      {
        id: "characterise",
        label: "Characterise the drift first",
        description: "Gather two more ranging passes; then burn with better knowledge.",
        effects: { fuelDelta: 220, scienceDelta: -3, quality: 0.7 },
      },
    ],
  },
  {
    id: "role_nav_sensor_fail",
    stage: 4,
    title: "Star Tracker Dropouts",
    description:
      "The primary star tracker keeps losing lock when the spacecraft crosses the scattered-light cone of the target.",
    educationalNote:
      "Even beautiful targets are navigation hazards — bright scattered light blinds star cameras.",
    roles: ["navigator"],
    choices: [
      {
        id: "switch_inertial",
        label: "Fly inertial through the cone",
        description: "Gyro-only attitude for a few hours, slight pointing error.",
        effects: { scienceDelta: -4, quality: 0.75 },
      },
      {
        id: "replan_attitude",
        label: "Re-plan attitudes to keep the tracker on dark sky",
        description: "Uses propellant for extra slews.",
        effects: { fuelDelta: 130, quality: 0.8 },
      },
    ],
  },
  {
    id: "role_orbit_window",
    stage: 5,
    title: "Orbital Insertion Window Choice",
    description:
      "Flight dynamics offers two insertion options: a fuel-cheap long capture, or an expensive immediate orbit.",
    educationalNote:
      "Aerobraking and long captures trade months of time for hundreds of kilograms of propellant.",
    roles: ["navigator"],
    cooperative: "proposal",
    choices: [
      {
        id: "immediate",
        label: "Immediate insertion burn",
        description: "Science starts today; the propellant bill is heavy.",
        effects: { fuelDelta: 320, quality: 0.7 },
      },
      {
        id: "long_capture",
        label: "Long, gentle capture",
        description: "Saves propellant; the spacecraft arrives thin on consumables later.",
        effects: { fuelDelta: 80, scienceDelta: -6, reliabilityDelta: -2, quality: 0.8 },
      },
    ],
  },

  // ---------------------------------------------------------- Science & Comms Officer
  {
    id: "role_discovery",
    stage: 6,
    title: "Unexpected Scientific Discovery",
    description:
      "The instruments just saw something nobody predicted at this target. Ground teams are asking for a full campaign.",
    educationalNote:
      "The greatest findings in planetary science were unplanned — instruments pointed at the right place by luck and curiosity.",
    trigger: { metric: "scienceCapability", atLeast: 70 },
    roles: ["scientist"],
    cooperative: "proposal",
    choices: [
      {
        id: "full_campaign",
        label: "Run a full discovery campaign",
        description: "Retask everything onto the discovery. Bonus data, real power cost.",
        effects: { powerStress: 40, scienceDelta: 16, dataDelta: 26, quality: 0.85 },
      },
      {
        id: "quick_look",
        label: "Quick-look only",
        description: "A short observation without disturbing the plan.",
        effects: { scienceDelta: 5, quality: 0.65 },
      },
    ],
  },
  {
    id: "role_comm_interrupt",
    stage: 7,
    title: "Communication Interruption",
    description:
      "The high-gain antenna's gimbal motor stalled mid-track. Downlink is running on the low-gain fallback.",
    educationalNote:
      "Antenna gimbals are motors and bearings — when they stick, engineers improvise with the whole spacecraft's attitude.",
    roles: ["scientist"],
    choices: [
      {
        id: "slew_spacecraft",
        label: "Slew the whole spacecraft to point the dish",
        description: "Data flows again, but slewing costs propellant and disturbs observations.",
        effects: { fuelDelta: 90, dataDelta: 14, quality: 0.8 },
      },
      {
        id: "low_rate",
        label: "Accept the low-gain data rate",
        description: "Trickle the data home slowly; some of it will not fit before the mission ends.",
        effects: { dataDelta: -14, quality: 0.55 },
      },
    ],
  },
  {
    id: "role_observation_window",
    stage: 6,
    title: "Additional Observation Opportunity",
    description:
      "Orbit geometry offers an extra close pass nobody planned for — if instruments are ready in time.",
    educationalNote:
      "Killer observing windows are pure geometry: they open, and they close, on the laws of orbital mechanics.",
    roles: ["scientist"],
    choices: [
      {
        id: "grab_window",
        label: "Grab the extra pass",
        description: "Compress the schedule to squeeze in another observation.",
        effects: { scienceDelta: 10, dataDelta: 12, powerStress: 25, quality: 0.85 },
      },
      {
        id: "skip",
        label: "Skip it — protect the schedule",
        description: "Fatigue causes mistakes; the planned campaign is enough.",
        effects: { quality: 0.6 },
      },
    ],
  },
];

/** All pools merged, for decision-quality lookups and single-player variety. */
export const ALL_POOLED_EVENTS: MissionEvent[] = [...GENERIC_EVENTS, ...ROLE_EVENTS];
