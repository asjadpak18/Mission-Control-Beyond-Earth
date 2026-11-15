"use client";

/**
 * ============================================================================
 * MISSION SIMULATION — the interactive eight-stage flight (v2.0 layout)
 * ============================================================================
 * Three-area layout, as designed in the v2.0 spec:
 *   LEFT   — mission stages, progress, telemetry, flight controls
 *   MIDDLE — mission console (telemetry lines, decisions), stage education
 *   RIGHT  — large animated visual simulation window (MissionVisualizer)
 *
 * The engine drives everything; the event decision modal keeps decisions
 * accessible at all times, and the flight view mirrors the actual state.
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Check, ChevronRight, CircleCheck, CircleDashed, CircleX, Flame, Gauge, Microscope,
  Play, RotateCcw, ScrollText, Signal, TriangleAlert, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computeResources } from "@/lib/game/calculations";
import { STAGE_DEFS } from "@/lib/game/simulation";
import { useGameStore, currentMission } from "@/store/gameStore";
import { StatBar } from "@/components/game/shared";
import { MissionVisualizer } from "@/components/game/MissionVisualizer";
import { cn } from "@/lib/utils";
import { useCue, useSoundStore } from "@/store/soundStore";

const REVEAL_INTERVAL_MS = 650;
/** Stage 1 (launch) lines print slower so the liftoff simulation — countdown,
 *  ignition, tower clear — plays out in the flight view while the log runs. */
const LAUNCH_REVEAL_INTERVAL_MS = 2600;

