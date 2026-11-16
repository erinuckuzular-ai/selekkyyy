import { crateBySlug, byId } from './catalogue';
import { createShop } from './shop3d';
import { bag, prefs, queue } from './store';
import { parse } from './router';
import { player, playQueue } from './player';
import { loadFires, renderBag, renderBrowse, setCrateFocus, showCrate, showRequests, showSharedBag, showTrack, startRadio, toggleBag, wireNowBar } from './ui';
import { h } from './ui-bits';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const canvas = $<HTMLCanvasElement>('#scene');
const browse = $('#browse');
const hint = $('#hint');
let labelEl: HTMLElement | null = null;

const shop = createShop(canvas, {
  onCrate: slug => showCrate(slug),
  onDeck: () => { if (player.currentId) showTrack(player.currentId, true, false); else startRadio(); },
  onHover: (t, x, y) => {
    if (!t) { labelEl?.remove(); labelEl = null; return; }
    if (!labelEl) { labelEl = h('<div class="label3d"></div>'); document.getElementById('app')!.append(labelEl); }
    labelEl.innerHTML = `${t.title}<small>${t.sub}</small>`; labelEl.style.left = `${x}px`; labelEl.style.top = `${y - 14}px`;
  },
});
setCrateFocus(slug => { if (view === 'shop') shop.focusCrate(slug); });

let view: 'shop' | 'browse' = prefs.view;
function setView(v: 'shop' | 'browse') {
  view = v; prefs.view = v;
  const isShop = v === 'shop';
  canvas.classList.toggle('hidden', !isShop); browse.hidden = isShop;
  shop.setActive(isShop); hint.hidden = !isShop;
  $('#viewToggle').textContent = isShop ? 'Browse' : 'Walk in';
  if (!isShop) renderBrowse();
}
$('#viewToggle').addEventListener('click', () => setView(view === 'shop' ? 'browse' : 'shop'));
$('#radioBtn').addEventListener('click', startRadio);
$('#requestBtn').addEventListener('click', showRequests);
$('#bagBtn').addEventListener('click', () => toggleBag());
bag.ev.on(renderBag); renderBag();
wireNowBar();
queue.ev.on(() => { const id = queue.current(); shop.setNowPlaying(id ? byId.get(id)!.crate : null, true); });
player.onState(s => { const id = player.currentId; shop.setNowPlaying(id ? byId.get(id)!.crate : null, s === 'playing'); });

// Intro + routing
const intro = $('#intro');
const route = parse();
const isPhone = matchMedia('(max-width: 720px)').matches;
function enter(v: 'shop' | 'browse') {
  intro.classList.add('gone'); setView(v);
  setTimeout(() => hint.classList.add('fade'), 7000);
  applyRoute(true);
}
$('#enterBtn').addEventListener('click', () => enter('shop'));
$('#browseBtn').addEventListener('click', () => enter('browse'));
if (route.kind !== 'home') {
  // Deep link: show what was shared behind the intro so the first click also unlocks audio.
  $('#enterBtn').textContent = route.kind === 'radio' ? 'Turn on the radio' : 'Step inside and play';
}
if (isPhone && route.kind === 'home') $('#browseBtn').textContent = 'Browse (lighter on phones)';

function applyRoute(userGesture: boolean) {
  const r = parse();
  if (r.kind === 'track') { if (crateBySlug.has(byId.get(r.id)?.crate ?? '')) showTrack(r.id, false, userGesture, r.t ?? 0); }
  else if (r.kind === 'crate') showCrate(r.slug, false);
  else if (r.kind === 'bag') showSharedBag(r.ids);
  else if (r.kind === 'radio' && userGesture) startRadio();
}
window.addEventListener('popstate', () => applyRoute(false));
document.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-link]'); if (a) { e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); $('#panel').hidden = true; } });
loadFires();
// Keep the 3D scene idle until the user steps in; the intro is on top anyway.
shop.setActive(false);
export { playQueue };
