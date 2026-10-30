import { AGES, CIVS } from '../sim/data';
import type { GameState } from '../sim/types';
import { staysOf } from './journeyReport';

/**
 * The end screen's Share button (#896): a 1200×630 picture of the match (the outcome, the people,
 * the road walked through the ages) with a line of text and a link a friend can open to play the
 * same world. The phone's share sheet takes it where there is one; elsewhere the picture downloads
 * and the text is copied.
 */
export interface ShareInput {
  s: GameState;
  viewer: number;
  won: boolean;
  /** The tick the match ended. */
  end: number;
  minutes: number;
  /** A link to the same world (seed, map, size), or none for chapters and online rooms. */
  world?: string;
}

const AGE_COLORS = ['#c7b48a', '#d8924a', '#a9b6c8', '#d0705a', '#7fa6bf', '#9fd18a'];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = src;
  });
}

/** The road walked: each age once per stay, steps back marked. */
function road(inp: ShareInput): { name: string; tier: number; back: boolean }[] {
  return staysOf(inp.s.players[inp.viewer], inp.end).map((st) => ({ name: AGES[st.age].name, tier: AGES[st.age].tier, back: st.back }));
}

export function shareText(inp: ShareInput): string {
  const p = inp.s.players[inp.viewer];
  const ages = road(inp).map((r) => r.name);
  const time = inp.minutes < 1 ? 'under a minute' : `${inp.minutes} minute${inp.minutes === 1 ? '' : 's'}`;
  return `${inp.won ? 'Victory' : 'Defeat'} as the ${CIVS[p.civ].name} in ${time} in Ages of Earth. My road: ${ages.join(' → ')}.${inp.world ? ' Play the same world:' : ' Play free in your browser:'}`;
}

export async function drawShareCard(inp: ShareInput): Promise<HTMLCanvasElement> {
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const p = inp.s.players[inp.viewer];
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1b2230');
  bg.addColorStop(1, '#0e1621');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // The player's colour as a glow behind the outcome.
  const glow = g.createRadialGradient(260, 170, 10, 260, 170, 520);
  glow.addColorStop(0, `${p.color}55`);
  glow.addColorStop(1, '#0000');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // A canvas draws only faces already loaded: ask for the title's two first.
  await Promise.all(['800 104px Cinzel', '800 34px Nunito', '700 22px Nunito'].map((f) => document.fonts?.load(f).catch(() => [])));
  const serif = "'Cinzel', Georgia, serif", sans = "'Nunito', system-ui, sans-serif";
  const icon = await loadImage(new URL('icon.svg', location.href).toString());
  if (icon) g.drawImage(icon, 64, 52, 64, 64);
  g.fillStyle = '#e8c46a';
  g.font = `800 34px ${serif}`;
  g.textBaseline = 'middle';
  g.fillText('Ages of Earth', 146, 86);

  g.textBaseline = 'alphabetic';
  g.font = `800 104px ${serif}`;
  g.fillStyle = inp.won ? '#ffdf8a' : '#d6dbe4';
  g.fillText(inp.won ? 'Victory' : 'Defeat', 64, 238);
  g.font = `700 34px ${sans}`;
  g.fillStyle = '#eef1f6';
  const time = inp.minutes < 1 ? 'under a minute' : `${inp.minutes} minute${inp.minutes === 1 ? '' : 's'}`;
  g.fillText(`as the ${CIVS[p.civ].name}, in ${time}`, 68, 292);

  // The road through the ages, as chips that wrap.
  g.font = `700 22px ${sans}`;
  g.fillStyle = '#9aa3b5';
  g.fillText('The road walked', 68, 356);
  let x = 64, y = 376;
  const legs = road(inp);
  for (const [i, r] of legs.entries()) {
    const label = `${r.back ? '↩ ' : ''}${r.name}`;
    g.font = `800 22px ${sans}`;
    const w = g.measureText(label).width + 28;
    if (x + w > W - 64) {
      x = 64;
      y += 52;
    }
    if (y > 480) break;
    g.fillStyle = '#18202d';
    g.strokeStyle = AGE_COLORS[Math.min(r.tier, AGE_COLORS.length - 1)];
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(x, y, w, 40, 20);
    g.fill();
    g.stroke();
    g.fillStyle = '#eef1f6';
    g.fillText(label, x + 14, y + 28);
    x += w + 10;
    if (i < legs.length - 1 && x + 30 < W - 64) {
      g.fillStyle = '#6b7488';
      g.fillText('→', x, y + 28);
      x += 32;
    }
  }

  const st = p.stats;
  g.font = `700 24px ${sans}`;
  g.fillStyle = '#b9c1cf';
  g.fillText(`Built ${st.built} · Trained ${st.trained} · Kills ${st.kills} · Techs ${st.techs}`, 68, 548);
  g.font = `800 24px ${sans}`;
  g.fillStyle = '#ffdf8a';
  const play = `Play free at ${location.host || 'Ages of Earth'}`;
  g.fillText(play, W - 64 - g.measureText(play).width, 548);
  // The five epochs' colours along the foot, as on the title.
  AGE_COLORS.slice(0, 5).forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(64 + i * 220, 584, 208, 8);
  });
  return c;
}

/** Share the card: the share sheet where it takes files, else download it and copy the text. Says what happened. */
export async function shareMatch(inp: ShareInput, toast: (msg: string, kind: 'info' | 'bad') => void): Promise<void> {
  const canvas = await drawShareCard(inp);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
  const url = inp.world ?? `${location.origin}${location.pathname}`;
  const text = shareText(inp);
  if (!blob) return toast('The picture could not be made', 'bad');
  const file = new File([blob], 'ages-of-earth-match.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text} ${url}`, title: 'Ages of Earth' });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Picture saved, and the text and link copied: paste them with it', 'info');
  } catch {
    toast('Picture saved', 'info');
  }
}
