/**
 * A welcome for a phone or tablet with no mouse (#896): the game is built for a mouse, so say so kindly
 * and offer to send the link to a computer, or play on anyway. Asked once per browser.
 */
const KEY = 'ages.phoneWelcome';

export function phoneWelcome(host: HTMLElement): void {
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === '1';
  } catch {
    // Private windows may refuse storage; ask again next time.
  }
  if (!touchOnly || seen) return;
  const url = `${location.origin}${location.pathname}`;
  const el = document.createElement('div');
  el.className = 'modal phone-welcome';
  el.innerHTML = `<div class="card" role="dialog" aria-labelledby="pw-h">
    <h2 id="pw-h">Ages of Earth</h2>
    <p>A real-time strategy game made for a <b>laptop or desktop with a mouse</b>: drag to select, right-click to command, keys for the rest.</p>
    <p class="sel-sub">Send yourself the link and play it there, or look around here first.</p>
    <div class="row">
      <button class="btn wide primary" data-pw="send">Send me the link</button>
      <button class="btn wide" data-pw="stay">Look around anyway</button>
    </div>
    <p class="sel-sub"><a href="guide/">Read how to play</a> · <a href="peoples/">the peoples</a> · <a href="ages/">the ages</a></p>
  </div>`;
  const close = () => {
    el.remove();
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Nothing to keep.
    }
  };
  el.addEventListener('click', async (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-pw]')?.dataset.pw;
    if (act === 'stay') close();
    if (act !== 'send') return;
    const btn = e.target as HTMLButtonElement;
    try {
      if (navigator.share) await navigator.share({ title: 'Ages of Earth', text: 'Play Ages of Earth on my computer:', url });
      else {
        await navigator.clipboard.writeText(url);
        btn.textContent = 'Link copied';
      }
    } catch {
      btn.textContent = url;
    }
  });
  host.appendChild(el);
}
