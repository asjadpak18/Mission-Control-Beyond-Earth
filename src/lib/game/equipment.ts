/**
 * ============================================================================
 * EQUIPMENT CATALOGUE — owned by the Game Systems developer (AI 2)
 * ============================================================================
 * v2.0: expanded from 21 to 54 well-balanced components covering every major
 * spacecraft subsystem with meaningful trade-offs in every category.
 * Every item is created through `defineEquipment` so all frozen-contract
 * fields always exist (zero for inapplicable attributes).
 *
 * Balance targets:
 * - A viable spacecraft exists for every mission within budget and mass.
 * - Chemical engines: high thrust, heavy propellant use.
 * - Nuclear thermal: high thrust, moderate propellant use, very expensive.
 * - Ion engines: low thrust, extremely efficient, power hungry.
 * - Solar arrays: cheap power near the Sun, weak far out (see mission solarDerate).
 * - RTGs: steady power anywhere, expensive and heavy.
 * - Protection and structure now offer a real quality ladder (light → heavy).
 * ============================================================================
 */

import { Equipment, EquipmentCategory } from "./types";

type EquipmentSeed = Partial<Equipment> & Pick<Equipment, "id" | "name" | "category" | "description" | "tradeoff">;

function defineEquipment(seed: EquipmentSeed): Equipment {
  return {
    isSolar: false,
    cost: 0,
    mass: 0,
    powerGeneration: 0,
    powerConsumption: 0,
    fuelCapacity: 0,
    fuelConsumption: 0,
    propulsion: 0,
    reliability: 95,
    powerStorage: 0,
    scienceOutput: 0,
    radiationShielding: 0,
    thermalProtection: 0,
    landingAssist: 0,
    commCapability: 0,
    navigation: 0,
    structural: 0,
    ...seed,
  };
}

