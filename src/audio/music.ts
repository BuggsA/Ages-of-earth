/**
 * Music made as it plays, one style per epoch: a drone, hand drums and a bone flute in the Stone Age;
 * a lyre and frame drum in a desert mode in the Bronze Age; recorder and lute in the Dorian mode in the
 * Middle Ages; harpsichord and strings in the Gunpowder Age; a brass band with oom-pah and snare in the
 * Industrial Age. Phrases are invented on the spot from
 * short motifs that come back with changes, with rests between sections so it never nags. When a
 * battle starts the drums come in harder.
 *
 * Plucked strings are Karplus-Strong: a burst of noise fed round a short delay that loses a little each
 * pass, rendered once into buffers.
 */
import type { AgeId } from '../sim/types';

interface Style {
  bpm: number;
  /** The key's root, in Hz. */
  root: number;
  /** The mode, as semitones above the root. */
  scale: number[];
  /** Chords as scale degrees, one per bar, cycled. */
  chords: number[];
  lead: 'flute' | 'pluck' | 'recorder' | 'harpsichord' | 'cornet' | 'bell' | 'theremin';
  accomp: 'drone' | 'lyre' | 'lute' | 'strings' | 'oompah';
  drums: 'hand' | 'frame' | 'tabor' | 'timpani' | 'snare' | 'anvil';
  /** How busy the tune is (chance of a note on each half beat). */
  density: number;
}

const STYLES: Style[] = [
  { bpm: 70, root: 146.83, scale: [0, 3, 5, 7, 10], chords: [0, 0, 0, 0], lead: 'flute', accomp: 'drone', drums: 'hand', density: 0.32 },
  { bpm: 76, root: 164.81, scale: [0, 1, 4, 5, 7, 8, 10], chords: [0, 0, 6, 0, 3, 3, 6, 0], lead: 'pluck', accomp: 'lyre', drums: 'frame', density: 0.4 },
  { bpm: 84, root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 6, 3, 0, 0, 6, 4, 0], lead: 'recorder', accomp: 'lute', drums: 'tabor', density: 0.42 },
  { bpm: 92, root: 196.0, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 3, 4, 0, 5, 2, 4, 0], lead: 'harpsichord', accomp: 'strings', drums: 'timpani', density: 0.5 },
  { bpm: 104, root: 174.61, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 3, 4, 0, 5, 3, 4, 0], lead: 'cornet', accomp: 'oompah', drums: 'snare', density: 0.48 },
];

/**
 * The side ages (#55) each have a theme of their own, in place of their tier's: merchants a bright
 * Mixolydian on lute and bells over a tabor, the Iron Age a minor pentatonic over a drone with an
 * anvil keeping time, pilgrims a slow Phrygian chant of bells and strings, fairs a lively major waltz
 * of recorder and oom-pah.
 */
const SIDE_STYLES: Partial<Record<AgeId, Style>> = {
  aeronaut: { bpm: 104, root: 220, scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 4, 1, 5], lead: 'recorder', accomp: 'oompah', drums: 'tabor', density: 0.48 },
  reclaimer: { bpm: 72, root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 3, 0, 5], lead: 'recorder', accomp: 'drone', drums: 'frame', density: 0.36 },
  merchant: { bpm: 96, root: 196.0, scale: [0, 2, 4, 5, 7, 9, 10], chords: [0, 3, 6, 0, 4, 3, 6, 0], lead: 'bell', accomp: 'lute', drums: 'tabor', density: 0.5 },
  iron: { bpm: 66, root: 123.47, scale: [0, 3, 5, 7, 10], chords: [0, 0, 2, 0], lead: 'flute', accomp: 'drone', drums: 'anvil', density: 0.3 },
  pilgrim: { bpm: 58, root: 164.81, scale: [0, 1, 3, 5, 7, 8, 10], chords: [0, 0, 5, 3, 0, 4, 5, 0], lead: 'bell', accomp: 'strings', drums: 'frame', density: 0.28 },
  sail: { bpm: 78, root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 3, 4, 0, 6, 3, 4, 0], lead: 'flute', accomp: 'lute', drums: 'frame', density: 0.4 },
  // The Age of Lightning (#231): a whole-tone theremin over held strings and the anvil's clank, the sound of a laboratory at night.
  lightning: { bpm: 80, root: 155.56, scale: [0, 2, 4, 6, 8, 10], chords: [0, 3, 1, 4], lead: 'theremin', accomp: 'strings', drums: 'anvil', density: 0.3 },
  // The Age of the Warband (#299): a hard Phrygian march, horn-like cornet over a drone, the timpani a war drum.
  warband: { bpm: 88, root: 130.81, scale: [0, 1, 3, 5, 7, 8, 10], chords: [0, 0, 1, 0, 6, 0, 1, 0], lead: 'cornet', accomp: 'drone', drums: 'timpani', density: 0.36 },
  fair: { bpm: 112, root: 220.0, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 4, 3, 0, 5, 3, 4, 0], lead: 'recorder', accomp: 'oompah', drums: 'tabor', density: 0.58 },
};

