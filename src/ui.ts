// Crate wall, record panel, bag, requests, share. Terse by design.
import { byId, crateBySlug, crates, fmtTime, label, thumb, tracks, tracksIn, type Track } from './catalogue';
import { api, api2, type Comment } from './api';
import { bag, fired, prefs, queue, shuffle } from './store';
import { abs, go, url } from './router';
import { player, playQueue } from './player';
import { share, socials } from './share';
import { ago, esc, h, toast } from './ui-bits';
import { blip } from './audio';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const panel = $('#panel'), drawer = $('#bag'), modal = $('#modal'), dig = $('#dig'), tabs = $('#crateTabs'), ghost = $('#ghost');
export const digHooks: { onOpen: ((slug: string) => void) | null } = { onOpen: null };
let fires: Record<string, number> = {};
export let currentCrate = crates[0].slug;
export const hooks: { dropOn: ((t: Track, side: 'A' | 'B') => void) | null; deckRects: (() => { side: 'A' | 'B'; el: HTMLElement }[]) | null; onTap: ((t: Track) => void) | null } = { dropOn: null, deckRects: null, onTap: null };

export async function loadFires() { fires = await api.fires(); }

export function renderTabs() {
  tabs.innerHTML = '';
  for (const c of crates) { const b = h(`<button style="--c:${c.color}" data-slug="${c.slug}" class="${c.slug === currentCrate ? 'on' : ''}">${esc(c.name)}</button>`); b.addEventListener('click', () => showCrate(c.slug)); tabs.append(b); }
}

export function showCrate(slug: string, pushUrl = true) {
  const c = crateBySlug.get(slug); if (!c) return; currentCrate = slug;
  if (pushUrl) go(url.crate(slug)); renderTabs();
  const list = tracksIn(slug);
  dig.hidden = false; dig.style.setProperty('--c', c.color);
  $('#digTitle').innerHTML = `${esc(c.name)} <span class="count">${list.length}</span>`; $('#digBlurb').textContent = c.blurb;
  const row = $('#digActions'); row.innerHTML = '<button class="k" data-act="play">PLAY CRATE</button><button class="k" data-act="shuf">SHUFFLE</button><button class="k" data-act="bag">BAG ALL</button><button class="k" data-act="share">SHARE</button>';
  row.onclick = e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act; const ids = list.map(t => t.id);
    if (a === 'play') playQueue(ids, 0, `crate:${slug}`); if (a === 'shuf') playQueue(shuffle(ids), 0, `crate:${slug}`);
    if (a === 'bag') { for (const id of ids) bag.add(id); toast(`${ids.length} IN THE BAG`); } if (a === 'share') share(`${c.name} · Selekkyyy`, `${c.name} crate`, abs(url.crate(slug))); };
  const grid = $('#digRecords'); grid.innerHTML = '';
  for (const t of list) grid.append(recordEl(t));
  digHooks.onOpen?.(slug);
}
export function closeDig() { dig.hidden = true; }

const targets = (): { side: 'A' | 'B'; el: HTMLElement }[] => dig.hidden ? (hooks.deckRects?.() ?? []) : [...dig.querySelectorAll<HTMLElement>('.pad')].map(el => ({ side: el.dataset.side as 'A' | 'B', el }));
function recordEl(t: Track) {
  const c = crateBySlug.get(t.crate)!;
  const el = h(`<div class="rec s${t.size} ${player.currentId === t.id ? 'playing' : ''} ${bag.has(t.id) ? 'inbag' : ''}" data-id="${t.id}" style="--c:${c.color}" title="${esc(label(t))} · ${t.kind}">
    <div class="sl" style="background-image:url(${thumb(t.id)})"></div><div class="vinyl"></div><span class="tag">${t.size}" ${t.rpm}</span></div>`);
  const wrap = h('<div></div>'); wrap.append(el, h(`<div class="rec-title">${esc(t.title)}</div>`), h(`<div class="rec-artist">${esc(t.artist)}</div>`));
  // pointer drag: move far = drag onto a deck; tap = open the record
  let pid = -1, sx = 0, sy = 0, dragging = false;
  el.addEventListener('pointerdown', e => { pid = e.pointerId; sx = e.clientX; sy = e.clientY; dragging = false; el.setPointerCapture(pid); });
  el.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return; if (!dragging && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { dragging = true; ghost.hidden = false; ghost.style.setProperty('--c', c.color); blip(500, 0.03, 0.03); }
    if (!dragging) return; ghost.style.left = `${e.clientX}px`; ghost.style.top = `${e.clientY}px`;
    for (const d of targets()) { const r = d.el.getBoundingClientRect(); d.el.classList.toggle('over', e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom); }
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pid) return; pid = -1; ghost.hidden = true;
    if (!dragging) { hooks.onTap ? hooks.onTap(t) : showTrack(t.id); return; }
    for (const d of targets()) { const r = d.el.getBoundingClientRect(); d.el.classList.remove('over'); if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) hooks.dropOn?.(t, d.side); }
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  return wrap;
}

