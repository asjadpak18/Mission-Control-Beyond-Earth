"use client";

/**
 * MISSION BRIEFING — full mission requirements before design begins.
 * v2.0: includes the mission setup panel — difficulty setting, rolled or
 * hand-picked constraints — with every requirement reflecting the EFFECTIVE
 * mission (base + constraints) so players see the real numbers they must meet.
 */

import Image from "next/image";
import { useMemo } from "react";
import { ArrowLeft, ArrowRight, Coins, Dices, Flame, Gauge, Scale, ShieldAlert, SlidersHorizontal, Sun, Target, Telescope, TriangleAlert, Wrench, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getEquipment } from "@/lib/game/equipment";
import { formatMass, formatMoney } from "@/lib/game/calculations";
import { DIFFICULTY_SETTINGS, CONSTRAINT_POOL } from "@/lib/game/constraints";
import type { DifficultySetting } from "@/lib/game/types";
import { useGameStore, currentMission, appliedConstraints } from "@/store/gameStore";
import { DifficultyBadge, EduTooltip, SectionHeading } from "@/components/game/shared";
import { ImageWatermark } from "@/components/game/Watermark";
import { cn } from "@/lib/utils";

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

function RequirementRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="text-primary/80">{icon}</span>
        {label}
        {hint ? <EduTooltip text={hint} /> : null}
      </span>
      <span className="font-mono text-[13px] font-semibold text-cyan-200">{value}</span>
    </div>
  );
}

const DIFFICULTY_HINTS: Record<DifficultySetting, string> = {
  Beginner: "+15% budget, calmer operations — learn the systems.",
  Intermediate: "The mission as designed. Fair but honest.",
  Advanced: "−10% budget, busier operations, one rolled constraint.",
  Expert: "−18% budget, −10% mass, busy ops, two rolled constraints.",
  "Custom Challenge": "Pick your own constraint cocktail. Good luck, Director.",
};

