/**
 * ============================================================================
 * SOUND MANAGER — v2.2 procedural audio for Mission Control
 * ============================================================================
 * A singleton Web Audio synth that generates every cue procedurally — no
 * asset files, no network, deterministic. Matches the game's pure-CSS/SVG
 * aesthetic: the audio is synthesized from oscillators, filtered noise, and
 * envelopes on demand.
 *
 * Browser autoplay policy: the AudioContext is created lazily on the first
 * `resume()` call (which must be triggered by a user gesture — every entry
 * point below is called from a click handler, so this is safe).
 *
 * Volume: a master GainNode controlled by the soundStore (0..1). Mute is a
 * separate flag that bypasses the gain entirely.
 * ============================================================================
 */

type CueName =
  | "ui_click"
  | "ui_hover"
  | "stage_advance"
  | "launch_ignition"
  | "launch_ascent"
  | "engine_burn"
  | "event_alert"
  | "event_resolved_good"
  | "event_resolved_bad"
  | "touchdown"
  | "separation"
  | "scan_sweep"
  | "comm_signal"
  | "mission_complete"
  | "mission_failure";

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.7;
  private muted = false;
  private activeNodes: Set<AudioNode> = new Set();

  /** Lazily create the AudioContext — call from a user gesture. */
  resume(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  get currentVolume(): number {
    return this.volume;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  // -------------------------------------------------------------------------
  // Synthesis primitives
  // -------------------------------------------------------------------------

  /** A filtered white-noise buffer source. */
  private noiseSource(durationSec: number, filterType: BiquadFilterType, freq: number, q = 1): { source: AudioBufferSourceNode; gain: GainNode } | null {
    if (!this.ctx || !this.master) return null;
    const len = Math.floor(this.ctx.sampleRate * durationSec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    src.connect(filter).connect(gain).connect(this.master);
    this.activeNodes.add(src);
    src.onended = () => this.activeNodes.delete(src);
    return { source: src, gain };
  }

  /** An oscillator with an ADSR-style gain envelope. */
  private tone(
    freq: number,
    durationSec: number,
    type: OscillatorType = "sine",
    gainPeak = 0.2,
    attackSec = 0.01,
    releaseSec = 0.1,
  ): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + attackSec);
    gain.gain.linearRampToValueAtTime(0, now + durationSec + releaseSec);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + durationSec + releaseSec + 0.02);
    this.activeNodes.add(osc);
    osc.onended = () => this.activeNodes.delete(osc);
  }

  /** A quick frequency sweep (for whooshes / alerts). */
  private sweep(
    fromFreq: number,
    toFreq: number,
    durationSec: number,
    type: OscillatorType = "sawtooth",
    gainPeak = 0.15,
  ): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(fromFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), now + durationSec);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + durationSec + 0.05);
    this.activeNodes.add(osc);
    osc.onended = () => this.activeNodes.delete(osc);
  }

  // -------------------------------------------------------------------------
  // Public cue methods
  // -------------------------------------------------------------------------

  play(cue: CueName): void {
    // Always resume on any cue — ensures context is live after user gesture.
    this.resume();
    if (!this.ctx || !this.master || this.muted) return;

    switch (cue) {
      case "ui_click":
        this.tone(880, 0.04, "sine", 0.08, 0.002, 0.04);
        break;
      case "ui_hover":
        this.tone(1320, 0.02, "sine", 0.03, 0.001, 0.02);
        break;
      case "stage_advance":
        this.sweep(200, 800, 0.5, "sawtooth", 0.08);
        break;
      case "launch_ignition": {
        // Low rumble building up + a rising tone
        const n = this.noiseSource(1.5, "lowpass", 120, 0.7);
        if (n) {
          const now = this.ctx.currentTime;
          n.gain.gain.setValueAtTime(0, now);
          n.gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
          n.gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
          n.source.start(now);
          n.source.stop(now + 1.6);
        }
        this.sweep(60, 180, 1.2, "square", 0.12);
        break;
      }
      case "launch_ascent": {
        // Filtered noise whoosh — rumbling ascent
        const n = this.noiseSource(3.0, "bandpass", 400, 0.5);
        if (n) {
          const now = this.ctx.currentTime;
          n.gain.gain.setValueAtTime(0.001, now);
          n.gain.gain.linearRampToValueAtTime(0.18, now + 0.4);
          n.gain.gain.linearRampToValueAtTime(0.08, now + 2.5);
          n.gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
          n.source.start(now);
          n.source.stop(now + 3.1);
        }
        break;
      }
      case "engine_burn": {
        // Short engine burst for correction/insertion burns
        const n = this.noiseSource(1.2, "lowpass", 180, 0.8);
        if (n) {
          const now = this.ctx.currentTime;
          n.gain.gain.setValueAtTime(0, now);
          n.gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
          n.gain.gain.linearRampToValueAtTime(0.12, now + 0.9);
          n.gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          n.source.start(now);
          n.source.stop(now + 1.3);
        }
        this.tone(80, 1.0, "square", 0.06, 0.05, 0.2);
        break;
      }
      case "event_alert": {
        // Two-tone alert — grabs attention without being harsh
        this.tone(660, 0.12, "square", 0.1, 0.005, 0.08);
        setTimeout(() => this.tone(880, 0.15, "square", 0.1, 0.005, 0.1), 140);
        break;
      }
      case "event_resolved_good": {
        // Rising chime
        this.tone(523, 0.1, "sine", 0.12, 0.005, 0.08);
        setTimeout(() => this.tone(659, 0.1, "sine", 0.12, 0.005, 0.08), 110);
        setTimeout(() => this.tone(784, 0.2, "sine", 0.14, 0.005, 0.15), 220);
        break;
      }
      case "event_resolved_bad": {
        // Descending buzz
        this.tone(330, 0.15, "sawtooth", 0.1, 0.005, 0.1);
        setTimeout(() => this.tone(220, 0.25, "sawtooth", 0.1, 0.005, 0.2), 160);
        break;
      }
      case "touchdown": {
        // Impact thud — low frequency burst with quick decay
        const n = this.noiseSource(0.4, "lowpass", 80, 0.5);
        if (n) {
          const now = this.ctx.currentTime;
          n.gain.gain.setValueAtTime(0.3, now);
          n.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          n.source.start(now);
          n.source.stop(now + 0.5);
        }
        this.tone(55, 0.3, "sine", 0.2, 0.002, 0.25);
        break;
      }
      case "separation": {
        // Mechanical clamp release — short metallic clank
        this.tone(1200, 0.05, "triangle", 0.08, 0.001, 0.04);
        setTimeout(() => this.tone(900, 0.08, "triangle", 0.06, 0.001, 0.06), 60);
        break;
      }
      case "scan_sweep": {
        // Science scan — oscillating sweep
        this.sweep(800, 1600, 0.6, "sine", 0.05);
        break;
      }
      case "comm_signal": {
        // Comm downlink — modulated tone
        this.tone(1000, 0.15, "sine", 0.06, 0.01, 0.1);
        setTimeout(() => this.tone(1200, 0.15, "sine", 0.06, 0.01, 0.1), 180);
        break;
      }
      case "mission_complete": {
        // Triumphant chord progression
        this.tone(523, 0.3, "sine", 0.1, 0.01, 0.25);
        setTimeout(() => this.tone(659, 0.3, "sine", 0.1, 0.01, 0.25), 150);
        setTimeout(() => this.tone(784, 0.3, "sine", 0.1, 0.01, 0.25), 300);
        setTimeout(() => this.tone(1047, 0.6, "sine", 0.14, 0.01, 0.5), 450);
        break;
      }
      case "mission_failure": {
        // Descending somber tones
        this.tone(440, 0.4, "sawtooth", 0.1, 0.02, 0.35);
        setTimeout(() => this.tone(330, 0.4, "sawtooth", 0.1, 0.02, 0.35), 300);
        setTimeout(() => this.tone(220, 0.8, "sawtooth", 0.12, 0.02, 0.7), 600);
        break;
      }
    }
  }
}

/** Singleton — import this everywhere. */
export const sound = new SoundManager();
export type { CueName };