export function markPlaying() { for (const el of document.querySelectorAll<HTMLElement>('.rec')) { el.classList.toggle('playing', el.dataset.id === player.currentId); el.classList.toggle('inbag', bag.has(el.dataset.id!)); } }

function openPanel(title: string, body: HTMLElement) {
  panel.innerHTML = ''; panel.hidden = false;
  panel.append(h(`<div class="ph">${title}<button class="x">X</button></div>`)); const pb = h('<div class="pb"></div>'); pb.append(body); panel.append(pb);
  panel.querySelector('.x')!.addEventListener('click', () => { panel.hidden = true; go(url.crate(currentCrate), true); });
}

export async function showTrack(id: string, pushUrl = true) {
  const t = byId.get(id); if (!t) return; const c = crateBySlug.get(t.crate)!;
  if (pushUrl) go(url.track(id));
  const body = h(`<div>
    <div class="hero"><div class="disc" style="--c:${c.color};--img:url(${thumb(id, 'hq')})"></div><div><h3>${esc(t.title)}</h3><div class="a">${esc(t.artist)}</div>
      <div class="spec">${t.kind.toUpperCase()}<br>${t.size}" · ${t.rpm} RPM · ${fmtTime(t.seconds)}<br>${esc(c.name.toUpperCase())} · ${t.decade}</div></div></div>
    <div class="row">
      <button class="k hot" data-act="a">▶ DECK A</button><button class="k" data-act="b">▶ DECK B</button>
      <button class="k" data-act="bag">${bag.has(id) ? 'IN BAG ✓' : '+ BAG'}</button>
      <button class="k fire ${fired.has(id) ? 'on' : ''}" data-act="fire">🔥 <span class="fc">${fires[id] ?? 0}</span></button>
      <button class="k" data-act="share">SHARE</button>
    </div>
    <div class="discogs"><span class="empty">checking discogs…</span></div>
    <div class="chat"><h4>SHOP FLOOR</h4><div class="clist"><span class="empty">…</span></div>
      <form class="form"><input name="nick" maxlength="24" placeholder="name (optional)" value="${esc(prefs.nick)}"><textarea name="body" maxlength="400" placeholder="say something about the record" required></textarea><button class="k" type="submit">POST</button></form></div></div>`);
  body.addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (!btn) return; const a = btn.dataset.act;
    if (a === 'a') hooks.dropOn?.(t, 'A'); if (a === 'b') hooks.dropOn?.(t, 'B');
    if (a === 'bag') { bag.toggle(id); btn.textContent = bag.has(id) ? 'IN BAG ✓' : '+ BAG'; markPlaying(); }
    if (a === 'fire') { if (fired.has(id)) return toast('ALREADY FIRED'); fired.add(id); btn.classList.add('on'); try { const r = await api.fire(id); fires[id] = r.count; } catch { fires[id] = (fires[id] ?? 0) + 1; } btn.querySelector('.fc')!.textContent = String(fires[id]); }
    if (a === 'share') shareSheet(label(t), abs(url.track(id)));
  });
  const form = body.querySelector<HTMLFormElement>('form')!;
  form.addEventListener('submit', async e => { e.preventDefault(); const fd = new FormData(form); const nick = String(fd.get('nick') ?? '').trim(); const text = String(fd.get('body') ?? '').trim(); if (text.length < 2) return; prefs.nick = nick;
    try { await api.comment(id, nick || 'anon', text); form.reset(); (form.elements.namedItem('nick') as HTMLInputElement).value = nick; renderComments(await api.comments(id)); } catch (err) { toast(String((err as Error).message || 'NOPE').toUpperCase()); } });
  const renderComments = (list: Comment[]) => { const el = body.querySelector('.clist')!; el.innerHTML = list.length ? '' : '<span class="empty">nobody has said anything. you first.</span>'; for (const cm of list) el.append(h(`<div class="c"><span class="n">${esc(cm.nick)}</span><span class="w">${ago(cm.created_at)}</span><div>${esc(cm.body)}</div></div>`)); };
  openPanel(esc(c.name.toUpperCase()), body);
  api.comments(id).then(renderComments);
  api2.discogs(id).then(d => {
    const el = body.querySelector('.discogs')!;
    if (d.url) el.innerHTML = `<b>${esc(d.title ?? '')}</b> ${d.year ?? ''} ${d.label ? '· ' + esc(d.label) : ''} ${d.format ? '· ' + esc(d.format) : ''}<br>${d.lowest != null ? `<span class="price">from ${d.currency === 'GBP' ? '£' : d.currency + ' '}${Number(d.lowest).toFixed(2)}</span> · ${d.for_sale} for sale · ` : 'no copies listed · '}<a href="${d.url}" target="_blank" rel="noopener">discogs ↗</a>`;
    else el.innerHTML = `${d.noToken ? 'prices not wired yet · ' : 'not matched · '}<a href="${d.searchUrl}" target="_blank" rel="noopener">search discogs ↗</a>`;
  }).catch(() => { body.querySelector('.discogs')!.innerHTML = `<a href="https://www.discogs.com/search/?q=${encodeURIComponent(label(t))}" target="_blank" rel="noopener">search discogs ↗</a>`; });
}

