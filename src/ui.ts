// DOM panels: crate digging, track detail, bag, requests, share, now-playing bar.
import { byId, crateBySlug, crates, fmtTime, label, newArrivals, staffPicks, thumb, tracks, tracksIn, type Track } from './catalogue';
import { api, type Comment } from './api';
import { bag, fired, prefs, queue, shuffle } from './store';
import { abs, go, url } from './router';
import { next, player, playQueue, prev } from './player';
import { share, socials } from './share';
import { ago, esc, h, toast } from './ui-bits';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const panel = $('#panel'), drawer = $('#bag'), modal = $('#modal'), browse = $('#browse');
let fires: Record<string, number> = {};
let onCrateFocus: (slug: string) => void = () => {};
export const setCrateFocus = (f: (slug: string) => void) => { onCrateFocus = f; };

export async function loadFires() { fires = await api.fires(); }

const sleeve = (t: Track, extra = '') => h(`
  <button class="sleeve ${player.currentId === t.id ? 'playing' : ''} ${extra}" data-id="${t.id}" title="${esc(label(t))}">
    <img loading="lazy" src="${thumb(t.id)}" alt="">
    <div class="meta"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></div>
  </button>`);

function closePanel() { panel.hidden = true; panel.innerHTML = ''; }
function openPanel(head: string, body: HTMLElement | string) {
  panel.innerHTML = ''; panel.hidden = false;
  panel.append(h(`<div class="panel-head">${head}<button class="x" aria-label="Close">×</button></div>`));
  const b = h('<div class="panel-body"></div>'); typeof body === 'string' ? (b.innerHTML = body) : b.append(body); panel.append(b);
  panel.querySelector('.x')!.addEventListener('click', () => { closePanel(); go('/'); });
}

export function showCrate(slug: string, pushUrl = true) {
  const c = crateBySlug.get(slug); if (!c) return;
  const list = tracksIn(slug);
  if (pushUrl) go(url.crate(slug));
  onCrateFocus(slug);
  const body = h('<div></div>');
  const act = h(`<div class="actions"><button class="btn amber" data-act="playall">Play the crate</button><button class="btn ghost" data-act="bagall">Bag all ${list.length}</button><button class="btn ghost" data-act="share">Share crate</button></div>`);
  act.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (a === 'playall') playQueue(list.map(t => t.id), 0, `crate:${slug}`);
    if (a === 'bagall') { for (const t of list) bag.add(t.id); toast(`${list.length} records in the bag`); }
    if (a === 'share') share(`${c.name} crate · Selekkyyy`, `Dig the ${c.name} crate`, abs(url.crate(slug)));
  });
  body.append(act);
  const flip = h('<div class="flip"></div>'); list.forEach(t => flip.append(sleeve(t))); body.append(flip);
  flip.addEventListener('click', e => { const id = (e.target as HTMLElement).closest<HTMLElement>('.sleeve')?.dataset.id; if (id) showTrack(id); });
  openPanel(`<div><h2>${esc(c.name)}</h2><div class="sub">${esc(c.blurb)} ${list.length} records.</div></div>`, body);
}

