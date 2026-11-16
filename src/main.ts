import { byId, crateBySlug, crates, thumb, tracks, tracksIn, type Track } from './catalogue';
import { Deck } from './deck';
import { players, next } from './player';
import { bag, queue } from './store';
import { parse, go, url } from './router';
import { airhorn, pullUp, siren, surface, unlockAudio, blip } from './audio';
import { rigs, rigById } from './rigs';
import { createFloor } from './shopfloor';
import { startGame } from './game';
import { installEggs } from './eggs';
import { openClash } from './clash';
import { hooks, digHooks, loadFires, renderBag, renderTabs, showCrate, closeDig, showRequests, showSharedBag, showTrack, startRadio, toggleBag, markPlaying, closeModal } from './ui';
import { h, toast } from './ui-bits';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
document.addEventListener('pointerdown', unlockAudio, { once: true });

// ---------- Scene: build shelves and crates ----------
const stage = $('#stage'), scene = $('#scene'), shelves = $('#shelves'), cratesRow = $('#cratesRow');
const SW = 1600, SH = 900;
{
  const pool = [...tracks].sort(() => Math.random() - 0.5);
  for (let r = 0; r < 3; r++) { const sh = h('<div class="shelf"></div>'); for (let i = 0; i < 12; i++) { const t = pool[(r * 12 + i) % pool.length]; sh.append(h(`<img src="${thumb(t.id)}" alt="" style="--r:${(Math.random() * 6 - 3).toFixed(1)}deg" loading="lazy">`)); } shelves.append(sh); }
  for (const c of crates) {
    const list = tracksIn(c.slug); const el = h(`<div class="crate" data-slug="${c.slug}" style="--c:${c.color}"><div class="fan"></div><div class="box"></div><div class="sign">${c.name.toUpperCase()}<small>${list.length} RECORDS</small></div></div>`);
    const fan = el.querySelector('.fan')!; for (let i = 0; i < 6; i++) { const t = list[Math.floor(i * list.length / 6)]; fan.append(h(`<i style="--img:url(${thumb(t.id)});--r:${-10 + i * 4}deg;--y:${Math.abs(i - 2.5) * 3}px"></i>`)); }
    el.addEventListener('click', () => { zoomTo(el, 2); showCrate(c.slug); });
    cratesRow.append(el);
  }
}
let zoomed = false;
function fit() {
  const s = Math.min(stage.clientWidth / SW, stage.clientHeight / SH);
  const x = (stage.clientWidth - SW * s) / 2, y = (stage.clientHeight - SH * s) / 2;
  scene.style.transform = `translate(${x - SW / 2 * 0}px, ${y}px) scale(${s})`; scene.style.left = '0'; scene.style.top = '0';
  return s;
}
function zoomTo(el: HTMLElement, factor: number) {
  const s0 = Math.min(stage.clientWidth / SW, stage.clientHeight / SH) * factor;
  const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect(); const cur = Math.min(stage.clientWidth / SW, stage.clientHeight / SH);
  // element centre in scene coords
  const sceneRect = scene.getBoundingClientRect(); const cx = (r.left + r.width / 2 - sceneRect.left) / cur, cy = (r.top + r.height / 2 - sceneRect.top) / cur;
  const tx = sr.width / 2 - cx * s0, ty = sr.height / 2 - cy * s0;
  scene.style.transform = `translate(${tx}px, ${ty}px) scale(${s0})`; zoomed = true; backBtn.hidden = false;
}
const backBtn = $('#backBtn');
function backToShop() { fit(); zoomed = false; backBtn.hidden = true; closeDig(); $('#booth').hidden = true; $('#panel').hidden = true; if (parse().kind !== 'home') go('/', true); }
backBtn.addEventListener('click', backToShop);
window.addEventListener('resize', () => { if (!zoomed) fit(); });
fit();
digHooks.onOpen = slug => { if (!zoomed) { const el = cratesRow.querySelector<HTMLElement>(`[data-slug="${slug}"]`); if (el) zoomTo(el, 2); } };

