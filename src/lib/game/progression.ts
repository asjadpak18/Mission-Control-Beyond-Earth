/**
 * ============================================================================
 * PROGRESSION SYSTEM — v2.3 ranks + achievements (GDD Section 14)
 * ============================================================================
 * Pure functions that compute the player's current rank and earned
 * achievements from the persisted mission log. No separate store needed —
 * everything is derived from the existing MissionLogEntry[] in the game store.
 *
 * Ranks (GDD §14.2):
 *   1. Rookie Astronaut       — 0 successful missions
 *   2. Junior Mission Engineer — 1 successful mission
 *   3. Spacecraft Designer     — 3 successful missions
 *   4. Mission Specialist      — 6 successful missions
 *   5. Senior Mission Director — 10 successful missions
 *
 * Achievements (GDD §14.3, adapted to the actual 15-mission catalogue):
 *   First Launch, Perfect Budget, Efficient Engineer, Lunar Explorer,
 *   Mars Pioneer, Asteroid Researcher, Solar Scientist, Deep Space Engineer,
 *   Orbital Logistics Specialist, Planetary Explorer, Telescope Specialist,
 *   Master Mission Director
 * ============================================================================
 */

import type { MissionLogEntry } from "./types";

export interface Rank {
  id: number;
  name: string;
  threshold: number; // minimum successful missions to reach this rank
  description: string;
}

export const RANKS: Rank[] = [
  { id: 0, name: "Rookie Astronaut", threshold: 0, description: "Just joined the program. Every great mission director starts here." },
  { id: 1, name: "Junior Mission Engineer", threshold: 1, description: "Completed your first successful mission. You're learning the ropes." },
  { id: 2, name: "Spacecraft Designer", threshold: 3, description: "Three missions under your belt. You know how to balance a design." },
  { id: 3, name: "Mission Specialist", threshold: 6, description: "Halfway through the catalogue. You handle complex missions with confidence." },
  { id: 4, name: "Senior Mission Director", threshold: 10, description: "A veteran of the deep-space program. Other directors ask for your advice." },
];

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Icon name from lucide-react. */
  icon: string;
  /** Returns true if this achievement is earned given the mission log. */
  check: (log: MissionLogEntry[]) => boolean;
}

