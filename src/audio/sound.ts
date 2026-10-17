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
  | 'rankUp' | 'victory' | 'defeat' | 'error' | 'coin' | 'queue' | 'catapult' | 'cannon' | 'impact' | 'spear' | 'chant' | 'convert' | 'heal'
  | 'townBell' | 'allClear' | 'research' | 'wonder' | 'wonderRising' | 'shelter' | 'bombDrop' | 'explosion' | 'mg' | 'engine' | 'shipHorn' | 'splashWater'
  | 'board' | 'relicTake' | 'relicKeep' | 'tradeLoad' | 'tradePaid' | 'tradeShare' | 'stepBack' | 'ruinFind' | 'thunder' | 'owl' | 'gull' | 'cricket' | 'frog' | 'birdsong' | 'greatWork' | 'beacon' | 'rally' | 'mammoth' | 'howl' | 'snarl' | 'landmarkTaken' | 'landmarkLost' | 'consecrate' | 'heirloom' | 'zap' | 'coilHum' | 'heroFall' | 'strikeCamp' | 'pitchCamp' | 'callUp' | 'bleat' | 'lambBleat' | 'tribute' | 'caravanBells' | 'toll' | 'wayHunters' | 'wayHearth' | 'wayWarband' | 'blood' | 'graft' | 'crash' | 'drain' | 'sacrifice' | 'curse' | 'sighting';

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
  /** Rain's hiss and snow's hush on the ambience bus, and the day they follow. */
  private weatherGain: GainNode | null = null;
  private weatherDay: { kind: string; strength: number } = { kind: 'clear', strength: 0 };
  private ambOn = false;
  private birdQuiet = false;
  /** Winter's cold wind, and the season it follows. */
  private winterGain: GainNode | null = null;
  private season = 0;
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
    'catapult', 'cannon', 'impact', 'spear', 'chant', 'convert', 'heal', 'townBell', 'allClear', 'research', 'wonder', 'wonderRising', 'shelter',
    'relicTake', 'relicKeep', 'tradeLoad', 'tradePaid', 'tradeShare', 'rankUp', 'stepBack', 'ruinFind', 'thunder', 'owl', 'gull', 'cricket', 'frog', 'birdsong', 'greatWork', 'beacon', 'rally', 'mammoth', 'howl', 'snarl', 'landmarkTaken', 'landmarkLost', 'consecrate', 'heirloom', 'zap', 'coilHum', 'heroFall', 'callUp', 'tribute', 'caravanBells', 'toll', 'wayHunters', 'wayHearth', 'wayWarband', 'blood', 'graft', 'crash', 'drain', 'sacrifice', 'curse', 'sighting',
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
      case 'sighting':
        // First sight of a ruin, relic or landmark: a hushed rising fifth on a low pad, a bell shower after.
        this.tone(out, t, { f: N.C3, dur: 2.2, peak: 0.05, attack: 0.5, lp: 600 });
        this.tone(out, t + 0.1, { f: N.G3, dur: 2.0, peak: 0.04, attack: 0.5, lp: 700 });
        [N.E5, N.G5, N.B5, N.E6].forEach((f, i) => this.bell(out, t + 0.5 + i * 0.16, f, 1.4, 0.045));
        break;
      case 'heirloom':
        // A slow peal from the new craft: a low bronze bell, then a falling change of three over its hum.
        this.bell(out, t, N.C4, 2.2, 0.08);
        [N.G5, N.E5, N.C5].forEach((f, i) => this.bell(out, t + 0.55 + i * 0.4, f, 1.6, 0.06));
        break;
      case 'stepBack':
        // Stepping back an age (#47): the epoch fanfare's notes walked downhill, ending on a low bell.
        [N.G4, N.E4, N.C4].forEach((f, i) => this.brass(out, t + i * 0.32, f, 0.9, 0.065));
        this.brass(out, t + 0.96, N.G3, 1.4, 0.06);
        this.bell(out, t + 1.0, N.C4, 1.8, 0.06);
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
      case 'rankUp':
        // A bright rising fanfare: two notes and a bell.
        this.tone(out, t, { f: N.G4, type: 'triangle', dur: 0.18, peak: 0.07, attack: 0.01 });
        this.tone(out, t + 0.1, { f: N.C5, type: 'triangle', dur: 0.3, peak: 0.07, attack: 0.01 });
        this.bell(out, t + 0.2, N.E6, 0.7, 0.04);
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
      case 'wonderRising':
        // A Wonder begins (#361): a far-off horn sounds the Wonder fanfare's opening fifth an octave down
        // and leaves it hanging. The finished Wonder's fanfare answers it.
        this.brass(out, t, N.C3, 1.4, 0.08);
        this.brass(out, t + 0.7, N.G3, 2.0, 0.08);
        this.drum(out, t, 0.18);
        this.drum(out, t + 0.7, 0.14);
        this.bell(out, t + 0.75, N.G4, 2.2, 0.03);
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
      case 'mammoth':
        // The wild (#171): a mammoth's trumpet. A brassy blare that climbs and cracks, over a rumble.
        this.tone(out, t, { f: 330, to: 620, type: 'sawtooth', dur: 0.55, peak: 0.07, attack: 0.05, lp: 2400, glide: 0.35 });
        this.tone(out, t, { f: 495, to: 930, type: 'square', dur: 0.5, peak: 0.025, attack: 0.06, lp: 2000, glide: 0.35 });
        this.tone(out, t + 0.5, { f: 600, to: 420, type: 'sawtooth', dur: 0.4, peak: 0.05, lp: 1800 });
        this.noise(out, t, { dur: 0.8, filter: 'bandpass', f: 1200, q: 1.5, peak: 0.03, attack: 0.05 });
        this.tone(out, t, { f: 60, to: 45, dur: 0.7, peak: 0.12 });
        break;
      case 'howl':
        // A wolf's howl: a breathy rise, a long held note, and a falling tail.
        this.tone(out, t, { f: 380, to: 560, dur: 0.5, peak: 0.05, attack: 0.15, glide: 0.4 });
        this.tone(out, t + 0.45, { f: 560, to: 520, dur: 0.9, peak: 0.055, attack: 0.05 });
        this.tone(out, t + 1.3, { f: 520, to: 330, dur: 0.6, peak: 0.045, attack: 0.02 });
        this.noise(out, t, { dur: 1.8, filter: 'bandpass', f: 520, q: 4, peak: 0.012, attack: 0.2 });
        break;
      case 'snarl':
        // A snarl and a snap of jaws.
        this.tone(out, t, { f: 110, to: 90, type: 'sawtooth', dur: 0.22, peak: 0.07, lp: 700 });
        this.noise(out, t, { dur: 0.2, filter: 'bandpass', f: 500, q: 1.2, peak: 0.08 });
        this.noise(out, t + 0.18, { dur: 0.04, filter: 'highpass', f: 2200, peak: 0.12 });
        break;
      case 'owl':
        // A soft, hollow hoot-hoo: a low breathy tone that dips, a short rest, a longer fall.
        this.tone(out, t, { f: 420, to: 360, dur: 0.22, peak: 0.06, attack: 0.04 });
        this.noise(out, t, { dur: 0.2, filter: 'bandpass', f: 400, q: 3, peak: 0.015, attack: 0.04 });
        this.tone(out, t + 0.3, { f: 400, to: 300, dur: 0.5, peak: 0.07, attack: 0.05 });
        this.noise(out, t + 0.3, { dur: 0.45, filter: 'bandpass', f: 380, q: 3, peak: 0.015, attack: 0.05 });
        break;
      case 'gull':
        // A gull's mew: two rising, nasal cries that break and fall away, with a little rasp.
        this.tone(out, t, { f: 1500, to: 2300, type: 'sawtooth', dur: 0.16, peak: 0.022, attack: 0.02, lp: 3200 });
        this.tone(out, t + 0.2, { f: 2200, to: 1300, type: 'sawtooth', dur: 0.3, peak: 0.02, attack: 0.02, lp: 3200 });
        this.noise(out, t + 0.02, { dur: 0.4, filter: 'bandpass', f: 2400, q: 4, peak: 0.008, attack: 0.03 });
        break;
      case 'birdsong':
        // A songbird: three quick rising whistles and a trilling fall, thin and high.
        [2600, 3000, 3400].forEach((f, i) => this.tone(out, t + i * 0.09, { f, to: f + 500, dur: 0.07, peak: 0.012, attack: 0.01, lp: 5200 }));
        for (let k = 0; k < 5; k++) this.tone(out, t + 0.36 + k * 0.045, { f: 3600 - k * 220, to: 3300 - k * 220, dur: 0.035, peak: 0.01, attack: 0.006, lp: 5200 });
        break;
      case 'cricket':
        // A cricket's chirp: a quick run of high, thin pulses, the whole run twice.
        for (let k = 0; k < 6; k++) this.tone(out, t + k * 0.055, { f: 4300, to: 4500, dur: 0.035, peak: 0.01, attack: 0.005, lp: 5200 });
        for (let k = 0; k < 6; k++) this.tone(out, t + 0.5 + k * 0.055, { f: 4300, to: 4500, dur: 0.035, peak: 0.009, attack: 0.005, lp: 5200 });
        break;
      case 'frog':
        // A frog's croak: a low, throaty pulse train that sags, then a quick answering ribbit.
        for (let k = 0; k < 4; k++) this.tone(out, t + k * 0.07, { f: 190 - k * 12, to: 150 - k * 12, type: 'square', dur: 0.06, peak: 0.016, attack: 0.008, lp: 700 });
        this.tone(out, t + 0.45, { f: 240, to: 170, type: 'square', dur: 0.09, peak: 0.014, attack: 0.01, lp: 800 });
        this.noise(out, t, { dur: 0.3, filter: 'bandpass', f: 320, q: 2, peak: 0.006, attack: 0.02 });
        break;
      case 'thunder':
        // A crack that rolls away: sharp high noise, then a long low rumble that swells and sinks.
        this.noise(out, t, { dur: 0.12, filter: 'highpass', f: 1600, peak: 0.2 });
        this.noise(out, t, { dur: 2.6, f: 260, to: 55, peak: 0.55, attack: 0.18 });
        this.noise(out, t + 0.5, { dur: 2.2, f: 180, to: 45, peak: 0.35, attack: 0.5 });
        this.tone(out, t + 0.05, { f: 52, to: 34, dur: 2.2, peak: 0.12, attack: 0.3 });
        break;
      case 'zap':
        // A Coil Tower's bolt (#231): a sharp crack, a buzzing 120 Hz snarl that dies away, a hiss of ozone.
        this.noise(out, t, { dur: 0.06, filter: 'highpass', f: 2600, peak: 0.16 });
        this.tone(out, t, { f: 120, type: 'sawtooth', dur: 0.32, peak: 0.05, lp: 1800 });
        this.tone(out, t + 0.01, { f: 2400, to: 600, type: 'square', dur: 0.12, peak: 0.018 });
        this.noise(out, t + 0.05, { dur: 0.4, filter: 'bandpass', f: 5200, q: 0.7, peak: 0.04 });
        break;
      case 'coilHum':
        // The mains hum of a Coil Tower's field (#231): 60 Hz and its octave swelling and ebbing, a thin whine on top.
        this.tone(out, t, { f: 60, type: 'sawtooth', dur: 2.4, peak: 0.035, attack: 0.7, lp: 400 });
        this.tone(out, t, { f: 120, type: 'triangle', dur: 2.4, peak: 0.03, attack: 0.9 });
        this.tone(out, t + 0.2, { f: 3200, to: 3320, dur: 1.8, peak: 0.004, attack: 0.8 });
        this.noise(out, t, { dur: 2.2, filter: 'bandpass', f: 900, q: 2, peak: 0.006, attack: 0.8 });
        break;
      case 'ruinFind':
        // Struck stone: the spade rings on something hard, earth slides, then an old mode rises out of it.
        this.tone(out, t, { f: 1250, to: 900, dur: 0.07, peak: 0.07 });
        this.bell(out, t + 0.01, N.D5 * 1.48, 0.5, 0.035);
        this.noise(out, t + 0.06, { dur: 0.45, filter: 'lowpass', f: 700, q: 0.8, peak: 0.07 });
        this.tone(out, t + 0.08, { f: 120, to: 70, dur: 0.2, peak: 0.08 });
        [N.D4, N.A4, N.C5, N.D5, N.F4 * 2].forEach((f, i) => this.bell(out, t + 0.45 + i * 0.12, f, 1.1 - i * 0.1, 0.035));
        this.tone(out, t + 0.45, { f: N.D4 / 2, type: 'triangle', dur: 1.4, peak: 0.04, attack: 0.3 });
        break;
      case 'tradeLoad':
        // Loaded at the post: a creak of harness, a thump of bales and a little string of camel bells.
        this.noise(out, t, { dur: 0.1, filter: 'bandpass', f: 380, q: 3, peak: 0.08 });
        this.tone(out, t + 0.04, { f: 110, to: 70, dur: 0.14, peak: 0.09 });
        [N.E5, N.G5, N.E5, N.A5].forEach((f, i) => this.bell(out, t + 0.12 + i * 0.09, f, 0.35, 0.025));
        break;
      case 'tradePaid':
        // Home with the gold: coins poured out, brightening, and a merchant's two-note flourish.
        for (let i = 0; i < 7; i++) this.tone(out, t + i * 0.045, { f: 1900 + ((i * 397) % 900), dur: 0.08, peak: 0.05 - i * 0.004 });
        this.noise(out, t, { dur: 0.3, filter: 'highpass', f: 5000, q: 0.7, peak: 0.03 });
        this.tone(out, t + 0.34, { f: N.A5, type: 'triangle', dur: 0.12, peak: 0.05 });
        this.tone(out, t + 0.44, { f: N.E6, type: 'triangle', dur: 0.22, peak: 0.05 });
        break;
      case 'tradeShare':
        // An ally's caravan passing through: a lighter spill of coins and one clear bell, softer than your own.
        for (let i = 0; i < 4; i++) this.tone(out, t + i * 0.05, { f: 2300 + ((i * 331) % 600), dur: 0.06, peak: 0.028 - i * 0.004 });
        this.bell(out, t + 0.2, N.E6, 0.7, 0.03);
        break;
      case 'greatWork':
        // A people's great work called: a long low horn swelling on an open fifth, then three bells.
        this.tone(out, t, { f: N.D4 / 2, type: 'sawtooth', dur: 0.9, peak: 0.07 });
        this.tone(out, t + 0.05, { f: N.A4 / 2, type: 'triangle', dur: 0.85, peak: 0.07 });
        [N.D5, N.A5, N.D5 * 2].forEach((f, i) => this.bell(out, t + 0.35 + i * 0.14, f, 1.1 - i * 0.2, 0.035));
        break;
      case 'consecrate':
        // A building won over by faith (#209): the choir swells to a full chord over a deep bell, and chimes ring out above.
        for (const f of [N.C3, N.G3, N.C4, N.E4, N.G4]) this.tone(out, t, { f, type: 'sawtooth', dur: 2, peak: 0.026, attack: 0.25, lp: 1500 });
        this.bell(out, t + 0.05, N.C3, 2.4, 0.11);
        [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => this.bell(out, t + 0.4 + i * 0.12, f, 1, 0.04));
        break;
      case 'landmarkTaken':
        // A landmark claimed: two drum strokes, then a cow-horn's rising call and a struck stone answering it.
        this.drum(out, t, 0.12);
        this.drum(out, t + 0.18, 0.09);
        this.tone(out, t + 0.3, { f: N.D4 / 2, to: N.A4 / 2, type: 'sawtooth', dur: 0.5, peak: 0.05, attack: 0.08 });
        this.tone(out, t + 0.8, { f: N.A4 / 2, type: 'sawtooth', dur: 0.75, peak: 0.045, attack: 0.05 });
        this.bell(out, t + 0.85, N.D5, 0.9, 0.03);
        break;
      case 'landmarkLost':
        // Driven off a landmark: the horn falls away, a single low drum.
        this.tone(out, t, { f: N.A4 / 2, to: N.D4 / 2.5, type: 'sawtooth', dur: 0.9, peak: 0.045, attack: 0.05 });
        this.drum(out, t + 0.5, 0.1);
        break;
      case 'beacon':
        // A fire catching: a whoosh of flame, then a horn call from the roof.
        this.noise(out, t, { dur: 0.5, filter: 'bandpass', f: 700, q: 0.8, peak: 0.12 });
        this.tone(out, t + 0.15, { f: N.D4 / 2, type: 'sawtooth', dur: 0.6, peak: 0.05 });
        this.tone(out, t + 0.45, { f: N.A4 / 2, type: 'sawtooth', dur: 0.7, peak: 0.05 });
        break;
      case 'strikeCamp':
        // A camp struck (#297): felt dropping onto the cart, then the axle creaking as the ox leans in.
        this.noise(out, t, { dur: 0.22, filter: 'lowpass', f: 380, q: 0.7, peak: 0.16 });
        this.tone(out, t + 0.2, { f: 210, to: 150, type: 'sawtooth', dur: 0.32, peak: 0.035 });
        this.tone(out, t + 0.5, { f: 180, to: 240, type: 'sawtooth', dur: 0.28, peak: 0.03 });
        break;
      case 'bleat':
      case 'lambBleat': {
        // A bleat (#308): a nasal reed voice shaking in quick pulses, sliding down, a lamb's higher and shorter.
        const lamb = name === 'lambBleat';
        const f0 = lamb ? 520 : 330;
        const n = lamb ? 5 : 7;
        for (let i = 0; i < n; i++) {
          const f = f0 * (1 - i * 0.02);
          this.tone(out, t + i * 0.055, { f, to: f * 0.97, type: 'sawtooth', dur: 0.07, peak: 0.035, attack: 0.01, lp: lamb ? 2200 : 1400 });
        }
        this.noise(out, t, { dur: n * 0.055, filter: 'bandpass', f: lamb ? 1800 : 1100, q: 3, peak: 0.01 });
        break;
      }
      case 'pitchCamp':
        // A camp pitched (#297): the lattice snapping open, two mallet knocks on the stakes, the felt settling.
        this.noise(out, t, { dur: 0.08, filter: 'bandpass', f: 2200, q: 2, peak: 0.08 });
        this.tone(out, t + 0.12, { f: 160, to: 110, dur: 0.12, peak: 0.12 });
        this.tone(out, t + 0.32, { f: 170, to: 115, dur: 0.12, peak: 0.12 });
        this.noise(out, t + 0.45, { dur: 0.35, filter: 'lowpass', f: 300, q: 0.6, peak: 0.1 });
        break;
      case 'blood':
        // Blood drawn (#355): a low windlass creak, then a thick pour into copper and a hollow drip.
        this.noise(out, t, { dur: 0.22, filter: 'bandpass', f: 420, q: 3, peak: 0.05 });
        this.tone(out, t + 0.05, { f: 95, to: 70, dur: 0.3, type: 'triangle', peak: 0.1 });
        this.noise(out, t + 0.2, { dur: 0.4, filter: 'lowpass', f: 700, q: 0.8, peak: 0.07 });
        this.tone(out, t + 0.62, { f: 330, to: 250, dur: 0.1, peak: 0.05 });
        break;
      case 'graft':
        // A graft (#355 s3): a pump's two strokes, a hiss of pressure, then a slow low heartbeat.
        [0, 0.18].forEach((d) => this.noise(out, t + d, { dur: 0.12, filter: 'bandpass', f: 900, q: 4, peak: 0.05 }));
        this.noise(out, t + 0.34, { dur: 0.3, filter: 'highpass', f: 2600, q: 0.7, peak: 0.035 });
        [0.62, 0.8, 1.32, 1.5].forEach((d, i) => this.tone(out, t + d, { f: i % 2 ? 48 : 58, to: 40, dur: 0.14, type: 'sine', peak: i % 2 ? 0.1 : 0.14 }));
        break;
      case 'drain':
        // Hemocraft's drain (#355 s2): a wet suck up a rubber hose, a valve's tick, and the pump's slow low stroke.
        this.noise(out, t, { dur: 0.3, filter: 'bandpass', f: 260, q: 2.5, peak: 0.05 });
        this.tone(out, t + 0.04, { f: 140, to: 62, dur: 0.32, type: 'triangle', peak: 0.06 });
        this.noise(out, t + 0.36, { dur: 0.03, filter: 'highpass', f: 3200, q: 1, peak: 0.03 });
        this.tone(out, t + 0.42, { f: 52, to: 44, dur: 0.24, type: 'sine', peak: 0.08 });
        break;
      case 'sacrifice':
        // The Blood-rite's offering (#355 s4): a deep gong struck once, a thin cry that is cut off, then a slow pour into a bowl.
        this.tone(out, t, { f: 72, to: 58, dur: 1, type: 'sine', peak: 0.16 });
        this.tone(out, t, { f: 144, to: 130, dur: 0.7, type: 'triangle', peak: 0.04 });
        this.tone(out, t + 0.12, { f: 620, to: 380, dur: 0.22, type: 'sawtooth', peak: 0.03, lp: 1800 });
        this.noise(out, t + 0.5, { dur: 0.5, filter: 'lowpass', f: 650, q: 0.8, peak: 0.07 });
        this.tone(out, t + 1.05, { f: 310, to: 240, dur: 0.1, peak: 0.05 });
        break;
      case 'curse':
        // A curse laid (#355 s4): a whispering breath, a drone on a tritone that sours, and one low thud as it lands.
        this.noise(out, t, { dur: 0.6, filter: 'bandpass', f: 1500, q: 5, peak: 0.035 });
        this.tone(out, t + 0.05, { f: 110, to: 104, dur: 0.75, type: 'sawtooth', peak: 0.04, lp: 700 });
        this.tone(out, t + 0.05, { f: 156, to: 148, dur: 0.75, type: 'sawtooth', peak: 0.03, lp: 700 });
        this.tone(out, t + 0.78, { f: 62, to: 44, dur: 0.3, type: 'sine', peak: 0.12 });
        break;
      case 'crash':
        // A graft run dry (#355 s3): the heartbeat stumbles and a falling, sour groan.
        [0, 0.16, 0.52].forEach((d) => this.tone(out, t + d, { f: 55, to: 38, dur: 0.14, type: 'sine', peak: 0.12 }));
        this.tone(out, t + 0.7, { f: 220, to: 92, dur: 0.6, type: 'sawtooth', peak: 0.03 });
        break;
      case 'callUp':
        // The call to arms (#313): a bugle's assembly, four notes up the major chord, over a snare roll.
        [N.G4, N.C5, N.E5, N.G5].forEach((f, i) => this.tone(out, t + i * 0.13, { f, type: 'square', dur: i === 3 ? 0.42 : 0.12, peak: 0.035 }));
        for (let i = 0; i < 8; i++) this.noise(out, t + 0.05 + i * 0.07, { dur: 0.05, filter: 'bandpass', f: 2600, q: 1.2, peak: 0.03 + i * 0.006 });
        this.tone(out, t + 0.6, { f: 120, to: 70, dur: 0.18, peak: 0.1 });
        break;
      case 'caravanBells':
        // A caravan home to a camp that moved (the Silk Road, #326): the hollow bronze bells under a camel's chin,
        // swaying low and lopsided with its stride, then the coins of the longer road poured out.
        [[N.D4, 0], [N.E4, 0.21], [N.D4, 0.38], [N.F4, 0.62], [N.D4, 0.8]].forEach(([f, dt], i) => this.bell(out, t + dt, f, 0.9, 0.05 - i * 0.005));
        for (let i = 0; i < 6; i++) this.tone(out, t + 0.95 + i * 0.05, { f: 1800 + ((i * 397) % 900), dur: 0.08, peak: 0.045 - i * 0.004 });
        this.noise(out, t + 0.95, { dur: 0.28, filter: 'highpass', f: 5000, q: 0.7, peak: 0.025 });
        break;
      case 'toll':
        // Safe passage (#334): the toll-keeper's staff knocked twice on the gate's beam, and coins counted out one by one onto a brass tray.
        this.noise(out, t, { dur: 0.05, filter: 'bandpass', f: 380, q: 2, peak: 0.07 });
        this.tone(out, t, { f: 210, to: 150, dur: 0.07, peak: 0.07 });
        this.noise(out, t + 0.16, { dur: 0.05, filter: 'bandpass', f: 340, q: 2, peak: 0.06 });
        this.tone(out, t + 0.16, { f: 190, to: 140, dur: 0.07, peak: 0.06 });
        for (let i = 0; i < 4; i++) this.tone(out, t + 0.36 + i * 0.11, { f: 2100 + ((i * 277) % 500), dur: 0.09, peak: 0.04 - i * 0.004 });
        this.bell(out, t + 0.82, N.A4 * 2, 0.5, 0.02);
        break;
      case 'wayHunters':
        // The Hunters' Way: a hollow bone whistle calls twice, then a spear butt thumps the earth.
        this.tone(out, t, { f: 880, to: 1100, dur: 0.18, peak: 0.05 });
        this.tone(out, t + 0.24, { f: 990, to: 1320, dur: 0.22, peak: 0.05 });
        this.noise(out, t + 0.55, { dur: 0.06, filter: 'bandpass', f: 260, q: 2, peak: 0.07 });
        this.tone(out, t + 0.55, { f: 120, to: 70, dur: 0.12, peak: 0.09 });
        break;
      case 'wayHearth':
        // The Hearth Way: a fire catching (crackle), then a warm low hum of voices round it.
        this.noise(out, t, { dur: 0.3, filter: 'highpass', f: 3200, q: 0.8, peak: 0.03 });
        for (let i = 0; i < 4; i++) this.noise(out, t + 0.05 + i * 0.08, { dur: 0.02, filter: 'bandpass', f: 2200 + ((i * 611) % 1500), q: 3, peak: 0.04 });
        this.tone(out, t + 0.3, { f: N.D4 / 2, dur: 0.7, peak: 0.05 });
        this.tone(out, t + 0.3, { f: N.A4 / 2, dur: 0.7, peak: 0.035 });
        break;
      case 'wayWarband':
        // The Warband Way: three blows on a shield, the last one held by a low horn.
        for (let i = 0; i < 3; i++) {
          this.noise(out, t + i * 0.17, { dur: 0.06, filter: 'bandpass', f: 700, q: 1.5, peak: 0.08 });
          this.tone(out, t + i * 0.17, { f: 150, to: 90, dur: 0.1, peak: 0.09 });
        }
        this.tone(out, t + 0.5, { f: N.D4 / 2, type: 'sawtooth', dur: 0.5, peak: 0.05 });
        break;
      case 'tribute':
        // Tribute (#318): a horse snorting and stamping where it stands, then a purse of coins tipped into a saddlebag.
        this.noise(out, t, { dur: 0.16, filter: 'bandpass', f: 900, q: 1.4, peak: 0.05 });
        this.tone(out, t + 0.18, { f: 95, to: 60, dur: 0.08, peak: 0.08 });
        this.tone(out, t + 0.3, { f: 90, to: 58, dur: 0.08, peak: 0.07 });
        for (let i = 0; i < 5; i++) this.tone(out, t + 0.42 + i * 0.05, { f: 1700 + ((i * 433) % 800), dur: 0.07, peak: 0.04 - i * 0.005 });
        this.noise(out, t + 0.42, { dur: 0.22, filter: 'highpass', f: 4500, q: 0.7, peak: 0.02 });
        break;
      case 'rally':
        // A war horn: a low rising call, then a bright answer over it.
        this.tone(out, t, { f: N.D4 / 2, to: N.A4 / 2, type: 'sawtooth', dur: 0.55, peak: 0.07 });
        this.tone(out, t + 0.35, { f: N.A4, type: 'square', dur: 0.4, peak: 0.04 });
        this.noise(out, t + 0.3, { dur: 0.25, filter: 'bandpass', f: 1800, q: 1, peak: 0.05 });
        break;
      case 'heroFall':
        // A low toll, twice, with a thud of the body under it.
        this.bell(out, t + 0.1, N.D4 / 2, 1.8, 0.1);
        this.bell(out, t + 0.7, N.A4 / 4, 2.2, 0.08);
        this.tone(out, t, { f: 110, to: 45, dur: 0.4, peak: 0.12 });
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
    // Rain: a bright hiss with a soft patter under it. Snow: only a muffled hush. Both start silent.
    const rain = ctx.createBufferSource();
    rain.buffer = this.pinkBuf;
    rain.loop = true;
    const hiss = ctx.createBiquadFilter();
    hiss.type = 'highpass';
    hiss.frequency.value = 1400;
    const patter = ctx.createBiquadFilter();
    patter.type = 'lowpass';
    patter.frequency.value = 7000;
    this.weatherGain = ctx.createGain();
    this.weatherGain.gain.value = 0;
    rain.connect(hiss).connect(patter).connect(this.weatherGain).connect(this.amb);
    rain.start(0, 1.7);
    // Winter: a thin, hollow wind that swells and sinks, a bandpass sweeping slowly across the cold air.
    const cold = ctx.createBufferSource();
    cold.buffer = this.pinkBuf;
    cold.loop = true;
    const hollow = ctx.createBiquadFilter();
    hollow.type = 'bandpass';
    hollow.frequency.value = 520;
    hollow.Q.value = 5;
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.07;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 180;
    sweep.connect(sweepDepth).connect(hollow.frequency);
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.11;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.5;
    this.winterGain = ctx.createGain();
    this.winterGain.gain.value = 0;
    gust.connect(gustDepth).connect(this.winterGain.gain);
    cold.connect(hollow).connect(this.winterGain).connect(this.amb);
    cold.start(0, 5.3);
    sweep.start();
    gust.start();
    this.setSeason(this.season);
    this.setWeather(this.weatherDay.kind, this.weatherDay.strength);
    if (!this.offline) this.scheduleBirds();
  }

  /** Let the season be heard: winter brings a hollow wind and silences the songbirds. */
  setSeason(season: number): void {
    this.season = season;
    if (!this.ctx || !this.winterGain) return;
    this.winterGain.gain.setTargetAtTime(season === 3 ? 0.5 : 0, this.ctx.currentTime, 2.5);
  }

  /** Let the day's weather be heard: rain hisses, snow hushes, mist and clear skies add nothing. */
  setWeather(kind: string, strength: number): void {
    this.weatherDay = { kind, strength };
    if (!this.ctx || !this.weatherGain) return;
    const level = kind === 'rain' ? 0.55 * strength : kind === 'snow' ? 0.05 * strength : 0;
    this.weatherGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
    // Fewer birds sing in the rain.
    this.birdQuiet = kind === 'rain' || kind === 'snow';
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
      if (!this.birdQuiet && this.season !== 3) this.bird();
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
