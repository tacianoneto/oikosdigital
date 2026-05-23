// Procedural Web Audio engine for Oikos. No asset files: every sound effect and
// the ambient pad are synthesized at runtime, so there is nothing to license,
// host, or preload. Settings persist to localStorage.

import type { GameLogPayloadKind } from "@oikos/shared";

export interface AudioSettings {
  muted: boolean;
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
}

const STORAGE_KEY = "oikos-audio";

const DEFAULT_SETTINGS: AudioSettings = {
  muted: false,
  sfxVolume: 0.7,
  musicVolume: 0.4
};

function loadSettings(): AudioSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: Boolean(parsed.muted),
      sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
      musicVolume: clamp01(parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

let settings = loadSettings();

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;

interface Ambient {
  nodes: AudioNode[];
  stop: () => void;
}
let ambient: Ambient | null = null;
let ambientWanted = false;

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  sfxGain = ctx.createGain();
  sfxGain.connect(masterGain);

  musicGain = ctx.createGain();
  musicGain.connect(masterGain);

  applyGains();
  return ctx;
}

function applyGains(): void {
  if (!ctx || !masterGain || !sfxGain || !musicGain) return;
  const now = ctx.currentTime;
  masterGain.gain.setTargetAtTime(settings.muted ? 0 : 1, now, 0.02);
  sfxGain.gain.setTargetAtTime(settings.sfxVolume, now, 0.02);
  musicGain.gain.setTargetAtTime(settings.musicVolume, now, 0.05);
}

// Call from a user gesture (pointerdown/keydown) so the browser allows audio.
export function initAudioOnGesture(): void {
  const context = ensureContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();
  if (ambientWanted && !ambient) startAmbient();
}

export function getAudioSettings(): AudioSettings {
  return { ...settings };
}

export function setAudioSettings(partial: Partial<AudioSettings>): AudioSettings {
  settings = {
    muted: partial.muted ?? settings.muted,
    sfxVolume: partial.sfxVolume !== undefined ? clamp01(partial.sfxVolume) : settings.sfxVolume,
    musicVolume: partial.musicVolume !== undefined ? clamp01(partial.musicVolume) : settings.musicVolume
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
  applyGains();
  return { ...settings };
}

// --- SFX synthesis ----------------------------------------------------------

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  slideTo?: number;
  delay?: number;
}

function tone(opts: ToneOptions): void {
  if (!ctx || !sfxGain) return;
  const start = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), start + opts.duration);
  }
  const peak = opts.gain ?? 0.3;
  const attack = opts.attack ?? 0.005;
  const release = opts.release ?? Math.max(0.04, opts.duration * 0.6);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
  osc.connect(env).connect(sfxGain);
  osc.start(start);
  osc.stop(start + attack + release + 0.05);
}

function noiseBurst(duration: number, opts: { gain?: number; lowpass?: number; delay?: number } = {}): void {
  if (!ctx || !sfxGain) return;
  const start = ctx.currentTime + (opts.delay ?? 0);
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = opts.lowpass ?? 1800;
  const env = ctx.createGain();
  const peak = opts.gain ?? 0.2;
  env.gain.setValueAtTime(peak, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(env).connect(sfxGain);
  src.start(start);
  src.stop(start + duration + 0.02);
}

function withContext(fn: () => void): void {
  const context = ensureContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();
  fn();
}

export function playClick(): void {
  withContext(() => tone({ freq: 320, duration: 0.06, type: "triangle", gain: 0.12, slideTo: 260 }));
}

export function playCardPlace(): void {
  withContext(() => {
    tone({ freq: 180, duration: 0.16, type: "sine", gain: 0.28, slideTo: 110 });
    noiseBurst(0.09, { gain: 0.12, lowpass: 1200 });
  });
}

export function playPieceMove(): void {
  withContext(() => tone({ freq: 440, duration: 0.1, type: "triangle", gain: 0.16, slideTo: 560 }));
}

export function playCapture(): void {
  withContext(() => {
    tone({ freq: 220, duration: 0.18, type: "sawtooth", gain: 0.22, slideTo: 90 });
    noiseBurst(0.16, { gain: 0.2, lowpass: 900 });
  });
}

export function playScore(): void {
  withContext(() => {
    // bright ascending arpeggio
    tone({ freq: 523.25, duration: 0.12, type: "triangle", gain: 0.2 });
    tone({ freq: 659.25, duration: 0.12, type: "triangle", gain: 0.2, delay: 0.08 });
    tone({ freq: 783.99, duration: 0.18, type: "triangle", gain: 0.22, delay: 0.16 });
  });
}

export function playTurnChange(): void {
  withContext(() => {
    tone({ freq: 392, duration: 0.18, type: "sine", gain: 0.2 });
    tone({ freq: 587.33, duration: 0.22, type: "sine", gain: 0.2, delay: 0.12 });
  });
}

export function playFinish(): void {
  withContext(() => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => tone({ freq, duration: 0.4, type: "triangle", gain: 0.24, delay: i * 0.14 }));
  });
}

// Map a game-log payload kind to its sound. Returns false for kinds with no sound.
export function playLogEvent(kind: GameLogPayloadKind | undefined): void {
  switch (kind) {
    case "place_card":
      playCardPlace();
      break;
    case "move_piece":
    case "add_piece":
      playPieceMove();
      break;
    case "remove_piece":
      playCapture();
      break;
    case "score":
    case "pair_bonus":
      playScore();
      break;
    case "advance_turn":
      playTurnChange();
      break;
    case "finish":
      playFinish();
      break;
    default:
      break;
  }
}

// --- Ambient pad ------------------------------------------------------------

// A soft evolving chord drone with a slow filter sweep. Calm, low in the mix.
export function startAmbient(): void {
  ambientWanted = true;
  const context = ensureContext();
  if (!context || !musicGain || ambient) return;
  if (context.state === "suspended") void context.resume();

  const chord = [110, 164.81, 220, 329.63]; // A2, E3, A3, E4
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 600;
  filter.Q.value = 0.7;
  filter.connect(musicGain);

  // Slow LFO sweeping the filter for movement.
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  lfo.frequency.value = 0.05;
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  const nodes: AudioNode[] = [filter, lfo, lfoGain];
  const oscs: OscillatorNode[] = [lfo];

  for (const freq of chord) {
    const osc = context.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 8;
    const g = context.createGain();
    g.gain.value = 0.12;
    osc.connect(g).connect(filter);
    osc.start();
    nodes.push(osc, g);
    oscs.push(osc);
  }

  ambient = {
    nodes,
    stop: () => {
      const now = context.currentTime;
      for (const osc of oscs) {
        try {
          osc.stop(now + 0.4);
        } catch {
          // already stopped
        }
      }
    }
  };
}

export function stopAmbient(): void {
  ambientWanted = false;
  if (ambient) {
    ambient.stop();
    ambient = null;
  }
}
