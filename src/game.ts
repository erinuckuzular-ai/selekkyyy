// NEEDLE DROP: hear eight seconds from a random point in the groove, name the record. Ten rounds.
import { byId, label, tracks, tracksIn } from './catalogue';
import { api2 } from './api';
import { players } from './player';
import { blip } from './audio';
import { shuffle, prefs } from './store';
import { esc, h } from './ui-bits';

const ROUNDS = 10, SECS = 8;
export function startGame(modal: HTMLElement, onEnd: () => void) {
  const p = players.B; // game plays on deck B so the main deck keeps its record
  let round = 0, score = 0, streak = 0, timer = 0, t0 = 0, answered = false;
  const order = shuffle(tracks).slice(0, ROUNDS);
  modal.hidden = false; modal.innerHTML = '';
  const card = h(`<div class="mc game"><h2>NEEDLE DROP</h2><div class="q"></div><div class="timer"><i></i></div><div class="opts"></div><div class="score"></div><div class="lb"></div><div class="row" style="justify-content:flex-end"><button class="k" data-act="quit">QUIT</button></div></div>`);
  modal.append(card);
  const q = card.querySelector<HTMLElement>('.q')!, bar = card.querySelector<HTMLElement>('.timer i')!, opts = card.querySelector<HTMLElement>('.opts')!, sc = card.querySelector<HTMLElement>('.score')!, lb = card.querySelector<HTMLElement>('.lb')!;
  card.querySelector('[data-act=quit]')!.addEventListener('click', quit);
  function quit() { clearInterval(timer); p.stop(); modal.hidden = true; modal.innerHTML = ''; onEnd(); }
  function next() {
    if (round >= ROUNDS) return finish();
    answered = false; const t = order[round]; round++;
    const pool = tracksIn(t.crate).filter(x => x.id !== t.id); const decoys = shuffle(pool.length >= 3 ? pool : tracks.filter(x => x.id !== t.id)).slice(0, 3);
    const choices = shuffle([t, ...decoys]);
    q.textContent = `ROUND ${round}/${ROUNDS} · WHAT IS THIS?`; sc.textContent = `SCORE ${score}  STREAK ${streak}`;
    opts.innerHTML = ''; for (const c of choices) { const b = h(`<button class="k" data-id="${c.id}">${esc(label(c))}</button>`); b.addEventListener('click', () => answer(c.id, t.id, b)); opts.append(b); }
    const start = Math.floor(t.seconds * (0.3 + Math.random() * 0.4));
    p.setRate(1); p.play(t.id, start, false);
    t0 = performance.now(); clearInterval(timer);
    timer = window.setInterval(() => { const left = Math.max(0, SECS - (performance.now() - t0) / 1000); bar.style.width = `${(left / SECS) * 100}%`; if (left <= 0 && !answered) answer('', t.id, null); }, 100);
  }
  function answer(id: string, right: string, btn: HTMLElement | null) {
    if (answered) return; answered = true; clearInterval(timer); p.pause();
    const secs = (performance.now() - t0) / 1000;
    for (const b of opts.querySelectorAll<HTMLElement>('button')) { if (b.dataset.id === right) b.classList.add('good'); b.style.pointerEvents = 'none'; }
    if (id === right) { streak++; const pts = 100 + Math.round(Math.max(0, SECS - secs) * 12) + streak * 10; score += pts; blip(1200, 0.1); setTimeout(() => blip(1600, 0.12), 90); q.textContent = `YES. +${pts}`; }
    else { streak = 0; btn?.classList.add('badd'); blip(140, 0.3, 0.1); q.textContent = `NO. ${label(byId.get(right)!)}`; }
    sc.textContent = `SCORE ${score}  STREAK ${streak}`;
    setTimeout(next, 1500);
  }
  async function finish() {
    p.stop(); q.textContent = 'DONE.'; bar.style.width = '0'; opts.innerHTML = '';
    sc.textContent = `FINAL ${score}`;
    const f = h(`<div class="form" style="margin-top:8px"><input maxlength="16" placeholder="name for the board" value="${esc(prefs.nick)}"><button class="k hot">POST SCORE</button></div>`);
    opts.append(f);
    f.querySelector('button')!.addEventListener('click', async () => {
      const nick = f.querySelector('input')!.value.trim() || 'anon'; prefs.nick = nick;
      try { const r = await api2.score(nick, score); q.textContent = `RANK #${r.rank}`; } catch { q.textContent = 'board offline'; }
      f.remove(); board();
    });
    board();
  }
  async function board() {
    const list = await api2.scores(); lb.innerHTML = '<b style="font-family:var(--px);font-size:8px">HIGH SCORES</b>';
    if (!list.length) lb.append(h('<div class="empty">no scores yet</div>'));
    list.slice(0, 10).forEach((s, i) => lb.append(h(`<div><span>${i + 1}. ${esc(s.nick)}</span><b>${s.score}</b></div>`)));
  }
  next();
}
