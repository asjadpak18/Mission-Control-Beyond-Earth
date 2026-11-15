"use client";

/**
 * ============================================================================
 * LEARN BASICS SCREEN — v2.3 educational reference (GDD Section 15)
 * ============================================================================
 * A standalone reference section covering the 15 fundamental space mission
 * concepts listed in the Game Design Document. Each topic is an expandable
 * card with a beginner-friendly explanation grounded in real aerospace
 * engineering, with connections to the game's mechanics where relevant.
 *
 * Accessible from the dashboard via the "LEARN BASICS" button.
 * ============================================================================
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen, ArrowLeft, Search } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";

interface LearnTopic {
  id: string;
  title: string;
  category: string;
  content: string;
}

const TOPICS: LearnTopic[] = [
  {
    id: "spacecraft",
    title: "What is a spacecraft?",
    category: "Fundamentals",
    content: "A spacecraft is a vehicle designed to operate outside Earth's atmosphere. Unlike aircraft, which use wings to generate lift from air, spacecraft operate in the vacuum of space where there is no air to push against. Every spacecraft has the same core systems: a structure (the bus that holds everything together), propulsion (to change direction and speed), power (solar panels or nuclear generators), communications (to talk to Earth), thermal control (to keep electronics from freezing or overheating), and a payload (the scientific instruments or cargo the mission is built to deliver). In this game, each of these systems maps to an equipment category — Propulsion, Power, Communication, Science, Thermal, and Structure — and your job is to choose the right mix for each mission.",
  },
  {
    id: "rockets",
    title: "How do rockets work?",
    category: "Fundamentals",
    content: "Rockets work on Newton's third law: for every action, there is an equal and opposite reaction. A rocket burns fuel in a combustion chamber and expels the hot exhaust gas out the back at extremely high speed. Pushing mass backward pushes the rocket forward. The faster the exhaust and the more mass you can throw, the more thrust you generate. This is why rocket engines have large nozzle bells — they shape the exhaust to maximize its exit velocity. Unlike a car engine that needs oxygen from the air to burn fuel, rocket engines carry their own oxidizer, which is why they can operate in the vacuum of space. In the game, your engine choice determines your propulsion capability — more powerful engines provide more thrust but consume fuel faster.",
  },
  {
    id: "propulsion",
    title: "What is propulsion?",
    category: "Fundamentals",
    content: "Propulsion is the system that changes a spacecraft's velocity — speeding up, slowing down, or changing direction. In space, there is no friction to slow you down, so every velocity change (called a 'burn') requires propellant. The total velocity change a spacecraft can produce is called its 'delta-v budget,' and it is the single most important number in mission design. Chemical engines burn fuel and oxidizer together for high thrust but low efficiency — they're best for launches and quick maneuvers. Ion engines use electricity to accelerate a gas (like xenon) to extremely high speeds, giving low thrust but excellent efficiency — they're best for long, slow deep-space missions. The trade-off in the game: chemical engines are cheap and fast but burn through fuel quickly; ion engines are efficient but need lots of electrical power and take a long time to get anywhere.",
  },
  {
    id: "orbital_velocity",
    title: "What is orbital velocity?",
    category: "Orbital Mechanics",
    content: "Orbital velocity is the speed a spacecraft must travel sideways to 'fall around' a planet without ever hitting the ground. At Earth's surface, orbital velocity is about 7.8 km/s (28,000 km/h). If you go slower than this, gravity pulls you back down. If you go faster, you enter a higher orbit or even escape the planet entirely. The key insight is that orbiting is just falling — but moving sideways so fast that the ground curves away beneath you as fast as you fall. This is why rockets launch vertically at first (to get above the atmosphere) then pitch over to fly mostly horizontally (to build up that sideways orbital velocity). In the game, the 'Arrival' stage (stage 5) for orbiter missions represents the moment when your spacecraft must fire its engine to slow down enough to be captured into orbit around the destination — this is called 'orbit insertion.'",
  },
  {
    id: "fuel",
    title: "Why do spacecraft need fuel?",
    category: "Fundamentals",
    content: "Spacecraft need fuel because in space, there is nothing to push against. Every change in velocity — speeding up, slowing down, turning, or entering orbit — requires throwing mass (propellant) in the opposite direction. The amount of fuel you need depends on your mission's delta-v budget, which is determined by where you're going and what maneuvers you need to perform. Going to the Moon requires less delta-v than going to Mars; landing on a planet requires more delta-v than just orbiting it because you have to slow down enough to touch down safely. The 'rocket equation' — a fundamental law of physics — means that adding more fuel also adds more mass, which requires even more fuel to push. This is why fuel is often the heaviest part of a spacecraft. In the game, each mission has a 'minFuel' requirement, and your fuel capacity must meet or exceed it to launch.",
  },
  {
    id: "solar_panels",
    title: "How do solar panels work in space?",
    category: "Power Systems",
    content: "Solar panels work the same way in space as on Earth — they convert sunlight into electricity using photovoltaic cells. But in space, there is no atmosphere to scatter or absorb sunlight, so solar panels produce more power per square meter. However, the intensity of sunlight drops with the square of distance from the Sun. At Earth (1 AU), a solar panel produces its full rated power. At Mars (1.5 AU), it produces about 44% of rated power. At Jupiter (5.2 AU), only about 3.7%. This is the 'solar derate' factor in the game — each mission lists how much solar output is available at the destination. For missions to Jupiter and beyond, solar panels become impractical and you need an RTG instead. Solar panels are light and cheap but only work in sunlight; batteries store the energy for when you're in a planet's shadow (eclipse).",
  },
  {
    id: "rtg",
    title: "What is an RTG?",
    category: "Power Systems",
    content: "A Radioisotope Thermoelectric Generator (RTG) is a nuclear battery that generates electricity from the heat of decaying radioactive material (usually plutonium-238). As the plutonium atoms decay, they release heat, and thermocouples convert some of that heat into electricity. RTGs have no moving parts, are incredibly reliable (they can run for decades), and work anywhere — including the dark outer solar system where solar panels are useless. The Voyager spacecraft, launched in 1977, are still sending data back to Earth using RTGs. The trade-off: RTGs are heavy, expensive, and produce relatively little power (typically 100-300 watts). In the game, the Cassini-class RTG is essential for missions to Jupiter, Saturn, and beyond, where the solar derate makes solar panels useless. Missions to the Sun or Mercury, ironically, also benefit from RTGs because the intense heat near the Sun can damage solar panels.",
  },
  {
    id: "communication",
    title: "How does a spacecraft communicate with Earth?",
    category: "Communications",
    content: "Spacecraft communicate with Earth using radio waves — the same technology as Wi-Fi or cell phones, but at much lower frequencies and much higher power. A spacecraft's antenna sends a radio signal toward Earth, where giant dish antennas (like NASA's Deep Space Network) receive it. The strength of the signal drops with the square of distance, so a spacecraft at Mars needs a much stronger antenna than one at the Moon. High-gain antennas focus the radio beam tightly (like a laser vs a flashlight) for long-distance communication but must be pointed precisely at Earth. Low-gain antennas broadcast in all directions for short-range communication and don't need pointing. In the game, communication capability determines how much scientific data you can transmit back to Earth — if your antenna is too weak for the distance, you collect data but can't send it all back, lowering your score.",
  },
  {
    id: "mass",
    title: "What is spacecraft mass?",
    category: "Fundamentals",
    content: "Spacecraft mass is the total weight of everything on the vehicle — structure, fuel, engines, instruments, power systems, everything. Mass is the most precious resource in spaceflight because every kilogram costs fuel to launch and maneuver. The 'mass budget' is the maximum mass a mission can carry, set by the launch rocket's lifting capacity and the mission's delta-v requirements. Exceeding the mass budget means the spacecraft can't reach its destination. Engineers spend enormous effort shaving grams off every component — lighter structures, smaller electronics, more efficient fuel. In the game, every component has a mass value, and the mission's maxMass is your hard limit. The 'massRemaining' stat shows how much room you have left. A well-designed spacecraft uses its mass budget efficiently — not too heavy (wastes fuel) but not too light (missing capability).",
  },
  {
    id: "trajectory",
    title: "What is a mission trajectory?",
    category: "Orbital Mechanics",
    content: "A trajectory is the path a spacecraft follows through space. Unlike a car that can steer freely, a spacecraft in orbit is constantly falling — its path is determined by gravity. Mission planners use gravity to shape trajectories: flying past a planet can speed you up (gravity assist) or slow you down, without using any fuel. A trajectory to Mars isn't a straight line — it's a long curving arc where the spacecraft launches when Earth and Mars are in the right relative positions (a 'launch window'), then coasts for months along an elliptical path that intersects Mars's orbit. In the game, the 8-stage simulation represents the key events along a mission trajectory: launch (leaving Earth), cruise (coasting through space), navigation (trajectory corrections), arrival (reaching the destination), science (operating at the destination), and communication (sending data home). Each stage tests different spacecraft systems.",
  },
  {
    id: "spectrometer",
    title: "What is a spectrometer?",
    category: "Scientific Instruments",
    content: "A spectrometer is an instrument that measures the spectrum of light — breaking it into its component wavelengths, like a prism splits white light into a rainbow. Every element and molecule absorbs or emits light at specific wavelengths, so by analyzing the spectrum of light from a planet, asteroid, or star, scientists can determine its chemical composition without ever touching it. This is how we know Mars has iron oxide (it's red), Europa has a water-ice surface, and the Sun is mostly hydrogen and helium. Infrared spectrometers can detect organic molecules — the building blocks of life. In the game, the Mass Spectrometer and Multi-Spectral Imager are your key science instruments. Different missions require different instruments: a comet mission needs a dust analyzer, an ice-moon mission needs ice-penetrating radar, a Mars lander needs a ground-penetrating radar to search for subsurface water.",
  },
  {
    id: "radiation_shielding",
    title: "How does radiation shielding work?",
    category: "Protection",
    content: "Space is full of radiation — from the Sun (solar flares), from the galaxy (cosmic rays), and from planetary magnetospheres (Jupiter's radiation belts are especially intense). Radiation can damage electronics, degrade solar panels, and harm astronauts. Shielding works by putting mass between the radiation source and the sensitive components — but in spaceflight, mass is expensive, so you can't just wrap everything in thick lead. Instead, engineers use layered materials: aluminum for structural shielding, water or plastic for radiation absorption (hydrogen-rich materials stop radiation well), and electronic hardening (radiation-resistant chips). The strategy is to minimize exposure time and put the most sensitive components in the center of the spacecraft, surrounded by fuel tanks and other equipment that acts as incidental shielding. In the game, radiationShielding is a capability score, and missions to Jupiter/Europa have high minRadiation requirements because Jupiter's radiation belts are lethal to unshielded electronics.",
  },
  {
    id: "orbital_rendezvous",
    title: "What is orbital rendezvous?",
    category: "Orbital Mechanics",
    content: "Orbital rendezvous is the process of bringing two spacecraft to the same place at the same time in orbit. It's not like driving a car up to another car — in orbit, if you speed up, you rise to a higher orbit (which is slower), and if you slow down, you drop to a lower orbit (which is faster). So to catch up to a spacecraft ahead of you, you actually slow down first, drop into a lower orbit, let the faster orbit carry you underneath, then speed back up to rise to the target's altitude just as you reach it. This is how the Space Station resupply missions work — a cargo spacecraft launches into a slightly lower orbit, catches up over several days, then raises its orbit to rendezvous and dock. Docking is the final, most delicate step — two spacecraft must align precisely and connect at less than 0.1 m/s relative velocity. In the game, navigation capability (nav_computer, star_tracker) determines how well your spacecraft can perform these precise maneuvers.",
  },
  {
    id: "space_telescopes",
    title: "How do space telescopes work?",
    category: "Scientific Instruments",
    content: "Space telescopes are telescopes placed above Earth's atmosphere, which blocks or blurs many wavelengths of light. The Hubble Space Telescope sees in visible and ultraviolet light; the James Webb Space Telescope sees in infrared, allowing it to peer through dust clouds and detect the heat of distant planets and stars. A space telescope has three main parts: a primary mirror (collects light), instruments (cameras and spectrometers that analyze the light), and a pointing system (keeps the telescope aimed precisely at the target for hours or days). Precision pointing is critical — a telescope looking at a distant galaxy must hold steady to within a fraction of an arcsecond, which requires star trackers and reaction wheels. In the game, the Solar Observation Mission and Deep-Space Interstellar Precursor missions represent observatory-type missions where high-precision instruments and stable pointing are the primary requirements, rather than propulsion or landing capability.",
  },
  {
    id: "exoplanets",
    title: "What are exoplanets?",
    category: "Astronomy",
    content: "Exoplanets are planets that orbit stars other than our Sun. As of 2026, over 5,000 exoplanets have been confirmed, ranging from small rocky worlds to gas giants larger than Jupiter. Most are detected indirectly — by watching a star dim slightly as a planet passes in front of it (the 'transit method'), or by measuring the wobble of a star caused by a planet's gravity (the 'radial velocity method'). Some have been directly imaged using coronagraphs that block out the star's light. The search for Earth-like exoplanets in the 'habitable zone' (where liquid water could exist) is one of the most exciting fields in astronomy. Missions like TESS, CHEOPS, and the James Webb Space Telescope are characterizing exoplanet atmospheres, looking for biosignatures — gases like oxygen or methane that might indicate life. In the game, the Deep-Space Interstellar Precursor mission represents a mission to study distant astronomical objects, requiring high-gain antennas, precision pointing, and advanced science instruments rather than propulsion or landing systems.",
  },
];

const CATEGORIES = ["All", "Fundamentals", "Orbital Mechanics", "Power Systems", "Communications", "Scientific Instruments", "Protection", "Astronomy"];

export function LearnBasicsScreen() {
  const goTo = useGameStore((s) => s.goTo);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = TOPICS.filter((t) => {
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "All" || t.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold tracking-wide text-foreground">Learn Basics</h1>
            <p className="text-xs text-muted-foreground">Fundamental concepts of space mission engineering</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => goTo("dashboard")}
          className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-secondary/50 px-3 py-1.5 font-mono text-[11px] font-semibold text-cyan-100 transition-colors hover:border-primary/60 hover:bg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> BACK
        </button>
      </div>

      {/* Search + category filter */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topics…"
            className="w-full rounded-md border border-primary/30 bg-secondary/40 py-2 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-cyan-400/60 focus:outline-none"
            aria-label="Search topics"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide transition-colors",
                category === c
                  ? "bg-accent/20 text-accent"
                  : "border border-primary/20 bg-secondary/30 text-muted-foreground hover:text-foreground",
              )}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Topic count */}
      <p className="mb-4 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
        {filtered.length} OF {TOPICS.length} TOPICS
      </p>

      {/* Topic cards */}
      <div className="space-y-2.5">
        {filtered.map((topic) => {
          const isOpen = expanded === topic.id;
          return (
            <div
              key={topic.id}
              className="overflow-hidden rounded-lg border border-primary/20 bg-secondary/30"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : topic.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded border border-accent/30 bg-accent/5 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wide text-accent/80">
                    {topic.category.toUpperCase()}
                  </span>
                  <span className="text-[14px] font-semibold text-foreground">{topic.title}</span>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
              {isOpen ? (
                <div className="border-t border-primary/15 px-4 py-4">
                  <p className="text-[13px] leading-relaxed text-cyan-100/85">{topic.content}</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-primary/20 bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No topics match your search.
        </div>
      ) : null}
    </div>
  );
}
