/**
 * Every sound in the game is made on the spot with the Web Audio API: blows, bowstrings, musket shots,
 * axes, picks, hammers, bells, horns and drums built from oscillators and filtered noise, so there are
 * no audio files to download. Effects pass through a little room reverb and a gentle compressor so a
 * big battle never gets harsh. Wind in the grass and birdsong are a separate, quieter layer.
 *
 * Browsers only allow sound after the player has clicked or pressed a key, so nothing is created
 * until `unlock` is called from such an event.
 */

export type SoundName =
  | 'click' | 'open' | 'select' | 'selectBuilding' | 'move' | 'attack' | 'strike' | 'thud' | 'hit' | 'hitBuilding' | 'bow' | 'sling' | 'musket'
  | 'fall' | 'collapse' | 'built' | 'place' | 'ready' | 'readyCitizen' | 'chop' | 'mine' | 'hammer' | 'rustle' | 'epoch' | 'alert'
  | 'victory' | 'defeat' | 'error' | 'coin' | 'queue' | 'catapult' | 'cannon' | 'impact' | 'spear' | 'chant' | 'convert' | 'heal'
  | 'townBell' | 'allClear' | 'research' | 'wonder' | 'shelter' | 'bombDrop' | 'explosion' | 'mg' | 'engine' | 'shipHorn' | 'splashWater'
  | 'board' | 'relicTake' | 'relicKeep';

export interface SoundSettings {
  /** Effects volume, 0 to 1. */
  volume: number;
  /** Wind and birdsong, 0 to 1. */
  ambience: number;
  /** Music, 0 to 1. */
  music: number;
  muted: boolean;
}

export interface PlayOptions {
  /** Seconds from now. */
  delay?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
  /** Extra loudness, 0 to 1. */
  gain?: number;
}

const KEY = 'ages-sound';

// Notes in Hz.
const N = {
  C3: 130.81, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.51, G6: 1567.98, A6: 1760, B6: 1975.53, C7: 2093,
};

interface ToneOpts {
  f: number;
  to?: number;
  type?: OscillatorType;
  dur: number;
  peak?: number;
  attack?: number;
  /** Low-pass the tone (brass, soft pads). */
  lp?: number;
  /** Seconds the pitch takes to glide to `to` (default: the whole tone). */
  glide?: number;
}

interface NoiseOpts {
  dur: number;
  filter?: BiquadFilterType;
  f?: number;
  to?: number;
  q?: number;
  peak?: number;
  attack?: number;
}

function loadSettings(): SoundSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const n = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    return { volume: n(s.volume, 0.8), ambience: n(s.ambience, 0.6), music: n(s.music, 0.5), muted: s.muted === true };
  } catch {
    return { volume: 0.8, ambience: 0.6, music: 0.5, muted: false };
  }
}

type Ctor = typeof AudioContext;

