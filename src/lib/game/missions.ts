/**
 * ============================================================================
 * MISSION DEFINITIONS — owned by the Game Systems developer (AI 2)
 * ============================================================================
 * v2.0: fifteen missions across the solar system with a difficulty ladder:
 *   Beginner (Moon ×2) → Intermediate (Mars, NEA) → Advanced (Comet, Venus,
 *   Asteroid, Mercury, Sun) → Expert (Jupiter, Europa, Saturn, Titan,
 *   Mars Sample Return, Deep Space).
 *
 * Scoring invariant: every mission's primary objectives total exactly 400
 * points and secondary objectives total exactly 150 points, so that with
 * engineering (200) + efficiency (150) + decisions (100) the maximum score
 * is exactly 1,000.
 *
 * Every mission has at least one viable spacecraft configuration (verified
 * by the QA test-suite).
 * ============================================================================
 */

import { Mission } from "./types";

export const MISSIONS: Mission[] = [
  // ------------------------------------------------------------------ MOON
  {
    id: "lunar_research",
    name: "Lunar Research Expedition",
    destination: "Moon",
    difficulty: "Beginner",
    type: "orbiter",
    description:
      "Send an orbiter to the Moon to study the surface from low lunar orbit. A short, forgiving mission — the perfect first command.",
    scientificPurpose:
      "Map the lunar south pole and search for water ice in permanently shadowed craters, a key resource for future crewed bases.",
    budget: 50_000_000,
    maxMass: 5_000,
    minFuel: 1_000,
    minPower: 100,
    minPropulsion: 40,
    solarDerate: 1.0,
    minLanding: 0,
    minThermal: 0,
    minRadiation: 0,
    minNavigation: 0,
    requiredEquipment: ["communication_antenna", "science_instrument"],
    objectives: [
      { id: "reach_moon", description: "Reach lunar orbit", required: true, points: 250, target: { kind: "stage", stage: 5 } },
      { id: "collect_data", description: "Collect scientific data", required: true, points: 150, target: { kind: "scienceData", minimum: 50 } },
      { id: "mineral_scan", description: "Perform a full mineralogical scan (spectrometer)", required: false, points: 50, target: { kind: "equipment", equipmentId: "spectrometer" } },
      { id: "extended_dataset", description: "Transmit an extended dataset to Earth", required: false, points: 50, target: { kind: "dataTransmitted", minimum: 120 } },
      { id: "fuel_reserve", description: "Return with a 40% propellant reserve", required: false, points: 50, target: { kind: "fuelRemaining", minimum: 400 } },
    ],
    events: [
      {
        id: "lunar_eclipse",
        stage: 5,
        title: "Earth Eclipse Period",
        description:
          "The spacecraft will pass through Earth's shadow for 84 minutes. Solar panels receive no sunlight while systems keep running.",
        educationalNote:
          "Real lunar orbiters regularly pass through eclipses. Batteries keep the spacecraft alive until sunlight returns.",
        trigger: { metric: "powerMargin", below: 220 },
        roles: ["engineer"],
        choices: [
          {
            id: "battery_mode",
            label: "Run on batteries, keep instruments warm",
            description:
              "Trust the battery buffer and keep everything running. Safe if you carry enough stored energy.",
            effects: { reliabilityDelta: -1, quality: 0.85 },
          },
          {
            id: "safe_mode",
            label: "Enter safe mode until sunlight returns",
            description:
              "Power down to essentials. Guaranteed survival, but you lose observation time over the south pole.",
            effects: { scienceDelta: -12, quality: 0.75 },
          },
        ],
      },
      {
        id: "occultation",
        stage: 7,
        title: "Communications Occultation",
        description:
          "The Moon blocks the line of sight to Earth for two orbits. The antenna cannot send or receive during this window.",
        educationalNote:
          "Mission planners schedule data downlinks around occultations — geometry rules deep-space communications.",
        roles: ["scientist"],
        choices: [
          {
            id: "buffer_data",
            label: "Record data onboard and downlink later",
            description: "Store science in memory and transmit after the blackout. Requires a healthy power margin.",
            effects: { dataDelta: 25, powerStress: 30, quality: 0.85 },
          },
          {
            id: "skip_downlink",
            label: "Pause the science campaign",
            description: "Stop collecting data during the blackout to save power. Some observations are lost forever.",
            effects: { scienceDelta: -8, dataDelta: 5, quality: 0.55 },
          },
        ],
      },
    ],
    imageId: "moon",
  },

  // ------------------------------------------------------------------ MARS
  {
    id: "mars_survey",
    name: "Mars Surface Survey",
    destination: "Mars",
    difficulty: "Intermediate",
    type: "lander",
    description:
      "Land a science platform on the Martian surface and survey the landing region. You will need to survive entry, descent and landing.",
    scientificPurpose:
      "Analyse soil chemistry and trace methane in Jezero-style terrain to assess past habitability of Mars.",
    budget: 45_000_000,
    maxMass: 8_000,
    minFuel: 2_600,
    minPower: 280,
    minPropulsion: 70,
    solarDerate: 0.5,
    minLanding: 60,
    minThermal: 40,
    minRadiation: 0,
    minNavigation: 30,
    requiredEquipment: ["communication_antenna", "science_instrument"],
    objectives: [
      { id: "safe_landing", description: "Execute a safe landing on Mars", required: true, points: 200, target: { kind: "landingQuality", minimum: 50 } },
      { id: "surface_science", description: "Collect surface science data", required: true, points: 200, target: { kind: "scienceData", minimum: 55 } },
      { id: "precision_landing", description: "Touch down within 500 m of the target (precision landing)", required: false, points: 60, target: { kind: "landingQuality", minimum: 75 } },
      { id: "downlink", description: "Transmit the full survey dataset to Earth", required: false, points: 45, target: { kind: "dataTransmitted", minimum: 150 } },
      { id: "fuel_reserve", description: "Land with propellant to spare (≥ 500 kg)", required: false, points: 45, target: { kind: "fuelRemaining", minimum: 500 } },
    ],
    events: [
      {
        id: "dust_storm",
        stage: 6,
        title: "Regional Dust Storm",
        description:
          "A dust storm is darkening the skies over the landing site. Solar generation drops sharply while dust coats the panels.",
        educationalNote:
          "Dust storms ended the Opportunity rover mission in 2018. Sunlight at Mars is already half as strong as at Earth.",
        trigger: { metric: "powerMargin", below: 350 },
        roles: ["commander"],
        choices: [
          {
            id: "hibernate",
            label: "Hibernate until the storm passes",
            description: "Shut down science and wait. Survivable, but days of observations are lost.",
            effects: { scienceDelta: -18, quality: 0.8 },
          },
          {
            id: "push_through",
            label: "Keep the science campaign running",
            description: "Run instruments on battery power through the storm. Risky with a thin power margin.",
            effects: { scienceDelta: 10, powerStress: 60, riskDelta: 0.12, quality: 0.5 },
          },
        ],
      },
      {
        id: "landing_hazard",
        stage: 5,
        title: "Landing Site Hazard",
        description:
          "Terminal descent imaging reveals boulder fields inside the target ellipse with only seconds to decide.",
        educationalNote:
          "Terrain-relative navigation let Perseverance divert away from hazards autonomously — at the cost of landing fuel.",
        roles: ["navigator"],
        choices: [
          {
            id: "divert",
            label: "Divert to the clear zone (burn extra propellant)",
            description: "Retarget a safe zone 800 m away. Costs precious landing fuel but protects the spacecraft.",
            effects: { fuelDelta: 350, landingQualityDelta: 18, quality: 0.85 },
          },
          {
            id: "commit",
            label: "Commit to the original site",
            description: "Trust the descent module. Saves fuel, but boulder contact is a real risk.",
            effects: { riskDelta: 0.18, landingQualityDelta: -12, quality: 0.4 },
          },
        ],
      },
    ],
    imageId: "mars",
  },

  // ------------------------------------------------------------------ COMET
  {
    id: "comet_rendezvous",
    name: "Comet Rendezvous",
    destination: "Comet 67P-Analog",
    difficulty: "Advanced",
    type: "orbiter",
    description:
      "Catch up with a comet beyond the orbit of Mars and fly alongside it for months as it approaches the Sun and awakens.",
    scientificPurpose:
      "Sample the pristine ices and organics of a comet nucleus — leftover building blocks of the solar system.",
    budget: 70_000_000,
    maxMass: 7_500,
    minFuel: 4_200,
    minPower: 360,
    minPropulsion: 90,
    solarDerate: 0.2,
    minLanding: 0,
    minThermal: 0,
    minRadiation: 20,
    minNavigation: 90,
    requiredEquipment: ["communication_antenna", "science_instrument", "nav_computer"],
    objectives: [
      { id: "rendezvous", description: "Achieve comet rendezvous", required: true, points: 250, target: { kind: "stage", stage: 5 } },
      { id: "coma_science", description: "Study the cometary coma and nucleus", required: true, points: 150, target: { kind: "scienceData", minimum: 70 } },
      { id: "plume_transit", description: "Navigate the outgassing plume without damage", required: false, points: 50, target: { kind: "stage", stage: 4 } },
      { id: "composition_scan", description: "Complete a full composition scan (spectrometer)", required: false, points: 50, target: { kind: "equipment", equipmentId: "spectrometer" } },
      { id: "fuel_reserve", description: "Finish the escort phase with ≥ 700 kg of propellant", required: false, points: 50, target: { kind: "fuelRemaining", minimum: 700 } },
    ],
    events: [
      {
        id: "outgassing_plume",
        stage: 4,
        title: "Outgassing Plume Ahead",
        description:
          "The comet is waking up. Jets of gas and dust erupt from the nucleus, right across your approach corridor.",
        educationalNote:
          "Rosetta had to adjust its trajectory as comet 67P grew active — jets are unpredictable and dusty.",
        roles: ["navigator"],
        choices: [
          {
            id: "fly_through",
            label: "Thread the plume for close-up science",
            description: "Fly through the jets for spectacular data. Dust impacts stress the spacecraft.",
            effects: { scienceDelta: 14, reliabilityDelta: -4, riskDelta: 0.1, quality: 0.55 },
          },
          {
            id: "stand_off",
            label: "Hold a safe stand-off distance",
            description: "Observe from 200 km. Safe, but the spectrometer loses detail.",
            effects: { scienceDelta: -6, quality: 0.75 },
          },
        ],
      },
      {
        id: "comet_discovery",
        stage: 6,
        title: "Organic Molecules Detected",
        description:
          "The spectrometer just detected complex organic molecules in a fresh jet. Ground teams request an extended observation.",
        educationalNote:
          "Comets may have delivered water and organics to the young Earth — exactly why we chase them.",
        trigger: { metric: "scienceCapability", atLeast: 100 },
        roles: ["scientist"],
        choices: [
          {
            id: "extended_obs",
            label: "Approach for an extended observation run",
            description: "Burn a little propellant to get closer and exploit the discovery.",
            effects: { fuelDelta: 250, scienceDelta: 16, dataDelta: 30, quality: 0.85 },
          },
          {
            id: "nominal_ops",
            label: "Stay on the planned trajectory",
            description: "The planned campaign already returns good data. Play it safe.",
            effects: { scienceDelta: 4, quality: 0.7 },
          },
        ],
      },
    ],
    imageId: "comet",
  },

  // ------------------------------------------------------------------ VENUS
  {
    id: "venus_probe",
    name: "Venus Atmospheric Probe",
    destination: "Venus",
    difficulty: "Advanced",
    type: "probe",
    description:
      "Plunge a probe into the crushing, 460 °C atmosphere of Venus and transmit measurements during the descent.",
    scientificPurpose:
      "Profile sulfuric acid clouds and hunt for phosphine to investigate whether anything could live in Venus's clouds.",
    budget: 55_000_000,
    maxMass: 6_000,
    minFuel: 2_200,
    minPower: 240,
    minPropulsion: 60,
    solarDerate: 1.15,
    minLanding: 0,
    minThermal: 85,
    minRadiation: 0,
    minNavigation: 20,
    requiredEquipment: ["communication_antenna", "science_instrument"],
    objectives: [
      { id: "survive_entry", description: "Survive atmospheric entry", required: true, points: 250, target: { kind: "stage", stage: 5 } },
      { id: "atmosphere_profile", description: "Profile the Venusian atmosphere", required: true, points: 150, target: { kind: "scienceData", minimum: 60 } },
      { id: "deep_transmit", description: "Keep transmitting from the lower atmosphere", required: false, points: 55, target: { kind: "stage", stage: 7 } },
      { id: "acid_clouds", description: "Sample the sulfuric acid cloud deck (spectrometer)", required: false, points: 50, target: { kind: "equipment", equipmentId: "spectrometer" } },
      { id: "power_margin", description: "Maintain a 120 W power margin at Venus", required: false, points: 45, target: { kind: "powerMargin", minimum: 120 } },
    ],
    events: [
      {
        id: "entry_corridor",
        stage: 5,
        title: "Entry Corridor Tighter Than Planned",
        description:
          "Trajectory solutions converge late: the probe will enter slightly steep. The heat shield will work harder than designed.",
        educationalNote:
          "Atmospheric entry is a narrow corridor — too steep and you burn up, too shallow and you skip off the atmosphere.",
        trigger: { metric: "reliability", below: 95 },
        roles: ["navigator"],
        choices: [
          {
            id: "aerobrake_longer",
            label: "Widen the corridor with an extra braking burn",
            description: "Spend propellant to shallow the entry angle. Easier on the heat shield.",
            effects: { fuelDelta: 300, reliabilityDelta: 2, quality: 0.9 },
          },
          {
            id: "steep_entry",
            label: "Accept the steeper entry",
            description: "Ride it out. The shield should hold — margin for error shrinks fast at 11 km/s.",
            effects: { riskDelta: 0.15, quality: 0.45 },
          },
        ],
      },
      {
        id: "cloud_corrosion",
        stage: 6,
        title: "Dense Acid Layer",
        description:
          "The probe is sinking through a dense sulfuric acid layer. External sensors are degrading faster than expected.",
        educationalNote:
          "Venus's clouds are concentrated sulfuric acid — Soviet Venera probes survived only hours.",
        roles: ["engineer"],
        choices: [
          {
            id: "retract_sensors",
            label: "Retract the most exposed sensors",
            description: "Protect the instrument suite at the cost of some measurements.",
            effects: { scienceDelta: -10, reliabilityDelta: 3, quality: 0.75 },
          },
          {
            id: "full_profile",
            label: "Keep all sensors exposed",
            description: "Take the full profile while everything still works. The data is priceless.",
            effects: { scienceDelta: 12, reliabilityDelta: -6, riskDelta: 0.08, quality: 0.55 },
          },
        ],
      },
    ],
    imageId: "venus",
  },

  // ------------------------------------------------------------------ ASTEROID BELT
  {
    id: "asteroid_survey",
    name: "Asteroid Belt Survey",
    destination: "Asteroid Belt",
    difficulty: "Advanced",
    type: "flyby",
    description:
      "Fly a survey spacecraft deep into the asteroid belt and rendezvous with a metal-rich near-Earth asteroid.",
    scientificPurpose:
      "Map the asteroid's metal content and structure — the raw material for tomorrow's in-space construction.",
    budget: 65_000_000,
    maxMass: 7_000,
    minFuel: 3_800,
    minPower: 320,
    minPropulsion: 80,
    solarDerate: 0.35,
    minLanding: 0,
    minThermal: 0,
    minRadiation: 40,
    minNavigation: 80,
    requiredEquipment: ["communication_antenna", "science_instrument", "nav_computer"],
    objectives: [
      { id: "belt_cruise", description: "Cruise safely into the asteroid belt", required: true, points: 200, target: { kind: "stage", stage: 5 } },
      { id: "asteroid_map", description: "Map the target asteroid", required: true, points: 200, target: { kind: "scienceData", minimum: 65 } },
      { id: "precision_nav", description: "Achieve a precision rendezvous (star tracker installed)", required: false, points: 50, target: { kind: "equipment", equipmentId: "star_tracker" } },
      { id: "metal_scan", description: "Complete the metallicity scan (spectrometer)", required: false, points: 50, target: { kind: "equipment", equipmentId: "spectrometer" } },
      { id: "fuel_reserve", description: "Finish with ≥ 600 kg of propellant", required: false, points: 50, target: { kind: "fuelRemaining", minimum: 600 } },
    ],
    events: [
      {
        id: "micrometeoroid",
        stage: 3,
        title: "Micrometeoroid Impact",
        description:
          "A sand-grain particle struck the spacecraft at 20 km/s. Diagnostics are checking for damage.",
        educationalNote:
          "Even dust is dangerous at interplanetary speeds — Whipple shields and robust structures absorb the hit.",
        trigger: { metric: "reliability", below: 96 },
        roles: ["engineer"],
        choices: [
          {
            id: "inspect_damage",
            label: "Pause cruise and inspect the damage",
            description: "Use a day of the schedule for a full system checkout. Catches problems early.",
            effects: { scienceDelta: -4, reliabilityDelta: 4, quality: 0.85 },
          },
          {
            id: "continue_cruise",
            label: "Continue on course",
            description: "Telemetry looks acceptable. Keep flying and hope nothing was knocked loose.",
            effects: { riskDelta: 0.1, quality: 0.55 },
          },
        ],
      },
      {
        id: "nav_correction",
        stage: 4,
        title: "Navigation Correction Required",
        description:
          "Gravitational tugs from nearby asteroids have drifted the trajectory. The target ellipse is slipping.",
        educationalNote:
          "Deep-space navigation is dead-reckoning refined by tiny corrections — NASA's Deep Space Network tracks probes to metres.",
        roles: ["navigator"],
        choices: [
          {
            id: "precise_burn",
            label: "Execute a precise correction burn",
            description: "Spend propellant to nail the rendezvous geometry.",
            effects: { fuelDelta: 280, scienceDelta: 6, quality: 0.85 },
          },
          {
            id: "accept_drift",
            label: "Accept the drift and a longer approach",
            description: "Save the propellant; arrive with a less favourable geometry.",
            effects: { scienceDelta: -10, quality: 0.6 },
          },
        ],
      },
    ],
    imageId: "asteroid",
  },

  // ------------------------------------------------------------------ JUPITER
  {
    id: "jupiter_flyby",
    name: "Jupiter System Flyby",
    destination: "Jupiter",
    difficulty: "Expert",
    type: "flyby",
    description:
      "Cross 700 million kilometres of space and thread the Jupiter system, flying past Europa and Io through the fiercest radiation belts in the solar system.",
    scientificPurpose:
      "Study Europa's subsurface ocean and Io's volcanism, and map Jupiter's magnetosphere during a daring flyby tour.",
    budget: 80_000_000,
    maxMass: 9_000,
    minFuel: 5_200,
    minPower: 480,
    minPropulsion: 110,
    solarDerate: 0.12,
    minLanding: 0,
    minThermal: 0,
    minRadiation: 70,
    minNavigation: 50,
    requiredEquipment: ["deep_space_antenna", "science_instrument"],
    objectives: [
      { id: "jupiter_arrival", description: "Complete the Jupiter flyby", required: true, points: 250, target: { kind: "stage", stage: 5 } },
      { id: "radiation_survival", description: "Survive the radiation belts and keep collecting data", required: true, points: 150, target: { kind: "stage", stage: 6 } },
      { id: "europa_science", description: "Achieve high-value Europa science", required: false, points: 55, target: { kind: "scienceData", minimum: 75 } },
      { id: "moon_gallery", description: "Downlink the full Galilean moon gallery", required: false, points: 45, target: { kind: "dataTransmitted", minimum: 180 } },
      { id: "power_margin", description: "Maintain a 150 W power margin at Jupiter", required: false, points: 50, target: { kind: "powerMargin", minimum: 150 } },
    ],
    events: [
      {
        id: "radiation_storm",
        stage: 3,
        title: "Solar Radiation Storm Warning",
        description:
          "A coronal mass ejection is sweeping through the outer solar system. It will wash over the spacecraft mid-cruise.",
        educationalNote:
          "Outside Earth's protective magnetosphere, solar storms fry unshielded electronics — Juno carried a titanium vault.",
        roles: ["engineer"],
        cooperative: "proposal",
        choices: [
          {
            id: "harden_systems",
            label: "Power down and ride out the storm",
            description: "Shield sensitive electronics in safe mode. Some cruise science is lost.",
            effects: { scienceDelta: -8, reliabilityDelta: 3, quality: 0.85 },
          },
          {
            id: "weather_it",
            label: "Keep all systems running",
            description: "Accept the radiation dose. Instruments keep working — electronics age faster.",
            effects: { reliabilityDelta: -7, riskDelta: 0.12, quality: 0.4 },
          },
        ],
      },
      {
        id: "europa_flyby",
        stage: 6,
        title: "Europa Plume Sighting",
        description:
          "Moments before the Europa pass, the ultraviolet sensor catches a active water plume. A small divert would fly straight through it.",
        educationalNote:
          "Hubble spotted candidate plumes at Europa — flying one would sample an alien ocean without landing.",
        roles: ["scientist"],
        choices: [
          {
            id: "divert_plume",
            label: "Divert through the plume",
            description: "Burn propellant to thread the plume — a once-in-a-mission measurement.",
            effects: { fuelDelta: 400, scienceDelta: 18, dataDelta: 40, quality: 0.8 },
          },
          {
            id: "nominal_flyby",
            label: "Fly the planned Europa corridor",
            description: "The planned flyby is already excellent science.",
            effects: { scienceDelta: 6, quality: 0.7 },
          },
        ],
      },
    ],
    imageId: "jupiter",
  },

  // ------------------------------------------------------------------ LUNAR CARGO
  {
    id: "lunar_cargo",
    name: "Lunar Cargo Delivery",
    destination: "Moon",
    difficulty: "Beginner",
    type: "lander",
    description:
      "Deliver a pressurised cargo module to the lunar south pole outpost. The cargo is precious — a rough landing is a failed delivery.",
    scientificPurpose:
      "Resupply a robotic outpost at the lunar south pole with spare parts and sample canisters ahead of crewed arrival.",
    budget: 42_000_000,
    maxMass: 6_000,
    minFuel: 1_400,
    minPower: 120,
    minPropulsion: 45,
    solarDerate: 1.0,
    minLanding: 70,
    minThermal: 0,
    minRadiation: 0,
    minNavigation: 20,
    requiredEquipment: ["communication_antenna"],
    objectives: [
      { id: "cargo_landing", description: "Set the cargo down intact", required: true, points: 250, target: { kind: "landingQuality", minimum: 55 } },
      { id: "surface_ops", description: "Support surface operations after touchdown", required: true, points: 150, target: { kind: "stage", stage: 6 } },
      { id: "precision_drop", description: "Deliver within 100 m of the outpost (precision landing)", required: false, points: 50, target: { kind: "landingQuality", minimum: 80 } },
      { id: "delivery_report", description: "Transmit the full delivery report to Earth", required: false, points: 50, target: { kind: "dataTransmitted", minimum: 100 } },
      { id: "fuel_reserve", description: "Land with propellant to spare (≥ 300 kg)", required: false, points: 50, target: { kind: "fuelRemaining", minimum: 300 } },
    ],
    events: [
      {
        id: "cargo_shift",
        stage: 5,
        title: "Cargo Shift During Descent",
        description:
          "One cargo pallet broke loose during braking. The centre of mass is now off-axis for the final approach.",
        educationalNote:
          "Landing with an off-centre mass is like carrying a suitcase on one side — thrusters must compensate constantly.",
        roles: ["navigator"],
        choices: [
          {
            id: "hover_repack",
            label: "Hover and re-seat the cargo (burn extra fuel)",
            description: "A few extra seconds of hover fix the balance and protect the landing.",
            effects: { fuelDelta: 180, landingQualityDelta: 14, quality: 0.85 },
          },
          {
            id: "land_as_is",
            label: "Land with the shifted cargo",
            description: "Save the fuel; accept a harder, less precise touchdown.",
            effects: { landingQualityDelta: -15, riskDelta: 0.1, quality: 0.5 },
          },
        ],
      },
      {
        id: "lunar_night",
        stage: 6,
        title: "Lunar Night Approaching",
        description:
          "Sunset at the outpost is 6 Earth-days away. The lander must survive −170 °C in darkness to keep the cargo warm.",
        educationalNote:
          "A lunar night lasts two Earth weeks; surviving it on batteries and heaters is the hardest part of polar lunar logistics.",
        trigger: { metric: "powerMargin", below: 200 },
        roles: ["engineer"],
        choices: [
          {
            id: "hibernate_cargo",
            label: "Hibernate with cargo heaters on batteries",
            description: "Keep the cargo just warm enough. Systems ride the cold.",
            effects: { reliabilityDelta: -2, quality: 0.8 },
          },
          {
            id: "minimum_power",
            label: "Power everything down to the minimum",
            description: "Guaranteed survival, but the cargo chills to its limit.",
            effects: { scienceDelta: -8, quality: 0.65 },
          },
        ],
      },
    ],
    imageId: "moon",
  },

  // ------------------------------------------------------------------ NEA SAMPLE RETURN
  {
    id: "nea_sample_return",
    name: "Near-Earth Asteroid Sample Return",
    destination: "Asteroid 2026-SX1",
    difficulty: "Intermediate",
    type: "flyby",
    description:
      "Rendezvous with a near-Earth asteroid, grab pristine regolith with a touch-and-go manoeuvre, and bring the canister home.",
    scientificPurpose:
      "Return unaltered material from a carbon-rich near-Earth asteroid — a time capsule from the birth of the solar system.",
    budget: 58_000_000,
    maxMass: 6_500,
    minFuel: 3_400,
    minPower: 300,
    minPropulsion: 75,
    solarDerate: 0.85,
    minLanding: 0,
    minThermal: 0,
    minRadiation: 15,
    minNavigation: 90,
    requiredEquipment: ["communication_antenna", "sample_arm", "nav_computer"],
    objectives: [
      { id: "rendezvous_tag", description: "Achieve rendezvous and touch the surface", required: true, points: 220, target: { kind: "stage", stage: 5 } },
      { id: "sealed_sample", description: "Collect and seal a pristine sample", required: true, points: 180, target: { kind: "scienceData", minimum: 55 } },
      { id: "precision_tag", description: "Touch down inside the sampling zone (terrain-relative navigation)", required: false, points: 50, target: { kind: "equipment", equipmentId: "terrain_nav" } },
      { id: "sample_report", description: "Transmit the full sampling dataset", required: false, points: 50, target: { kind: "dataTransmitted", minimum: 140 } },
      { id: "return_margin", description: "Keep ≥ 500 kg of propellant for the return leg", required: false, points: 50, target: { kind: "fuelRemaining", minimum: 500 } },
    ],
    events: [
      {
        id: "spin_state",
        stage: 4,
        title: "Unexpected Spin State",
        description:
          "The asteroid's rotation is faster than survey data suggested. The planned sampling site sweeps past quickly.",
        educationalNote:
          "Bennu surprised OSIRIS-REx with a boulder-strewn surface and particle ejections — asteroid missions re-plan constantly.",
        roles: ["navigator"],
        choices: [
          {
            id: "match_spin",
            label: "Match the spin with tighter tracking",
            description: "Harder flying, cleaner sampling geometry.",
            effects: { fuelDelta: 200, scienceDelta: 8, quality: 0.85 },
          },
          {
            id: "grab_quick",
            label: "Take a quicker, shallower grab",
            description: "Less propellant, a smaller and less pristine sample.",
            effects: { scienceDelta: -10, quality: 0.55 },
          },
        ],
      },
      {
        id: "seal_concern",
        stage: 6,
        title: "Canister Seal Concern",
        description:
          "Telemetry suggests the sample canister lid did not fully latch after stowage. The sample may be leaking.",
        educationalNote:
          "OSIRIS-REx stowed its sample so fast precisely because loose material was escaping — engineers call it a leak drill.",
        trigger: { metric: "reliability", below: 95 },
        roles: ["engineer"],
        cooperative: "proposal",
        choices: [
          {
            id: "reseat_seal",
            label: "Pause and re-seat the canister seal",
            description: "A careful remote re-latch protects the sample.",
            effects: { scienceDelta: -4, reliabilityDelta: 3, quality: 0.9 },
          },
          {
            id: "accept_loss",
            label: "Cap it and continue the campaign",
            description: "Keep observing; accept a partial sample loss.",
            effects: { scienceDelta: -8, quality: 0.55 },
          },
        ],
      },
    ],
    imageId: "asteroid",
  },

  // ------------------------------------------------------------------ MERCURY ORBITER
  {
    id: "mercury_orbiter",
    name: "Mercury Orbiter",
    destination: "Mercury",
    difficulty: "Advanced",
    type: "orbiter",
    description:
      "Brake into orbit around the planet closest to the Sun — a world of 430 °C days and −180 °C nights, six times closer to the fire than Earth.",
    scientificPurpose:
      "Map Mercury's strangely oversized iron core and its permanently shadowed polar ice under a scorching Sun.",
    budget: 62_000_000,
    maxMass: 6_800,
    minFuel: 4_200,
    minPower: 500,
    minPropulsion: 90,
    solarDerate: 1.9,
    minLanding: 0,
    minThermal: 60,
    minRadiation: 30,
    minNavigation: 60,
    requiredEquipment: ["communication_antenna", "science_instrument"],
    objectives: [
      { id: "mercury_orbit", description: "Achieve Mercury orbit", required: true, points: 250, target: { kind: "stage", stage: 5 } },
      { id: "core_map", description: "Map the crust and iron core", required: true, points: 150, target: { kind: "scienceData", minimum: 65 } },
      { id: "polar_ice", description: "Confirm polar ice deposits (spectrometer)", required: false, points: 50, target: { kind: "equipment", equipmentId: "spectrometer" } },
      { id: "downlink", description: "Downlink the full survey dataset", required: false, points: 45, target: { kind: "dataTransmitted", minimum: 150 } },
      { id: "thermal_survive", description: "Maintain a 180 W power margin at Mercury", required: false, points: 55, target: { kind: "powerMargin", minimum: 180 } },
    ],
    events: [
      {
        id: "hot_pass",
        stage: 6,
        title: "Periapsis Over the Sunlit Side",
        description:
          "The orbit's low point crosses the subsolar meridian: the spacecraft stares into a furnace while it works.",
        educationalNote:
          "MESSENGER and BepiColombo hide behind sunshades — at Mercury, the spacecraft itself must behave like a sunshield.",
        trigger: { metric: "reliability", below: 95 },
        roles: ["engineer"],
        choices: [
          {
            id: "shield_side",
            label: "Point the shield at the Sun, instruments edge-on",
            description: "Safer thermal geometry at some cost to observation quality.",
            effects: { scienceDelta: -7, reliabilityDelta: 2, quality: 0.85 },
          },
          {
            id: "full_exposure",
            label: "Keep instruments pointed straight down",
            description: "Best data, hardest thermal hour of the mission.",
            effects: { scienceDelta: 8, riskDelta: 0.12, quality: 0.5 },
          },
        ],
      },
      {
        id: "resonance_tweak",
        stage: 4,
        title: "Resonance Orbit Adjustment",
        description:
          "Flight dynamics wants a slightly different Mercury arrival time to line up the science orbit's ground track.",
        educationalNote:
          "Mercury flybys are chess with gravity — arrival timing echoes through the whole mission geometry.",
        roles: ["navigator"],
        choices: [
          {
            id: "retune",
            label: "Retune the arrival (propellant for a cleaner orbit)",
            description: "Better mapping geometry for the whole mission.",
            effects: { fuelDelta: 240, scienceDelta: 7, quality: 0.85 },
          },
          {
            id: "keep_arrival",
            label: "Keep the current arrival",
            description: "Save propellant; accept patchier coverage.",
            effects: { scienceDelta: -8, quality: 0.6 },
          },
        ],
      },
    ],
    imageId: "mercury",
  },

  // ------------------------------------------------------------------ SOLAR OBSERVATORY
  {
    id: "solar_observation",
    name: "Solar Observation Mission",
    destination: "The Sun",
    difficulty: "Advanced",
    type: "orbiter",
    description:
      "Fly a hardened observatory to a close solar orbit — inside the orbit of Mercury — and watch the star that rules everything.",
    scientificPurpose:
      "Study solar flares, coronal mass ejections and the solar wind at the source, giving space weather forecasts hours of extra warning.",
    budget: 66_000_000,
    maxMass: 6_000,
    minFuel: 3_600,
    minPower: 600,
    minPropulsion: 80,
    solarDerate: 2.6,
    minLanding: 0,
    minThermal: 80,
    minRadiation: 55,
    minNavigation: 40,
    requiredEquipment: ["communication_antenna", "science_instrument"],
    objectives: [
      { id: "solar_orbit", description: "Enter the close solar observation orbit", required: true, points: 240, target: { kind: "stage", stage: 5 } },
      { id: "flare_watch", description: "Run the flare-watch campaign", required: true, points: 160, target: { kind: "scienceData", minimum: 70 } },
      { id: "coronal_data", description: "Downlink continuous coronal data", required: false, points: 50, target: { kind: "dataTransmitted", minimum: 160 } },
      { id: "mag_boom", description: "Operate the magnetometer boom (fields package)", required: false, points: 50, target: { kind: "equipment", equipmentId: "magnetometer" } },
      { id: "power_margin", description: "Hold a 250 W power margin at perihelion", required: false, points: 50, target: { kind: "powerMargin", minimum: 250 } },
    ],
    events: [
      {
        id: "flare_alert",
        stage: 6,
        title: "X-Class Flare In Progress",
        description:
          "The Sun just unleashed an X-class flare aimed squarely at the observatory. Radiation and particles are spiking.",
        educationalNote:
          "Solar Orbiter and Parker Solar Probe survive by hiding behind heat shields — the instruments peek out through tiny windows.",
        roles: ["commander"],
        cooperative: "vote",
        choices: [
          {
            id: "ride_out",
            label: "Shelter behind the shield and ride it out",
            description: "Pause science for the storm's duration.",
            effects: { scienceDelta: -8, reliabilityDelta: 4, quality: 0.85 },
          },
          {
            id: "through_it",
            label: "Keep observing through the flare",
            description: "Once-in-a-mission data at real electronic risk.",
            effects: { scienceDelta: 15, riskDelta: 0.16, quality: 0.55 },
          },
        ],
      },
      {
        id: "perihelion_crunch",
        stage: 5,
        title: "Perihelion Thermal Crunch",
        description:
          "The closest approach to the Sun is heating every surface faster than models predicted.",
        educationalNote:
          "Parker Solar Probe's shield reaches 1,400 °C while its instruments stay at room temperature — thermal design is the mission.",
        trigger: { metric: "reliability", below: 94 },
        roles: ["engineer"],
        choices: [
          {
            id: "attitude_shade",
            label: "Adjust attitude for maximum shading",
            description: "Thermally safest, observation geometry slightly worse.",
            effects: { fuelDelta: 90, reliabilityDelta: 3, quality: 0.85 },
          },
          {
            id: "push_closer",
            label: "Hold the planned geometry",
            description: "The data is worth the heat — probably.",
            effects: { scienceDelta: 9, riskDelta: 0.13, quality: 0.5 },
          },
        ],
      },
    ],
    imageId: "sun",
  },

  // ------------------------------------------------------------------ EUROPA
  {
    id: "europa_exploration",
    name: "Europa Exploration",
    destination: "Europa",
    difficulty: "Expert",
    type: "orbiter",
    description:
      "Settle into orbit around Jupiter's ice moon and sound the global ocean hidden beneath its cracked shell — through the harshest radiation field a spacecraft can survive.",
    scientificPurpose:
      "Determine the thickness of Europa's ice shell and catalogue the chemistry of its subsurface ocean — is it habitable?",
    budget: 88_000_000,
    maxMass: 9_000,
    minFuel: 5_400,
    minPower: 450,
    minPropulsion: 110,
    solarDerate: 0.12,
    minLanding: 0,
    minThermal: 0,
    minRadiation: 85,
    minNavigation: 70,
    requiredEquipment: ["deep_space_antenna", "science_instrument", "radar_sounder"],
    objectives: [
      { id: "europa_orbit", description: "Achieve Europa orbit", required: true, points: 240, target: { kind: "stage", stage: 5 } },
      { id: "ocean_sound", description: "Sound the subsurface ocean with radar", required: true, points: 160, target: { kind: "scienceData", minimum: 75 } },
      { id: "plume_transit", description: "Fly through an active plume (stage 4)", required: false, points: 50, target: { kind: "stage", stage: 4 } },
      { id: "ocean_data", description: "Downlink the full ocean dataset", required: false, points: 50, target: { kind: "dataTransmitted", minimum: 200 } },
      { id: "power_margin", description: "Maintain a 150 W power margin at Europa", required: false, points: 50, target: { kind: "powerMargin", minimum: 150 } },
    ],
    events: [
      {
        id: "radiation_dose",
        stage: 3,
        title: "Radiation Dose Climbing",
        description:
          "Jupiter's belts are cooking the electronics faster than planned. The vault is holding, but the margin is shrinking.",
        educationalNote:
          "Europa Clipper orbits Jupiter in loops, not Europa itself — dodging radiation is the whole orbit design.",
        roles: ["engineer"],
        cooperative: "proposal",
        choices: [
          {
            id: "raise_orbit",
            label: "Raise the orbit to escape the worst belts",
            description: "Less radiation, longer transfer, less close science.",
            effects: { fuelDelta: 260, scienceDelta: -6, reliabilityDelta: 3, quality: 0.85 },
          },
          {
            id: "stay_low",
            label: "Stay in the science orbit",
            description: "Accept the dose; the instruments are shielded anyway.",
            effects: { reliabilityDelta: -5, riskDelta: 0.1, quality: 0.5 },
          },
        ],
      },
      {
        id: "ice_quake",
        stage: 6,
        title: "Ice Quake Detected",
        description:
          "The radar caught a shifting ice plate — a fresh fracture is exposing subsurface material to space.",
        educationalNote:
          "Europa's ice shell tectonics recycle its surface; somewhere, fresh ocean material lies on top.",
        trigger: { metric: "scienceCapability", atLeast: 90 },
        roles: ["scientist"],
        choices: [
          {
            id: "retask_radar",
            label: "Retask the radar over the fracture",
            description: "A unique look at fresh subsurface layers.",
            effects: { powerStress: 30, scienceDelta: 14, dataDelta: 25, quality: 0.85 },
          },
          {
            id: "continue_grid",
            label: "Continue the planned mapping grid",
            description: "Systematic coverage beats opportunism — usually.",
            effects: { quality: 0.65 },
          },
        ],
      },
    ],
    imageId: "europa",
  },

  // ------------------------------------------------------------------ SATURN
  {
    id: "saturn_orbiter",
    name: "Saturn Orbiter",
    destination: "Saturn",
    difficulty: "Expert",
    type: "orbiter",
    description:
      "Cross a billion and a half kilometres and thread the ring plane into Saturn orbit for a decade-long tour of the ringed world and its moons.",
    scientificPurpose:
      "Study Saturn's rings, its hazy moon Titan and the icy jets of Enceladus — a mini solar system in one system.",
    budget: 92_000_000,
    maxMass: 9_500,
    minFuel: 6_000,
    minPower: 480,
    minPropulsion: 120,
    solarDerate: 0.09,
    minLanding: 0,
    minThermal: 0,
    minRadiation: 50,
    minNavigation: 90,
    requiredEquipment: ["deep_space_antenna", "science_instrument", "nav_computer"],
    objectives: [
      { id: "saturn_orbit", description: "Achieve Saturn orbit", required: true, points: 250, target: { kind: "stage", stage: 5 } },
      { id: "ring_tour", description: "Map the rings and inner moons", required: true, points: 150, target: { kind: "scienceData", minimum: 75 } },
      { id: "titan_flybys", description: "Execute the Titan flyby sequence", required: false, points: 55, target: { kind: "stage", stage: 6 } },
      { id: "dust_science", description: "Sample the ring environment (dust analyzer)", required: false, points: 50, target: { kind: "equipment", equipmentId: "dust_analyzer" } },
      { id: "downlink", description: "Downlink the ring gallery", required: false, points: 45, target: { kind: "dataTransmitted", minimum: 200 } },
    ],
    events: [
      {
        id: "ring_crossing",
        stage: 5,
        title: "Ring-Plane Crossing",
        description:
          "The insertion trajectory crosses the ring plane through a sparse gap — dust flux will spike for seconds.",
        educationalNote:
          "Cassini crossed the ring plane dozens of times, aiming for gaps mapped by its own instruments.",
        roles: ["navigator"],
        choices: [
          {
            id: "through_gap",
            label: "Thread the mapped gap",
            description: "The planned crossing — minimal dust, perfect geometry.",
            effects: { quality: 0.85 },
          },
          {
            id: "wide_detour",
            label: "Detour above the ring plane",
            description: "Extra propellant for a safer, dust-free crossing.",
            effects: { fuelDelta: 240, reliabilityDelta: 2, quality: 0.75 },
          },
        ],
      },
      {
        id: "enceladus_plume",
        stage: 6,
        title: "Enceladus Plume Alignment",
        description:
          "The icy moon's south-polar jets are aligned perfectly with the orbit — a deep plume pass is possible.",
        educationalNote:
          "Cassini flew through Enceladus's jets and tasted an ocean — salt, organics, and hydrothermal chemistry.",
        trigger: { metric: "scienceCapability", atLeast: 85 },
        roles: ["scientist"],
        cooperative: "proposal",
        choices: [
          {
            id: "deep_pass",
            label: "Request a deep plume pass",
            description: "Ocean chemistry measured directly — at the cost of a fuel-burning retarget.",
            effects: { fuelDelta: 300, scienceDelta: 15, dataDelta: 30, quality: 0.85 },
          },
          {
            id: "shallow_pass",
            label: "Take the planned shallow pass",
            description: "Good data, no extra propellant.",
            effects: { scienceDelta: 6, quality: 0.7 },
          },
        ],
      },
    ],
    imageId: "saturn",
  },

  // ------------------------------------------------------------------ TITAN PROBE
  {
    id: "titan_probe",
    name: "Titan Atmospheric Probe",
    destination: "Titan",
    difficulty: "Expert",
    type: "probe",
    description:
      "Descend through the orange haze of Titan — the only moon with a real atmosphere — and drift down onto a methane shore.",
    scientificPurpose:
      "Profile Titan's nitrogen-methane atmosphere and test its lakes for prebiotic chemistry in the deep freeze.",
    budget: 78_000_000,
    maxMass: 7_500,
    minFuel: 4_600,
    minPower: 420,
    minPropulsion: 85,
    solarDerate: 0.09,
    minLanding: 0,
    minThermal: 70,
    minRadiation: 25,
    minNavigation: 55,
    requiredEquipment: ["communication_antenna", "science_instrument", "spectrometer"],
    objectives: [
      { id: "haze_entry", description: "Survive entry through the haze", required: true, points: 240, target: { kind: "stage", stage: 5 } },
      { id: "descent_profile", description: "Profile the atmosphere during descent", required: true, points: 160, target: { kind: "scienceData", minimum: 70 } },
      { id: "shore_transmit", description: "Keep transmitting from the surface", required: false, points: 55, target: { kind: "stage", stage: 7 } },
      { id: "lake_radar", description: "Sound the lakes with radar", required: false, points: 45, target: { kind: "equipment", equipmentId: "radar_sounder" } },
      { id: "float_margin", description: "Finish with ≥ 500 kg propellant for station keeping", required: false, points: 50, target: { kind: "fuelRemaining", minimum: 500 } },
    ],
    events: [
      {
        id: "methane_storm",
        stage: 6,
        title: "Methane Rain Squall",
        description:
          "A dark squall of methane rain drifts across the descent path, blurring the cameras and chilling the shell.",
        educationalNote:
          "On Titan it rains methane; the drops fall slowly through thick air, and the lakes are liquid natural gas.",
        roles: ["scientist"],
        choices: [
          {
            id: "through_rain",
            label: "Descend through the squall",
            description: "Rain chemistry is a scientific gift — imaging suffers.",
            effects: { scienceDelta: 11, dataDelta: -8, quality: 0.7 },
          },
          {
            id: "drift_clear",
            label: "Steer toward clearer air",
            description: "Burn a little propellant for clean imaging.",
            effects: { fuelDelta: 90, scienceDelta: 4, quality: 0.8 },
          },
        ],
      },
      {
        id: "chute_anomaly",
        stage: 5,
        title: "Parachute Descent Anomaly",
        description:
          "The main chute is oscillating more than predicted; the descent timeline has stretched by minutes.",
        educationalNote:
          "Huygens' descent through Titan's haze took 2.5 hours — every minute of battery and heat mattered.",
        trigger: { metric: "reliability", below: 94 },
        roles: ["engineer"],
        choices: [
          {
            id: "cut_early",
            label: "Cut to the drogue chute early",
            description: "Faster descent, harder landing, more battery left afterwards.",
            effects: { riskDelta: 0.1, reliabilityDelta: 2, quality: 0.65 },
          },
          {
            id: "ride_main",
            label: "Ride the main chute down",
            description: "Gentle landing; the batteries drain in the cold.",
            effects: { powerStress: 45, quality: 0.75 },
          },
        ],
      },
    ],
    imageId: "titan",
  },

  // ------------------------------------------------------------------ MARS SAMPLE RETURN
  {
    id: "mars_sample_return",
    name: "Mars Sample Return",
    destination: "Mars",
    difficulty: "Expert",
    type: "lander",
    description:
      "Land beside cached sample tubes, load them into a return rocket, and launch the precious cargo off Mars — the hardest task ever attempted with a spacecraft.",
    scientificPurpose:
      "Return sealed Martian rock cores to Earth, where laboratories a thousand times more capable than any rover await them.",
    budget: 95_000_000,
    maxMass: 10_000,
    minFuel: 7_000,
    minPower: 380,
    minPropulsion: 130,
    solarDerate: 0.5,
    minLanding: 80,
    minThermal: 50,
    minRadiation: 0,
    minNavigation: 80,
    requiredEquipment: ["communication_antenna", "science_instrument", "sample_arm", "nav_computer"],
    objectives: [
      { id: "precision_arrival", description: "Land beside the sample cache with precision", required: true, points: 220, target: { kind: "landingQuality", minimum: 60 } },
      { id: "load_cache", description: "Collect and load the sealed sample tubes", required: true, points: 180, target: { kind: "scienceData", minimum: 60 } },
      { id: "ascent_margin", description: "Preserve the ascent window (≥ 900 kg propellant at mission end)", required: false, points: 60, target: { kind: "fuelRemaining", minimum: 900 } },
      { id: "tube_report", description: "Transmit the tube inventory and loading data", required: false, points: 45, target: { kind: "dataTransmitted", minimum: 180 } },
      { id: "terrain_nav_obj", description: "Use terrain-relative navigation for the landing", required: false, points: 45, target: { kind: "equipment", equipmentId: "terrain_nav" } },
    ],
    events: [
      {
        id: "ascent_storm",
        stage: 6,
        title: "Dust Storm Over the Ascent Path",
        description:
          "A dust cell is crossing the launch site. Solar-powered ascent preparation is slipping behind schedule.",
        educationalNote:
          "Launching from Mars means fighting its weather with a spacecraft that must also be a rocket.",
        trigger: { metric: "powerMargin", below: 320 },
        roles: ["commander"],
        cooperative: "vote",
        choices: [
          {
            id: "wait_out",
            label: "Delay ascent preparations for cleaner skies",
            description: "Safer charging and loading; the launch window narrows.",
            effects: { scienceDelta: -6, reliabilityDelta: 2, quality: 0.8 },
          },
          {
            id: "charge_hard",
            label: "Push preparations on battery power",
            description: "Hold the window at the cost of stored energy.",
            effects: { powerStress: 60, riskDelta: 0.1, quality: 0.55 },
          },
        ],
      },
      {
        id: "tube_stuck",
        stage: 6,
        title: "Sample Tube Handling Fault",
        description:
          "One sealed tube is seated stubbornly in its depot slot. The arm's grip force is at its rated limit.",
        educationalNote:
          "Robotic sampling on another planet is slow, careful work — every gram of force is engineered in advance.",
        roles: ["engineer"],
        cooperative: "proposal",
        choices: [
          {
            id: "gentle_retry",
            label: "Back off and retry with a gentler grip",
            description: "Time-consuming, safe for the irreplaceable sample.",
            effects: { scienceDelta: -3, reliabilityDelta: 2, quality: 0.85 },
          },
          {
            id: "force_it",
            label: "Pull with maximum force",
            description: "Fast — and a crumpled tube would be a tragedy.",
            effects: { riskDelta: 0.16, quality: 0.4 },
          },
        ],
      },
    ],
    imageId: "mars",
  },

  // ------------------------------------------------------------------ DEEP SPACE
  {
    id: "deep_space_precursor",
    name: "Deep-Space Interstellar Precursor",
    destination: "Interstellar Space",
    difficulty: "Expert",
    type: "flyby",
    description:
      "Build a spacecraft engineered to work where the Sun is just the brightest star — a precursor mission beyond the edge of the solar system.",
    scientificPurpose:
      "Measure the heliopause, the interstellar medium and the Sun's journey through the galaxy — with the most autonomous spacecraft ever flown.",
    budget: 98_000_000,
    maxMass: 9_000,
    minFuel: 6_200,
    minPower: 520,
    minPropulsion: 130,
    solarDerate: 0.03,
    minLanding: 0,
    minThermal: 0,
    minRadiation: 45,
    minNavigation: 100,
    requiredEquipment: ["deep_space_antenna", "science_instrument", "nav_computer", "star_tracker"],
    objectives: [
      { id: "heliopause", description: "Cross the heliopause into interstellar space", required: true, points: 250, target: { kind: "stage", stage: 5 } },
      { id: "ism_science", description: "Characterise the interstellar medium", required: true, points: 150, target: { kind: "scienceData", minimum: 70 } },
      { id: "fields_pkg", description: "Operate the interstellar fields package (magnetometer)", required: false, points: 50, target: { kind: "equipment", equipmentId: "magnetometer" } },
      { id: "long_haul_data", description: "Downlink the interstellar dataset", required: false, points: 50, target: { kind: "dataTransmitted", minimum: 150 } },
      { id: "power_margin", description: "Hold a 200 W power margin decades out", required: false, points: 50, target: { kind: "powerMargin", minimum: 200 } },
    ],
    events: [
      {
        id: "hypervelocity_dust",
        stage: 3,
        title: "Hypervelocity Dust Strike",
        description:
          "At 25 km/s relative speed, an interstellar dust grain hit like a rifle round. The forward shield caught it.",
        educationalNote:
          "Voyager and New Horizons race through a medium where even atoms hit hard — shielding is life support.",
        trigger: { metric: "reliability", below: 96 },
        roles: ["engineer"],
        choices: [
          {
            id: "full_survey",
            label: "Full damage survey before continuing",
            description: "A day of diagnostics; problems caught early stay small.",
            effects: { scienceDelta: -3, reliabilityDelta: 4, quality: 0.85 },
          },
          {
            id: "telemetry_only",
            label: "Trust remote telemetry and press on",
            description: "No time to spare on a decades-long flight — or is there exactly time?",
            effects: { riskDelta: 0.12, quality: 0.5 },
          },
        ],
      },
      {
        id: "rtg_decay",
        stage: 6,
        title: "Power Budget Tightening",
        description:
          "The RTGs are decaying exactly as physics predicts — but the mission's appetite has not.",
        educationalNote:
          "Voyager's team shuts instruments one by one, like closing rooms in a house to keep the rest warm.",
        trigger: { metric: "powerMargin", below: 240 },
        roles: ["commander"],
        choices: [
          {
            id: "shed_load",
            label: "Power down the lowest-priority instruments",
            description: "A carefully staged retreat that keeps core science alive.",
            effects: { scienceDelta: -7, reliabilityDelta: 2, quality: 0.85 },
          },
          {
            id: "share_buffer",
            label: "Run everything on the battery buffer",
            description: "Keep all instruments with no margin left for surprises.",
            effects: { powerStress: 50, riskDelta: 0.1, quality: 0.5 },
          },
        ],
      },
    ],
    imageId: "deepspace",
  },
];

export const MISSIONS_BY_ID: Record<string, Mission> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m])
);

export function getMission(id: string): Mission | undefined {
  return MISSIONS_BY_ID[id];
}
