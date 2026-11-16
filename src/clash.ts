// Sound clash client. Lives in the side panel so the decks stay in view.
import { byId, label, type Track } from './catalogue';
import type { Deck } from './deck';
import { airhorn, pullUp, siren, blip } from './audio';
import { prefs } from './store';
import { abs, go, url } from './router';
import { hooks, openModal, closeModal } from './ui';
import { esc, h, toast } from './ui-bits';
import { share } from './share';

export const CLASH_BASE = (import.meta.env.VITE_CLASH_URL as string | undefined) ?? 'https://selekkyyy-clash.erinuckuzular.workers.dev';
type Side = 'A' | 'B';
interface State { code: string; phase: 'lobby' | 'drop' | 'vote' | 'done'; round: number; rounds: number; turn: Side; selectas: Partial<Record<Side, { nick: string; cid: string }>>; current: { side: Side; trackId: string; startedAt: number } | null; votes: Record<Side, number>; score: Record<Side, number>; crowd: number; log: string[]; phaseEnds: number | null; winner: Side | 'draw' | null }

let ws: WebSocket | null = null; let me: { cid: string; role: string } | null = null; let state: State | null = null; let lastTrack = ''; let prevTap: typeof hooks.onTap = null;

export async function openClash(ctx: { decks: Record<Side, Deck>; floor: { crowdShout(t: string): void; keeperSay(t: string): void } }, code?: string) {
  if (!code) {
    openModal(`<h2>SOUND CLASH</h2><p>Two selectas, three rounds, the crowd decides. Everyone in the room hears the same record on their own decks. Horns carry.</p>
      <div class="form"><input id="cnick" maxlength="16" placeholder="your name" value="${esc(prefs.nick)}"><div class="row" style="margin:0"><button class="k hot" data-act="new">NEW ROOM</button><input id="ccode" maxlength="8" placeholder="ROOM CODE" style="width:140px;text-transform:uppercase"><button class="k" data-act="join">JOIN</button></div></div>`, el => {
      el.addEventListener('click', async e => { const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act; if (!a) return;
        prefs.nick = (el.querySelector<HTMLInputElement>('#cnick')!.value || 'anon').trim();
        if (a === 'new') { try { const r = await fetch(`${CLASH_BASE}/new`).then(r => r.json()) as { code: string }; closeModal(); openClash(ctx, r.code); } catch { toast('CLASH SERVER DOWN'); } }
        if (a === 'join') { const c = el.querySelector<HTMLInputElement>('#ccode')!.value.trim().toUpperCase(); if (c.length >= 4) { closeModal(); openClash(ctx, c); } } });
    });
    return;
  }
  go(url.clash(code));
  const panel = document.getElementById('panel')!; panel.hidden = false; panel.innerHTML = '';
  panel.append(h(`<div class="ph">CLASH ${esc(code)}<button class="k" data-act="share" style="margin-left:auto;font-size:7px">INVITE</button><button class="x">X</button></div>`));
  const body = h('<div class="pb clash"><div class="st"></div><div class="row act"></div><div class="log"></div><form class="form" style="margin-top:6px"><input name="text" maxlength="140" placeholder="shout something"></form></div>'); panel.append(body);
  panel.querySelector('.x')!.addEventListener('click', leave);
  panel.querySelector('[data-act=share]')!.addEventListener('click', () => share(`Clash ${code}`, 'come clash', abs(url.clash(code))));
  const st = body.querySelector<HTMLElement>('.st')!, act = body.querySelector<HTMLElement>('.act')!, log = body.querySelector<HTMLElement>('.log')!;
  body.querySelector('form')!.addEventListener('submit', e => { e.preventDefault(); const i = body.querySelector<HTMLInputElement>('input')!; if (i.value.trim()) send({ t: 'chat', text: i.value.trim() }); i.value = ''; });

  ws?.close(); ws = new WebSocket(`${CLASH_BASE.replace(/^http/, 'ws')}/room/${code}`);
  const nick = prefs.nick || 'anon';
  ws.onopen = () => { const wantSelecta = confirm('Step up as a selecta? Cancel to join the crowd.'); send({ t: 'join', nick, role: wantSelecta ? 'selecta' : 'crowd' }); };
  ws.onclose = () => { addLog('disconnected'); };
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.t === 'you') { me = m; toast(m.role === 'selecta' ? 'YOU ARE IN THE BOOTH' : 'YOU ARE THE CROWD'); }
    if (m.t === 'horn') { if (m.kind === 'siren') { siren.start(1); setTimeout(() => siren.stop(), 900); } if (m.kind === 'horn') airhorn(); if (m.kind === 'pullup') pullUp(); ctx.floor.crowdShout(`${m.from}: ${m.kind.toUpperCase()}`); }
    if (m.t === 'chat') { addLog(`${m.nick}: ${m.text}`); ctx.floor.crowdShout(m.text.slice(0, 24)); }
    if (m.t === 'state') { state = m.state as State; render(); sync(); }
  };
  function send(o: unknown) { if (ws?.readyState === 1) ws.send(JSON.stringify({ ...(o as object), nick })); }
  function mySide(): Side | null { if (!state || !me) return null; if (state.selectas.A?.cid === me.cid) return 'A'; if (state.selectas.B?.cid === me.cid) return 'B'; return null; }
  function addLog(line: string) { log.append(h(`<div>${esc(line)}</div>`)); log.scrollTop = log.scrollHeight; }
  let lastLogLen = 0;
  function render() {
    if (!state) return; const s = state; const my = mySide();
    const sideBox = (side: Side) => `<div class="side ${my === side ? 'me' : ''}"><b style="font-family:var(--px);font-size:9px;color:var(--${side === 'A' ? 'cyan' : 'pink'})">${side}</b> ${esc(s.selectas[side]?.nick ?? '— empty —')}<div class="votes">${s.score[side]} ${s.phase === 'vote' ? `· votes ${s.votes[side]}` : ''}</div>${s.current?.side === side ? `<div style="font-size:16px">${esc(label(byId.get(s.current.trackId)!) )}</div>` : ''}</div>`;
    const left = s.phaseEnds ? Math.max(0, Math.round((s.phaseEnds - Date.now()) / 1000)) : null;
    st.innerHTML = `<div class="sides">${sideBox('A')}<div class="vs">VS</div>${sideBox('B')}</div><div class="crowd">round ${s.round}/${s.rounds} · ${s.phase.toUpperCase()}${s.phase === 'drop' ? ` · ${s.turn} TO DROP` : ''}${left !== null ? ` · ${left}s` : ''} · ${s.crowd} in the room${s.winner ? ` · <b>${s.winner === 'draw' ? 'DRAW' : s.winner + ' WINS'}</b>` : ''}</div>`;
    act.innerHTML = '';
    const btn = (t: string, f: () => void, cls = 'k') => { const b = h(`<button class="${cls}">${t}</button>`); b.addEventListener('click', f); act.append(b); };
    if (s.phase === 'lobby' && my === 'A' && s.selectas.B) btn('START CLASH', () => send({ t: 'start' }), 'k hot');
    if (s.phase === 'lobby' && !s.selectas.B) act.append(h('<span class="crowd">waiting for a second selecta. send the invite.</span>'));
    if (s.phase === 'drop' && my === s.turn) { if (!s.current) act.append(h('<span class="crowd" style="color:var(--yellow)">YOUR DROP. tap a record in the crate.</span>')); else btn('DONE, NEXT', () => send({ t: 'done' })); }
    if (s.phase === 'vote' && my !== 'A') btn('VOTE A', () => send({ t: 'vote', side: 'A' }));
    if (s.phase === 'vote' && my !== 'B') btn('VOTE B', () => send({ t: 'vote', side: 'B' }), 'k hot');
    btn('SIREN', () => send({ t: 'horn', kind: 'siren' })); btn('HORN', () => send({ t: 'horn', kind: 'horn' }));
    if (s.phase === 'done' && my) btn('REMATCH', () => send({ t: 'reset' }));
    if (s.log.length !== lastLogLen) { for (const l of s.log.slice(lastLogLen)) addLog(l); lastLogLen = s.log.length; }
    // while it is my drop, tapping a record sends it instead of opening it
    hooks.onTap = (s.phase === 'drop' && my === s.turn && !s.current) ? (t: Track) => { send({ t: 'drop', trackId: t.id, label: label(t) }); blip(900, 0.08); } : prevTap;
  }
  function sync() {
    if (!state?.current) { lastTrack = ''; return; } const c = state.current; const key = c.trackId + c.startedAt; if (key === lastTrack) return; lastTrack = key;
    const t = byId.get(c.trackId); if (!t) return; const offset = Math.max(0, (Date.now() - c.startedAt) / 1000);
    ctx.decks[c.side].load(t, true, offset); ctx.floor.keeperSay(`${c.side} drops ${t.title}`);
  }
  const tick = setInterval(() => { if (state?.phaseEnds) render(); if (!ws || ws.readyState > 1) clearInterval(tick); }, 1000);
  function leave() { ws?.close(); ws = null; hooks.onTap = prevTap; panel.hidden = true; go('/', true); clearInterval(tick); }
}