export async function showTrack(id: string, pushUrl = true, autoplay = true, start = 0) {
  const t = byId.get(id); if (!t) return;
  const c = crateBySlug.get(t.crate)!;
  if (pushUrl) go(url.track(id));
  onCrateFocus(t.crate);
  if (autoplay) { const list = tracksIn(t.crate).map(x => x.id); playQueue(list, list.indexOf(id), `crate:${t.crate}`, start); }
  const body = h(`<div>
    <div class="track-hero"><img src="${thumb(id, 'hq')}" alt=""><div><h3>${esc(t.title)}</h3><div class="a">${esc(t.artist)}</div><div class="d">${esc(c.name)} · ${t.decade} · ${fmtTime(t.seconds)}</div></div></div>
    <div class="actions">
      <button class="btn amber" data-act="play">▶ Play</button>
      <button class="btn ${bag.has(id) ? 'ghost' : ''}" data-act="bag">${bag.has(id) ? 'In the bag ✓' : '+ Bag it'}</button>
      <button class="btn fire ${fired.has(id) ? 'on' : ''}" data-act="fire">🔥 <span class="fc">${fires[id] ?? 0}</span></button>
      <button class="btn ghost" data-act="share">Share</button>
      <a class="btn ghost" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">YouTube ↗</a>
    </div>
    <div class="actions"><button class="btn ghost small" data-act="crate">Back to ${esc(c.name)}</button></div>
    <div class="comments"><h4>Shop floor chat</h4><div class="clist"><div class="empty">Loading…</div></div>
      <form class="cform"><input name="nick" maxlength="24" placeholder="Your name (optional)" value="${esc(prefs.nick)}"><textarea name="body" maxlength="400" placeholder="Where did you first hear this?" required></textarea><button class="btn small" type="submit">Post</button></form>
    </div></div>`);
  body.addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (!btn) return;
    const a = btn.dataset.act;
    if (a === 'play') { const list = tracksIn(t.crate).map(x => x.id); playQueue(list, list.indexOf(id), `crate:${t.crate}`); }
    if (a === 'bag') { bag.toggle(id); btn.textContent = bag.has(id) ? 'In the bag ✓' : '+ Bag it'; btn.classList.toggle('ghost', bag.has(id)); toast(bag.has(id) ? 'Bagged' : 'Put back'); }
    if (a === 'fire') { if (fired.has(id)) return toast('Already fired this one'); fired.add(id); btn.classList.add('on'); try { const r = await api.fire(id); fires[id] = r.count; btn.querySelector('.fc')!.textContent = String(r.count); } catch { fires[id] = (fires[id] ?? 0) + 1; btn.querySelector('.fc')!.textContent = String(fires[id]); } }
    if (a === 'share') shareSheet(label(t), abs(url.track(id)));
    if (a === 'crate') showCrate(t.crate);
  });
  const form = body.querySelector<HTMLFormElement>('.cform')!;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form); const nick = String(fd.get('nick') ?? '').trim(); const text = String(fd.get('body') ?? '').trim();
    if (text.length < 2) return; prefs.nick = nick;
    try { const c = await api.comment(id, nick || 'anon', text); form.reset(); (form.elements.namedItem('nick') as HTMLInputElement).value = nick; renderComments([c, ...(await api.comments(id))].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i)); }
    catch (err) { toast(String((err as Error).message || 'Could not post')); }
  });
  const renderComments = (list: Comment[]) => {
    const el = body.querySelector('.clist')!; el.innerHTML = list.length ? '' : '<div class="empty">No chat yet. Say something.</div>';
    for (const c of list) el.append(h(`<div class="comment"><span class="n">${esc(c.nick)}</span><span class="w">${ago(c.created_at)}</span><div>${esc(c.body)}</div></div>`));
  };
  openPanel(`<div><h2>Now digging</h2><div class="sub">${esc(c.name)} crate</div></div>`, body);
  renderComments(await api.comments(id));
}

export function shareSheet(title: string, u: string) {
  const s = socials(`${title} — on Selekkyyy`, u);
  openModal(`<h2>Share</h2><p>${esc(title)}</p>
    <div class="share-url"><input readonly value="${esc(u)}"><button class="btn" data-act="copy">Copy</button></div>
    <div class="share-grid">
      <a class="btn" href="${s.whatsapp}" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="${s.x}" target="_blank" rel="noopener">X</a>
      <a class="btn" href="${s.telegram}" target="_blank" rel="noopener">Telegram</a><a class="btn" href="${s.mail}">Email</a>
    </div><p class="fine" style="opacity:.6;font-size:12px">Instagram does not take links from the web, so copy and paste it into a story or DM.</p>`,
    el => { el.querySelector('[data-act=copy]')!.addEventListener('click', () => share(title, title, u)); if ("share" in navigator && /Mobi|Android|iPhone/i.test(navigator.userAgent)) { share(title, `${title} — on Selekkyyy`, u); closeModal(); } });
}

function openModal(html: string, wire?: (el: HTMLElement) => void) {
  modal.innerHTML = ''; modal.hidden = false;
  const card = h(`<div class="modal-card">${html}<div class="actions" style="justify-content:flex-end;margin:14px 0 0"><button class="btn ghost" data-act="close">Close</button></div></div>`);
  card.querySelector('[data-act=close]')!.addEventListener('click', closeModal);
  modal.append(card); modal.addEventListener('click', e => { if (e.target === modal) closeModal(); }, { once: true });
  wire?.(card);
}
export function closeModal() { modal.hidden = true; modal.innerHTML = ''; }