/** Successful missions (status "success" or "partial" both count as completed). */
function successfulMissions(log: MissionLogEntry[]): MissionLogEntry[] {
  return log.filter((e) => e.status === "success" || e.status === "partial");
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_launch",
    name: "First Launch",
    description: "Complete your first mission (success or partial).",
    icon: "Rocket",
    check: (log) => successfulMissions(log).length >= 1,
  },
  {
    id: "perfect_budget",
    name: "Perfect Budget",
    description: "Complete a mission with less than 5% of your budget remaining.",
    icon: "Coins",
    check: (log) =>
      // Typical mission budgets range from $30M to $80M. "Perfect Budget" means
      // the player spent almost all of it — less than $1.5M remaining (roughly
      // 5% of a $30M budget). budgetRemaining is always >= 0 (validation blocks
      // over-budget launches).
      successfulMissions(log).some(
        (e) => e.budgetRemaining !== undefined && e.budgetRemaining >= 0 && e.budgetRemaining < 1_500_000,
      ),
  },
  {
    id: "efficient_engineer",
    name: "Efficient Engineer",
    description: "Score 180+ out of 200 on the engineering category.",
    icon: "Wrench",
    check: (log) => successfulMissions(log).some((e) => (e.engineeringScore ?? 0) >= 180),
  },
  {
    id: "lunar_explorer",
    name: "Lunar Explorer",
    description: "Complete a Lunar mission.",
    icon: "Moon",
    check: (log) => successfulMissions(log).some((e) => e.missionId.includes("lunar")),
  },
  {
    id: "mars_pioneer",
    name: "Mars Pioneer",
    description: "Complete a Mars mission.",
    icon: "Globe",
    check: (log) => successfulMissions(log).some((e) => e.missionId.includes("mars")),
  },
  {
    id: "asteroid_researcher",
    name: "Asteroid Researcher",
    description: "Complete an asteroid mission.",
    icon: "AsteroidSquare",
    check: (log) =>
      successfulMissions(log).some(
        (e) => e.missionId.includes("asteroid") || e.missionId.includes("nea"),
      ),
  },
  {
    id: "solar_scientist",
    name: "Solar Scientist",
    description: "Complete the Solar Observation Mission.",
    icon: "Sun",
    check: (log) => successfulMissions(log).some((e) => e.missionId.includes("solar")),
  },
  {
    id: "deep_space_engineer",
    name: "Deep Space Engineer",
    description: "Complete a mission to Jupiter, Europa, Saturn, Titan, or interstellar space.",
    icon: "Telescope",
    check: (log) =>
      successfulMissions(log).some(
        (e) =>
          e.missionId.includes("jupiter") ||
          e.missionId.includes("europa") ||
          e.missionId.includes("saturn") ||
          e.missionId.includes("titan") ||
          e.missionId.includes("deep_space"),
      ),
  },
  {
    id: "orbital_logistics",
    name: "Orbital Logistics Specialist",
    description: "Complete the Lunar Cargo Delivery mission.",
    icon: "Package",
    check: (log) => successfulMissions(log).some((e) => e.missionId === "lunar_cargo"),
  },
  {
    id: "planetary_explorer",
    name: "Planetary Explorer",
    description: "Complete missions to 3 or more distinct destinations.",
    icon: "Planets",
    check: (log) => {
      const dests = new Set(
        successfulMissions(log).map((e) => e.destination ?? e.missionId).filter(Boolean),
      );
      return dests.size >= 3;
    },
  },
  {
    id: "telescope_specialist",
    name: "Telescope Specialist",
    description: "Complete the Solar Observation or Deep-Space Interstellar Precursor mission.",
    icon: "ScanEye",
    check: (log) =>
      successfulMissions(log).some(
        (e) => e.missionId.includes("solar") || e.missionId.includes("deep_space"),
      ),
  },
  {
    id: "master_director",
    name: "Master Mission Director",
    description: "Complete all 15 missions successfully.",
    icon: "Award",
    check: (log) => {
      // The game has 15 missions; check that all unique mission IDs appear in successful entries.
      const successful = successfulMissions(log);
      const completedIds = new Set(successful.map((e) => e.missionId));
      // We need at least 15 distinct successful mission IDs.
      return completedIds.size >= 15;
    },
  },
];

/** Compute the player's current rank from the mission log. */
export function computeRank(log: MissionLogEntry[]): Rank {
  const count = successfulMissions(log).length;
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (count >= r.threshold) rank = r;
  }
  return rank;
}

/** Compute the next rank (or null if already at max). */
export function nextRank(log: MissionLogEntry[]): Rank | null {
  const count = successfulMissions(log).length;
  const current = computeRank(log);
  const next = RANKS.find((r) => r.id === current.id + 1);
  return next ?? null;
}

/** Compute all earned achievements. */
export function earnedAchievements(log: MissionLogEntry[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.check(log));
}

/** Stats summary for the progress screen. */
export interface PlayerStats {
  totalMissions: number;
  successfulMissions: number;
  failedMissions: number;
  successRate: number; // 0-100
  totalScore: number;
  bestScore: number;
  distinctDestinations: number;
  achievementsEarned: number;
  achievementsTotal: number;
  rank: Rank;
  nextRank: Rank | null;
  missionsToNextRank: number;
}

export function computeStats(log: MissionLogEntry[]): PlayerStats {
  const successful = successfulMissions(log);
  const failed = log.filter((e) => e.status === "failure");
  const totalScore = successful.reduce((sum, e) => sum + e.score, 0);
  const bestScore = successful.length > 0 ? Math.max(...successful.map((e) => e.score)) : 0;
  const dests = new Set(successful.map((e) => e.destination ?? e.missionId).filter(Boolean));
  const rank = computeRank(log);
  const next = nextRank(log);
  const earned = earnedAchievements(log);
  return {
    totalMissions: log.length,
    successfulMissions: successful.length,
    failedMissions: failed.length,
    successRate: log.length > 0 ? Math.round((successful.length / log.length) * 100) : 0,
    totalScore,
    bestScore,
    distinctDestinations: dests.size,
    achievementsEarned: earned.length,
    achievementsTotal: ACHIEVEMENTS.length,
    rank,
    nextRank: next,
    missionsToNextRank: next ? Math.max(0, next.threshold - successful.length) : 0,
  };
}