// ---------- Decks + mixer (inside the booth overlay) ----------
const booth = $('#booth'); const decksEl = $('#decks'); const mixer = $('#mixer');
const deckA = new Deck('A', players.A, decksEl); decksEl.insertBefore(deckA.el, mixer);
const deckB = new Deck('B', players.B, decksEl); decksEl.insertBefore(deckB.el, mixer.nextSibling);
const decks = { A: deckA, B: deckB };
hooks.deckRects = () => booth.hidden ? [] : [{ side: 'A', el: deckA.el }, { side: 'B', el: deckB.el }];
hooks.dropOn = (t: Track, side: 'A' | 'B') => { if (side === 'A') queue.setQueue([], -1, 'manual'); decks[side].load(t, true); blip(700, 0.05, 0.04); toast(`ON DECK ${side}`); };
function openBooth() { closeDig(); booth.hidden = false; zoomTo($('#stationBtn'), 2.2); }
$('#stationBtn').addEventListener('click', openBooth);
$('#tvBtn').addEventListener('click', () => $('#monitors').classList.toggle('collapsed')); $('#stationBtn2').addEventListener('click', () => booth.hidden ? openBooth() : backToShop());
const gainA = $<HTMLInputElement>('#gainA'), gainB = $<HTMLInputElement>('#gainB'), xf = $<HTMLInputElement>('#xfade');
const applyMix = () => { const x = Number(xf.value); players.A.setVolume(Number(gainA.value) * Math.min(1, 2 * (1 - x))); players.B.setVolume(Number(gainB.value) * Math.min(1, 2 * x)); };
for (const i of [gainA, gainB, xf]) i.addEventListener('input', applyMix);
xf.addEventListener('dblclick', () => { xf.value = '0.5'; applyMix(); });
queue.ev.on(() => { const id = queue.current(); if (!id) return; deckA.load(byId.get(id)!, false); });
const nowA = $('#nowA'), nowB = $('#nowB');
function refreshNow() {
  const a = players.A.currentId ? byId.get(players.A.currentId) : null, b = players.B.currentId ? byId.get(players.B.currentId) : null;
  nowA.textContent = `A: ${a ? a.title : '—'}`; nowB.textContent = `B: ${b ? b.title : '—'}`;
  $('.mini-deck.a').classList.toggle('live', players.A.state === 'playing'); $('.mini-deck.b').classList.toggle('live', players.B.state === 'playing');
  for (const el of cratesRow.querySelectorAll<HTMLElement>('.crate')) el.classList.toggle('playing', [a?.crate, b?.crate].includes(el.dataset.slug) && (players.A.state === 'playing' || players.B.state === 'playing'));
  if (players.A.state === 'playing' || players.B.state === 'playing') $('#monitors').classList.remove('collapsed');
  $('#crtA').classList.toggle('live', players.A.state === 'playing'); $('#crtB').classList.toggle('live', players.B.state === 'playing');
  stackEl.classList.toggle('live-stack', players.A.state === 'playing' || players.B.state === 'playing');
}
players.A.onState(s => { const id = players.A.currentId; if (id && deckA.track?.id !== id) deckA.load(byId.get(id)!, false); if (s === 'playing' && !deckA.isRunning()) deckA.start(); markPlaying(); refreshNow(); });
players.B.onState(() => { markPlaying(); refreshNow(); });
$('#nextBtn').addEventListener('click', next);

// ---------- Toys ----------
$<HTMLInputElement>('#noise').addEventListener('input', e => surface.set(Number((e.target as HTMLInputElement).value)));
const sirenBtn = $('#sirenBtn'); let sirenMode: 0 | 1 | 2 = 0;
const sirenOn = (e: Event) => { e.preventDefault(); sirenBtn.classList.add('held'); siren.start(sirenMode); floor.crowdShout('SIREN'); };
const sirenOff = () => { sirenBtn.classList.remove('held'); siren.stop(); };
sirenBtn.addEventListener('pointerdown', sirenOn); sirenBtn.addEventListener('pointerup', sirenOff); sirenBtn.addEventListener('pointerleave', sirenOff);
sirenBtn.addEventListener('contextmenu', e => { e.preventDefault(); sirenMode = ((sirenMode + 1) % 3) as 0 | 1 | 2; toast(`SIREN ${['WOBBLE', 'FAST', 'SWEEP'][sirenMode]}`); });
$('#hornBtn').addEventListener('click', () => { airhorn(); floor.crowdShout('BRAAAP'); });
const doPullUp = () => { pullUp(); const d = deckA.isRunning() ? deckA : deckB; setTimeout(() => { d.player.seek(0); if (!d.isRunning()) d.start(); }, 500); floor.crowdShout('WHEEL!'); floor.keeperSay('pull up.'); };
$('#pullBtn').addEventListener('click', doPullUp);

