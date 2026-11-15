"use client";

/**
 * Shared presentational primitives for Mission Control: Beyond Earth.
 * Pure UI — no game logic. All numbers arrive pre-formatted from callers.
 */

import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { Difficulty } from "@/lib/game/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Difficulty badge
// ---------------------------------------------------------------------------

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Beginner: "bg-emerald-400/10 text-emerald-300 border-emerald-400/40",
  Intermediate: "bg-cyan-400/10 text-cyan-300 border-cyan-400/40",
  Advanced: "bg-amber-400/10 text-amber-300 border-amber-400/40",
  Expert: "bg-rose-400/10 text-rose-300 border-rose-400/40",
};

export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        DIFFICULTY_STYLES[difficulty],
        className
      )}
    >
      {difficulty}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Small data chip
// ---------------------------------------------------------------------------

export function Chip({
  icon,
  label,
  value,
  tone = "default",
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "bad";
  className?: string;
}) {
  const tones = {
    default: "text-cyan-200/90",
    good: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-secondary/60 px-2 py-1 text-xs",
        className
      )}
    >
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold", tones[tone])}>{value}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Educational tooltip
// ---------------------------------------------------------------------------

export function EduTooltip({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children ?? (
          <button type="button" aria-label="Explanation" className="text-cyan-300/70 hover:text-cyan-200 transition-colors">
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs border-primary/30 bg-popover/95 text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Progress bar with threshold colouring
// ---------------------------------------------------------------------------

export function StatBar({
  label,
  value,
  max,
  display,
  invert = false,
  hint,
  compact = false,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  /** true when a LOWER usage is better (budget, mass, fuel burn) */
  invert?: boolean;
  hint?: string;
  compact?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const over = invert ? value > max : false;
  const tight = invert ? !over && pct > 90 : false;
  const barColor = over ? "bg-rose-400" : tight ? "bg-amber-400" : "bg-gradient-to-r from-primary to-accent";

  return (
    <div className={cn("space-y-1", compact && "space-y-0.5")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", compact && "text-[11px]")}>
          {label}
          {hint ? <EduTooltip text={hint} /> : null}
        </span>
        <span
          className={cn(
            "font-mono text-xs font-semibold",
            over ? "text-rose-300" : tight ? "text-amber-300" : "text-cyan-200"
          )}
        >
          {display}
        </span>
      </div>
      <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted/80", compact && "h-1")}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

export function SectionHeading({ kicker, title, className }: { kicker?: string; title: string; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      {kicker ? (
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent/80">{kicker}</div>
      ) : null}
      <h2 className="font-display text-lg font-bold tracking-wide text-foreground sm:text-xl">{title}</h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mission status badge
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: "running" | "success" | "partial" | "failure" }) {
  const styles = {
    running: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
    success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    partial: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    failure: "border-rose-400/40 bg-rose-400/10 text-rose-300",
  };
  const labels = { running: "IN FLIGHT", success: "SUCCESS", partial: "PARTIAL", failure: "FAILURE" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest", styles[status])}>
      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status]}
    </span>
  );
}
