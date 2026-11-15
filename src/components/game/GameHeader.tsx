"use client";

/**
 * Application header: identity, phase stepper (PLAN → DESIGN → VALIDATE →
 * LAUNCH → MANAGE → EVALUATE), mission context and (v2.0) the active game
 * mode with a quick way back to mission control.
 */

import { Rocket, Users, Undo2 } from "lucide-react";
import { useGameStore, Phase } from "@/store/gameStore";
import { getMission } from "@/lib/game/missions";
import { cn } from "@/lib/utils";
import { SoundControl } from "./SoundControl";

const PHASES: Array<{ key: string; label: string; stores: Phase[] }> = [
  { key: "PLAN", label: "Plan", stores: ["dashboard", "briefing"] },
  { key: "DESIGN", label: "Design", stores: ["designer"] },
  { key: "VALIDATE", label: "Validate", stores: ["readiness"] },
  { key: "LAUNCH", label: "Launch", stores: ["simulation"] },
  { key: "MANAGE", label: "Manage", stores: ["simulation"] },
  { key: "EVALUATE", label: "Evaluate", stores: ["report"] },
];

export function GameHeader() {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const missionId = useGameStore((s) => s.missionId);
  const setMode = useGameStore((s) => s.setMode);
  const mission = missionId ? getMission(missionId) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-primary/15 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => useGameStore.getState().returnHome()}
          className="flex items-center gap-2.5 text-left"
          aria-label="Return to mission selection"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent">
            <Rocket className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[13px] font-bold tracking-[0.18em] text-foreground">
              MISSION CONTROL
            </span>
            <span className="block font-mono text-[10px] tracking-[0.3em] text-accent/80">BEYOND EARTH</span>
          </span>
        </button>

        {/* Phase stepper — hidden on small screens */}
        <nav aria-label="Mission phases" className="hidden items-center gap-1 md:flex">
          {mode === "multiplayer" ? (
            <span className="flex items-center gap-1.5 rounded border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.15em] text-cyan-300">
              <Users className="h-3 w-3" aria-hidden="true" /> COOPERATIVE
            </span>
          ) : (
            PHASES.map((p, i) => {
              const active = p.stores.includes(phase);
              return (
                <span key={p.key} className="flex items-center">
                  {i > 0 ? <span className="mx-1 h-px w-4 bg-primary/25" aria-hidden="true" /> : null}
                  <span
                    className={cn(
                      "rounded px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.15em] transition-colors",
                      active
                        ? "bg-primary/15 text-accent text-glow"
                        : "text-muted-foreground/70"
                    )}
                  >
                    {p.key}
                  </span>
                </span>
              );
            })
          )}
        </nav>

        <div className="flex items-center gap-2">
          {mode === "multiplayer" ? (
            <button
              type="button"
              onClick={() => setMode("single")}
              className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-secondary/50 px-2.5 py-1 font-mono text-[10px] font-semibold text-cyan-100 transition-colors hover:border-primary/60 hover:bg-secondary"
            >
              <Undo2 className="h-3 w-3" aria-hidden="true" /> SOLO MODE
            </button>
          ) : null}
          {mission && mode === "single" ? (
            <span className="hidden max-w-[220px] truncate font-mono text-[11px] text-cyan-200/80 sm:block">
              <span className="text-muted-foreground">ACTIVE:</span> {mission.name}
            </span>
          ) : null}
          <SoundControl className="hidden sm:flex" />
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/5 px-2.5 py-1">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] font-bold tracking-widest text-emerald-300">GS-ONLINE</span>
          </span>
        </div>
      </div>
    </header>
  );
}