export function shareSheet(title: string, u: string) {
  const s = socials(`${title} — Selekkyyy`, u);
  openModal(`<h2>SHARE</h2><p>${esc(title)}</p><div class="share-url"><input readonly value="${esc(u)}"><button class="k" data-act="copy">COPY</button></div>
    <div class="grid2" style="margin-top:8px"><a class="k" href="${s.whatsapp}" target="_blank" rel="noopener">WHATSAPP</a><a class="k" href="${s.x}" target="_blank" rel="noopener">X</a><a class="k" href="${s.telegram}" target="_blank" rel="noopener">TELEGRAM</a><a class="k" href="${s.mail}">EMAIL</a></div>`,
    el => el.querySelector('[data-act=copy]')!.addEventListener('click', () => share(title, title, u)));
}
export function openModal(html: string, wire?: (el: HTMLElement) => void) {
  modal.innerHTML = ''; modal.hidden = false;
  const card = h(`<div class="mc">${html}<div class="row" style="justify-content:flex-end;margin:14px 0 0"><button class="k" data-act="close">CLOSE</button></div></div>`);
  card.querySelector('[data-act=close]')!.addEventListener('click', closeModal); modal.append(card);
  modal.onclick = e => { if (e.target === modal) closeModal(); }; wire?.(card);
}
export function closeModal() { modal.hidden = true; modal.innerHTML = ''; }

export function showRequests() {
  openModal(`<h2>REQUESTS</h2><p>Want something in the crates? Leave it. Takedowns go here too.</p>
    <form class="form"><input name="nick" maxlength="24" placeholder="name (optional)" value="${esc(prefs.nick)}"><textarea name="body" maxlength="300" placeholder="artist – tune" required></textarea><button class="k hot" type="submit">DROP IT</button></form>
    <h4 style="font-family:var(--px);font-size:8px;margin:14px 0 4px;color:var(--cyan)">RECENT</h4><div class="rlist"><span class="empty">…</span></div>`, el => {
    const form = el.querySelector<HTMLFormElement>('form')!;
    const render = (list: { nick: string; body: string; created_at: number }[]) => { const r = el.querySelector('.rlist')!; r.innerHTML = list.length ? '' : '<span class="empty">nothing yet</span>'; for (const x of list) r.append(h(`<div class="req"><b>${esc(x.nick)}</b> <span style="color:var(--dim);font-size:14px">${ago(x.created_at)}</span><div>${esc(x.body)}</div></div>`)); };
    form.addEventListener('submit', async e => { e.preventDefault(); const fd = new FormData(form); const nick = String(fd.get('nick') ?? '').trim(); prefs.nick = nick; try { await api.request(nick || 'anon', String(fd.get('body'))); form.reset(); toast('IN THE BOX'); render(await api.requests()); } catch (err) { toast(String((err as Error).message).toUpperCase()); } });
    api.requests().then(render);
  });
}

