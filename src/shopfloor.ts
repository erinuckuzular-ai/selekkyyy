// Shop floor: punters wander in from the door, browse, dance when a tune is on. Click one to bounce them.
// Characters are original pixel sprites drawn with box-shadow.
import { blip } from './audio';
import { h } from './ui-bits';

const SKINS = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#5c3a1e'];
const TOPS = ['#ff2a6d', '#05d9e8', '#ffe600', '#2bff88', '#d300c5', '#ffffff', '#ff8c00'];
const LINES_BROWSE = ['got any Sylvia?', 'is this the 7"?', 'how much?', 'FREE?? mad', 'play that one', 'got this on tape', 'my dad had this', 'bit quiet in here', 'can I touch the decks', 'what rpm is this'];
const LINES_DANCE = ['TUNE', 'pull up!', 'wheel it', 'one more time', 'oi oi', 'big one', 'that bassline tho', 'rewind!', 'selecta!!', 'phone in the air'];
const LINES_KICKED = ['oi!', 'I was buying that', 'rude', 'I know the owner', 'unsubscribed', 'banned??'];
const KEEPER = ['crate by the door is fresh.', 'try 45 on a 33. go on.', 'drag the arm. cue it.', 'the bag checks out free.', 'konami code works here.', 'needle drop pays nothing. pride only.', 'bounce the ones who film.', 'the vault is behind the counter.', 'siren is for emergencies and tunes.', 'click me again, I am busy.'];

type Px = [number, number, string];
function sprite(skin: string, top: string, legs: string, hat?: string): Px[] {
  const p: Px[] = [];
  const fill = (x0: number, y0: number, w: number, hgt: number, c: string) => { for (let y = y0; y < y0 + hgt; y++) for (let x = x0; x < x0 + w; x++) p.push([x, y, c]); };
  if (hat) fill(1, 0, 4, 1, hat);
  fill(1, 1, 4, 3, skin); fill(2, 2, 1, 1, '#000'); fill(4, 2, 1, 1, '#000');
  fill(1, 4, 4, 4, top); fill(0, 4, 1, 3, top); fill(5, 4, 1, 3, top);
  fill(1, 8, 2, 3, legs); fill(3, 8, 2, 3, legs); fill(1, 11, 2, 1, '#000'); fill(3, 11, 2, 1, '#000');
  return p;
}
function render(el: HTMLElement, px: Px[]) {
  const i = document.createElement('i'); i.className = 'px';
  i.style.boxShadow = px.map(([x, y, c]) => `${x * 4}px ${y * 4}px 0 ${c}`).join(',');
  i.style.background = 'transparent'; el.append(i);
}
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function createFloor(root: HTMLElement, state: { playing(): boolean }) {
  const walkway = root.querySelector<HTMLElement>('#walkway')!;
  const bouncedEl = root.querySelector<HTMLElement>('#bounced')!, inEl = root.querySelector<HTMLElement>('#inshop')!;
  const keeper = root.querySelector<HTMLElement>('#keeper')!, says = root.querySelector<HTMLElement>('#keeperSays')!;
  render(keeper, sprite('#c68642', '#000', '#222', '#ffe600'));
  let bounced = 0; let keeperIdx = 0;
  const people = new Set<{ el: HTMLElement; x: number; dir: number; speed: number; mode: 'walk' | 'browse' | 'dance' | 'leave'; until: number; bubble: HTMLElement | null }>();
  const W = () => 1600;
  function say(el: HTMLElement, text: string, ms = 1800) {
    el.querySelector('.say')?.remove(); const b = h(`<div class="say">${text}</div>`); el.append(b); setTimeout(() => b.remove(), ms);
  }
  function spawn() {
    if (people.size >= 9) return;
    const el = h('<div class="person walk"></div>');
    render(el, sprite(pick(SKINS), pick(TOPS), pick(['#223', '#1a1a1a', '#445', '#6a2a8a']), Math.random() < 0.3 ? pick(TOPS) : undefined));
    const p = { el, x: W() - 60, dir: -1, speed: 18 + Math.random() * 22, mode: 'walk' as const, until: performance.now() + 2000 + Math.random() * 5000, bubble: null };
    el.style.left = `${p.x}px`; walkway.append(el); people.add(p as any);
    el.addEventListener('click', () => {
      if (el.classList.contains('kicked')) return;
      el.classList.remove('walk', 'dance'); el.classList.add('kicked'); say(el, pick(LINES_KICKED), 700);
      blip(180, 0.15, 0.1); setTimeout(() => blip(120, 0.2, 0.1), 80);
      bounced++; bouncedEl.textContent = `BOUNCED ${bounced}`; people.delete(p as any); setTimeout(() => el.remove(), 900); updateCount();
      try { const n = Number(localStorage.getItem('bounced') || 0) + 1; localStorage.setItem('bounced', String(n)); } catch { /* */ }
    });
    updateCount();
  }
  function updateCount() { inEl.textContent = `IN SHOP ${people.size}`; }
  let last = performance.now();
  function tick(t: number) {
    requestAnimationFrame(tick); const dt = Math.min(0.1, (t - last) / 1000); last = t; const playing = state.playing();
    for (const p of people) {
      if (t > p.until) {
        const r = Math.random();
        if (p.mode === 'leave') { /* keep walking out */ }
        else if (playing && r < 0.55) { p.mode = 'dance'; say(p.el, pick(LINES_DANCE)); p.until = t + 2500 + Math.random() * 4000; }
        else if (r < 0.75) { p.mode = 'browse'; if (Math.random() < 0.5) say(p.el, pick(LINES_BROWSE)); p.until = t + 2000 + Math.random() * 4000; }
        else if (r < 0.9) { p.mode = 'walk'; p.dir = Math.random() < 0.5 ? -1 : 1; p.until = t + 1500 + Math.random() * 3000; }
        else { p.mode = 'leave'; p.dir = 1; p.until = t + 60000; }
        p.el.classList.toggle('walk', p.mode === 'walk' || p.mode === 'leave'); p.el.classList.toggle('dance', p.mode === 'dance');
      }
      if (p.mode === 'walk' || p.mode === 'leave') {
        p.x += p.dir * p.speed * dt;
        if (p.x < 250) { p.x = 250; p.dir = 1; } if (p.mode !== 'leave' && p.x > W() - 130) { p.x = W() - 130; p.dir = -1; }
        if (p.mode === 'leave' && p.x > W() - 30) { p.el.remove(); people.delete(p); updateCount(); continue; }
        p.el.style.left = `${p.x}px`; p.el.style.scale = p.dir < 0 ? '1 1' : '-1 1';
      }
    }
  }
  requestAnimationFrame(tick);
  setInterval(() => { if (Math.random() < (state.playing() ? 0.7 : 0.35)) spawn(); }, 4000);
  setTimeout(spawn, 1500);
  keeper.addEventListener('click', () => { says.hidden = false; says.textContent = KEEPER[keeperIdx++ % KEEPER.length]; blip(660, 0.05, 0.05); clearTimeout((keeper as any)._t); (keeper as any)._t = setTimeout(() => { says.hidden = true; }, 2600); });
  return {
    keeperSay(text: string, ms = 3000) { says.hidden = false; says.textContent = text; clearTimeout((keeper as any)._t); (keeper as any)._t = setTimeout(() => { says.hidden = true; }, ms); },
    crowdShout(text: string) { for (const p of people) if (Math.random() < 0.5) say(p.el, text); },
    get bounced() { return bounced; },
  };
}
