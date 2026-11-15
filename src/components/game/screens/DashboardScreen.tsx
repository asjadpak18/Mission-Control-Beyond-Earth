"use client";

/**
 * DASHBOARD — mode selection (v2.0) + mission catalogue + flight log.
 * Single Player keeps the original loop; Multiplayer opens the cooperative
 * flow (host/join over LAN).
 */

import Image from "next/image";
import { useMemo } from "react";
import { ArrowRight, BookOpen, CircleCheck, Coins, Gauge, Orbit, Satellite, Scale, Trophy, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MISSIONS } from "@/lib/game/missions";
import { EQUIPMENT } from "@/lib/game/equipment";
import { formatMass, formatMoney } from "@/lib/game/calculations";
import { useGameStore } from "@/store/gameStore";
import { computeRank, earnedAchievements, ACHIEVEMENTS } from "@/lib/game/progression";
import { ImageWatermark } from "@/components/game/Watermark";
import { DifficultyBadge, SectionHeading, StatusBadge } from "@/components/game/shared";
import type { Mission } from "@/lib/game/types";

const DESTINATION_IMAGES: Record<string, string> = {
  moon: "/images/dest-moon.png",
  mars: "/images/dest-mars.png",
  venus: "/images/dest-venus.png",
  asteroid: "/images/dest-asteroid.png",
  jupiter: "/images/dest-jupiter.png",
  comet: "/images/dest-comet.png",
  mercury: "/images/dest-mercury.png",
  sun: "/images/dest-sun.png",
  europa: "/images/dest-europa.png",
  saturn: "/images/dest-saturn.png",
  titan: "/images/dest-titan.png",
  deepspace: "/images/dest-deepspace.png",
};

