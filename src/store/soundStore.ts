"use client";

/**
 * ============================================================================
 * SOUND STORE — v2.2 persisted volume + mute state
 * ============================================================================
 * A tiny Zustand store that persists the master volume and mute flag to
 * localStorage, and syncs them into the SoundManager singleton.
 *
 * Components import `useSoundStore` to read/set volume and mute. The
 * SoundManager itself is framework-agnostic; this store is the React-facing
 * adapter that keeps the singleton in sync with persisted user prefs.
 * ============================================================================
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sound } from "@/lib/sound/soundManager";

interface SoundState {
  volume: number; // 0..1
  muted: boolean;
  /** True until the user has interacted with the page (browser autoplay gate). */
  audioUnlocked: boolean;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setMuted: (m: boolean) => void;
  unlockAudio: () => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set, get) => ({
      volume: 0.7,
      muted: false,
      audioUnlocked: false,

      setVolume: (v) => {
        const clamped = Math.max(0, Math.min(1, v));
        sound.setVolume(clamped);
        // Unmute if the user raises volume above zero while muted.
        if (clamped > 0 && get().muted) {
          sound.setMuted(false);
          set({ volume: clamped, muted: false });
        } else {
          set({ volume: clamped });
        }
      },

      toggleMute: () => {
        const next = !get().muted;
        sound.setMuted(next);
        set({ muted: next });
      },

      setMuted: (m) => {
        sound.setMuted(m);
        set({ muted: m });
      },

      unlockAudio: () => {
        if (get().audioUnlocked) return;
        sound.resume();
        sound.setVolume(get().volume);
        sound.setMuted(get().muted);
        set({ audioUnlocked: true });
      },
    }),
    {
      name: "mission-control-sound",
      partialize: (s) => ({ volume: s.volume, muted: s.muted }),
    },
  ),
);

/**
 * Convenience hook: play a cue, unlocking audio on the first call.
 * Use this in click handlers so the browser autoplay gate is satisfied.
 */
export function useCue() {
  const unlockAudio = useSoundStore((s) => s.unlockAudio);
  return (cue: Parameters<typeof sound.play>[0]) => {
    unlockAudio();
    sound.play(cue);
  };
}
