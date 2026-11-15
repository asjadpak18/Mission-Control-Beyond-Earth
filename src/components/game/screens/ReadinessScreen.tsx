"use client";

/**
 * MISSION READINESS — the launch gate.
 * Every validation check is listed with a beginner-friendly explanation;
 * launch is impossible while any essential check fails.
 */

import { useMemo } from "react";
import { ArrowLeft, CircleCheck, CircleDashed, Rocket, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeResources, formatMoney } from "@/lib/game/calculations";
import { validateSpacecraft } from "@/lib/game/validation";
import { useGameStore, currentMission } from "@/store/gameStore";
import { SectionHeading } from "@/components/game/shared";
import { cn } from "@/lib/utils";

export function ReadinessScreen() {
  const missionId = useGameStore((s) => s.missionId);
  const difficulty = useGameStore((s) => s.difficulty);
  const constraintIds = useGameStore((s) => s.constraintIds);
  const constraintSeed = useGameStore((s) => s.constraintSeed);
  const design = useGameStore((s) => (s.missionId ? s.designs[s.missionId] : undefined));
  const goTo = useGameStore((s) => s.goTo);
  const launchMission = useGameStore((s) => s.launchMission);

  const mission = useMemo(
    () => (missionId ? currentMission({ missionId, difficulty, constraintIds, constraintSeed }) : null),
    [missionId, difficulty, constraintIds, constraintSeed]
  );

  const validation = useMemo(
    () => (mission && design ? validateSpacecraft(mission, design) : null),
    [mission, design]
  );
  const resources = useMemo(
    () => (mission && design ? computeResources(mission, design) : null),
    [mission, design]
  );

  if (!mission || !design || !validation || !resources) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-muted-foreground">No mission selected.</p>
        <Button className="mt-4" onClick={() => goTo("dashboard")}>
          Return to mission selection
        </Button>
      </div>
    );
  }

  const launch = () => {
    const ok = launchMission(); // hard gate — refuses when not ready
    if (!ok) {
      // The checklist above already explains every blocker.
      document.getElementById("readiness-checklist")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
            STEP 03 — FLIGHT READINESS REVIEW · {mission.name.toUpperCase()}
          </div>
          <h1 className="font-display mt-1 text-xl font-bold text-foreground sm:text-2xl">Launch Readiness</h1>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => goTo("designer")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" /> Back to designer
        </Button>
      </div>

      {/* Status banner */}
      <div
        className={cn(
          "panel mt-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between",
          validation.ready ? "panel-glow border-emerald-400/40" : "border-rose-400/40"
        )}
      >
        <div className="flex items-center gap-3">
          {validation.ready ? (
            <CircleCheck className="h-9 w-9 shrink-0 text-emerald-400" aria-hidden="true" />
          ) : (
            <TriangleAlert className="h-9 w-9 shrink-0 text-rose-400" aria-hidden="true" />
          )}
          <div>
            <div className={cn("font-display text-base font-bold", validation.ready ? "text-emerald-300" : "text-rose-300")}>
              {validation.ready ? "GO FOR LAUNCH" : "NO-GO — ISSUES FOUND"}
            </div>
            <div className="text-xs text-muted-foreground">
              {validation.ready
                ? `Spacecraft: ${resources.totalMass.toLocaleString()} kg · ${formatMoney(resources.totalCost)} · reliability ${resources.reliability}%`
                : `${validation.errors.length} essential check${validation.errors.length === 1 ? "" : "s"} still failing. Fix them in the designer.`}
            </div>
          </div>
        </div>
        <Button
          size="lg"
          disabled={!validation.ready}
          onClick={launch}
          className={cn(
            "font-display h-12 px-8 text-sm font-bold tracking-[0.2em]",
            validation.ready
              ? "launch-glow bg-gradient-to-r from-primary to-accent text-[#04070f] hover:from-primary/90 hover:to-accent/90"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Rocket className="mr-2 h-5 w-5" aria-hidden="true" />
          {validation.ready ? "LAUNCH MISSION" : "LAUNCH BLOCKED"}
        </Button>
      </div>

      {/* Essential checks */}
      <section id="readiness-checklist" className="mt-6 scroll-mt-24">
        <SectionHeading kicker="ESSENTIAL CHECKS" title="Validation Checklist" className="mb-4" />
        <div className="space-y-2.5">
          {validation.checks.map((check) => (
            <div
              key={check.id}
              className={cn(
                "panel flex items-start gap-3 p-4",
                check.passed ? "border-emerald-400/25" : "border-rose-400/45 bg-rose-400/5"
              )}
            >
              {check.passed ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              ) : (
                <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={cn("text-sm font-semibold", check.passed ? "text-foreground" : "text-rose-200")}>
                    {check.label}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10px] font-bold tracking-[0.2em]",
                      check.passed ? "text-emerald-400/80" : "text-rose-400"
                    )}
                  >
                    {check.passed ? "PASS" : "FAIL"}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{check.message}</p>
                {!check.passed && check.hint ? (
                  <p className="mt-1.5 border-l-2 border-accent/40 pl-2 text-xs italic leading-relaxed text-cyan-200/70">
                    Hint: {check.hint}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Advisories */}
      {validation.warnings.length > 0 ? (
        <section className="mt-6">
          <SectionHeading kicker="FLIGHT ADVISORIES" title="Warnings (non-blocking)" className="mb-4" />
          <div className="space-y-2.5">
            {validation.warnings.map((w) => (
              <div key={w.id} className="panel flex items-start gap-3 border-amber-400/30 bg-amber-400/5 p-4">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-amber-200">{w.label}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{w.message}</p>
                  {w.hint ? (
                    <p className="mt-1.5 border-l-2 border-amber-400/40 pl-2 text-xs italic leading-relaxed text-amber-200/60">
                      {w.hint}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="panel mt-6 flex items-center gap-3 border-emerald-400/25 p-4">
          <CircleCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <p className="text-[13px] text-muted-foreground">
            No advisories — your margins are comfortable. Good engineering leaves room for the unexpected.
          </p>
        </div>
      )}
    </div>
  );
}