export function renderBag() {
  $('#bagCount').textContent = String(bag.ids.length); markPlaying();
  if (drawer.hidden) return;
  const items = bag.ids.map(id => byId.get(id)!).filter(Boolean); const total = items.reduce((s, t) => s + t.seconds, 0);
  drawer.innerHTML = ''; drawer.append(h(`<div class="ph">BAG · ${items.length} · ${fmtTime(total)}<button class="x">X</button></div>`));
  const body = h('<div class="pb" style="flex:1"></div>'); if (!items.length) body.append(h('<div class="empty">empty. go dig.</div>'));
  for (const t of items) { const c = crateBySlug.get(t.crate)!; const row = h(`<div class="bi"><div class="d" style="--c:${c.color}"></div><div class="t">${esc(t.title)}<small>${esc(t.artist)} · ${t.size}" · ${fmtTime(t.seconds)}</small></div><button data-act="a">A</button><button data-act="b">B</button><button data-act="rm">X</button></div>`);
    row.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act; if (a === 'a') hooks.dropOn?.(t, 'A'); if (a === 'b') hooks.dropOn?.(t, 'B'); if (a === 'rm') bag.remove(t.id); }); body.append(row); }
  drawer.append(body);
  const co = h(`<div class="checkout"><div class="total"><span>TOTAL</span><span>£0.00 ALWAYS</span></div>
    <button class="k hot" data-act="yt" ${items.length ? '' : 'disabled'}>CHECK OUT → YOUTUBE PLAYLIST</button>
    <div class="row" style="margin:0"><button class="k" data-act="play" ${items.length ? '' : 'disabled'}>PLAY BAG</button><button class="k" data-act="share" ${items.length ? '' : 'disabled'}>SHARE BAG</button><button class="k" data-act="clear" ${items.length ? '' : 'disabled'}>EMPTY</button></div>
    <div style="font-size:15px;color:var(--dim)">The bag becomes a playlist you can save. Nothing is charged, ever.</div></div>`);
  co.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (a === 'yt') window.open(`https://www.youtube.com/watch_videos?video_ids=${bag.ids.slice(0, 50).join(',')}&title=${encodeURIComponent('Selekkyyy bag')}`, '_blank', 'noopener');
    if (a === 'play') playQueue(bag.ids, 0, 'bag'); if (a === 'share') shareSheet(`a bag of ${items.length} records`, abs(url.bag(bag.ids))); if (a === 'clear' && confirm('Empty the bag?')) bag.clear(); });
  drawer.append(co); drawer.querySelector('.ph .x')!.addEventListener('click', () => { drawer.hidden = true; });
}
export function toggleBag(open?: boolean) { drawer.hidden = open === undefined ? !drawer.hidden : !open; renderBag(); }

export function showSharedBag(ids: string[]) {
  const items = ids.map(id => byId.get(id)!).filter(Boolean); if (!items.length) return;
  openModal(`<h2>SOMEONE SENT A BAG</h2><p>${items.length} records: ${items.slice(0, 5).map(t => esc(label(t))).join(' · ')}${items.length > 5 ? ' · …' : ''}</p>
    <div class="row"><button class="k hot" data-act="play">PLAY IT</button><button class="k" data-act="merge">ADD TO MINE</button><button class="k" data-act="replace">REPLACE MINE</button></div>`, el => {
    el.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act; if (!a) return;
      if (a === 'play') { playQueue(ids, 0, 'shared-bag'); closeModal(); } if (a === 'merge') { for (const id of ids) bag.add(id); closeModal(); toggleBag(true); } if (a === 'replace') { bag.set(ids); closeModal(); toggleBag(true); } }); });
}
export function startRadio() { playQueue(shuffle(tracks.map(t => t.id)), 0, 'radio'); go(url.radio()); toast('RADIO. WHOLE SHOP. SHUFFLED.'); }
export { queue };
