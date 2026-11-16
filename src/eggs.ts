// Easter eggs. Nothing here is documented in the UI on purpose.
import { airhorn, blip, pullUp } from './audio';
import { toast } from './ui-bits';

export function installEggs(hooks: { pullUp(): void; keeper(text: string): void; crowd(text: string): void; dubplate(): void }) {
  const konami = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let ki = 0; let typed = '';
  window.addEventListener('keydown', e => {
    const tag = (e.target as HTMLElement).tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    ki = k === konami[ki] ? ki + 1 : (k === konami[0] ? 1 : 0);
    if (ki === konami.length) { ki = 0; hooks.dubplate(); toast('BACK ROOM OPEN. DUBPLATES ONLY.'); hooks.keeper('shh. these are not for sale either.'); for (let i = 0; i < 4; i++) setTimeout(() => blip(400 + i * 200, 0.08), i * 90); }
    if (k.length === 1) { typed = (typed + k).slice(-10); }
    if (typed.endsWith('rewind') || typed.endsWith('wheel')) { typed = ''; hooks.pullUp(); }
    if (typed.endsWith('bo')) { /* wait for bo bo bo */ }
    if (typed.endsWith('bobobo')) { typed = ''; airhorn(); hooks.crowd('BO BO BO'); }
    if (typed.endsWith('tea')) { typed = ''; hooks.keeper('kettle is on. two sugars.'); }
  });
  // Logo: seven clicks for disco mode
  let clicks = 0, ct = 0;
  document.getElementById('logo')!.addEventListener('click', () => {
    clicks++; clearTimeout(ct); ct = window.setTimeout(() => { clicks = 0; }, 1200);
    if (clicks === 7) { clicks = 0; document.body.classList.add('disco'); toast('DISCO MODE'); hooks.crowd('lights!'); setTimeout(() => document.body.classList.remove('disco'), 20000); }
  });
  // Midnight: the keeper notices
  const hr = new Date().getHours(); if (hr >= 1 && hr < 5) setTimeout(() => hooks.keeper('bit late for shopping innit.'), 15000);
}
export const eggPullUp = pullUp;
