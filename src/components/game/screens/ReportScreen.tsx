"use client";

/**
 * MISSION REPORT — final evaluation: score breakdown, objectives, decisions,
 * engineering strengths/weaknesses and recommendations for the next attempt.
 */

import { useMemo } from "react";
import {
  ArrowRight, Award, BookOpen, CircleCheck, CircleX, Coins, Gauge, Lightbulb, Microscope, Orbit,
  RotateCcw, ScrollText, Signal, ThumbsDown, ThumbsUp, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMission } from "@/lib/game/missions";
import { useGameStore } from "@/store/gameStore";
import { SectionHeading, StatusBadge } from "@/components/game/shared";
import { cn } from "@/lib/utils";

function ScoreRow({ label, value, max, hint }: { label: string; value: number; max: number; hint: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs font-bold text-cyan-200">
          {value} <span className="text-muted-foreground/60">/ {max}</span>
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">{hint}</p>
    </div>
  );
}

export function ReportScreen() {
  const missionId = useGameStore((s) => s.missionId);
  const result = useGameStore((s) => s.result);
  const goTo = useGameStore((s) => s.goTo);
  const retryMission = useGameStore((s) => s.retryMission);

  const mission = missionId ? getMission(missionId) : null;

  const grade = useMemo(() => {
    if (!result) return { letter: "—", label: "" };
    const s = result.score;
    if (s >= 900) return { letter: "S", label: "Flagship command" };
    if (s >= 800) return { letter: "A", label: "Distinguished flight" };
    if (s >= 650) return { letter: "B", label: "Solid engineering" };
    if (s >= 450) return { letter: "C", label: "Marginal mission" };
    if (s >= 250) return { letter: "D", label: "Development flight" };
    return { letter: "E", label: "Back to the drawing board" };
  }, [result]);

  if (!mission || !result) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-muted-foreground">No mission report available.</p>
        <Button className="mt-4" onClick={() => goTo("dashboard")}>
          Return to mission selection
        </Button>
      </div>
    );
  }

  const b = result.scoreBreakdown;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      {/* ---------------- Header banner ---------------- */}
      <section
        className={cn(
          "panel hud-corners mt-6 flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8",
          result.status === "success"
            ? "border-emerald-400/40"
            : result.status === "partial"
              ? "border-amber-400/40"
              : "border-rose-400/40"
        )}
      >
        <div className="max-w-xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={result.status} />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {mission.name} · SEED {result.seed}
            </span>
          </div>
          <h1 className="font-display text-2xl font-black tracking-wide text-foreground sm:text-3xl">
            Mission Report
          </h1>
          <p className="text-sm leading-relaxed text-cyan-100/85">{result.report.summary}</p>
          <div className="flex flex-wrap gap-4 pt-1 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Orbit className="h-3.5 w-3.5 text-accent/70" aria-hidden="true" />
              STAGES <span className="font-bold text-cyan-200">{result.completedStages}/8</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Microscope className="h-3.5 w-3.5 text-accent/70" aria-hidden="true" />
              SCIENCE <span className="font-bold text-cyan-200">{result.scientificData}/100</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Signal className="h-3.5 w-3.5 text-accent/70" aria-hidden="true" />
              DOWNLINK <span className="font-bold text-cyan-200">{result.dataTransmitted}</span>
            </span>
          </div>
        </div>

        {/* Score ring */}
        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:gap-2">
          <div className="relative flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(0,163,255,0.12)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="url(#scoreGradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(result.score / 1000) * 276.46} 276.46`}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00a3ff" />
                  <stop offset="100%" stopColor="#00e5ff" />
                </linearGradient>
              </defs>
            </svg>
            <div className="text-center">
              <div className="font-display text-2xl font-black text-foreground sm:text-3xl">{result.score}</div>
              <div className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground">/ 1000</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5">
            <Award className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="font-display text-sm font-black text-accent">{grade.letter}</span>
            <span className="font-mono text-[10px] text-cyan-200/80">{grade.label}</span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ---------------- Left column ---------------- */}
        <div className="space-y-6">
          <section className="panel p-5 sm:p-6">
            <SectionHeading kicker="SCORING" title="Score Breakdown" className="mb-4" />
            <div className="space-y-4">
              <ScoreRow label="Primary objectives" value={b.objectivesPrimary} max={400} hint="The must-achieve goals of the mission." />
              <ScoreRow label="Secondary objectives" value={b.objectivesSecondary} max={150} hint="Stretch goals that reward a stronger spacecraft." />
              <ScoreRow label="Engineering performance" value={b.engineering} max={200} hint="Reliability, power margin and robustness of your design." />
              <ScoreRow label="Resource efficiency" value={b.efficiency} max={150} hint="How wisely you spent propellant and budget." />
              <ScoreRow label="Decision-making" value={b.decisions} max={100} hint="The quality of your calls during in-flight events." />
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading
              kicker="OBJECTIVES"
              title={`${result.completedObjectives.length}/${result.completedObjectives.length + result.failedObjectives.length} Objectives Achieved`}
              className="mb-4"
            />
            <ul className="space-y-2">
              {[...result.completedObjectives, ...result.failedObjectives].map((o) => (
                <li
                  key={o.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-md border px-3 py-2",
                    o.completed ? "border-emerald-400/20 bg-emerald-400/5" : "border-rose-400/20 bg-rose-400/5"
                  )}
                >
                  <span className="flex min-w-0 items-start gap-2">
                    {o.completed ? (
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                    )}
                    <span>
                      <span className={cn("block text-[13px]", o.completed ? "text-cyan-100" : "text-rose-100/80")}>
                        {o.description}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {o.required ? "PRIMARY" : "SECONDARY"}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs font-bold",
                      o.completed ? "text-emerald-300" : "text-rose-300/70"
                    )}
                  >
                    {o.earned}/{o.points}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading kicker="FLIGHT RECORD" title="Decisions Made" className="mb-4" />
            {result.decisions.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                No in-flight decisions were required — a quiet flight. Fewer events often means fewer chances to
                shine (or to fail).
              </p>
            ) : (
              <ol className="space-y-3">
                {result.decisions.map((d, i) => (
                  <li key={`${d.eventId}-${i}`} className="relative border-l border-primary/25 pl-4">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      STAGE {d.stage} · {d.eventTitle}
                    </div>
                    <div className="mt-0.5 text-[13px] font-semibold text-cyan-100">{d.choiceLabel}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{d.outcome}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* ---------------- Right column ---------------- */}
        <div className="space-y-6">
          <section className="panel hud-corners p-5 sm:p-6">
            <SectionHeading kicker="ENGINEERING ANALYSIS" title="Performance Review" className="mb-4" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Gauge className="h-3 w-3" aria-hidden="true" /> FUEL REMAINING
                </div>
                <div className="font-mono text-base font-bold text-cyan-200">
                  {result.telemetry.fuelRemaining}
                  <span className="text-xs text-muted-foreground"> / {result.telemetry.fuelCapacity} kg</span>
                </div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Gauge className="h-3 w-3" aria-hidden="true" /> RELIABILITY
                </div>
                <div className="font-mono text-base font-bold text-cyan-200">{result.telemetry.reliability}%</div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Signal className="h-3 w-3" aria-hidden="true" /> POWER MARGIN
                </div>
                <div
                  className={cn(
                    "font-mono text-base font-bold",
                    result.telemetry.powerMargin >= 0 ? "text-emerald-300" : "text-rose-300"
                  )}
                >
                  {result.telemetry.powerMargin} W
                </div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Wrench className="h-3 w-3" aria-hidden="true" /> LANDING QUALITY
                </div>
                <div className="font-mono text-base font-bold text-cyan-200">
                  {result.telemetry.landingQuality !== null ? `${result.telemetry.landingQuality}/100` : "N/A"}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> Strengths
                </div>
                <ul className="space-y-1">
                  {result.report.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-cyan-100/85">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">
                  <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /> Weaknesses
                </div>
                <ul className="space-y-1">
                  {result.report.weaknesses.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-cyan-100/85">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading kicker="NEXT ATTEMPT" title="Recommendations" className="mb-3" />
            <ul className="space-y-2">
              {result.report.recommendations.map((rec, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-accent/20 bg-accent/5 px-3 py-2 text-[12.5px] leading-relaxed text-cyan-100/90"
                >
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent/80" aria-hidden="true" />
                  {rec}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-5 sm:p-6">
            <SectionHeading kicker="WHAT WE LEARNED" title="Educational Notes" className="mb-3" />
            <ul className="space-y-2.5">
              {result.report.educationalNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] italic leading-relaxed text-cyan-200/75">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent/60" aria-hidden="true" />
                  {note}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* ---------------- Actions ---------------- */}
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          size="lg"
          variant="outline"
          className="border-primary/40 font-display h-12 px-6 text-sm font-bold tracking-wider text-accent hover:bg-accent/10"
          onClick={retryMission}
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          REFIT & REFLY THIS MISSION
        </Button>
        <Button
          size="lg"
          className="launch-glow font-display h-12 bg-gradient-to-r from-primary to-accent px-6 text-sm font-bold tracking-wider text-[#04070f] hover:from-primary/90 hover:to-accent/90"
          onClick={() => goTo("dashboard")}
        >
          NEW MISSION
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-6 flex justify-center">
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/60">
          <ScrollText className="h-3 w-3" aria-hidden="true" />
          REPLAYABLE — SAME SPACECRAFT + SAME SEED = SAME FLIGHT. CHANGE EITHER FOR A NEW CHALLENGE.
        </span>
      </div>
    </div>
  );
}
