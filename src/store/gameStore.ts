/**
 * ============================================================================
 * GAME STORE — integration layer (AI 1 / AI 4) — v2.0
 * ============================================================================
 * Zustand store that wires the pure game engines (calculations, validation,
 * simulation, constraints) to the UI. The store NEVER recomputes game logic
 * itself — it delegates to the shared modules and holds only session state.
 *
 * v2.0 additions:
 * - Game mode: "single" (original loop) | "multiplayer" (routed to the
 *   multiplayer app, which lives in its own store).
 * - Difficulty setting + constraint picks; every mission query returns the
 *   EFFECTIVE mission (base mission transformed by applyDifficulty), so all
 *   screens, calculations and validation see constraint effects consistently.
 *
 * Persisted (localStorage): spacecraft designs per mission + mission log.
 * Ephemeral: current phase, difficulty, constraints, live simulation, results.
 * ============================================================================
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Mission,
  SimulationResult,
  SimulationState,
  SpacecraftConfig,
  MissionLogEntry,
  DifficultySetting,
} from "@/lib/game/types";
import { getMission } from "@/lib/game/missions";
import { withQuantity, emptyConfig, installedQuantity, computeResources } from "@/lib/game/calculations";
import { validateSpacecraft } from "@/lib/game/validation";
import { createSimulation, runStage, resolveEvent, finalizeSimulation } from "@/lib/game/simulation";
import { makeSeed } from "@/lib/game/rng";
import { applyDifficulty } from "@/lib/game/constraints";

export type Phase = "dashboard" | "briefing" | "designer" | "readiness" | "simulation" | "report" | "learn" | "progress";
export type GameMode = "single" | "multiplayer";

interface GameStore {
  mode: GameMode;
  phase: Phase;
  missionId: string | null;
  difficulty: DifficultySetting;
  constraintIds: string[];
  constraintSeed: number;
  designs: Record<string, SpacecraftConfig>;
  simulation: SimulationState | null;
  result: SimulationResult | null;
  missionLog: MissionLogEntry[];
  hydrated: boolean;

  setHydrated: () => void;
  setMode: (mode: GameMode) => void;
  goTo: (phase: Phase) => void;
  selectMission: (missionId: string) => void;
  setDifficulty: (difficulty: DifficultySetting) => void;
  toggleConstraint: (constraintId: string) => void;
  clearConstraints: () => void;
  rerollConstraints: () => void;
  setQuantity: (equipmentId: string, quantity: number) => void;
  adjustQuantity: (equipmentId: string, delta: number) => void;
  clearDesign: () => void;
  launchMission: () => boolean;
  advanceStage: () => void;
  decide: (choiceId: string) => void;
  completeMission: () => void;
  retryMission: () => void;
  returnHome: () => void;
}

/** Session state the effective mission is derived from. */
interface MissionContext {
  missionId: string | null;
  difficulty: DifficultySetting;
  constraintIds: string[];
  constraintSeed: number;
}

/**
 * The EFFECTIVE mission: the base mission transformed by the current
 * difficulty setting and constraints. Every consumer (designer stats,
 * validation, simulation) sees the same numbers. Returns null outside a
 * mission context.
 */
export function currentMission(state: MissionContext): Mission | null {
  if (!state.missionId) return null;
  const base = getMission(state.missionId);
  if (!base) return null;
  const { mission } = applyDifficulty(base, state.difficulty, state.constraintIds, state.constraintSeed);
  return mission;
}

/** Base mission without any difficulty transformation (identity fields only). */
export function baseMission(state: MissionContext): Mission | null {
  return state.missionId ? getMission(state.missionId) ?? null : null;
}

/** Constraint objects currently applied (for the briefing UI). */
export function appliedConstraints(state: MissionContext) {
  if (!state.missionId) return [];
  const base = getMission(state.missionId);
  if (!base) return [];
  return applyDifficulty(base, state.difficulty, state.constraintIds, state.constraintSeed).applied;
}

