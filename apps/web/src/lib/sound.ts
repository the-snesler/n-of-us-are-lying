/**
 * Synthesized sound effects (Web Audio, no asset files).
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is
 * resumed on the first pointer/key event. Sounds requested while audio is
 * still locked are dropped rather than queued, so nothing bursts out late.
 */

export type SoundName =
  | "join"
  | "leave"
  | "start"
  | "whoosh"
  | "submit"
  | "tap"
  | "tick"
  | "timeUp"
  | "truth"
  | "everyoneLies"
  | "sparkle"
  | "fanfare"
  | "coin"
  | "ding";

export type SoundStatus = "locked" | "on" | "muted";

const MUTE_KEY = "nofus_muted";
const MASTER_VOLUME = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  ctx = new AudioCtx();
  // Gentle limiting so overlapping sounds never clip
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.ratio.value = 6;
  compressor.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_VOLUME;
  master.connect(compressor);

  // Shared buffer of white noise for percussive sounds
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  ctx.onstatechange = notify;
  return ctx;
}

/** Create/resume the AudioContext; succeeds once the page has had a user gesture */
export function primeAudio() {
  const context = getContext();
  if (context && context.state !== "running") {
    context.resume().then(notify, () => {});
  }
}

if (typeof window !== "undefined") {
  for (const event of ["pointerdown", "keydown", "touchend"]) {
    window.addEventListener(event, primeAudio, { capture: true, passive: true });
  }
}

export function getSoundStatus(): SoundStatus {
  if (muted) return "muted";
  return ctx?.state === "running" ? "on" : "locked";
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable, mute just won't persist
  }
  if (ctx && master) {
    master.gain.setTargetAtTime(value ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02);
  }
  notify();
}

// ---------------------------------------------------------------------------
// Synthesis primitives
// ---------------------------------------------------------------------------

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  glideTo?: number; // Frequency to slide to over the note's duration
  detune?: number;
  filter?: number; // Lowpass cutoff
  filterTo?: number; // Lowpass cutoff to sweep to
}

function tone(
  context: AudioContext,
  freq: number,
  start: number,
  duration: number,
  {
    type = "sine",
    gain = 0.3,
    attack = 0.005,
    glideTo,
    detune = 0,
    filter,
    filterTo,
  }: ToneOptions = {},
) {
  const t = context.currentTime + start;
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + duration);
  osc.detune.value = detune;

  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  let node: AudioNode = osc;
  if (filter) {
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(filter, t);
    if (filterTo) {
      lowpass.frequency.exponentialRampToValueAtTime(filterTo, t + duration);
    }
    node.connect(lowpass);
    node = lowpass;
  }
  node.connect(env);
  env.connect(master!);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

interface NoiseOptions {
  gain?: number;
  attack?: number;
  filterType?: BiquadFilterType;
  freq?: number;
  freqTo?: number;
  q?: number;
}

function noise(
  context: AudioContext,
  start: number,
  duration: number,
  {
    gain = 0.2,
    attack = 0.002,
    filterType = "bandpass",
    freq = 1000,
    freqTo,
    q = 1,
  }: NoiseOptions = {},
) {
  const t = context.currentTime + start;
  const src = context.createBufferSource();
  src.buffer = noiseBuffer;

  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (freqTo) filter.frequency.exponentialRampToValueAtTime(freqTo, t + duration);

  const env = context.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  src.connect(filter).connect(env).connect(master!);
  src.start(t);
  src.stop(t + duration + 0.05);
}

/** Brassy stab: a few detuned saws with a filter that opens then closes */
function brass(context: AudioContext, freq: number, start: number, duration: number, gain = 0.12) {
  for (const detune of [-8, 0, 8]) {
    tone(context, freq, start, duration, {
      type: "sawtooth",
      gain,
      attack: 0.02,
      detune,
      filter: freq * 6,
      filterTo: freq * 1.5,
    });
  }
}

/** Soft bell: sine fundamental plus a quickly fading overtone */
function bell(context: AudioContext, freq: number, start: number, duration: number, gain = 0.2) {
  tone(context, freq, start, duration, { gain });
  tone(context, freq * 2.76, start, duration * 0.4, { gain: gain * 0.25 });
}

// Major pentatonic from C5, so ascending submission plinks always sound musical
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

const vary = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

// ---------------------------------------------------------------------------
// Sound library
// ---------------------------------------------------------------------------

