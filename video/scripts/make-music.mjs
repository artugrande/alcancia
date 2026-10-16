// Synthesizes an original, royalty-free lo-fi / ambient loop for the Alcancía demo.
// Pure Node (no deps). Output: public/music.wav (44.1 kHz, 16-bit, stereo, ~125 s).
// Run: node scripts/make-music.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SR = 44100;
const DURATION = 125;
const BPM = 100;
const BEAT = 60 / BPM; // 0.6 s
const BAR = BEAT * 4; // 2.4 s
const N = Math.floor(SR * DURATION);

const L = new Float32Array(N);
const R = new Float32Array(N);

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// I–V–vi–IV in C major (voicings around C4)
const CHORDS = [
  { root: 48, notes: [60, 64, 67, 71] }, // Cmaj7
  { root: 43, notes: [59, 62, 67, 69] }, // G6/B-ish
  { root: 45, notes: [60, 64, 69, 71] }, // Am(add9)
  { root: 41, notes: [60, 65, 69, 72] }, // Fmaj
];

// deterministic PRNG so the track is reproducible
let seed = 1234567;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const add = (i, v, pan = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += v * (1 - Math.max(0, pan));
  R[i] += v * (1 + Math.min(0, pan));
};

const nBars = Math.ceil(DURATION / BAR);

for (let b = 0; b < nBars; b++) {
  const chord = CHORDS[b % 4];
  const t0 = b * BAR;

  // --- Pad: detuned soft sines with slow attack/release, overlapping bars
  const padLen = BAR + 0.8;
  for (const [k, note] of chord.notes.entries()) {
    const f = midiHz(note);
    const pan = (k / (chord.notes.length - 1)) * 1.2 - 0.6;
    const s0 = Math.floor(t0 * SR);
    const len = Math.floor(padLen * SR);
    for (let j = 0; j < len; j++) {
      const t = j / SR;
      const env = Math.min(1, t / 0.6) * Math.min(1, (padLen - t) / 0.8);
      const lfo = 1 + 0.15 * Math.sin(2 * Math.PI * 0.25 * (t0 + t));
      const v =
        (Math.sin(2 * Math.PI * f * t) +
          0.6 * Math.sin(2 * Math.PI * f * 1.003 * t + 1) +
          0.12 * Math.sin(2 * Math.PI * f * 2 * t)) *
        env * lfo * 0.045;
      add(s0 + j, v, pan * 0.5);
    }
  }

  // --- Bass: root on beat 1 and beat 3 (soft sine)
  if (b >= 2) {
    for (const beat of [0, 2]) {
      const f = midiHz(chord.root);
      const s0 = Math.floor((t0 + beat * BEAT) * SR);
      const len = Math.floor(BEAT * 1.8 * SR);
      for (let j = 0; j < len; j++) {
        const t = j / SR;
        const env = Math.min(1, t / 0.01) * Math.exp(-t * 1.6);
        add(s0 + j, Math.sin(2 * Math.PI * f * t) * env * 0.16, 0);
      }
    }
  }

  // --- Plucky arpeggio: 8th notes, chord tones +1 octave, with a little echo
  if (b >= 4) {
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
    for (let e = 0; e < 8; e++) {
      const note = chord.notes[pattern[e]] + 12;
      const f = midiHz(note);
      const tStart = t0 + e * (BEAT / 2);
      const vel = (e % 2 === 0 ? 1 : 0.7) * (0.85 + rand() * 0.15);
      const pan = e % 2 === 0 ? -0.35 : 0.35;
      for (const [delay, gain, p] of [
        [0, 1, pan],
        [BEAT * 0.75, 0.32, -pan],
        [BEAT * 1.5, 0.12, pan],
      ]) {
        const s0 = Math.floor((tStart + delay) * SR);
        const len = Math.floor(0.7 * SR);
        for (let j = 0; j < len; j++) {
          const t = j / SR;
          const env = Math.min(1, t / 0.004) * Math.exp(-t * 7);
          const v =
            (Math.sin(2 * Math.PI * f * t) +
              0.25 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 12)) *
            env * vel * gain * 0.06;
          add(s0 + j, v, p);
        }
      }
    }
  }

  // --- Soft kick on every beat (from bar 8), lighter on 2 & 4
  if (b >= 8) {
    for (let beat = 0; beat < 4; beat++) {
      const s0 = Math.floor((t0 + beat * BEAT) * SR);
      const len = Math.floor(0.35 * SR);
      const g = beat % 2 === 0 ? 0.32 : 0.2;
      let phase = 0;
      for (let j = 0; j < len; j++) {
        const t = j / SR;
        const f = 45 + 80 * Math.exp(-t * 30);
        phase += (2 * Math.PI * f) / SR;
        const env = Math.exp(-t * 11);
        add(s0 + j, Math.sin(phase) * env * g, 0);
      }
    }
    // --- airy hats on off-beats (high-passed noise)
    for (let beat = 0; beat < 4; beat++) {
      const s0 = Math.floor((t0 + beat * BEAT + BEAT / 2) * SR);
      const len = Math.floor(0.08 * SR);
      let prev = 0;
      for (let j = 0; j < len; j++) {
        const t = j / SR;
        const n = rand() * 2 - 1;
        const hp = n - prev;
        prev = n;
        add(s0 + j, hp * Math.exp(-t * 60) * 0.025, 0.2);
      }
    }
  }
}

// --- simple stereo "room": two short feedback delays
const room = (buf, d1, d2) => {
  const a = Math.floor(d1 * SR);
  const c = Math.floor(d2 * SR);
  for (let i = 0; i < N; i++) {
    if (i >= a) buf[i] += buf[i - a] * 0.18;
    if (i >= c) buf[i] += buf[i - c] * 0.12;
  }
};
room(L, 0.083, 0.211);
room(R, 0.097, 0.187);

// --- gentle one-pole lowpass for warmth
for (const buf of [L, R]) {
  let y = 0;
  const a = 0.35;
  for (let i = 0; i < N; i++) {
    y += a * (buf[i] - y);
    buf[i] = y;
  }
}

// --- fades + normalize
const FADE_IN = 3;
const FADE_OUT = 6;
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = Math.min(1, t / FADE_IN) * Math.min(1, (DURATION - t) / FADE_OUT);
  L[i] *= g;
  R[i] *= g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const TARGET = 0.6; // leave headroom; the video also plays it at low volume
const norm = TARGET / peak;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * norm));
  const r = Math.max(-1, Math.min(1, R[i] * norm));
  data.writeInt16LE(Math.round(l * 32767), i * 4);
  data.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(2, 22); // stereo
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "music.wav");
writeFileSync(out, Buffer.concat([header, data]));
console.log(`Wrote ${out} (${DURATION}s, ${(data.length / 1e6).toFixed(1)} MB)`);