/** Current design for the active mission (always defined once a mission is selected). */
export function currentDesign(state: { missionId: string | null; designs: Record<string, SpacecraftConfig> }): SpacecraftConfig {
  if (!state.missionId) return emptyConfig("none");
  return state.designs[state.missionId] ?? emptyConfig(state.missionId);
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      mode: "single",
      phase: "dashboard",
      missionId: null,
      difficulty: "Intermediate",
      constraintIds: [],
      constraintSeed: 1,
      designs: {},
      simulation: null,
      result: null,
      missionLog: [],
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      setMode: (mode) => set({ mode }),

      goTo: (phase) => set({ phase }),

      selectMission: (missionId) => {
        const { designs } = get();
        const designsNext = { ...designs };
        if (!designsNext[missionId]) designsNext[missionId] = emptyConfig(missionId);
        set({ missionId, designs: designsNext, simulation: null, result: null, phase: "briefing" });
      },

      setDifficulty: (difficulty) => {
        // Custom Challenge keeps hand-picked constraints; other settings clear them.
        const constraintIds = difficulty === "Custom Challenge" ? get().constraintIds : [];
        set({ difficulty, constraintIds, constraintSeed: makeSeed() });
      },

      toggleConstraint: (constraintId) => {
        const { constraintIds } = get();
        set({
          constraintIds: constraintIds.includes(constraintId)
            ? constraintIds.filter((id) => id !== constraintId)
            : [...constraintIds, constraintId],
        });
      },

      clearConstraints: () => set({ constraintIds: [] }),

      rerollConstraints: () => set({ constraintSeed: makeSeed() }),

      setQuantity: (equipmentId, quantity) => {
        const s = get();
        if (!s.missionId) return;
        const design = currentDesign(s);
        set({ designs: { ...s.designs, [s.missionId]: withQuantity(design, equipmentId, quantity) } });
      },

      adjustQuantity: (equipmentId, delta) => {
        const s = get();
        if (!s.missionId) return;
        const design = currentDesign(s);
        set({
          designs: { ...s.designs, [s.missionId]: withQuantity(design, equipmentId, installedQuantity(design, equipmentId) + delta) },
        });
      },

      clearDesign: () => {
        const s = get();
        if (!s.missionId) return;
        set({ designs: { ...s.designs, [s.missionId]: emptyConfig(s.missionId) } });
      },

      launchMission: () => {
        const s = get();
        const mission = currentMission(s);
        if (!mission) return false;
        const design = currentDesign(s);
        const validation = validateSpacecraft(mission, design);
        if (!validation.ready) return false; // hard gate — never bypass
        const seed = makeSeed();
        set({
          simulation: createSimulation(mission, design, seed),
          result: null,
          phase: "simulation",
        });
        return true;
      },

      advanceStage: () => {
        const s = get();
        const mission = currentMission(s);
        if (!mission || !s.simulation) return;
        const design = currentDesign(s);
        set({ simulation: runStage(s.simulation, mission, design) });
      },

      decide: (choiceId) => {
        const s = get();
        const mission = currentMission(s);
        if (!mission || !s.simulation) return;
        const design = currentDesign(s);
        set({ simulation: resolveEvent(s.simulation, mission, design, choiceId) });
      },

      completeMission: () => {
        const s = get();
        const mission = currentMission(s);
        if (!mission || !s.simulation) return;
        const design = currentDesign(s);
        const result = finalizeSimulation(s.simulation, mission, design);
        // v2.3 — populate the extended log fields for achievement tracking.
        const resources = design ? computeResources(mission, design) : null;
        const entry: MissionLogEntry = {
          missionId: mission.id,
          missionName: mission.name,
          date: new Date().toISOString(),
          status: result.status,
          score: result.score,
          scientificData: result.scientificData,
          seed: result.seed,
          budgetRemaining: resources ? resources.budgetRemaining : undefined,
          engineeringScore: result.scoreBreakdown.engineering,
          efficiencyScore: result.scoreBreakdown.efficiency,
          destination: mission.destination,
        };
        set({
          result,
          missionLog: [entry, ...s.missionLog].slice(0, 60),
          phase: "report",
        });
      },

      retryMission: () => set({ simulation: null, result: null, phase: "readiness" }),

      returnHome: () => set({ phase: "dashboard", simulation: null, result: null }),
    }),
    {
      name: "mission-control-beyond-earth",
      partialize: (state) => ({ designs: state.designs, missionLog: state.missionLog }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