function MissionCard({ mission, best }: { mission: Mission; best?: number }) {
  const selectMission = useGameStore((s) => s.selectMission);
  const primaryCount = mission.objectives.filter((o) => o.required).length;

  return (
    <button
      type="button"
      onClick={() => selectMission(mission.id)}
      className="panel hud-corners group flex flex-col overflow-hidden text-left transition-all duration-300 hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_0_35px_rgba(0,163,255,0.18)] focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={`Select mission: ${mission.name}`}
    >
      <div className="relative h-36 w-full overflow-hidden sm:h-40">
        <Image
          src={DESTINATION_IMAGES[mission.imageId] ?? DESTINATION_IMAGES.moon}
          alt={`Destination artwork: ${mission.destination}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          priority={mission.id === "lunar_research"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060d1a] via-transparent to-transparent" />
        <ImageWatermark />
        <div className="absolute left-3 top-3">
          <DifficultyBadge difficulty={mission.difficulty} />
        </div>
        {best !== undefined ? (
          <div className="absolute right-3 top-3 rounded-md border border-accent/40 bg-background/70 px-2 py-1 font-mono text-[10px] font-bold text-accent backdrop-blur">
            BEST {best}/1000
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
            {mission.type} · {mission.destination}
          </div>
          <h3 className="font-display mt-1 text-base font-bold leading-snug text-foreground">{mission.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{mission.description}</p>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1.5 text-[11px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-amber-300/80" aria-hidden="true" />
            <span className="font-mono text-cyan-200">{formatMoney(mission.budget)}</span> budget
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Scale className="h-3.5 w-3.5 text-sky-300/80" aria-hidden="true" />
            <span className="font-mono text-cyan-200">{formatMass(mission.maxMass)}</span> max
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Gauge className="h-3.5 w-3.5 text-emerald-300/80" aria-hidden="true" />
            <span className="font-mono text-cyan-200">{mission.minFuel.toLocaleString()} kg</span> fuel
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-yellow-300/80" aria-hidden="true" />
            <span className="font-mono text-cyan-200">{mission.minPower} W</span> power
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-primary/15 pt-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            {primaryCount} PRIMARY OBJECTIVES
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-accent transition-transform duration-300 group-hover:translate-x-1">
            BRIEFING <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </button>
  );
}

export function DashboardScreen() {
  const missionLog = useGameStore((s) => s.missionLog);
  const goTo = useGameStore((s) => s.goTo);
  const activeMissionId = useGameStore((s) => s.missionId);
  const setMode = useGameStore((s) => s.setMode);

  const bestByMission = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of missionLog) {
      map[entry.missionId] = Math.max(map[entry.missionId] ?? 0, entry.score);
    }
    return map;
  }, [missionLog]);

  const completedCount = new Set(missionLog.filter((e) => e.status === "success").map((e) => e.missionId)).size;
  const rankName = computeRank(missionLog).name;
  const earnedCount = earnedAchievements(missionLog).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
      {/* ---------------- Hero ---------------- */}
      <section className="panel hud-corners relative mt-6 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-earth.png"
            alt="Earth seen from deep space at night, city lights glowing electric blue"
            fill
            sizes="100vw"
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#04070f] via-[#04070fcc] to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#04070f] via-transparent to-transparent" />
          <ImageWatermark />
        </div>

        <div className="relative z-10 flex flex-col gap-6 px-6 py-12 sm:px-10 sm:py-16 lg:py-20">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1">
              <Orbit className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-accent">
                EDUCATIONAL MISSION SIMULATOR
              </span>
            </div>
            <h1 className="font-display text-3xl font-black leading-tight tracking-wide text-foreground sm:text-4xl lg:text-5xl">
              BEYOND <span className="text-accent text-glow">EARTH</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-cyan-100/80 sm:text-base">
              You are the Mission Director. Pick a destination, engineer a spacecraft within real budgets,
              then fly the mission and manage emergencies. Every kilogram, watt and dollar is a trade-off —
              exactly like real aerospace engineering.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="lg"
                className="launch-glow font-display h-11 bg-gradient-to-r from-primary to-accent px-7 text-sm font-bold tracking-wider text-[#03101d] hover:from-primary/90 hover:to-accent/90"
                onClick={() => document.getElementById("mission-select")?.scrollIntoView({ behavior: "smooth" })}
              >
                SINGLE PLAYER — BEGIN MISSION PLANNING
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-display h-11 px-6 text-sm font-bold tracking-wider"
                onClick={() => setMode("multiplayer")}
              >
                <Users className="mr-2 h-4 w-4" aria-hidden="true" />
                MULTIPLAYER — COOPERATIVE MISSION
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="font-display h-9 px-4 text-xs font-bold tracking-wider"
                  onClick={() => goTo("learn")}
                >
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  LEARN BASICS
                </Button>
                <Button
                  variant="outline"
                  className="font-display h-9 px-4 text-xs font-bold tracking-wider"
                  onClick={() => goTo("progress")}
                >
                  <Trophy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  MY PROGRESS
                </Button>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {MISSIONS.length} DESTINATIONS · {EQUIPMENT.length} COMPONENTS · UP TO 4 PLAYERS · SCORE /1000
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {["PLAN", "DESIGN", "VALIDATE", "LAUNCH", "MANAGE", "EVALUATE"].map((p, i) => (
              <span key={p} className="flex items-center gap-2">
                {i > 0 ? <ArrowRight className="h-3 w-3 text-primary/40" aria-hidden="true" /> : null}
                <span className="rounded border border-primary/25 bg-secondary/60 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-cyan-200">
                  {p}
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Mission selection ---------------- */}
      <section id="mission-select" className="mt-12 scroll-mt-24">
        <SectionHeading
          kicker="STEP 01 — SELECT A MISSION"
          title="Available Missions"
          className="mb-5"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MISSIONS.map((mission) => (
            <MissionCard key={mission.id} mission={mission} best={bestByMission[mission.id]} />
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent/70" aria-hidden="true" />
          <span>
            New to mission design? Start with the <strong className="text-cyan-200">Lunar Research Expedition</strong> —
            the most forgiving engineering budget in the solar system.
          </span>
        </p>
      </section>

      {/* ---------------- Flight log ---------------- */}
      <section className="mt-12">
        <div className="mb-5 flex items-center justify-between">
          <SectionHeading kicker="MISSION ARCHIVE" title="Flight Log" />
          {missionLog.length > 0 ? (
            <button
              type="button"
              onClick={() => goTo("progress")}
              className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/8 px-3 py-1.5 transition-colors hover:bg-amber-400/15"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              <span className="font-mono text-[10px] font-bold tracking-wide text-amber-200">
                {rankName} · {earnedCount}/{ACHIEVEMENTS.length} ACHIEVEMENTS
              </span>
            </button>
          ) : null}
        </div>
        {missionLog.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 px-6 py-10 text-center">
            <Satellite className="h-8 w-8 text-primary/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No flights on record yet. Your first mission report will appear here.
            </p>
          </div>
        ) : (
          <div className="panel overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_150px_60px] items-center gap-2 border-b border-primary/15 px-4 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mission</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Date</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Result</span>
              <span className="text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Score</span>
            </div>
            <ul className="max-h-72 divide-y divide-primary/10 overflow-y-auto">
              {missionLog.map((entry, i) => (
                <li
                  key={`${entry.date}-${i}`}
                  className="grid grid-cols-[1fr_90px_150px_60px] items-center gap-2 px-4 py-2.5 transition-colors hover:bg-secondary/40"
                >
                  <span className="truncate text-[13px] text-cyan-100">{entry.missionName}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className="flex items-center">
                    <StatusBadge status={entry.status} />
                  </span>
                  <span className="text-right font-mono text-sm font-bold text-accent">{entry.score}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-primary/15 px-4 py-2 font-mono text-[10px] text-muted-foreground">
              {missionLog.length} FLIGHT{missionLog.length === 1 ? "" : "S"} · {completedCount}/{MISSIONS.length} MISSIONS
              FLOWN TO FULL SUCCESS
            </div>
          </div>
        )}
      </section>

      {/* ---------------- Educational strip ---------------- */}
      <section className="mt-12">
        <div className="panel grid gap-4 p-6 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="font-display text-sm font-bold text-accent">1 · ENGINEER</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Balance <strong className="text-cyan-200">budget, mass, fuel and power</strong>. More fuel means more
              manoeuvres — but also more mass to lift. Better instruments mean more science — but more power draw.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-display text-sm font-bold text-accent">2 · FLY</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Eight mission stages from launch to final evaluation, with <strong className="text-cyan-200">real
              emergencies</strong> that demand decisions: dust storms, radiation, plumes and power faults.
            </p>
          </div>
          <div className="space-y-2">
            <div className="font-display text-sm font-bold text-accent">3 · LEARN</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Every mission ends with a <strong className="text-cyan-200">full engineering report</strong>: what
              worked, what failed, and exactly what to change on your next attempt.
            </p>
          </div>
        </div>
      </section>

      {activeMissionId ? (
        <div className="mt-10 flex justify-center">
          <Button variant="outline" className="border-primary/30 font-mono text-xs tracking-widest" onClick={() => goTo("briefing")}>
            <ArrowRight className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            RESUME ACTIVE MISSION
          </Button>
        </div>
      ) : null}
    </div>
  );
}