export function SimulationScreen() {
  const missionId = useGameStore((s) => s.missionId);
  const simulation = useGameStore((s) => s.simulation);
  const difficulty = useGameStore((s) => s.difficulty);
  const constraintIds = useGameStore((s) => s.constraintIds);
  const constraintSeed = useGameStore((s) => s.constraintSeed);
  const design = useGameStore((s) => (s.missionId ? s.designs[s.missionId] : undefined));
  const advanceStage = useGameStore((s) => s.advanceStage);
  const decide = useGameStore((s) => s.decide);
  const completeMission = useGameStore((s) => s.completeMission);
  const retryMission = useGameStore((s) => s.retryMission);
  const goTo = useGameStore((s) => s.goTo);

  const mission = useMemo(
    () => (missionId ? currentMission({ missionId, difficulty, constraintIds, constraintSeed }) : null),
    [missionId, difficulty, constraintIds, constraintSeed]
  );

  const [revealCount, setRevealCount] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [eventDismissed, setEventDismissed] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cue = useCue();
  const audioUnlocked = useSoundStore((s) => s.audioUnlocked);

  // Clear any pending reveal timer on unmount.
  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  // Redirect if the simulation is missing (e.g. after a page refresh).
  useEffect(() => {
    if (!simulation || !mission || !design) {
      goTo(mission ? "readiness" : "dashboard");
    }
  }, [simulation, mission, design, goTo]);

  // v2.2 — play the event-alert stinger when a new event becomes pending.
  const prevEventId = useRef<string | null>(null);
  useEffect(() => {
    if (!simulation || !audioUnlocked) return;
    const pendingId = simulation.pendingEvent?.event.id ?? null;
    if (pendingId && pendingId !== prevEventId.current && simulation.stagePhase === "awaiting_event") {
      cue("event_alert");
    }
    prevEventId.current = pendingId;
  }, [simulation?.pendingEvent, simulation?.stagePhase, audioUnlocked, cue]);

  // v2.2 — play the mission complete / failure stinger when the mission ends.
  const prevMissionOver = useRef(false);
  useEffect(() => {
    if (!simulation || !audioUnlocked) return;
    const missionOver = simulation.stagePhase === "complete" || simulation.status === "failure";
    if (missionOver && !prevMissionOver.current) {
      cue(simulation.status === "failure" ? "mission_failure" : "mission_complete");
    }
    prevMissionOver.current = missionOver;
  }, [simulation?.stagePhase, simulation?.status, audioUnlocked, cue]);

  const resources = useMemo(
    () => (mission && design ? computeResources(mission, design) : null),
    [mission, design]
  );

  // Keep the console scrolled to the newest line.
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight, behavior: "smooth" });
  }, [revealCount, simulation?.stageLog.length, simulation?.pendingEvent]);

  if (!simulation || !mission || !design || !resources) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Preparing launch…</div>;
  }

  const stageNum = simulation.stageIndex + 1;
  const currentDef = STAGE_DEFS[simulation.stageIndex];
  const missionOver = simulation.stagePhase === "complete" || simulation.status === "failure";
  const showEvent =
    !revealing && simulation.stagePhase === "awaiting_event" && simulation.pendingEvent !== null && !eventDismissed;
  const stagesComplete = simulation.stageLog.filter((r) => r.status === "success" || r.status === "degraded").length;

  const executeStage = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    setRevealCount(0);
    setRevealing(true);
    // v2.2 — sound cues for stage execution
    const stageNum = simulation.stageIndex + 1;
    cue(stageNum === 1 ? "launch_ignition" : "stage_advance");
    if (stageNum === 1) {
      // Ascent whoosh fires shortly after ignition, matching the LaunchScene timeline.
      setTimeout(() => cue("launch_ascent"), 900);
    }
    advanceStage();
    // Read the record the engine just produced and reveal its lines over time.
    const sim = useGameStore.getState().simulation;
    const rec = sim?.stageLog[sim.stageLog.length - 1];
    revealNext(rec, 0);
  };

  /** Self-scheduling reveal: shows one console line per interval (no effect-setState). */
  function revealNext(rec: { stage: number; log: string[] } | undefined, count: number) {
    if (!rec || count >= rec.log.length) {
      setRevealing(false);
      setEventDismissed(false);
      return;
    }
    setRevealCount(count);
    const interval = rec.stage === 1 ? LAUNCH_REVEAL_INTERVAL_MS : REVEAL_INTERVAL_MS;
    revealTimer.current = setTimeout(() => revealNext(rec, count + 1), interval);
  }

  const stageStatusIcon = (n: number) => {
    const rec = simulation.stageLog.find((r) => r.stage === n);
    if (!rec) return <CircleDashed className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />;
    if (rec.status === "success") return <CircleCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
    if (rec.status === "degraded") return <TriangleAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />;
    if (rec.status === "failed") return <CircleX className="h-4 w-4 text-rose-400" aria-hidden="true" />;
    return <CircleDashed className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />;
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] px-3 pb-16 sm:px-6">
      {/* Header */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
            FLIGHT OPERATIONS · {mission.name.toUpperCase()} · SEED {simulation.seed}
          </div>
          <h1 className="font-display mt-1 text-xl font-bold text-foreground sm:text-2xl">Mission Control Live</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-300/90 hover:bg-rose-400/10 hover:text-rose-200"
          onClick={() => retryMission()}
        >
          <X className="mr-1.5 h-4 w-4" aria-hidden="true" /> Abort to readiness
        </Button>
      </div>

      {/* Compact stage timeline */}
      <div className="panel mt-4 overflow-x-auto p-3">
        <ol className="flex min-w-[680px] items-center gap-1">
          {STAGE_DEFS.map((def, i) => {
            const rec = simulation.stageLog.find((r) => r.stage === def.stage);
            const isCurrent = !missionOver && def.stage === stageNum && simulation.stagePhase !== "complete";
            const done = !!rec;
            return (
              <li key={def.stage} className="flex flex-1 items-center">
                <div className="flex min-w-16 flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border font-mono text-xs font-bold transition-all",
                      isCurrent && !revealing
                        ? "border-accent bg-accent/15 text-accent text-glow"
                        : isCurrent && revealing
                          ? "border-accent/70 bg-accent/25 text-accent blink"
                          : done
                            ? rec?.status === "failed"
                              ? "border-rose-400/60 bg-rose-400/10 text-rose-300"
                              : rec?.status === "degraded"
                                ? "border-amber-400/60 bg-amber-400/10 text-amber-300"
                                : "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                            : "border-primary/20 text-muted-foreground/60"
                    )}
                  >
                    {def.stage}
                  </div>
                  <span
                    className={cn(
                      "whitespace-nowrap font-mono text-[9px] font-semibold tracking-wider",
                      isCurrent ? "text-accent" : "text-muted-foreground/70"
                    )}
                  >
                    {def.short}
                  </span>
                </div>
                {i < STAGE_DEFS.length - 1 ? (
                  <div
                    className={cn(
                      "mx-1 h-px flex-1",
                      done ? "bg-emerald-400/40" : isCurrent ? "bg-accent/40" : "bg-primary/15"
                    )}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* ============== Three-area layout ============== */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,430px)]">
        {/* ---------------- LEFT: stages, telemetry, controls ---------------- */}
        <aside className="flex flex-col gap-4">
          <section className="panel overflow-hidden">
            <div className="border-b border-primary/15 px-4 py-2.5">
              <span className="font-display text-[13px] font-bold text-foreground">Mission Stages</span>
            </div>
            <ol className="divide-y divide-primary/10">
              {STAGE_DEFS.map((def) => {
                const rec = simulation.stageLog.find((r) => r.stage === def.stage);
                const isCurrent = !missionOver && def.stage === stageNum;
                return (
                  <li
                    key={def.stage}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2",
                      isCurrent ? "bg-accent/5" : "",
                    )}
                  >
                    {stageStatusIcon(def.stage)}
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate text-[12px] font-semibold",
                          isCurrent ? "text-accent" : rec ? "text-foreground" : "text-muted-foreground/70"
                        )}
                      >
                        {def.stage}. {def.title}
                      </div>
                      {rec ? (
                        <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                          {rec.status} · {rec.fuelUsed} kg · +{rec.scienceGained} sci
                        </div>
                      ) : null}
                    </div>
                    {isCurrent && !missionOver ? (
                      <span className="live-dot h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <div className="border-t border-primary/15 px-4 py-2 font-mono text-[10px] text-muted-foreground">
              {stagesComplete}/8 COMPLETE · {simulation.decisions.length} DECISIONS
            </div>
          </section>

          <section className="panel hud-corners space-y-4 p-4">
            <div className="font-display text-sm font-bold text-foreground">Telemetry</div>
            <StatBar
              label="Propellant remaining"
              value={Math.max(0, simulation.fuelRemaining)}
              max={resources.fuelCapacity || 1}
              display={`${Math.max(0, Math.round(simulation.fuelRemaining)).toLocaleString()} kg`}
              hint="Propellant left in the tanks. Course changes and emergencies consume it — running dry ends the mission."
              compact
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Microscope className="h-3 w-3" aria-hidden="true" /> SCIENCE
                </div>
                <div className="font-mono text-lg font-bold text-accent">{Math.round(simulation.scienceData)}</div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Signal className="h-3 w-3" aria-hidden="true" /> DOWNLINK
                </div>
                <div className="font-mono text-lg font-bold text-cyan-200">{Math.round(simulation.dataTransmitted)}</div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Gauge className="h-3 w-3" aria-hidden="true" /> RELIABILITY
                </div>
                <div
                  className={cn(
                    "font-mono text-lg font-bold",
                    simulation.reliability >= 85 ? "text-emerald-300" : simulation.reliability >= 70 ? "text-amber-300" : "text-rose-300"
                  )}
                >
                  {Math.round(simulation.reliability)}%
                </div>
              </div>
              <div className="rounded-md border border-primary/20 bg-secondary/40 p-2.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Flame className="h-3 w-3" aria-hidden="true" /> POWER MARGIN
                </div>
                <div
                  className={cn(
                    "font-mono text-lg font-bold",
                    resources.powerBalance - simulation.powerStress >= 0 ? "text-emerald-300" : "text-rose-300"
                  )}
                >
                  {Math.round(resources.powerBalance - simulation.powerStress)} W
                </div>
              </div>
            </div>
          </section>

          {/* Flight controls */}
          <section className="panel p-4">
            {missionOver ? (
              <Button
                size="lg"
                className="launch-glow font-display h-12 w-full bg-gradient-to-r from-primary to-accent text-sm font-bold tracking-[0.2em] text-[#03101d] hover:from-primary/90 hover:to-accent/90"
                onClick={() => completeMission()}
              >
                <ScrollText className="mr-2 h-5 w-5" aria-hidden="true" />
                GENERATE MISSION REPORT
              </Button>
            ) : simulation.stagePhase === "awaiting_event" ? (
              <div className="flex items-center justify-center gap-2 py-2 font-mono text-xs tracking-[0.2em] text-amber-300">
                <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                EVENT REQUIRES YOUR DECISION
              </div>
            ) : revealing ? (
              <div className="flex items-center justify-center gap-2 py-2 font-mono text-xs tracking-[0.2em] text-accent">
                <span className="live-dot h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                STAGE {stageNum} EXECUTING…
              </div>
            ) : (
              <Button
                size="lg"
                onClick={executeStage}
                className="font-display h-12 w-full border border-accent/50 bg-secondary text-sm font-bold tracking-[0.2em] text-accent hover:bg-[#123156]"
              >
                <Play className="mr-2 h-5 w-5" aria-hidden="true" />
                EXECUTE STAGE {stageNum} — {currentDef?.short}
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            {missionOver && simulation.status === "failure" ? (
              <Button variant="outline" className="mt-2 w-full border-primary/40 font-mono text-xs" onClick={retryMission}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                RETURN TO READINESS AND REFIT
              </Button>
            ) : null}
          </section>
        </aside>

        {/* ---------------- MIDDLE: mission console + education ---------------- */}
        <section className="panel flex min-h-[560px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-primary/15 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", missionOver ? "bg-amber-400" : "bg-emerald-400 live-dot")} aria-hidden="true" />
              <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-emerald-300">
                {missionOver ? "TRANSMISSION ENDED" : revealing ? "STAGE IN PROGRESS" : "AWAITING COMMAND"}
              </span>
            </div>
            {currentDef && !missionOver ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                STAGE {stageNum}/8 — {currentDef.title.toUpperCase()}
              </span>
            ) : null}
          </div>

          {/* Console body */}
          <div ref={consoleRef} className="grid-overlay flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: "56vh" }}>
            {simulation.stageLog.map((rec, idx) => {
              const isLast = idx === simulation.stageLog.length - 1;
              const linesToShow = isLast ? rec.log.slice(0, revealCount) : rec.log;
              return (
                <div key={rec.stage}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-[11px] font-bold tracking-[0.15em]",
                        rec.status === "success"
                          ? "text-emerald-300"
                          : rec.status === "degraded"
                            ? "text-amber-300"
                            : rec.status === "failed"
                              ? "text-rose-300"
                              : "text-muted-foreground/50"
                      )}
                    >
                      [STAGE {rec.stage} — {rec.title.toUpperCase()}]
                    </span>
                    {rec.status === "success" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    ) : null}
                  </div>
                  {linesToShow.map((line, i) => (
                    <p key={i} className="console-line text-cyan-100/80">
                      <span className="mr-2 text-primary/50">{String(i + 1).padStart(2, "0")}</span>
                      {line}
                    </p>
                  ))}
                  {isLast && revealing && revealCount < rec.log.length ? (
                    <p className="console-line mt-1 text-accent">
                      <span className="mr-2 opacity-50">»»</span>
                      <span className="blink">_</span>
                    </p>
                  ) : null}

                  {/* Decisions taken during this stage */}
                  {simulation.decisions
                    .filter((d) => d.stage === rec.stage)
                    .map((d) => (
                      <div key={d.eventId} className="mt-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/90">
                          DECISION · {d.eventTitle}
                        </div>
                        <div className="mt-0.5 text-[12px] font-semibold text-cyan-100">{d.choiceLabel}</div>
                        <div className="console-line mt-0.5 text-cyan-200/60">{d.outcome}</div>
                      </div>
                    ))}
                </div>
              );
            })}

            {simulation.stageLog.length === 0 && !revealing ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Play className="h-8 w-8 text-accent/50" aria-hidden="true" />
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                  All systems nominal. Ignition sequence is armed — command the first stage when ready,
                  Mission Director.
                </p>
              </div>
            ) : null}

            {simulation.failureReason ? (
              <div className="rounded-md border border-rose-400/50 bg-rose-400/10 px-4 py-3">
                <div className="font-mono text-xs font-bold tracking-widest text-rose-300">MISSION FAILURE</div>
                <p className="mt-1 text-[13px] text-rose-100/90">{simulation.failureReason}</p>
              </div>
            ) : null}
          </div>

          {/* Stage education card */}
          {currentDef && !missionOver ? (
            <div className="border-t border-primary/15 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
                STAGE {stageNum} BRIEF
              </div>
              <div className="font-display mt-1 text-sm font-bold text-foreground">{currentDef.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{currentDef.description}</p>
              <p className="mt-2 flex items-start gap-2 border-t border-primary/15 pt-2 text-[11px] italic leading-relaxed text-cyan-200/70">
                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden="true" />
                {currentDef.educational}
              </p>
            </div>
          ) : null}
        </section>

        {/* ---------------- RIGHT: animated flight view ---------------- */}
        <MissionVisualizer
          mission={mission}
          config={design}
          simulation={simulation}
          revealing={revealing}
          className="min-h-[480px]"
        />
      </div>

      {/* ------------------- Event decision modal ------------------- */}
      <Dialog open={showEvent} onOpenChange={() => undefined}>
        <DialogContent
          className="panel hud-corners max-w-lg border-accent/50 bg-[#081120]/95 p-0"
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          aria-describedby="event-description"
        >
          {simulation.pendingEvent ? (
            <div className="space-y-4 p-6">
              <DialogHeader className="space-y-2 text-left">
                <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">
                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  Mission event — stage {simulation.stageIndex + 1}
                </div>
                <DialogTitle className="font-display text-lg font-bold leading-snug text-foreground">
                  {simulation.pendingEvent.event.title}
                </DialogTitle>
                <DialogDescription className="text-[13px] leading-relaxed text-cyan-100/80">
                  {simulation.pendingEvent.event.description}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md border border-accent/25 bg-accent/5 p-3">
                <p className="flex items-start gap-2 text-[11.5px] italic leading-relaxed text-cyan-200/75">
                  <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" aria-hidden="true" />
                  {simulation.pendingEvent.event.educationalNote}
                </p>
              </div>

              <div className="flex items-center gap-4 rounded-md border border-primary/20 bg-secondary/40 px-3 py-2 font-mono text-[11px]">
                <span className="text-muted-foreground">
                  FUEL <span className="font-bold text-cyan-200">{Math.max(0, Math.round(simulation.fuelRemaining)).toLocaleString()} kg</span>
                </span>
                <span className="text-muted-foreground">
                  PWR MARGIN{" "}
                  <span className={cn("font-bold", resources.powerBalance - simulation.powerStress >= 0 ? "text-emerald-300" : "text-rose-300")}>
                    {Math.round(resources.powerBalance - simulation.powerStress)} W
                  </span>
                </span>
                <span className="text-muted-foreground">
                  REL <span className="font-bold text-cyan-200">{Math.round(simulation.reliability)}%</span>
                </span>
              </div>

              <div className="space-y-2.5">
                {simulation.pendingEvent.event.choices.map((choice, i) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => {
                      decide(choice.id);
                      setEventDismissed(true);
                      // v2.2 — play resolved cue based on the choice's planning quality.
                      cue(choice.effects.quality !== undefined && choice.effects.quality >= 0.5 ? "event_resolved_good" : "event_resolved_bad");
                    }}
                    className="group flex w-full items-start gap-3 rounded-md border border-primary/40 bg-secondary/60 p-3.5 text-left transition-all hover:border-accent/70 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/50 font-mono text-[11px] font-bold text-accent group-hover:border-accent group-hover:bg-accent/20">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-foreground">{choice.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {choice.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
