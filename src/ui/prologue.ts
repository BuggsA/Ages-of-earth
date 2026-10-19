/**
 * The title screen's trailer, and the step from it into a match. Only what is shown: no rules, no state.
 * The trailer plays once a session over the title's own world (letterbox, four beats, the wordmark landing) and
 * any key or click skips it. Pressing Play pushes the camera in, fades to black, starts the match under
 * the dark and opens on the people you lead. Automation and a calm-motion preference get neither
 * (`?intro=1` forces them), so tests and anyone who asks for less motion go straight through.
 */
const SEEN = 'ages-intro-seen';
const LENGTH = 12600;
const STEP_IN = 1500;
const STEP_HOLD = 2200;

const forced = (): boolean => new URLSearchParams(location.search).get('intro') === '1';
export const calm = (): boolean => !forced() && (!!navigator.webdriver || matchMedia('(prefers-reduced-motion: reduce)').matches);

function seen(): boolean {
  try {
    return sessionStorage.getItem(SEEN) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN, '1');
  } catch {
    /* private window: the trailer just plays again next time */
  }
}

export class Prologue {
  private timer = 0;
  private stepping = false;

  constructor(private title: HTMLElement, private adventure: HTMLElement) {
    this.embers();
    document.addEventListener('keydown', () => this.skip());
    title.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'customize') this.customize();
      else if (act === 'replay-intro') this.replay();
      else this.skip();
    });
  }

  /** Called when the title first shows: the trailer, or straight to the menu when it was seen or isn't wanted. */
  begin(): void {
    if (calm() || (seen() && !forced())) {
      this.title.classList.add('intro-done');
      return;
    }
    this.play();
  }

  private play(): void {
    window.clearTimeout(this.timer);
    this.title.classList.remove('intro-done', 'customizing');
    this.title.classList.remove('intro-run');
    void this.title.offsetWidth;
    this.title.classList.add('intro-run');
    this.timer = window.setTimeout(() => this.end(), LENGTH);
  }

  replay(): void {
    if (!calm()) this.play();
  }

  /** Any key or click while the trailer plays goes straight to the menu. */
  skip(): void {
    if (this.title.classList.contains('intro-run')) this.end();
  }

  private end(): void {
    window.clearTimeout(this.timer);
    this.title.classList.remove('intro-run');
    this.title.classList.add('intro-done');
    markSeen();
  }

  /** The match settings slide over the menu and back. */
  customize(): void {
    const on = this.title.classList.toggle('customizing');
    this.title.querySelector('[data-act="customize"]')?.setAttribute('aria-expanded', String(on));
  }

  /** "Random people · Normal": what Play will start, in a line. */
  summary(people: string, difficulty: string): void {
    const el = this.title.querySelector('#match-line');
    if (el) el.textContent = `${people} · ${difficulty}`;
  }

  /**
   * Press Play: the menu leaves and the camera pushes in; under the dark `begin` starts the match and says whom
   * you lead and in which age; the dark lifts on a camera easing back out.
   */
  stepIn(begin: () => { people: string; age: string }): void {
    if (calm()) {
      begin();
      return;
    }
    if (this.stepping) return;
    this.stepping = true;
    document.body.classList.add('stepping');
    this.title.classList.add('stepping');
    this.adventure.classList.add('dark');
    window.setTimeout(() => {
      const { people, age } = begin();
      (this.adventure.querySelector('#adv-people') as HTMLElement).textContent = people;
      (this.adventure.querySelector('#adv-age') as HTMLElement).textContent = age;
      this.adventure.classList.add('show');
      document.body.classList.remove('stepping');
      this.title.classList.remove('stepping');
      window.setTimeout(() => {
        this.adventure.classList.remove('show', 'dark');
        document.body.classList.add('adventure-in');
        window.setTimeout(() => {
          document.body.classList.remove('adventure-in');
          this.stepping = false;
        }, 3000);
      }, STEP_HOLD);
    }, STEP_IN);
  }

  /** Sparks rising off the world: a few dozen CSS-animated specks. */
  private embers(): void {
    const box = this.title.querySelector('#embers');
    if (!box) return;
    for (let i = 0; i < 34; i++) {
      const e = document.createElement('i');
      e.style.setProperty('--x', `${(Math.random() * 100).toFixed(1)}%`);
      e.style.setProperty('--s', `${(2 + Math.random() * 4).toFixed(1)}px`);
      e.style.setProperty('--d', `${(9 + Math.random() * 11).toFixed(1)}s`);
      e.style.setProperty('--t', `${(-Math.random() * 20).toFixed(1)}s`);
      e.style.setProperty('--w', `${(-40 + Math.random() * 80).toFixed(0)}px`);
      box.appendChild(e);
    }
  }
}