export async function showRequests() {
  openModal(`<h2>Request box</h2><p>Want something in the crates? Leave it here, the shop reads every one.</p>
    <form class="cform"><input name="nick" maxlength="24" placeholder="Your name (optional)" value="${esc(prefs.nick)}"><textarea name="body" maxlength="300" placeholder="Artist – tune, or a vibe" required></textarea><button class="btn amber" type="submit">Drop it in</button></form>
    <h4 style="font-family:var(--serif);margin:18px 0 6px">Recent requests</h4><div class="rlist"><div class="empty">Loading…</div></div>`, el => {
    const form = el.querySelector<HTMLFormElement>('form')!;
    const render = (list: { nick: string; body: string; created_at: number }[]) => { const r = el.querySelector('.rlist')!; r.innerHTML = list.length ? '' : '<div class="empty">Nothing yet. Be first.</div>'; for (const x of list) r.append(h(`<div class="req"><b>${esc(x.nick)}</b> <span style="opacity:.55;font-size:12px">${ago(x.created_at)}</span><div>${esc(x.body)}</div></div>`)); };
    form.addEventListener('submit', async e => { e.preventDefault(); const fd = new FormData(form); const nick = String(fd.get('nick') ?? '').trim(); prefs.nick = nick; try { await api.request(nick || 'anon', String(fd.get('body'))); form.reset(); toast('Request dropped in the box'); render(await api.requests()); } catch (err) { toast(String((err as Error).message)); } });
    api.requests().then(render);
  });
}

// Bag
export function renderBag() {
  $('#bagCount').textContent = String(bag.ids.length);
  if (drawer.hidden) return;
  const items = bag.ids.map(id => byId.get(id)!).filter(Boolean);
  const total = items.reduce((s, t) => s + t.seconds, 0);
  drawer.innerHTML = '';
  drawer.append(h(`<div class="panel-head"><div><h2>Your bag</h2><div class="sub">${items.length} record${items.length === 1 ? '' : 's'}, ${fmtTime(total)} of music</div></div><button class="x" aria-label="Close">×</button></div>`));
  const body = h('<div class="panel-body"></div>');
  if (!items.length) body.append(h('<div class="empty">Empty. Go dig.</div>'));
  for (const t of items) {
    const row = h(`<div class="bag-item"><img src="${thumb(t.id)}" alt=""><div class="grow"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)} · ${fmtTime(t.seconds)}</div></div><button class="icon" data-act="play" title="Play">▶</button><button class="x" data-act="rm" title="Put back">×</button></div>`);
    row.querySelector('[data-act=play]')!.addEventListener('click', () => playQueue(bag.ids, bag.ids.indexOf(t.id), 'bag'));
    row.querySelector('[data-act=rm]')!.addEventListener('click', () => bag.remove(t.id));
    body.append(row);
  }
  drawer.append(body);
  const co = h(`<div class="checkout">
    <div class="total"><span>Total</span><b>£0.00 — always</b></div>
    <button class="btn amber" data-act="yt" ${items.length ? '' : 'disabled'}>Check out → YouTube playlist</button>
    <div class="actions" style="margin:0"><button class="btn" data-act="play" ${items.length ? '' : 'disabled'}>Play the bag</button><button class="btn ghost" data-act="share" ${items.length ? '' : 'disabled'}>Share bag</button><button class="btn ghost danger" data-act="clear" ${items.length ? '' : 'disabled'}>Empty</button></div>
    <div style="font-size:12px;opacity:.65">Checkout opens your bag as a YouTube playlist you can save to your own account. Nothing is charged, ever.</div></div>`);
  co.addEventListener('click', e => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (a === 'yt') window.open(`https://www.youtube.com/watch_videos?video_ids=${bag.ids.slice(0, 50).join(',')}&title=${encodeURIComponent('Selekkyyy bag')}`, '_blank', 'noopener');
    if (a === 'play') playQueue(bag.ids, 0, 'bag');
    if (a === 'share') shareSheet(`A bag of ${items.length} tunes`, abs(url.bag(bag.ids)));
    if (a === 'clear' && confirm('Empty the bag?')) bag.clear();
  });
  drawer.append(co);
  drawer.querySelector('.panel-head .x')!.addEventListener('click', () => { drawer.hidden = true; });
}
export function toggleBag(open?: boolean) { drawer.hidden = open === undefined ? !drawer.hidden : !open; renderBag(); }

export function showSharedBag(ids: string[]) {
  const items = ids.map(id => byId.get(id)!).filter(Boolean); if (!items.length) return;
  openModal(`<h2>Someone shared a bag</h2><p>${items.length} tunes: ${items.slice(0, 5).map(t => esc(label(t))).join(' · ')}${items.length > 5 ? ' · …' : ''}</p>
    <div class="actions"><button class="btn amber" data-act="play">Play it</button><button class="btn" data-act="merge">Add to my bag</button><button class="btn ghost" data-act="replace">Replace my bag</button></div>`, el => {
    el.addEventListener('click', e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act; if (!a) return;
      if (a === 'play') { playQueue(ids, 0, 'shared-bag'); closeModal(); }
      if (a === 'merge') { for (const id of ids) bag.add(id); toast('Added to your bag'); closeModal(); toggleBag(true); }
      if (a === 'replace') { bag.set(ids); toast('Bag replaced'); closeModal(); toggleBag(true); } });
  });
}