export const EQUIPMENT: Equipment[] = [
  // ------------------------------------------------------------------ Propulsion
  defineEquipment({
    id: "chemical_engine",
    name: "Kestrel-9 Chemical Engine",
    category: "Propulsion",
    description:
      "A proven liquid-fuel main engine. Delivers high thrust for launch escapes and major manoeuvres, but burns propellant quickly.",
    tradeoff:
      "High thrust gets you there fast, but every kilogram of propellant you carry also has to be lifted — heavier spacecraft need even more fuel.",
    cost: 2_400_000,
    mass: 280,
    propulsion: 45,
    fuelConsumption: 11,
    reliability: 92,
  }),
  defineEquipment({
    id: "heavy_chemical_engine",
    name: "Prometheus Heavy Engine",
    category: "Propulsion",
    description:
      "A high-thrust engine for demanding missions such as Mars transfers and heavy payloads. Powerful, but the thirstiest engine in the catalogue.",
    tradeoff:
      "Doubling thrust nearly doubles propellant demand. Powerful engines make missions possible — and expensive.",
    cost: 5_200_000,
    mass: 620,
    propulsion: 100,
    fuelConsumption: 13,
    reliability: 90,
  }),
  defineEquipment({
    id: "ion_engine",
    name: "Hall-Effect Ion Thruster",
    category: "Propulsion",
    description:
      "An electric propulsion system that accelerates ionised propellant. Extremely fuel-efficient and gentle on hardware, but it needs a lot of electricity and produces little thrust.",
    tradeoff:
      "Ion engines sip propellant but demand constant power. Without strong solar arrays or an RTG, an ion craft simply drifts.",
    cost: 6_500_000,
    mass: 240,
    propulsion: 32,
    fuelConsumption: 2.2,
    powerConsumption: 90,
    reliability: 96,
  }),
  defineEquipment({
    id: "vacuum_engine",
    name: "Vacuum-Optimised Engine",
    category: "Propulsion",
    description:
      "A chemical engine with a huge expandable nozzle tuned for the vacuum of space. Solid mid-range thrust with kinder fuel consumption than a heavy lifter.",
    tradeoff:
      "Efficiency in vacuum costs flexibility: the long nozzle is fragile and heavy compared with compact engines.",
    cost: 3_400_000,
    mass: 380,
    propulsion: 60,
    fuelConsumption: 8.5,
    reliability: 93,
  }),
  defineEquipment({
    id: "nuclear_engine",
    name: "Nuclear Thermal Engine",
    category: "Propulsion",
    description:
      "A reactor-heated hydrogen engine: heavy-lift thrust with roughly half the propellant burn of chemical engines. The priciest way to move.",
    tradeoff:
      "Nuclear thermal halves your fuel bill but doubles your cost per newton — and the reactor adds mass and 30 W of pump power.",
    cost: 9_800_000,
    mass: 700,
    propulsion: 85,
    fuelConsumption: 6.5,
    powerConsumption: 30,
    reliability: 90,
  }),
  defineEquipment({
    id: "advanced_ion_engine",
    name: "NEXT-C Advanced Ion Drive",
    category: "Propulsion",
    description:
      "A gridded ion engine with the best propellant efficiency ever flown. Thrust is gentle; the power appetite is enormous.",
    tradeoff:
      "The most fuel-efficient drive in the catalogue — if you can feed it 120 W and accept a slow, patient climb.",
    cost: 8_200_000,
    mass: 300,
    propulsion: 40,
    fuelConsumption: 1.4,
    powerConsumption: 120,
    reliability: 95,
  }),
  defineEquipment({
    id: "monoprop_thrusters",
    name: "Monopropellant Thruster Cluster",
    category: "Propulsion",
    description:
      "Sixteen small simple thrusters for attitude control and small burns. Cheap, light and reliable — but weak for major manoeuvres.",
    tradeoff:
      "Cheap insurance for fine control, but a cluster alone cannot push a spacecraft across the solar system.",
    cost: 900_000,
    mass: 90,
    propulsion: 18,
    fuelConsumption: 8,
    reliability: 97,
  }),

  // ------------------------------------------------------------------ Fuel
  defineEquipment({
    id: "fuel_tank_small",
    name: "Compact Propellant Tank",
    category: "Fuel",
    description: "A small tank holding 600 kg of propellant. Good for fine-tuning your fuel margin.",
    tradeoff:
      "Fuel improves how much you can manoeuvre, but every tank adds mass — and heavier spacecraft burn more fuel to move.",
    cost: 350_000,
    mass: 90,
    fuelCapacity: 600,
    reliability: 99,
  }),
  defineEquipment({
    id: "fuel_tank_large",
    name: "Primary Propellant Tank",
    category: "Fuel",
    description: "A large 2,400 kg propellant tank, the workhorse of interplanetary missions.",
    tradeoff:
      "One large tank carries more fuel per kilogram of tank mass than several small ones — but a full load makes the spacecraft heavy.",
    cost: 950_000,
    mass: 320,
    fuelCapacity: 2_400,
    reliability: 99,
  }),
  defineEquipment({
    id: "fuel_tank_drop",
    name: "Jettisonable Drop Tank",
    category: "Fuel",
    description:
      "A 1,200 kg tank bolted alongside the bus that can be dropped after the departure burn to shed dead mass.",
    tradeoff:
      "More total propellant without a permanently heavier craft — but drop hardware costs money and adds mounting mass.",
    cost: 620_000,
    mass: 200,
    fuelCapacity: 1_200,
    reliability: 98,
  }),
  defineEquipment({
    id: "xenon_tank",
    name: "Xenon High-Pressure Tank",
    category: "Fuel",
    description:
      "A compact composite tank holding 900 kg of xenon for ion drives — very light for the propellant it stores.",
    tradeoff:
      "Xenon tanks are the lightest way to carry fuel, but the gas and the tank are expensive.",
    cost: 800_000,
    mass: 70,
    fuelCapacity: 900,
    reliability: 98,
  }),

  // ------------------------------------------------------------------ Power
  defineEquipment({
    id: "solar_array",
    name: "Solar Array",
    category: "Power",
    description:
      "A photovoltaic panel generating 150 W in Earth-Moon sunlight. Output falls with distance from the Sun (see the mission briefing).",
    tradeoff:
      "Larger solar arrays improve power generation but add mass and cost — and near Jupiter they barely work at all.",
    cost: 500_000,
    mass: 150,
    powerGeneration: 150,
    isSolar: true,
    reliability: 95,
  }),
  defineEquipment({
    id: "solar_array_large",
    name: "High-Efficiency Solar Wing",
    category: "Power",
    description:
      "An advanced 420 W solar wing using triple-junction cells. The best solar performance available, still limited far from the Sun.",
    tradeoff:
      "More power for the same sunlight — but 260 kg of wings also make your spacecraft harder to turn and more expensive.",
    cost: 1_400_000,
    mass: 260,
    powerGeneration: 420,
    isSolar: true,
    reliability: 93,
  }),
  defineEquipment({
    id: "rtg",
    name: "Radioisotope Generator (RTG)",
    category: "Power",
    description:
      "Converts heat from decaying plutonium into 320 W of electricity. Works day and night, at any distance from the Sun, for decades.",
    tradeoff:
      "An RTG gives you power anywhere in the solar system — the price is a heavy hit to your budget.",
    cost: 8_500_000,
    mass: 340,
    powerGeneration: 320,
    reliability: 98,
  }),
  defineEquipment({
    id: "battery",
    name: "Lithium-Ion Battery Pack",
    category: "Power",
    description:
      "A 400 Wh battery that buffers short power spikes and eclipses. Protects sensitive systems during high-demand events.",
    tradeoff:
      "Batteries do not generate power — they only buy you time. Still, they can be the difference during an eclipse or a power emergency.",
    cost: 280_000,
    mass: 110,
    powerStorage: 400,
    reliability: 96,
  }),
  defineEquipment({
    id: "solar_blanket",
    name: "Flexible Solar Blanket",
    category: "Power",
    description:
      "A roll-out thin-film solar blanket producing 90 W. The cheapest and lightest wattage near the Sun.",
    tradeoff:
      "Light and cheap, but thin-film cells are fragile and degrade faster than rigid panels.",
    cost: 250_000,
    mass: 60,
    powerGeneration: 90,
    isSolar: true,
    reliability: 93,
  }),
  defineEquipment({
    id: "battery_large",
    name: "Large Battery Bank",
    category: "Power",
    description:
      "A 1,200 Wh battery bank for eclipse-heavy orbits and power-hungry instruments.",
    tradeoff:
      "Serious stored energy for emergencies and night work — paid for in 240 kg of mass.",
    cost: 700_000,
    mass: 240,
    powerStorage: 1_200,
    reliability: 96,
  }),
  defineEquipment({
    id: "fuel_cell",
    name: "Regenerative Fuel Cell",
    category: "Power",
    description:
      "A fuel cell that generates 180 W day or night and doubles as a 900 Wh buffer when topped up.",
    tradeoff:
      "Steady non-solar power without an RTG's price tag — but heavier per watt and it slowly recharges from your solar surplus.",
    cost: 2_800_000,
    mass: 220,
    powerGeneration: 180,
    powerStorage: 900,
    reliability: 94,
  }),
  defineEquipment({
    id: "rtg_advanced",
    name: "Advanced Stirling RTG",
    category: "Power",
    description:
      "A next-generation radioisotope generator using Stirling convertors: 500 W anywhere in the solar system.",
    tradeoff:
      "The gold standard for deep-space power — and priced like it. Overkill anywhere the Sun still shines.",
    cost: 12_000_000,
    mass: 400,
    powerGeneration: 500,
    reliability: 97,
  }),

  // ------------------------------------------------------------------ Communication
  defineEquipment({
    id: "communication_antenna",
    name: "High-Gain Communication Antenna",
    category: "Communication",
    description:
      "A dish antenna for sending science data and receiving commands across deep space. Standard equipment on every mission.",
    tradeoff:
      "A bigger, better antenna returns more data to Earth — while consuming more electricity and mass.",
    cost: 1_500_000,
    mass: 120,
    powerConsumption: 60,
    commCapability: 70,
    reliability: 97,
  }),
  defineEquipment({
    id: "deep_space_antenna",
    name: "Deep-Space Network Antenna",
    category: "Communication",
    description:
      "A steerable high-power antenna for missions far from Earth. Returns nearly twice the data of a standard dish.",
    tradeoff:
      "Essential for data-heavy missions beyond the asteroid belt — but it is heavy, power-hungry and costly.",
    cost: 3_200_000,
    mass: 280,
    powerConsumption: 140,
    commCapability: 120,
    reliability: 95,
  }),
  defineEquipment({
    id: "low_gain_antenna",
    name: "Low-Gain Omni Antenna",
    category: "Communication",
    description:
      "A small omni-directional antenna. Modest data rates, but it works in any attitude and never needs pointing.",
    tradeoff:
      "Cheap redundancy and a lifeline if your main dish fails — at only 30 points of capability.",
    cost: 500_000,
    mass: 40,
    powerConsumption: 15,
    commCapability: 30,
    reliability: 98,
  }),
  defineEquipment({
    id: "relay_transponder",
    name: "Relay Transponder",
    category: "Communication",
    description:
      "A store-and-forward relay that buffers data and retransmits to Earth via orbiting assets when direct contact is poor.",
    tradeoff:
      "Boosts effective downlink for far missions — while consuming a modest 30 W.",
    cost: 1_200_000,
    mass: 100,
    powerConsumption: 30,
    commCapability: 55,
    navigation: 8,
    reliability: 96,
  }),
  defineEquipment({
    id: "optical_terminal",
    name: "Optical Laser Terminal",
    category: "Communication",
    description:
      "A deep-space laser comm terminal returning enormous data volumes — when it can be pointed precisely enough.",
    tradeoff:
      "The highest data rate available, but the beam is tight: it drinks 180 W and demands excellent pointing.",
    cost: 4_600_000,
    mass: 130,
    powerConsumption: 180,
    commCapability: 150,
    reliability: 93,
  }),

  // ------------------------------------------------------------------ Science
  defineEquipment({
    id: "science_instrument",
    name: "Multi-Spectral Imager",
    category: "Science",
    description:
      "A camera system that images targets in visible and infrared light. The foundation of every science mission.",
    tradeoff:
      "Better scientific instruments improve research output but consume more power — and every instrument adds mass.",
    cost: 1_800_000,
    mass: 90,
    powerConsumption: 55,
    scienceOutput: 40,
    reliability: 94,
  }),
  defineEquipment({
    id: "spectrometer",
    name: "Mass Spectrometer",
    category: "Science",
    description:
      "Identifies the chemical composition of atmospheres, surfaces and plumes. The most powerful science instrument available.",
    tradeoff:
      "Doubles your science return — if you can feed its 120 W appetite and lift its 180 kg.",
    cost: 3_600_000,
    mass: 180,
    powerConsumption: 120,
    scienceOutput: 85,
    reliability: 91,
  }),
  defineEquipment({
    id: "radar_sounder",
    name: "Ice-Penetrating Radar",
    category: "Science",
    description:
      "Peers through kilometres of ice to map buried oceans and subsurface structure. Essential for icy-moon science.",
    tradeoff:
      "Reveals what no camera can see — but its transmitter is power-hungry and the array is bulky.",
    cost: 3_200_000,
    mass: 160,
    powerConsumption: 110,
    scienceOutput: 60,
    reliability: 92,
  }),
  defineEquipment({
    id: "magnetometer",
    name: "Magnetometer Boom",
    category: "Science",
    description:
      "A boom-mounted instrument mapping magnetic fields — the key to understanding magnetospheres and the solar wind.",
    tradeoff:
      "Excellent science per watt, but the long boom must stay clear of your own electronics.",
    cost: 1_400_000,
    mass: 50,
    powerConsumption: 15,
    scienceOutput: 45,
    reliability: 96,
  }),
  defineEquipment({
    id: "dust_analyzer",
    name: "Dust & Plasma Analyzer",
    category: "Science",
    description:
      "Measures dust grains and plasma in situ — ideal for comets, rings, asteroid environs and the solar wind.",
    tradeoff:
      "Cheap, light science for dusty environments; less useful over bare, quiet worlds.",
    cost: 1_900_000,
    mass: 70,
    powerConsumption: 40,
    scienceOutput: 50,
    reliability: 94,
  }),
  defineEquipment({
    id: "sample_arm",
    name: "Sample Collection Arm",
    category: "Science",
    description:
      "A robotic arm with a coring drill and sealed canisters for collecting and storing samples — the heart of any sample-return mission.",
    tradeoff:
      "Turns a flyby into a sample return, but the arm, drill and canisters are heavy and power-hungry.",
    cost: 3_800_000,
    mass: 210,
    powerConsumption: 60,
    scienceOutput: 55,
    landingAssist: 8,
    reliability: 91,
  }),

  // ------------------------------------------------------------------ Navigation
  defineEquipment({
    id: "nav_computer",
    name: "Guidance & Navigation Computer",
    category: "Navigation",
    description:
      "An onboard computer that calculates trajectories and executes course corrections autonomously.",
    tradeoff:
      "Good navigation saves propellant by making precise, minimal corrections — sloppier flying wastes fuel.",
    cost: 900_000,
    mass: 70,
    powerConsumption: 45,
    navigation: 70,
    reliability: 96,
  }),
  defineEquipment({
    id: "star_tracker",
    name: "Star Tracker Assembly",
    category: "Navigation",
    description:
      "Locks onto star patterns to determine the spacecraft's exact orientation, critical for precise burns and pointing instruments.",
    tradeoff:
      "Two navigation aids are far more accurate than one — accuracy you will feel during tight rendezvous manoeuvres.",
    cost: 600_000,
    mass: 45,
    powerConsumption: 25,
    navigation: 55,
    reliability: 97,
  }),
  defineEquipment({
    id: "ds_transponder",
    name: "Deep-Space Ranging Transponder",
    category: "Navigation",
    description:
      "Turns radio ranging with Earth into ultra-precise position fixes. The DSN's favourite instrument.",
    tradeoff:
      "Metre-level positioning for tight arrivals, plus a little comm gain — for 35 W and a modest price.",
    cost: 1_100_000,
    mass: 60,
    powerConsumption: 35,
    navigation: 40,
    commCapability: 20,
    reliability: 96,
  }),
  defineEquipment({
    id: "terrain_nav",
    name: "Terrain-Relative Navigation Suite",
    category: "Navigation",
    description:
      "Cameras and lidar match the terrain below against onboard maps, guiding precise landings and close approaches.",
    tradeoff:
      "The difference between landing in a boulder field and on a pad — costs power and mass like any sensor suite.",
    cost: 2_400_000,
    mass: 120,
    powerConsumption: 50,
    navigation: 85,
    landingAssist: 15,
    reliability: 94,
  }),

  // ------------------------------------------------------------------ Thermal
  defineEquipment({
    id: "thermal_blanket",
    name: "Multi-Layer Insulation Blanket",
    category: "Thermal",
    description:
      "Gold-coloured insulation that keeps electronics in a comfortable temperature range in vacuum and sunlight.",
    tradeoff:
      "Cheap, light protection against everyday temperature swings — but it cannot survive atmospheric entry.",
    cost: 220_000,
    mass: 45,
    thermalProtection: 40,
    reliability: 99,
  }),
  defineEquipment({
    id: "heat_shield",
    name: "Ablative Heat Shield",
    category: "Thermal",
    description:
      "A sacrificial shield that burns away while protecting the spacecraft during atmospheric entry at hypersonic speed.",
    tradeoff:
      "The only way to survive entry at Venus or Mars — but it is one of the heaviest single components you can install.",
    cost: 1_600_000,
    mass: 420,
    thermalProtection: 95,
    reliability: 93,
  }),
  defineEquipment({
    id: "active_thermal_control",
    name: "Active Thermal Control System",
    category: "Thermal",
    description:
      "Pumped fluid loops, radiators and louvres that actively hold a tight temperature band — for spacecraft that cannot just wrap up warm.",
    tradeoff:
      "Handles environments blankets cannot, but the pumps consume 35 W and add moving parts that can fail.",
    cost: 1_300_000,
    mass: 130,
    powerConsumption: 35,
    thermalProtection: 55,
    reliability: 94,
  }),
  defineEquipment({
    id: "thermal_protection_system",
    name: "Thermal Protection System",
    category: "Thermal",
    description:
      "A full ceramic-carbon thermal protection stack for extreme environments — close solar approaches and hot atmospheres.",
    tradeoff:
      "Serious thermal margin costs serious mass: 260 kg that could have been fuel or instruments.",
    cost: 1_800_000,
    mass: 260,
    thermalProtection: 70,
    radiationShielding: 10,
    reliability: 94,
  }),

  // ------------------------------------------------------------------ Protection
  defineEquipment({
    id: "radiation_shield",
    name: "Radiation Shielding",
    category: "Protection",
    description:
      "Titanium-and-polyethylene shielding that protects electronics from solar particles and planetary radiation belts.",
    tradeoff:
      "Radiation shielding increases protection but consumes a large share of your mass budget — protection is heavy.",
    cost: 800_000,
    mass: 260,
    radiationShielding: 55,
    reliability: 99,
  }),
  defineEquipment({
    id: "radiation_shield_basic",
    name: "Basic Radiation Shielding",
    category: "Protection",
    description:
      "A lightweight polyethylene liner absorbing part of the radiation dose — modest protection for modest mass.",
    tradeoff:
      "Cheap, light partial protection. In the fiercest belts you will want more than a liner.",
    cost: 350_000,
    mass: 120,
    radiationShielding: 25,
    reliability: 99,
  }),
  defineEquipment({
    id: "radiation_shield_advanced",
    name: "Advanced Composite Shielding",
    category: "Protection",
    description:
      "Layered hydrogen-rich composites plus a small storm shelter vault: the best radiation protection a spacecraft can carry.",
    tradeoff:
      "Survives Jupiter-class belts — at 340 kg, protection competes directly with fuel and science.",
    cost: 2_200_000,
    mass: 340,
    radiationShielding: 80,
    reliability: 98,
  }),
  defineEquipment({
    id: "micrometeorite_shield",
    name: "Micrometeorite & Debris Shielding",
    category: "Protection",
    description:
      "Whipple-style spaced armour that shatters dust grains before they reach the hull. Standard in dusty environments.",
    tradeoff:
      "Absorbs hypervelocity dust and hardens the hull — at the price of mass that never generates or moves anything.",
    cost: 800_000,
    mass: 140,
    structural: 25,
    radiationShielding: 5,
    reliability: 99,
  }),
  defineEquipment({
    id: "dust_protection",
    name: "Dust Protection System",
    category: "Protection",
    description:
      "Sealed bearings, brushless motors and electrostatic dust mitigation for working on dusty, airless worlds.",
    tradeoff:
      "Keeps dust out of mechanisms on the Moon and Mars — but adds mass and complexity.",
    cost: 600_000,
    mass: 90,
    structural: 10,
    thermalProtection: 25,
    radiationShielding: 5,
    reliability: 97,
  }),
  defineEquipment({
    id: "reinforced_heat_shield",
    name: "Reinforced Heat Shield",
    category: "Protection",
    description:
      "A thicker, structural heat shield that also stiffens the airframe — for steep entries and sample-return speeds.",
    tradeoff:
      "Full thermal protection plus structural strength — the heaviest shield in the catalogue.",
    cost: 2_600_000,
    mass: 520,
    thermalProtection: 100,
    structural: 20,
    reliability: 92,
  }),

  // ------------------------------------------------------------------ Landing
  defineEquipment({
    id: "landing_legs",
    name: "Landing Leg Assembly",
    category: "Landing",
    description:
      "Four shock-absorbing legs for a soft touchdown on airless or thin-atmosphere bodies.",
    tradeoff:
      "Cheap landing capability, but legs alone cannot cancel a fast descent — combine them with a descent module.",
    cost: 600_000,
    mass: 190,
    landingAssist: 45,
    reliability: 95,
  }),
  defineEquipment({
    id: "descent_thruster",
    name: "Powered Descent Module",
    category: "Landing",
    description:
      "Throttled descent engines with terrain-relative navigation for a gentle, precise powered landing.",
    tradeoff:
      "The safest way to land — at the price of significant mass, cost and 40 W of guidance power.",
    cost: 2_600_000,
    mass: 430,
    propulsion: 15,
    fuelConsumption: 15,
    powerConsumption: 40,
    landingAssist: 85,
    reliability: 91,
  }),
  defineEquipment({
    id: "airbag_system",
    name: "Impact Airbag System",
    category: "Landing",
    description:
      "Clusters of airbags that cocoon the lander and bounce it to a stop — the Mars Pathfinder approach.",
    tradeoff:
      "Cheaper than powered descent and very forgiving of slopes — but a bouncing landing is anything but precise.",
    cost: 1_500_000,
    mass: 240,
    landingAssist: 55,
    reliability: 93,
  }),

  // ------------------------------------------------------------------ Structure
  defineEquipment({
    id: "structural_frame",
    name: "Primary Structure & Bus",
    category: "Structure",
    description:
      "The spacecraft's backbone: a reinforced frame that mounts all components and resists launch loads and impacts.",
    tradeoff:
      "A reinforced bus protects against impacts and vibration, but structure mass is mass that carries no fuel, power or science.",
    cost: 500_000,
    mass: 180,
    structural: 60,
    reliability: 99,
  }),
  defineEquipment({
    id: "structural_frame_light",
    name: "Lightweight Structural Frame",
    category: "Structure",
    description:
      "A minimal composite skeleton holding everything together at the lowest possible mass.",
    tradeoff:
      "Frees mass for fuel or instruments — but bends and impacts hit the spacecraft harder.",
    cost: 300_000,
    mass: 100,
    structural: 35,
    reliability: 98,
  }),
  defineEquipment({
    id: "structural_frame_reinforced",
    name: "Reinforced Structural Frame",
    category: "Structure",
    description:
      "A thickened primary structure with redundant load paths for heavy spacecraft and rough environments.",
    tradeoff:
      "A stiff, survivable bus — another 60 kg over the standard frame buys robustness.",
    cost: 750_000,
    mass: 240,
    structural: 85,
    reliability: 99,
  }),
  defineEquipment({
    id: "heavy_spacecraft_bus",
    name: "Heavy-Duty Spacecraft Bus",
    category: "Structure",
    description:
      "A large armoured bus with integral shielding — the foundation of flagship-class spacecraft.",
    tradeoff:
      "The most robust chassis available, with a little built-in radiation protection — 400 kg of it.",
    cost: 1_200_000,
    mass: 400,
    structural: 120,
    radiationShielding: 10,
    reliability: 99,
  }),
  defineEquipment({
    id: "deployable_platform",
    name: "Deployable Structural Platform",
    category: "Structure",
    description:
      "Folding trusses that unfold in space to carry instruments far from the noisy, hot bus.",
    tradeoff:
      "Clean mounting real estate for sensitive instruments — as long as the deployment motors do their single job.",
    cost: 900_000,
    mass: 160,
    structural: 50,
    landingAssist: 10,
    reliability: 96,
  }),
  defineEquipment({
    id: "modular_mounting",
    name: "Modular Equipment Mounting System",
    category: "Structure",
    description:
      "Standardised rails and harnesses that let any subsystem be swapped or relocated quickly during assembly.",
    tradeoff:
      "Cheaper integration and easier refits — at 120 kg it is a middleweight option.",
    cost: 650_000,
    mass: 120,
    structural: 45,
    reliability: 98,
  }),
  defineEquipment({
    id: "reinforced_landing_structure",
    name: "Reinforced Landing Structure",
    category: "Structure",
    description:
      "A crushable landing frame that absorbs touchdown loads through the whole bus, not just the legs.",
    tradeoff:
      "Adds real landing margin and stiffness — but the crush core is single-use and heavy.",
    cost: 1_100_000,
    mass: 280,
    structural: 60,
    landingAssist: 35,
    reliability: 97,
  }),
];

export const EQUIPMENT_BY_ID: Record<string, Equipment> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.id, e])
);

/** All categories that contain at least one catalogue item. */
export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  "Propulsion",
  "Fuel",
  "Power",
  "Communication",
  "Science",
  "Navigation",
  "Thermal",
  "Protection",
  "Landing",
  "Structure",
];

export function getEquipment(id: string): Equipment | undefined {
  return EQUIPMENT_BY_ID[id];
}