const LOOKAHEAD = 1.2;

export class Music {
  private ctx: BaseAudioContext | null = null;
  private out: GainNode | null = null;
  private epoch = 0;
  private age: AgeId | undefined;
  private timer = 0;
  private nextBar = 0;
  private bar = 0;
  private playing = false;
  /** 0 calm to 1 battle; eases back down over time. */
  private heat = 0;
  private plucks = new Map<number, AudioBuffer>();
  private motif: number[] = [];
  private lastNote = 0;
  private droneUntil = 0;

  /** Hook up to an audio graph (from the sound engine, once the player has clicked). */
  attach(ctx: BaseAudioContext, out: GainNode): void {
    if (this.ctx === ctx) return;
    this.ctx = ctx;
    this.out = out;
    this.plucks.clear();
  }

  get attached(): boolean {
    return !!this.ctx;
  }

  /** The style now playing: a side age's own theme, or its tier's. */
  private style(): Style {
    return (this.age && SIDE_STYLES[this.age]) || STYLES[this.epoch];
  }

  start(epoch: number, age?: AgeId): void {
    this.epoch = Math.min(epoch, STYLES.length - 1);
    this.age = age;
    if (this.playing || !this.ctx) {
      this.playing = true;
      return;
    }
    this.playing = true;
    this.bar = 0;
    this.motif = [];
    this.nextBar = this.ctx.currentTime + 0.5;
    this.droneUntil = 0;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 250);
  }

  stop(): void {
    this.playing = false;
    window.clearInterval(this.timer);
    this.timer = 0;
  }

  setEpoch(epoch: number, age?: AgeId): void {
    epoch = Math.min(epoch, STYLES.length - 1);
    if (epoch === this.epoch && age === this.age) return;
    this.epoch = epoch;
    this.age = age;
    // A fresh section in the new style.
    this.bar = 0;
    this.motif = [];
    this.droneUntil = 0;
  }

  /** Something warlike happened nearby. */
  stir(amount: number): void {
    this.heat = Math.min(1, this.heat + amount);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.playing || ctx.state !== 'running') return;
    if (this.nextBar < ctx.currentTime) this.nextBar = ctx.currentTime + 0.1;
    while (this.nextBar < ctx.currentTime + LOOKAHEAD) {
      this.playBar(this.nextBar);
      const st = this.style();
      this.nextBar += (4 * 60) / st.bpm;
      this.bar++;
      this.heat = Math.max(0, this.heat - 0.06);
    }
  }

  // ---- Composition -------------------------------------------------------------------------------

  private freq(st: Style, degree: number, octave = 0): number {
    const n = st.scale.length;
    const o = Math.floor(degree / n);
    const d = ((degree % n) + n) % n;
    return st.root * 2 ** (octave + o + st.scale[d] / 12);
  }

  private playBar(t: number): void {
    const st = this.style();
    const beat = 60 / st.bpm;
    // Sections of 16 bars: 12 playing and 4 resting (drone and a little drum only).
    const inSection = this.bar % 16;
    const resting = inSection >= 12;
    const chord = st.chords[this.bar % st.chords.length];
    const battle = this.heat > 0.35;

    // Accompaniment.
    if (st.accomp === 'drone') {
      if (t >= this.droneUntil) {
        const len = beat * 16;
        this.pad(t, [this.freq(st, 0, -1), this.freq(st, 3, -1)], len + beat * 2, 0.05, 'sine');
        this.droneUntil = t + len;
      }
    } else if (st.accomp === 'oompah') {
      // A band's bass on the strong beats, chords on the off beats.
      const steps = resting ? 1 : 4;
      for (let i = 0; i < steps; i++) {
        if (i % 2 === 0) this.pad(t + i * beat, [this.freq(st, chord + (i === 2 ? 4 : 0), -2)], beat * 0.7, 0.06, 'sawtooth');
        else this.pad(t + i * beat, [2, 4].map((k) => this.freq(st, chord + k, -1)), beat * 0.45, 0.03, 'sawtooth');
      }
    } else if (st.accomp === 'strings') {
      if (!resting || inSection === 12) this.pad(t, [0, 2, 4].map((k) => this.freq(st, chord + k, -1)), beat * 4.4, 0.035, 'sawtooth');
    } else {
      // Arpeggios on the lyre or lute.
      const notes = [0, 2, 4, 7].map((k) => this.freq(st, chord + k, st.accomp === 'lyre' ? -1 : -1));
      const steps = resting ? 2 : 8;
      for (let i = 0; i < steps; i++) {
        const f = notes[i % 2 === 0 ? (i / 2) % 4 : (i * 3) % 4];
        this.pluck(t + i * (beat / 2), f, 0.11 * (i % 4 === 0 ? 1.2 : 0.8), 0.35);
      }
      if (inSection % 4 === 0) this.pad(t, [this.freq(st, 0, -2)], beat * 4.2, 0.03, 'sine');
    }

    // Drums: quiet patterns at peace, driving ones in battle.
    const pattern = battle ? [1, 0, 1, 1, 1, 0, 1, 1] : resting ? [1, 0, 0, 0, 0, 0, 0, 0] : [1, 0, 0, 1, 0, 0, 1, 0];
    for (let i = 0; i < 8; i++) {
      if (!pattern[i]) continue;
      const accent = i === 0 ? 1 : 0.6;
      this.drum(st, t + i * (beat / 2), (battle ? 0.22 : 0.1) * accent, i % 4 === 0);
    }
    if (battle && st.drums === 'timpani' && this.bar % 2 === 0) this.drum(st, t + beat * 3.5, 0.2, true);

    if (resting) return;

    // The tune: a motif per four bars, repeated and changed.
    if (inSection % 4 === 0 || !this.motif.length) this.motif = this.newMotif(st);
    const variant = inSection % 4;
    for (let i = 0; i < 8; i++) {
      const deg = this.motif[i];
      if (deg === undefined || deg === null || Number.isNaN(deg)) continue;
      let d = deg + (variant === 2 && i > 4 ? 1 : 0);
      if (variant === 3 && i === 7) d = 0;
      const len = beat / 2 * (this.motif[i + 1] === undefined || Number.isNaN(this.motif[i + 1]) ? 2 : 1);
      this.lead(st, t + i * (beat / 2), this.freq(st, d + chord, 0), len);
    }
  }

  /** A short tune of half-beat notes as scale degrees (NaN for a rest), walking mostly by step. */
  private newMotif(st: Style): number[] {
    const m: number[] = [];
    let d = this.lastNote;
    for (let i = 0; i < 8; i++) {
      if (Math.random() > st.density + (i === 0 ? 0.4 : 0)) {
        m.push(NaN);
        continue;
      }
      const r = Math.random();
      d += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : 0;
      d = Math.max(-2, Math.min(st.scale.length + 3, d));
      m.push(d);
    }
    this.lastNote = Number.isNaN(m[7]) ? d : m[7];
    // Pull back toward home now and then.
    if (Math.abs(this.lastNote) > 4 && Math.random() < 0.5) this.lastNote = 0;
    return m;
  }

  // ---- Instruments -------------------------------------------------------------------------------

  private lead(st: Style, t: number, f: number, len: number): void {
    if (st.lead === 'bell') this.bell(t, f);
    else if (st.lead === 'pluck') this.pluck(t, f, 0.16, 0.9);
    else if (st.lead === 'harpsichord') {
      this.pluck(t, f, 0.13, 0.6, true);
      this.pluck(t, f * 2, 0.04, 0.4, true);
    } else if (st.lead === 'cornet') this.flute(t, f, len * 0.85, 0.045, 'sawtooth', 2.2);
    else if (st.lead === 'theremin') this.theremin(t, f * 2, len * 1.1);
    else this.flute(t, f * (st.lead === 'recorder' ? 2 : 1), len * 0.95, st.lead === 'flute' ? 0.06 : 0.05);
  }

  /** A struck bell: a sine and an inharmonic partner, ringing out. */
  private bell(t: number, f: number): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.07, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    env.connect(this.out!);
    for (const [mul, vol] of [[1, 1], [2.76, 0.35]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * 2 * mul;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + 2.3);
    }
  }

  /** A breathy wind voice: a flute or recorder, or (a brighter wave, filtered) a cornet. */
  /** A theremin: a pure tone that slides up into each note and wavers on a wide vibrato. */
  private theremin(t: number, f: number, len: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.94, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.14);
    const vib = ctx.createOscillator();
    vib.frequency.value = 6.2;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = f * 0.016;
    vib.connect(vibAmt).connect(osc.frequency);
    const env = ctx.createGain();
    const end = t + Math.max(0.3, len);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.045, t + 0.12);
    env.gain.setValueAtTime(0.04, end - 0.1);
    env.gain.exponentialRampToValueAtTime(0.0001, end + 0.2);
    osc.connect(env).connect(this.out!);
    osc.start(t);
    vib.start(t);
    osc.stop(end + 0.25);
    vib.stop(end + 0.25);
  }

  private flute(t: number, f: number, len: number, peak: number, type: OscillatorType = 'triangle', bright = 3): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = f * 0.006;
    vib.connect(vibAmt).connect(osc.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = f * bright;
    const env = ctx.createGain();
    const end = t + Math.max(0.2, len);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.07);
    env.gain.setValueAtTime(peak * 0.8, end - 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
    osc.connect(lp).connect(env).connect(this.out!);
    osc.start(t);
    vib.start(t);
    osc.stop(end + 0.2);
    vib.stop(end + 0.2);
  }

  private pad(t: number, freqs: number[], len: number, peak: number, type: OscillatorType): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + Math.min(1.4, len * 0.3));
    env.gain.setValueAtTime(peak, t + len * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = type === 'sine' ? 2000 : 900;
    lp.connect(env).connect(this.out!);
    for (const f of freqs) {
      for (const det of type === 'sine' ? [0] : [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + len + 0.1);
      }
    }
  }

  private pluck(t: number, f: number, peak: number, ring: number, bright = false): void {
    const ctx = this.ctx!;
    const key = Math.round(f * 10) * (bright ? -1 : 1);
    let buf = this.plucks.get(key);
    if (!buf) {
      buf = this.karplus(f, bright);
      this.plucks.set(key, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.setTargetAtTime(0.0001, t + ring * 0.6, ring * 0.4);
    src.connect(g).connect(this.out!);
    src.start(t);
    src.stop(t + ring * 2 + 0.2);
  }

  private karplus(f: number, bright: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 1.6);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    const period = Math.max(2, Math.round(rate / f));
    const line = new Float32Array(period);
    for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
    const loss = bright ? 0.499 : 0.4985;
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const j = i % period;
      const v = line[j];
      d[i] = v;
      line[j] = (v + prev) * loss;
      prev = v;
    }
    return buf;
  }

  private drum(st: Style, t: number, peak: number, low: boolean): void {
    const ctx = this.ctx!;
    if (st.drums === 'anvil') {
      // A hammer on iron: a ringing square wave, hard on the downbeat.
      const e = ctx.createGain();
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = low ? 520 : 780;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = low ? 900 : 1500;
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.003);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(bp).connect(e).connect(this.out!);
      o.start(t);
      o.stop(t + 0.6);
      return;
    }
    const env = ctx.createGain();
    const osc = ctx.createOscillator();
    const base = st.drums === 'timpani' ? 70 : st.drums === 'hand' ? 120 : st.drums === 'snare' ? 150 : 100;
    osc.frequency.setValueAtTime(low ? base : base * 1.8, t);
    osc.frequency.exponentialRampToValueAtTime(low ? base * 0.6 : base * 1.2, t + 0.25);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + (st.drums === 'timpani' ? 0.9 : 0.35));
    osc.connect(env).connect(this.out!);
    osc.start(t);
    osc.stop(t + 1);
    if (!low) {
      // The slap of the hand.
      const n = ctx.createBufferSource();
      const len = Math.floor(ctx.sampleRate * 0.05);
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const bd = b.getChannelData(0);
      for (let i = 0; i < len; i++) bd[i] = (Math.random() * 2 - 1) * (1 - i / len);
      n.buffer = b;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.value = peak * 0.5;
      n.connect(bp).connect(g).connect(this.out!);
      n.start(t);
    }
  }
}