// Radio
export function startRadio() {
  const ids = shuffle(tracks.map(t => t.id));
  playQueue(ids, 0, 'radio'); go(url.radio()); toast('Radio on. The whole shop, shuffled.');
}

// Browse view (flat)
export function renderBrowse() {
  browse.innerHTML = '';
  const chips = h('<div class="crate-row"></div>');
  for (const c of crates) chips.append(h(`<a class="crate-chip" style="--c:${c.color}" href="#crate-${c.slug}">${esc(c.name)} <span style="opacity:.6;font-weight:400">${tracksIn(c.slug).length}</span></a>`));
  browse.append(h('<h2 style="margin-top:0">The shop, laid flat</h2>'), h('<p class="blurb">Every record in the crates. Click a sleeve to play, hit the bag to collect.</p>'), chips);
  const shelfOf = (title: string, blurb: string, list: Track[], id?: string) => {
    const wrap = h(`<section ${id ? `id="${id}"` : ''}><div class="crate-head"><h2>${esc(title)}</h2><span class="pill">${list.length}</span></div><p class="blurb">${esc(blurb)}</p></section>`);
    const sh = h('<div class="shelf"></div>'); list.forEach(t => sh.append(sleeve(t))); wrap.append(sh); return wrap;
  };
  browse.append(shelfOf('Staff picks', 'What the counter is playing this week.', staffPicks));
  browse.append(shelfOf('New arrivals', 'Fresh in the crates.', newArrivals));
  for (const c of crates) browse.append(shelfOf(c.name, c.blurb, tracksIn(c.slug), `crate-${c.slug}`));
  browse.append(h(`<p class="blurb" style="margin-top:40px;font-size:13px">Selekkyyy is a free, non-profit community record shop. All audio plays from <a href="https://www.youtube.com/@selekkyyy" target="_blank" rel="noopener">YouTube</a>. If you own a record here and want it taken down, drop a note in the request box.</p>`));
  browse.onclick = e => { const id = (e.target as HTMLElement).closest<HTMLElement>('.sleeve')?.dataset.id; if (id) showTrack(id); };
}
export function markPlaying() { for (const el of document.querySelectorAll<HTMLElement>('.sleeve')) el.classList.toggle('playing', el.dataset.id === player.currentId); }

// Now bar
export function wireNowBar() {
  const bar = $('#nowbar'), ytwrap = $('#ytwrap');
  const setVideo = (on: boolean) => { prefs.video = on; ytwrap.classList.toggle('video', on); ytwrap.classList.toggle('mini', !on); $('#videoToggle').textContent = on ? 'Hide video' : 'Video'; };
  setVideo(prefs.video);
  $('#playBtn').addEventListener('click', () => player.toggle());
  $('#nextBtn').addEventListener('click', next);
  $('#prevBtn').addEventListener('click', prev);
  $('#videoToggle').addEventListener('click', () => setVideo(!prefs.video));
  $('#deck').addEventListener('click', () => setVideo(!prefs.video));
  $('#shareNow').addEventListener('click', () => { const id = player.currentId; if (!id) return; const t = Math.floor(player.time()); shareSheet(`${label(byId.get(id)!)} @ ${fmtTime(t)}`, abs(url.track(id, t))); });
  $('#progress').addEventListener('click', e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width); });
  const refresh = () => {
    const id = player.currentId; if (!id) return;
    const t = byId.get(id)!; bar.hidden = false; ytwrap.classList.remove('off');
    $('#nowTitle').textContent = t.title; $('#nowArtist').textContent = `${t.artist} · ${crateBySlug.get(t.crate)!.name}${queue.source === 'radio' ? ' · Radio' : queue.source === 'bag' ? ' · from your bag' : ''}`;
    markPlaying();
  };
  player.onState(s => { bar.classList.toggle('playing', s === 'playing'); $('#playBtn').textContent = s === 'playing' ? '❚❚' : '▶'; refresh(); });
  queue.ev.on(refresh);
  setInterval(() => { const d = player.duration(); $('#progressBar').style.width = d ? `${(player.time() / d) * 100}%` : '0'; }, 500);
  document.addEventListener('keydown', e => { if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return; if (e.key === ' ') { e.preventDefault(); player.toggle(); } if (e.key === 'n') next(); if (e.key === 'p') prev(); if (e.key === 'Escape') { closePanel(); closeModal(); drawer.hidden = true; } });
}