export class Sound {
  settings: SoundSettings = loadSettings();
  private ctx: BaseAudioContext | null = null;
  /** Rendering offline (for measuring levels), not to the speakers. */
  private offline = false;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private mus!: GainNode;
  /** Called once the audio graph exists (for the music to hook in). */
  onReady: ((ctx: BaseAudioContext, music: GainNode) => void) | null = null;
  private noiseBuf!: AudioBuffer;
  private pinkBuf!: AudioBuffer;
  private wind: GainNode | null = null;
  private ambOn = false;
  private birdTimer = 0;
  /** Recent plays per sound, to keep a busy turn from stacking the same sound twenty times. */
  private recent = new Map<SoundName, number[]>();

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const ctx = this.ctx;
        if (!ctx || this.offline) return;
        if (document.hidden) void (ctx as AudioContext).suspend();
        else void (ctx as AudioContext).resume();
      });
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Every sound there is. */
  static readonly names: SoundName[] = [
    'click', 'open', 'select', 'selectBuilding', 'move', 'attack', 'strike', 'thud', 'hit', 'hitBuilding', 'bow', 'sling', 'musket', 'fall',
    'collapse', 'built', 'place', 'ready', 'readyCitizen', 'chop', 'mine', 'hammer', 'rustle', 'epoch', 'alert', 'victory', 'defeat', 'error', 'coin', 'queue',
    'catapult', 'cannon', 'impact', 'spear', 'chant', 'convert', 'heal', 'townBell', 'allClear', 'research', 'wonder', 'shelter',
    'relicTake', 'relicKeep',
  ];

  /**
   * Render sounds offline and report how loud each one is (peak and RMS), for tuning levels
   * without listening. Development aid.
   */
  static async measure(names: SoundName[] = Sound.names, ambience = false): Promise<Record<string, { peak: number; rms: number }>> {
    const out: Record<string, { peak: number; rms: number }> = {};
    const rate = 22050;
    for (const name of ambience ? ['ambience'] : names) {
      const ctx = new OfflineAudioContext(2, rate * (ambience ? 12 : 3), rate);
      const s = new Sound();
      s.init(ctx, true);
      if (ambience) s.startAmbience();
      else s.play(name as SoundName);
      const buf = await ctx.startRendering();
      let peak = 0;
      let sum = 0;
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        sum += d[i] * d[i];
      }
      // RMS over the part that sounds (above a whisper), so short sounds aren't diluted by silence.
      const loud = d.filter((v) => Math.abs(v) > 0.003).length || 1;
      out[name] = { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / loud).toFixed(3) };
    }
    return out;
  }

  /** Create or wake the audio context. Call from a click or key press. */
  unlock(): void {
    const AC: Ctor | undefined = typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) this.init(new AC());
    if (this.ctx!.state === 'suspended' && !document.hidden) void (this.ctx as AudioContext).resume();
  }

  /** Build the mixing graph on a context: effects with reverb, ambience, a compressor, the master. */
  init(ctx: BaseAudioContext, offline = false): void {
    this.ctx = ctx;
    this.offline = offline;
    if (offline) this.settings = { volume: 0.8, ambience: 0.6, music: 0.5, muted: false };
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.sfx = ctx.createGain();
    this.amb = ctx.createGain();
    this.mus = ctx.createGain();
    // A small room: effects send a little into a reverb made from decaying noise.
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(1.6);
    const send = ctx.createGain();
    send.gain.value = 0.22;
    this.sfx.connect(comp);
    this.sfx.connect(send).connect(verb).connect(comp);
    this.amb.connect(comp);
    // Music sits in the same room, a little further back.
    const musSend = ctx.createGain();
    musSend.gain.value = 0.35;
    this.mus.connect(comp);
    this.mus.connect(musSend).connect(verb);
    comp.connect(this.master).connect(ctx.destination);
    this.noiseBuf = this.whiteNoise(2);
    this.pinkBuf = this.pinkNoise(8);
    this.apply(true);
    this.onReady?.(ctx, this.mus);
  }

  /** Change and remember the settings. */
  set(next: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...next };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      // Holds for this visit.
    }
    this.apply();
  }

  /** Set the bus levels: gliding to them, or (when the graph is first built) straight away. */
  private apply(now = false): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const to = (p: AudioParam, v: number, k: number) => (now ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, k));
    to(this.master.gain, this.settings.muted ? 0 : 1, 0.05);
    // Levels measured offline: effects peak around 0.1 to 0.6, the sea sits well under them.
    to(this.sfx.gain, this.settings.volume * 2.6, 0.05);
    to(this.amb.gain, this.settings.ambience * 0.28, 0.3);
    to(this.mus.gain, this.settings.music * 0.5, 0.3);
  }

  // ---- Building blocks -----------------------------------------------------------------------

  private whiteNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Softer, ocean-like noise (Paul Kellet's pink filter), looped seamlessly by fading its ends. */
  private pinkNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      const fade = Math.floor(ctx.sampleRate * 0.5);
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[i] = d[i] * k + d[d.length - fade + i] * (1 - k);
      }
    }
    return buf;
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** A short-lived output for one sound: its loudness and place left to right. */
  private voice(gain: number, pan: number, bus: GainNode = this.sfx): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(bus);
    } else g.connect(bus);
    return g;
  }

  private envelope(t: number, dur: number, peak: number, attack: number): GainNode {
    const env = this.ctx!.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return env;
  }

  private tone(out: AudioNode, t: number, o: ToneOpts): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? o.dur));
    const env = this.envelope(t, o.dur, o.peak ?? 0.2, o.attack ?? 0.005);
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f).connect(env);
    } else osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  private noise(out: AudioNode, t: number, o: NoiseOpts): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'lowpass';
    f.frequency.setValueAtTime(o.f ?? 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    f.Q.value = o.q ?? 0.8;
    const env = this.envelope(t, o.dur, o.peak ?? 0.2, o.attack ?? 0.004);
    src.connect(f).connect(env).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + 0.05);
  }

  /** A struck bell: a fundamental and two inharmonic partials that die away faster. */
  private bell(out: AudioNode, t: number, f: number, dur: number, peak: number): void {
    this.tone(out, t, { f, dur, peak });
    this.tone(out, t, { f: f * 2.76, dur: dur * 0.5, peak: peak * 0.3 });
    this.tone(out, t, { f: f * 5.4, dur: dur * 0.25, peak: peak * 0.12 });
  }

  /** A soft brass note: a sawtooth behind a low-pass, swelling in. */
  private brass(out: AudioNode, t: number, f: number, dur: number, peak: number): void {
    this.tone(out, t, { f, type: 'sawtooth', dur, peak, attack: 0.06, lp: 1300 });
    this.tone(out, t, { f: f * 1.003, type: 'sawtooth', dur, peak: peak * 0.6, attack: 0.08, lp: 900 });
  }

  private drum(out: AudioNode, t: number, peak: number): void {
    this.tone(out, t, { f: 95, to: 42, dur: 0.32, peak });
    this.noise(out, t, { dur: 0.14, f: 380, peak: peak * 0.6 });
  }

  // ---- Effects ------------------------------------------------------------------------------------

  /** Play one sound. Quietly does nothing before the player has clicked, or when muted. */
  play(name: SoundName, o: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || this.settings.muted || (ctx.state !== 'running' && !this.offline)) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    // No more than three of the same sound within a quarter second.
    const times = (this.recent.get(name) ?? []).filter((x) => Math.abs(x - t) < 0.25);
    if (times.length >= 3) return;
    times.push(t);
    this.recent.set(name, times);
    const out = this.voice(o.gain ?? 1, o.pan ?? 0);
    this.recipe(name, out, t);
  }

  private recipe(name: SoundName, out: GainNode, t: number): void {
    switch (name) {
      case 'click':
        this.tone(out, t, { f: 1250, to: 900, dur: 0.05, peak: 0.08 });
        break;
      case 'open':
        this.noise(out, t, { dur: 0.16, filter: 'bandpass', f: 2200, to: 800, q: 1.2, peak: 0.06 });
        this.tone(out, t, { f: 700, to: 1000, dur: 0.1, peak: 0.04 });
        break;
      case 'select':
        this.tone(out, t, { f: 660, type: 'triangle', dur: 0.08, peak: 0.12 });
        this.tone(out, t + 0.04, { f: 880, type: 'triangle', dur: 0.1, peak: 0.08 });
        break;
      case 'selectBuilding':
        for (const [i, f] of [N.C5, N.E5, N.G5].entries()) this.tone(out, t + i * 0.03, { f, type: 'triangle', dur: 0.3, peak: 0.06 });
        break;
      case 'move':
        // A short "hup!": a vowel-like buzz behind a formant filter.
        this.tone(out, t, { f: 210, to: 260, type: 'sawtooth', dur: 0.12, peak: 0.08, lp: 1100 });
        this.noise(out, t, { dur: 0.06, filter: 'bandpass', f: 1600, q: 2, peak: 0.05 });
        break;
      case 'attack':
        this.tone(out, t, { f: 180, to: 140, type: 'sawtooth', dur: 0.16, peak: 0.1, lp: 900 });
        this.drum(out, t + 0.05, 0.12);
        break;
      case 'strike':
        // Steel on steel: a bright hiss, three clashing partials, and the thud behind them.
        this.noise(out, t, { dur: 0.1, filter: 'highpass', f: 2600, peak: 0.22 });
        for (const [f, d] of [[1320, 0.3], [1987, 0.22], [2791, 0.16]] as const) this.tone(out, t, { f: f * (0.92 + Math.random() * 0.16), dur: d, peak: 0.045 });
        this.tone(out, t, { f: 150, to: 70, dur: 0.12, peak: 0.18 });
        break;
      case 'thud':
        this.tone(out, t, { f: 140, to: 60, dur: 0.14, peak: 0.2 });
        this.noise(out, t, { dur: 0.06, f: 900, peak: 0.12 });
        break;
      case 'hit':
        this.tone(out, t, { f: 170, to: 55, dur: 0.14, peak: 0.18 });
        this.noise(out, t, { dur: 0.06, f: 1400, peak: 0.12 });
        break;
      case 'hitBuilding':
        this.noise(out, t, { dur: 0.18, f: 700, to: 250, peak: 0.2 });
        this.tone(out, t, { f: 95, to: 50, dur: 0.2, peak: 0.16 });
        break;
      case 'bow':
        this.tone(out, t, { f: 300, to: 120, type: 'triangle', dur: 0.14, peak: 0.16, glide: 0.08 });
        this.noise(out, t + 0.02, { dur: 0.25, filter: 'bandpass', f: 2200, to: 600, q: 1.4, peak: 0.1 });
        break;
      case 'sling':
        this.noise(out, t, { dur: 0.22, filter: 'bandpass', f: 900, to: 2400, q: 2, peak: 0.12 });
        break;
      case 'musket':
        // A crack and a rolling boom.
        this.noise(out, t, { dur: 0.06, filter: 'highpass', f: 1800, peak: 0.5 });
        this.noise(out, t, { dur: 0.6, f: 900, to: 120, peak: 0.35, attack: 0.002 });
        this.tone(out, t, { f: 90, to: 40, dur: 0.35, peak: 0.25 });
        break;
      case 'fall':
        this.tone(out, t, { f: 300, to: 160, type: 'sawtooth', dur: 0.3, peak: 0.05, lp: 900 });
        this.noise(out, t + 0.12, { dur: 0.4, f: 600, to: 160, peak: 0.12, attack: 0.02 });
        break;
      case 'collapse':
        this.noise(out, t, { dur: 1.6, f: 900, to: 90, peak: 0.4, attack: 0.02 });
        this.tone(out, t, { f: 70, to: 32, dur: 1.2, peak: 0.3 });
        for (let i = 0; i < 5; i++) this.noise(out, t + 0.15 + i * 0.17, { dur: 0.12, filter: 'bandpass', f: 600 + i * 150, q: 1.5, peak: 0.12 });
        break;
      case 'built':
        [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => this.bell(out, t + i * 0.08, f, 0.9, 0.08));
        break;
      case 'place':
        this.noise(out, t, { dur: 0.05, filter: 'bandpass', f: 1400, q: 2, peak: 0.25 });
        this.tone(out, t, { f: 420, dur: 0.06, peak: 0.06 });
        break;
      case 'ready':
        this.brass(out, t, N.G3, 0.25, 0.08);
        this.brass(out, t + 0.18, N.C4, 0.45, 0.09);
        break;
      case 'readyCitizen':
        this.bell(out, t, N.G5, 0.5, 0.06);
        this.bell(out, t + 0.08, N.C6, 0.6, 0.05);
        break;
      case 'chop':
        this.noise(out, t, { dur: 0.05, filter: 'bandpass', f: 900, q: 3, peak: 0.5 });
        this.tone(out, t, { f: 240, to: 180, dur: 0.07, peak: 0.12 });
        break;
      case 'mine':
        this.tone(out, t, { f: 2400, dur: 0.12, peak: 0.05 });
        this.tone(out, t, { f: 3510, dur: 0.08, peak: 0.03 });
        this.noise(out, t, { dur: 0.05, filter: 'highpass', f: 3000, peak: 0.15 });
        break;
      case 'hammer':
        this.noise(out, t, { dur: 0.04, filter: 'bandpass', f: 1400, q: 2, peak: 0.35 });
        this.tone(out, t, { f: 520, dur: 0.05, peak: 0.06 });
        break;
      case 'rustle':
        this.noise(out, t, { dur: 0.3, filter: 'bandpass', f: 3500, to: 2200, q: 0.8, peak: 0.05, attack: 0.05 });
        break;
      case 'epoch':
        for (const f of [N.C4, N.E4, N.G4]) this.brass(out, t, f, 1.3, 0.07);
        this.brass(out, t + 0.45, N.C5, 1.2, 0.07);
        [N.G5, N.C6, N.E6, N.G6].forEach((f, i) => this.bell(out, t + 0.5 + i * 0.1, f, 1.2, 0.07));
        break;
      case 'alert':
        // A war horn, twice.
        this.brass(out, t, N.G3, 0.5, 0.11);
        this.brass(out, t + 0.55, N.G3, 0.7, 0.11);
        this.drum(out, t, 0.18);
        break;
      case 'coin':
        this.tone(out, t, { f: 2093, dur: 0.09, peak: 0.08 });
        this.tone(out, t + 0.06, { f: 2637, dur: 0.18, peak: 0.07 });
        break;
      case 'queue':
        this.tone(out, t, { f: 880, type: 'triangle', dur: 0.06, peak: 0.07 });
        this.tone(out, t + 0.05, { f: 1175, type: 'triangle', dur: 0.08, peak: 0.06 });
        break;
      case 'error':
        this.tone(out, t, { f: 170, type: 'square', dur: 0.12, peak: 0.05, lp: 900 });
        this.tone(out, t + 0.11, { f: 130, type: 'square', dur: 0.16, peak: 0.05, lp: 800 });
        break;
      case 'victory':
        [N.C4, N.E4, N.G4, N.C5].forEach((f, i) => this.brass(out, t + i * 0.16, f, 0.9 - i * 0.05, 0.08));
        for (const f of [N.C5, N.E5, N.G5]) this.brass(out, t + 0.7, f, 1.8, 0.06);
        [N.C6, N.E6, N.G6, N.C7].forEach((f, i) => this.bell(out, t + 0.8 + i * 0.12, f, 1.4, 0.06));
        break;
      case 'defeat':
        [N.A4, N.F4, N.D4].forEach((f, i) => this.brass(out, t + i * 0.45, f, 0.9, 0.07));
        this.drum(out, t + 1.35, 0.2);
        break;
      case 'catapult':
        // A creak of rope and timber, the thump of the arm, the whoosh of the stone.
        this.tone(out, t, { f: 180, to: 120, type: 'sawtooth', dur: 0.18, peak: 0.05, lp: 700 });
        this.tone(out, t + 0.15, { f: 110, to: 50, dur: 0.18, peak: 0.25 });
        this.noise(out, t + 0.16, { dur: 0.5, filter: 'bandpass', f: 500, to: 1600, q: 1.2, peak: 0.12 });
        break;
      case 'cannon':
        this.noise(out, t, { dur: 0.08, filter: 'highpass', f: 1200, peak: 0.55 });
        this.noise(out, t, { dur: 1.3, f: 600, to: 60, peak: 0.5, attack: 0.003 });
        this.tone(out, t, { f: 60, to: 28, dur: 0.9, peak: 0.4 });
        break;
      case 'impact':
        this.noise(out, t, { dur: 0.5, f: 800, to: 120, peak: 0.35, attack: 0.004 });
        this.tone(out, t, { f: 80, to: 36, dur: 0.4, peak: 0.3 });
        break;
      case 'spear':
        this.noise(out, t, { dur: 0.2, filter: 'bandpass', f: 1300, to: 500, q: 2, peak: 0.12 });
        break;
      case 'bombDrop':
        // The falling whistle.
        this.tone(out, t, { f: 1500, to: 520, dur: 0.85, peak: 0.07, attack: 0.08 });
        break;
      case 'explosion':
        // A deep blast with a long rumble and debris pattering down.
        this.noise(out, t, { dur: 0.1, filter: 'highpass', f: 900, peak: 0.6 });
        this.noise(out, t, { dur: 2.0, f: 700, to: 50, peak: 0.6, attack: 0.003 });
        this.tone(out, t, { f: 55, to: 24, dur: 1.4, peak: 0.5 });
        for (let i = 0; i < 4; i++) this.noise(out, t + 0.35 + i * 0.16, { dur: 0.08, filter: 'bandpass', f: 1400 - i * 150, q: 2, peak: 0.06 });
        break;
      case 'mg':
        // A short rattle of a machine gun.
        for (let i = 0; i < 5; i++) {
          this.noise(out, t + i * 0.07, { dur: 0.05, filter: 'highpass', f: 1500, peak: 0.25 });
          this.tone(out, t + i * 0.07, { f: 140, to: 70, dur: 0.06, peak: 0.12 });
        }
        break;
      case 'engine':
        // A droning radial engine passing by.
        this.tone(out, t, { f: 82, to: 70, type: 'sawtooth', dur: 1.4, peak: 0.06, attack: 0.4, lp: 420 });
        this.tone(out, t, { f: 123, to: 104, type: 'square', dur: 1.4, peak: 0.025, attack: 0.4, lp: 600 });
        this.noise(out, t, { dur: 1.4, f: 500, peak: 0.05, attack: 0.4 });
        break;
      case 'shipHorn':
        // A ship's bell for sail, a steam whistle for steel.
        this.bell(out, t, N.A5, 0.9, 0.08);
        this.bell(out, t + 0.22, N.A5, 0.9, 0.06);
        break;
      case 'splashWater':
        this.noise(out, t, { dur: 0.7, filter: 'bandpass', f: 1600, to: 300, q: 0.8, peak: 0.3, attack: 0.01 });
        this.tone(out, t, { f: 160, to: 60, dur: 0.3, peak: 0.12 });
        break;
      case 'board':
        // Footsteps on planking.
        for (let i = 0; i < 3; i++) this.noise(out, t + i * 0.11, { dur: 0.06, filter: 'bandpass', f: 500, q: 2.5, peak: 0.15 });
        break;
      case 'chant':
        // A low hum of voices on a fifth, swelling.
        for (const f of [N.C3, N.G3]) this.tone(out, t, { f, type: 'sawtooth', dur: 1.1, peak: 0.035, attack: 0.3, lp: 700 });
        this.tone(out, t, { f: N.C4, type: 'triangle', dur: 1.1, peak: 0.03, attack: 0.35 });
        break;
      case 'convert':
        // A bright choir chord and chimes.
        for (const f of [N.C4, N.E4, N.G4, N.C5]) this.tone(out, t, { f, type: 'sawtooth', dur: 1.3, peak: 0.03, attack: 0.08, lp: 1800 });
        [N.G5, N.C6, N.E6].forEach((f, i) => this.bell(out, t + 0.1 + i * 0.09, f, 0.9, 0.05));
        break;
      case 'heal':
        this.bell(out, t, N.E6, 0.5, 0.035);
        this.bell(out, t + 0.07, N.G6, 0.5, 0.03);
        break;
      case 'townBell':
        // A big bronze bell, struck three times.
        for (let i = 0; i < 3; i++) {
          this.bell(out, t + i * 0.55, N.C4, 1.8, 0.14);
          this.bell(out, t + i * 0.55, N.C4 * 2.4, 1.2, 0.05);
        }
        break;
      case 'allClear':
        this.bell(out, t, N.G4, 1.2, 0.1);
        this.bell(out, t + 0.35, N.C5, 1.6, 0.1);
        break;
      case 'research':
        [N.E5, N.G5, N.B5].forEach((f, i) => this.bell(out, t + i * 0.07, f, 0.8, 0.06));
        this.tone(out, t + 0.2, { f: N.E6, type: 'triangle', dur: 0.4, peak: 0.04 });
        break;
      case 'wonder':
        for (const f of [N.C4, N.G4]) this.brass(out, t, f, 1.6, 0.07);
        for (const f of [N.E4, N.C5]) this.brass(out, t + 0.5, f, 1.6, 0.07);
        for (const f of [N.G4, N.D5, N.G5]) this.brass(out, t + 1.0, f, 2.2, 0.07);
        [N.C6, N.E6, N.G6, N.C7].forEach((f, i) => this.bell(out, t + 1.1 + i * 0.12, f, 1.5, 0.05));
        this.drum(out, t, 0.2);
        this.drum(out, t + 0.5, 0.2);
        this.drum(out, t + 1.0, 0.25);
        break;
      case 'relicTake':
        // Lifted: a rising shimmer of small bells over a soft breath of voices.
        [N.A5, N.C6, N.E6, N.A6].forEach((f, i) => this.bell(out, t + i * 0.06, f, 0.9, 0.04));
        this.tone(out, t, { f: N.A3, type: 'sawtooth', dur: 0.9, peak: 0.02, attack: 0.25, lp: 900 });
        break;
      case 'relicKeep':
        // Laid in the Temple: a deep bell, then a choir chord that opens out.
        this.bell(out, t, N.A3, 2.2, 0.11);
        this.bell(out, t, N.A3 * 2.4, 1.4, 0.04);
        for (const f of [N.A3, N.E4, N.A4, N.C5]) this.tone(out, t + 0.15, { f, type: 'sawtooth', dur: 1.8, peak: 0.028, attack: 0.4, lp: 1500 });
        [N.E5, N.A5, N.C6, N.E6].forEach((f, i) => this.bell(out, t + 0.5 + i * 0.11, f, 1.2, 0.04));
        break;
      case 'shelter':
        this.noise(out, t, { dur: 0.12, filter: 'bandpass', f: 500, q: 1.5, peak: 0.15 });
        this.tone(out, t + 0.05, { f: 140, to: 90, dur: 0.18, peak: 0.12 });
        break;
    }
  }

  // ---- Voices --------------------------------------------------------------------------------------

  private lastVoice = -1;

  /**
   * A unit answers: a few syllables of made-up speech (a buzzing voice through two formant filters per
   * vowel), rising like a question when picked, falling when ordered, a shout when sent to fight.
   */
  speak(who: 'citizen' | 'soldier' | 'priest' | 'hero' | 'engineer', mood: 'select' | 'move' | 'attack', seed = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.settings.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - this.lastVoice < 0.45) return;
    this.lastVoice = now;
    const r = (k: number) => {
      const v = Math.sin((seed + 1) * 12.9898 + k * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    // Each unit has its own voice: higher or lower, by who they are.
    const base = who === 'citizen' ? (r(1) < 0.5 ? 205 : 135) : who === 'priest' ? 150 : who === 'hero' ? 105 : who === 'engineer' ? 125 : 118;
    const f0 = base * (0.92 + r(2) * 0.16);
    const VOWELS: [number, number][] = [[800, 1200], [500, 1850], [320, 2300], [520, 920], [360, 820]];
    const n = mood === 'attack' ? 2 : 2 + Math.floor(Math.random() * 2);
    const out = this.voice(mood === 'attack' ? 1.4 : 1, 0);
    let t = now + 0.03;
    for (let i = 0; i < n; i++) {
      const len = mood === 'attack' ? 0.16 : 0.1 + Math.random() * 0.06;
      const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
      // Intonation: up for a question, down for an answer, high and hard for a battle cry.
      const k = i / Math.max(1, n - 1);
      const pitch = f0 * (mood === 'select' ? 1 + k * 0.25 : mood === 'attack' ? 1.35 - k * 0.1 : 1.12 - k * 0.22);
      const src = ctx.createOscillator();
      src.type = 'sawtooth';
      src.frequency.setValueAtTime(pitch, t);
      src.frequency.linearRampToValueAtTime(pitch * (mood === 'select' ? 1.06 : 0.96), t + len);
      const env = ctx.createGain();
      const peak = (mood === 'attack' ? 0.11 : 0.07) * (who === 'hero' ? 1.2 : 1);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(peak, t + 0.02);
      env.gain.setValueAtTime(peak, t + len - 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      for (const [f, q, g] of [[f1, 6, 1], [f2, 9, 0.5]] as const) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = q;
        const fg = ctx.createGain();
        fg.gain.value = g;
        src.connect(bp).connect(fg).connect(env);
      }
      env.connect(out);
      src.start(t);
      src.stop(t + len + 0.02);
      // A consonant before some syllables.
      if (i > 0 || Math.random() < 0.6) this.noise(out, t - 0.015, { dur: 0.03, filter: 'bandpass', f: 2500 + Math.random() * 2500, q: 1.5, peak: 0.05 });
      t += len + 0.02;
    }
    if (who === 'soldier' || who === 'hero') this.noise(out, now, { dur: 0.08, filter: 'highpass', f: 3000, peak: mood === 'select' ? 0.03 : 0.05 });
  }

  // ---- Ambience ------------------------------------------------------------------------------------

  /** Wind over the grass and leaves, with birdsong now and then. */
  startAmbience(): void {
    const ctx = this.ctx;
    if (!ctx || this.ambOn) return;
    this.ambOn = true;
    const layer = (filter: BiquadFilterType, f: number, q: number, base: number, swell: number, rate: number, offset: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.pinkBuf;
      src.loop = true;
      const bq = ctx.createBiquadFilter();
      bq.type = filter;
      bq.frequency.value = f;
      bq.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = base;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const depth = ctx.createGain();
      depth.gain.value = swell;
      lfo.connect(depth).connect(g.gain);
      src.connect(bq).connect(g).connect(this.amb);
      src.start(0, offset);
      lfo.start();
      return g;
    };
    // A low breeze, and leaves rustling over it.
    layer('lowpass', 380, 0.7, 0.35, 0.25, 0.06, 0);
    this.wind = layer('bandpass', 1800, 0.5, 0.05, 0.045, 0.11, 3.1);
    if (!this.offline) this.scheduleBirds();
  }

  stopAmbience(): void {
    // The layers keep running silently; only the bus is faded, so starting again is instant.
    if (!this.ctx) return;
    this.amb.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    this.ambOn = false;
    window.clearTimeout(this.birdTimer);
  }

  /** Resume a faded ambience bus (after stopAmbience) at the chosen level. */
  resumeAmbience(): void {
    if (!this.ctx) return;
    if (!this.ambOn && this.wind) {
      this.ambOn = true;
      this.apply();
      this.scheduleBirds();
    } else this.startAmbience();
  }

  private scheduleBirds(): void {
    window.clearTimeout(this.birdTimer);
    this.birdTimer = window.setTimeout(() => {
      if (!this.ambOn) return;
      this.bird();
      this.scheduleBirds();
    }, 6000 + Math.random() * 14000);
  }

  private bird(): void {
    const ctx = this.ctx;
    if (!ctx || (ctx.state !== 'running' && !this.offline) || this.settings.muted || this.settings.ambience === 0) return;
    const out = this.voice(0.5, Math.random() * 1.6 - 0.8, this.amb);
    const t = ctx.currentTime;
    const calls = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1400;
    for (let i = 0; i < calls; i++) {
      const at = t + i * (0.12 + Math.random() * 0.06);
      this.tone(out, at, { f: base * (1 + Math.random() * 0.2), to: base * (0.7 + Math.random() * 0.2), dur: 0.08, peak: 0.03, attack: 0.01 });
    }
  }
}

export const sound = new Sound();