// ---------- Rig ----------
const rigPick = $('#rigPick'), stackEl = $('#stack'), meter = $('#meter'), rigName = $('#rigName');
let rig = rigById(localStorage.getItem('rig') || 'dub');
function setRig(id: string) {
  rig = rigById(id); try { localStorage.setItem('rig', id); } catch { /* */ }
  document.documentElement.style.setProperty('--accent', rig.accent); document.documentElement.style.setProperty('--accent2', rig.accent2);
  stackEl.innerHTML = rig.stack; rigName.textContent = rig.name.toUpperCase(); rigPick.innerHTML = '';
  for (const r of rigs) { const b = h(`<button class="${r.id === rig.id ? 'on' : ''}">${r.name.toUpperCase()}</button>`); b.addEventListener('click', () => setRig(r.id)); rigPick.append(b); }
  rigPick.append(h(`<div class="rig-line">${rig.line}</div>`));
  surface.set(rig.noise); $<HTMLInputElement>('#noise').value = String(rig.noise);
  for (const t of ['siren', 'horn', 'pullup'] as const) $(`#${t === 'pullup' ? 'pullBtn' : t + 'Btn'}`).toggleAttribute('disabled', !rig.toys.includes(t));
  meter.innerHTML = ''; for (let i = 0; i < 24; i++) meter.append(document.createElement('i'));
}
$('#stackSpot').addEventListener('click', () => { const i = rigs.findIndex(r => r.id === rig.id); setRig(rigs[(i + 1) % rigs.length].id); toast(`${rig.name.toUpperCase()}: ${rig.line}`); blip(300, 0.1, 0.06); });
const levels = new Array(24).fill(0);
setInterval(() => { const live = players.A.state === 'playing' || players.B.state === 'playing'; const bars = meter.children;
  for (let i = 0; i < bars.length; i++) { const target = live ? Math.max(0.08, Math.pow(Math.random(), 1.6) * (1 - i / 40)) : 0.04; levels[i] += (target - levels[i]) * 0.5; (bars[i] as HTMLElement).style.height = `${levels[i] * 100}%`; bars[i].classList.toggle('peak', levels[i] > 0.85); } }, 90);
setRig(rig.id);
setInterval(() => { const d = new Date(); $('#clock').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }, 1000);

// ---------- Floor + HUD ----------
const floor = createFloor(scene, { playing: () => players.A.state === 'playing' || players.B.state === 'playing' });
renderTabs();
$('#bagBtn').addEventListener('click', () => toggleBag()); bag.ev.on(renderBag); renderBag();
$('#radioBtn').addEventListener('click', () => { startRadio(); if (booth.hidden) openBooth(); });
$('#reqBtn').addEventListener('click', showRequests);
$('#gameBtn').addEventListener('click', () => { queue.setQueue([], -1, 'manual'); deckB.stop(); startGame($('#modal'), () => {}); });
$('#clashBtn').addEventListener('click', () => openClash({ decks, floor }));
document.addEventListener('keydown', e => { const tag = (e.target as HTMLElement).tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === ' ') { e.preventDefault(); deckA.toggle(); } if (e.key === 'Escape') { $('#panel').hidden = true; $('#bag').hidden = true; closeModal(); if (zoomed) backToShop(); } if (e.key === 'n') next(); });
installEggs({ pullUp: doPullUp, keeper: t => floor.keeperSay(t), crowd: t => floor.crowdShout(t), dubplate: () => document.body.classList.toggle('dubplate') });

// ---------- Routing + intro ----------
const intro = $('#intro');
function applyRoute(gesture: boolean) {
  const r = parse();
  if (r.kind === 'track') { const t = byId.get(r.id); if (t) { showCrate(t.crate, false); showTrack(r.id, false); if (gesture) decks.A.load(t, true, r.t ?? 0); } }
  else if (r.kind === 'crate' && crateBySlug.has(r.slug)) showCrate(r.slug, false);
  else if (r.kind === 'bag') showSharedBag(r.ids);
  else if (r.kind === 'radio' && gesture) { startRadio(); openBooth(); }
  else if (r.kind === 'clash') openClash({ decks, floor }, r.code);
}
$('#enterBtn').addEventListener('click', () => { intro.classList.add('gone'); unlockAudio(); fit(); applyRoute(true); floor.keeperSay('alright.'); });
window.addEventListener('popstate', () => applyRoute(false));
if (parse().kind !== 'home') $('#enterBtn').textContent = 'OPEN SHOP & PLAY';
loadFires();
(window as any).sel = { players, decks, url };
export { decks };