const sounds: Record<SoundName, (c: AudioContext, step: number) => void> = {
  // Bubbly "bloop" when a player joins
  join: (c) => {
    const p = vary(0.06);
    tone(c, 440 * p, 0, 0.12, { type: "triangle", gain: 0.3, glideTo: 880 * p });
    tone(c, 1320 * p, 0.08, 0.15, { gain: 0.15 });
  },

  // Deflating slide when a player drops
  leave: (c) => {
    tone(c, 520, 0, 0.3, { type: "triangle", gain: 0.2, glideTo: 220 });
  },

  // Bright arpeggio as the game kicks off
  start: (c) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(c, f, i * 0.08, 0.25, { type: "triangle", gain: 0.25 });
    });
    bell(c, 1567.98, 0.32, 0.9, 0.12);
    brass(c, 523.25, 0.32, 0.7, 0.06);
  },

  // Airy sweep for phase transitions
  whoosh: (c) => {
    noise(c, 0, 0.45, { gain: 0.25, attack: 0.15, freq: 300, freqTo: 4000, q: 2 });
    bell(c, 1174.66, 0.3, 0.6, 0.08);
  },

  // Plink when an answer comes in, climbing the scale with each one
  submit: (c, step) => {
    const f = PENTATONIC[Math.min(step, PENTATONIC.length - 1)];
    tone(c, f, 0, 0.18, { type: "triangle", gain: 0.25 });
    tone(c, f * 2, 0, 0.08, { gain: 0.1 });
  },

  // Soft UI click
  tap: (c) => {
    tone(c, 1400, 0, 0.04, { gain: 0.12, glideTo: 900 });
  },

  // Woodblock for the final countdown; step 1 = higher, more urgent
  tick: (c, step) => {
    const f = step ? 1600 : 1100;
    tone(c, f, 0, 0.06, { gain: 0.35 });
    noise(c, 0, 0.02, { gain: 0.15, filterType: "highpass", freq: 3000 });
  },

  // Game-show buzzer, buzzy but rounded off by a lowpass
  timeUp: (c) => {
    for (const f of [196, 198.5]) {
      tone(c, f, 0, 0.6, { type: "square", gain: 0.12, attack: 0.01, filter: 1400, filterTo: 500 });
    }
  },

  // "Ta-daa!" when the expert's truth is revealed
  truth: (c) => {
    const chord = [523.25, 659.25, 783.99];
    chord.forEach((f) => brass(c, f, 0, 0.14, 0.07));
    chord.forEach((f) => brass(c, f * 2 ** (2 / 12), 0.16, 1.1, 0.07));
    noise(c, 0.16, 1.2, { gain: 0.06, filterType: "highpass", freq: 6000 });
  },

  // "Dun dun dunnn" when there was no truth at all
  everyoneLies: (c) => {
    brass(c, 293.66, 0, 0.22, 0.1);
    brass(c, 277.18, 0.28, 0.22, 0.1);
    brass(c, 196, 0.56, 1.3, 0.11);
    tone(c, 98, 0.56, 1.3, { type: "triangle", gain: 0.3 });
  },

  // Twinkle when the expert marks a lie as also true
  sparkle: (c) => {
    for (let i = 0; i < 7; i++) {
      bell(c, (1500 + i * 280) * vary(0.04), i * 0.045, 0.3, 0.07);
    }
  },

  // Triplet pickup into a big chord for the final leaderboard
  fanfare: (c) => {
    brass(c, 392, 0, 0.12, 0.08);
    brass(c, 392, 0.14, 0.12, 0.08);
    brass(c, 392, 0.28, 0.12, 0.08);
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => brass(c, f, 0.44, 1.6, 0.06));
    noise(c, 0.44, 1.8, { gain: 0.07, filterType: "highpass", freq: 7000 });
    tone(c, 130.81, 0.44, 1.6, { type: "triangle", gain: 0.25 });
  },

  // Classic coin pickup, for a player's own points
  coin: (c) => {
    tone(c, 987.77, 0, 0.08, { type: "square", gain: 0.08 });
    tone(c, 1318.51, 0.08, 0.35, { type: "square", gain: 0.08 });
  },

  // Gentle two-note "your move" chime
  ding: (c) => {
    bell(c, 1318.51, 0, 0.5, 0.15);
    bell(c, 1975.53, 0.12, 0.7, 0.12);
  },
};

/**
 * Play a sound effect. `step` lets some sounds vary (e.g. submission count
 * climbs the scale, tick urgency).
 */
export function playSound(name: SoundName, step = 0) {
  if (muted) return;
  const context = getContext();
  if (!context || context.state !== "running") return;
  try {
    sounds[name](context, step);
  } catch (err) {
    console.warn(`Failed to play sound "${name}":`, err);
  }
}