export function BriefingScreen() {
  const missionId = useGameStore((s) => s.missionId);
  const goTo = useGameStore((s) => s.goTo);
  const difficulty = useGameStore((s) => s.difficulty);
  const constraintIds = useGameStore((s) => s.constraintIds);
  const constraintSeed = useGameStore((s) => s.constraintSeed);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const toggleConstraint = useGameStore((s) => s.toggleConstraint);
  const rerollConstraints = useGameStore((s) => s.rerollConstraints);

  const mission = useMemo(
    () => (missionId ? currentMission({ missionId, difficulty, constraintIds, constraintSeed }) : null),
    [missionId, difficulty, constraintIds, constraintSeed]
  );
  const applied = useMemo(
    () => (missionId ? appliedConstraints({ missionId, difficulty, constraintIds, constraintSeed }) : []),
    [missionId, difficulty, constraintIds, constraintSeed]
  );

  if (!mission) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-muted-foreground">No mission selected.</p>
        <Button className="mt-4" onClick={() => goTo("dashboard")}>
          Return to mission selection
        </Button>
      </div>
    );
  }

  const primary = mission.objectives.filter((o) => o.required);
  const secondary = mission.objectives.filter((o) => !o.required);
  const requiredEquipmentNames = mission.requiredEquipment.map((id) => getEquipment(id)?.name ?? id);

  const specialReqs: Array<{ icon: React.ReactNode; label: string; value: string; hint: string }> = [];
  if (mission.minLanding > 0)
    specialReqs.push({
      icon: <Wrench className="h-4 w-4" aria-hidden="true" />,
      label: "Landing capability",
      value: `≥ ${mission.minLanding} pts`,
      hint: "This mission lands on the surface. Combine landing legs with a powered descent module to survive touchdown.",
    });
  if (mission.minThermal > 0)
    specialReqs.push({
      icon: <Flame className="h-4 w-4" aria-hidden="true" />,
      label: "Thermal protection",
      value: `≥ ${mission.minThermal}%`,
      hint: "The spacecraft enters an atmosphere. Only an ablative heat shield provides enough protection.",
    });
  if (mission.minRadiation > 0)
    specialReqs.push({
      icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" />,
      label: "Radiation shielding",
      value: `≥ ${mission.minRadiation}%`,
      hint: "This environment floods electronics with radiation. Shielding stacks — install multiple layers if needed.",
    });
  if (mission.minNavigation > 0)
    specialReqs.push({
      icon: <Target className="h-4 w-4" aria-hidden="true" />,
      label: "Navigation accuracy",
      value: `≥ ${mission.minNavigation} pts`,
      hint: "The trajectory demands precise guidance. A navigation computer plus a star tracker is the strongest pairing.",
    });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
      {/* Hero banner */}
      <section className="panel hud-corners relative mt-6 h-48 overflow-hidden sm:h-56">
        <Image
          src={DESTINATION_IMAGES[mission.imageId] ?? DESTINATION_IMAGES.moon}
          alt={`Destination artwork: ${mission.destination}`}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#04070f] via-[#04070fd9] to-transparent" />
        <ImageWatermark />
        <div className="relative z-10 flex h-full flex-col justify-end gap-2 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={mission.difficulty} />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/90">
              {mission.type.toUpperCase()} · {mission.destination.toUpperCase()}
            </span>
          </div>
          <h1 className="font-display text-2xl font-black tracking-wide text-foreground sm:text-3xl">{mission.name}</h1>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left column: narrative + objectives */}
        <div className="space-y-6">
          <section className="panel p-5 sm:p-6">
            <SectionHeading kicker="MISSION DIRECTIVE" title="Mission Description" className="mb-3" />
            <p className="text-sm leading-relaxed text-cyan-100/85">{mission.description}</p>
            <Separator className="my-4 bg-primary/15" />
            <div className="flex items-start gap-3">
              <Telescope className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">Scientific purpose</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{mission.scientificPurpose}</p>
              </div>
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading
              kicker="SCORING"
              title="Mission Objectives"
              className="mb-4"
            />
            <div className="space-y-4">
              <div>
                <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/90">
                  Primary — {primary.reduce((s, o) => s + o.points, 0)} pts
                </div>
                <ul className="space-y-2">
                  {primary.map((o) => (
                    <li key={o.id} className="flex items-start justify-between gap-3 rounded-md border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
                      <span className="flex items-start gap-2 text-[13px] text-cyan-100">
                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                        {o.description}
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-300">{o.points}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300/90">
                  Secondary — {secondary.reduce((s, o) => s + o.points, 0)} pts
                </div>
                <ul className="space-y-2">
                  {secondary.map((o) => (
                    <li key={o.id} className="flex items-start justify-between gap-3 rounded-md border border-amber-400/10 bg-amber-400/5 px-3 py-2">
                      <span className="flex items-start gap-2 text-[13px] text-cyan-100/80">
                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" aria-hidden="true" />
                        {o.description}
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-300/90">{o.points}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 border-t border-primary/15 pt-3 text-xs leading-relaxed text-muted-foreground">
              Objectives are worth up to 550 points. Engineering performance (200), resource efficiency (150) and your
              in-flight decisions (100) make the rest of the 1,000-point score.
            </p>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading kicker="RISK ASSESSMENT" title="Known Mission Events" className="mb-3" />
            <p className="mb-3 text-xs text-muted-foreground">
              Based on previous flights to {mission.destination}, mission control expects conditions like these.
              They may or may not occur — your design determines how well you survive them.
            </p>
            <ul className="space-y-2.5">
              {mission.events.map((e) => (
                <li key={e.id} className="rounded-md border border-primary/15 bg-secondary/40 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-amber-300/80" aria-hidden="true" />
                    <span className="text-[13px] font-semibold text-cyan-100">{e.title}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">STAGE {e.stage}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.description}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right column: engineering requirements */}
        <div className="space-y-6">
          {/* Mission setup — difficulty & constraints */}
          <section className="panel p-5 sm:p-6">
            <SectionHeading kicker="MISSION SETUP" title="Difficulty & Constraints" className="mb-3" />
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {DIFFICULTY_SETTINGS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  aria-pressed={difficulty === d}
                  className={cn(
                    "rounded-md border px-2.5 py-2 text-left font-mono text-[10.5px] font-bold tracking-wide transition-colors",
                    difficulty === d
                      ? "border-accent/70 bg-accent/15 text-accent"
                      : "border-primary/25 bg-secondary/40 text-cyan-100/80 hover:border-primary/50 hover:text-cyan-100"
                  )}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="mt-2 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
              <SlidersHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden="true" />
              {DIFFICULTY_HINTS[difficulty]}
            </p>

            {difficulty === "Custom Challenge" ? (
              <div className="mt-3 space-y-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Active constraints — pick any combination
                </div>
                {CONSTRAINT_POOL.map((c) => {
                  const on = constraintIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleConstraint(c.id)}
                      aria-pressed={on}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                        on
                          ? "border-amber-400/60 bg-amber-400/10"
                          : "border-primary/20 bg-secondary/30 hover:border-primary/45"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border font-mono text-[9px] font-bold",
                          on ? "border-amber-400 bg-amber-400/20 text-amber-300" : "border-primary/40 text-transparent"
                        )}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block text-[12px] font-semibold", on ? "text-amber-200" : "text-cyan-100")}>
                          {c.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{c.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : applied.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300/90">
                    Rolled constraints (seed {constraintSeed})
                  </span>
                  <Button variant="outline" size="sm" className="h-6 px-2 font-mono text-[10px]" onClick={rerollConstraints}>
                    <Dices className="mr-1 h-3 w-3" aria-hidden="true" /> REROLL
                  </Button>
                </div>
                {applied.map((c) => (
                  <div key={c.id} className="rounded-md border border-amber-400/30 bg-amber-400/5 px-2.5 py-2">
                    <div className="text-[12px] font-semibold text-amber-200">{c.name}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{c.description}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-primary/20 bg-secondary/30 px-3 py-2 text-[11.5px] text-muted-foreground">
                No extra constraints at {difficulty} difficulty. The numbers on this card are the ones you must meet.
              </div>
            )}
          </section>

          <section className="panel hud-corners p-5 sm:p-6 lg:sticky lg:top-20">
            <SectionHeading kicker="ENGINEERING MARGINS" title="Design Requirements" className="mb-2" />
            <div className="divide-y divide-primary/10">
              <RequirementRow
                icon={<Coins className="h-4 w-4" aria-hidden="true" />}
                label="Budget"
                value={formatMoney(mission.budget)}
                hint="The total cost of every component you install must stay within this budget."
              />
              <RequirementRow
                icon={<Scale className="h-4 w-4" aria-hidden="true" />}
                label="Maximum mass"
                value={formatMass(mission.maxMass)}
                hint="The launch vehicle can only lift this much. Structure, fuel and equipment all count."
              />
              <RequirementRow
                icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
                label="Propellant required"
                value={`${mission.minFuel.toLocaleString()} kg`}
                hint="The minimum propellant for this mission's course changes. Inefficient engines need even more."
              />
              <RequirementRow
                icon={<Zap className="h-4 w-4" aria-hidden="true" />}
                label="Power at destination"
                value={`≥ ${mission.minPower} W`}
                hint="Effective generation at the destination — solar arrays produce less far from the Sun."
              />
              <RequirementRow
                icon={<Flame className="h-4 w-4" aria-hidden="true" />}
                label="Thrust capability"
                value={`≥ ${mission.minPropulsion} pts`}
                hint="Total engine capability needed for the journey. Chemical engines give thrust; ion engines give efficiency."
              />
              <RequirementRow
                icon={<Sun className="h-4 w-4" aria-hidden="true" />}
                label="Solar efficiency here"
                value={`${Math.round(mission.solarDerate * 100)}% of rating`}
                hint={
                  mission.solarDerate < 0.5
                    ? "Sunlight is weak this far out — solar arrays deliver only a fraction of their rating. Radioisotope generators (RTGs) ignore distance."
                    : "Solar arrays work well at this distance from the Sun."
                }
              />
              {specialReqs.map((r) => (
                <RequirementRow key={r.label} icon={r.icon} label={r.label} value={r.value} hint={r.hint} />
              ))}
            </div>

            <div className="mt-4 rounded-md border border-accent/25 bg-accent/5 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/90">Mandatory equipment</div>
              <ul className="mt-2 space-y-1">
                {requiredEquipmentNames.map((name) => (
                  <li key={name} className="flex items-center gap-2 text-[13px] text-cyan-100">
                    <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                size="lg"
                className="launch-glow font-display h-12 bg-gradient-to-r from-primary to-accent text-sm font-bold tracking-wider text-[#04070f] hover:from-primary/90 hover:to-accent/90"
                onClick={() => goTo("designer")}
              >
                PROCEED TO SPACECRAFT DESIGN
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" className="text-muted-foreground" onClick={() => goTo("dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back to mission selection
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
