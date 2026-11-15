"use client";

/**
 * ============================================================================
 * PROGRESS SCREEN — v2.3 player progression (GDD Section 14)
 * ============================================================================
 * Shows the player's current rank, stats summary, achievements grid, and
 * recent mission history. All data is computed from the persisted mission
 * log via the progression module — no separate store needed.
 *
 * Accessible from the dashboard via the "MY PROGRESS" button.
 * ============================================================================
 */

import { ArrowLeft, Trophy, Star, TrendingUp, Target, Award, Lock } from "lucide-react";
import * as Icons from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { computeStats, earnedAchievements, ACHIEVEMENTS, RANKS } from "@/lib/game/progression";
import { cn } from "@/lib/utils";

export function ProgressScreen() {
  const goTo = useGameStore((s) => s.goTo);
  const missionLog = useGameStore((s) => s.missionLog);

  const stats = computeStats(missionLog);
  const earned = earnedAchievements(missionLog);
  const earnedIds = new Set(earned.map((a) => a.id));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-amber-400/40 bg-amber-400/10 text-amber-300">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold tracking-wide text-foreground">My Progress</h1>
            <p className="text-xs text-muted-foreground">Rank, achievements and mission history</p>
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

      {/* Rank card */}
      <div className="mb-6 rounded-lg border border-amber-400/25 bg-gradient-to-br from-amber-400/8 to-amber-400/3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300/70">Current Rank</p>
            <p className="mt-1 font-display text-2xl font-bold text-amber-100">{stats.rank.name}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-100/60">{stats.rank.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">RANK {stats.rank.id + 1}/{RANKS.length}</span>
            <span className="font-mono text-[11px] font-bold text-amber-200">{stats.successfulMissions} missions</span>
          </div>
        </div>
        {/* Rank progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>{stats.rank.name}</span>
            {stats.nextRank ? (
              <span>{stats.nextRank.name} ({stats.nextRank.threshold} missions)</span>
            ) : (
              <span className="text-amber-300">MAX RANK</span>
            )}
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400/60 to-amber-300 transition-all duration-500"
              style={{
                width: stats.nextRank
                  ? `${Math.min(100, ((stats.successfulMissions - stats.rank.threshold) / (stats.nextRank.threshold - stats.rank.threshold)) * 100)}%`
                  : "100%",
              }}
            />
          </div>
          {stats.nextRank ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {stats.missionsToNextRank} more successful mission{stats.missionsToNextRank !== 1 ? "s" : ""} to reach <strong className="text-amber-200">{stats.nextRank.name}</strong>
            </p>
          ) : null}
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Target className="h-4 w-4" />} label="Total Missions" value={stats.totalMissions} />
        <StatCard icon={<Star className="h-4 w-4" />} label="Successful" value={stats.successfulMissions} accent="emerald" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Success Rate" value={`${stats.successRate}%`} />
        <StatCard icon={<Award className="h-4 w-4" />} label="Best Score" value={stats.bestScore} accent="amber" />
        <StatCard icon={<Star className="h-4 w-4" />} label="Total Score" value={stats.totalScore} />
        <StatCard icon={<Target className="h-4 w-4" />} label="Distinct Destinations" value={stats.distinctDestinations} />
        <StatCard icon={<Award className="h-4 w-4" />} label="Achievements" value={`${stats.achievementsEarned}/${stats.achievementsTotal}`} accent="amber" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Failed Missions" value={stats.failedMissions} accent={stats.failedMissions > 0 ? "rose" : undefined} />
      </div>

      {/* Achievements */}
      <div className="mb-6">
        <h2 className="mb-3 font-display text-sm font-bold tracking-wide text-foreground">Achievements</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const isEarned = earnedIds.has(a.id);
            const IconComp = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[a.icon] ?? Award;
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  isEarned
                    ? "border-amber-400/30 bg-amber-400/8"
                    : "border-primary/15 bg-secondary/20 opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                    isEarned ? "bg-amber-400/15 text-amber-300" : "bg-primary/10 text-muted-foreground",
                  )}
                >
                  {isEarned ? <IconComp className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12.5px] font-semibold", isEarned ? "text-amber-100" : "text-muted-foreground")}>
                    {a.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{a.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mission history */}
      <div>
        <h2 className="mb-3 font-display text-sm font-bold tracking-wide text-foreground">Mission History</h2>
        {missionLog.length === 0 ? (
          <div className="rounded-lg border border-primary/20 bg-secondary/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No missions flown yet. Complete a mission to see your history here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-primary/20">
            <table className="w-full text-left text-[12px]">
              <thead className="border-b border-primary/20 bg-secondary/40">
                <tr>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Mission</th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Score</th>
                  <th className="hidden px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {missionLog.slice(0, 20).map((entry, i) => (
                  <tr key={i} className="border-b border-primary/10 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{entry.missionName}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide",
                          entry.status === "success" && "bg-emerald-400/15 text-emerald-300",
                          entry.status === "partial" && "bg-amber-400/15 text-amber-300",
                          entry.status === "failure" && "bg-rose-400/15 text-rose-300",
                        )}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-cyan-200">{entry.score}</td>
                    <td className="hidden px-3 py-2 text-right font-mono text-[10px] text-muted-foreground sm:table-cell">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {missionLog.length > 20 ? (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">Showing 20 most recent of {missionLog.length} total missions</p>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: "emerald" | "amber" | "rose";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "amber"
        ? "text-amber-300"
        : accent === "rose"
          ? "text-rose-300"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-primary/20 bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("mt-1 font-display text-lg font-bold tabular-nums", accentClass)}>{value}</p>
    </div>
  );
}
