"use client";

/**
 * ============================================================================
 * SOUND CONTROL — v2.2 volume slider + mute toggle
 * ============================================================================
 * A compact control that lives in the GameHeader. Shows a speaker icon that
 * toggles mute, and an inline volume slider. Both controls unlock the
 * AudioContext on first interaction (satisfying the browser autoplay gate).
 * ============================================================================
 */

import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useSoundStore } from "@/store/soundStore";
import { cn } from "@/lib/utils";

export function SoundControl({ className }: { className?: string }) {
  const volume = useSoundStore((s) => s.volume);
  const muted = useSoundStore((s) => s.muted);
  const setVolume = useSoundStore((s) => s.setVolume);
  const toggleMute = useSoundStore((s) => s.toggleMute);
  const unlockAudio = useSoundStore((s) => s.unlockAudio);

  const effectiveMuted = muted || volume === 0;
  const Icon = effectiveMuted ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const handleMuteClick = () => {
    unlockAudio();
    toggleMute();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    unlockAudio();
    setVolume(parseFloat(e.target.value));
  };

  return (
    <div className={cn("flex items-center gap-2", className)} aria-label="Sound controls">
      <button
        type="button"
        onClick={handleMuteClick}
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
        aria-label={effectiveMuted ? "Unmute sound" : "Mute sound"}
        aria-pressed={effectiveMuted}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={handleVolumeChange}
        className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-primary/20 accent-cyan-400"
        aria-label="Volume"
        aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
