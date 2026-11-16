// Sound clash rooms. One Durable Object per room code. WebSockets with hibernation.
// Two selectas (A and B) take turns dropping a record; everyone in the room plays it locally,
// the crowd votes, best of ROUNDS wins. Horns and sirens are broadcast so the whole room hears them.
export interface Env { ROOM: DurableObjectNamespace }

const ROUNDS = 3, DROP_SECS = 75, VOTE_SECS = 20;
type Side = 'A' | 'B';
interface Selecta { nick: string; cid: string }
interface State {
  code: string; phase: 'lobby' | 'drop' | 'vote' | 'done'; round: number; rounds: number; turn: Side;
  selectas: Partial<Record<Side, Selecta>>; current: { side: Side; trackId: string; startedAt: number } | null;
  votes: Record<Side, number>; score: Record<Side, number>; crowd: number; log: string[]; phaseEnds: number | null; winner: Side | 'draw' | null;
}
const fresh = (code: string): State => ({ code, phase: 'lobby', round: 1, rounds: ROUNDS, turn: 'A', selectas: {}, current: null, votes: { A: 0, B: 0 }, score: { A: 0, B: 0 }, crowd: 0, log: [], phaseEnds: null, winner: null });

export class ClashRoom implements DurableObject {
  state: State | null = null;
  constructor(private ctx: DurableObjectState, private env: Env) {}
  private async load(code: string) { if (!this.state) this.state = (await this.ctx.storage.get<State>('s')) ?? fresh(code); return this.state; }
  private save() { return this.ctx.storage.put('s', this.state!); }
  private att(ws: WebSocket) { return (ws.deserializeAttachment() ?? {}) as { cid: string; nick: string; role: 'selecta' | 'crowd'; votedRound?: number } }
  private broadcast(msg: unknown, except?: WebSocket) { const s = JSON.stringify(msg); for (const ws of this.ctx.getWebSockets()) if (ws !== except) try { ws.send(s); } catch { /* gone */ } }
  private pushState() { this.state!.crowd = this.ctx.getWebSockets().length; this.broadcast({ t: 'state', state: this.state }); }
  private log(line: string) { const s = this.state!; s.log.push(`${new Date().toISOString().slice(11, 16)} ${line}`); if (s.log.length > 60) s.log.shift(); }

  async fetch(req: Request) {
    const url = new URL(req.url); const code = url.pathname.split('/').pop()!.toUpperCase();
    const s = await this.load(code);
    if (req.headers.get('Upgrade') !== 'websocket') return Response.json(s);
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ cid: crypto.randomUUID(), nick: 'anon', role: 'crowd' });
    server.send(JSON.stringify({ t: 'state', state: s }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const s = this.state ?? await this.load('?'); const a = this.att(ws);
    let m: any; try { m = JSON.parse(String(raw)); } catch { return; }
    const nick = String(m.nick ?? a.nick ?? 'anon').slice(0, 16);
    switch (m.t) {
      case 'join': {
        a.nick = nick;
        if (m.role === 'selecta') { const side: Side | null = !s.selectas.A ? 'A' : !s.selectas.B ? 'B' : null; if (side) { s.selectas[side] = { nick, cid: a.cid }; a.role = 'selecta'; this.log(`${nick} steps up as ${side}`); } else { a.role = 'crowd'; this.log(`${nick} in the crowd (booth full)`); } }
        else { a.role = 'crowd'; this.log(`${nick} in the crowd`); }
        ws.serializeAttachment(a); ws.send(JSON.stringify({ t: 'you', cid: a.cid, role: a.role }));
        break; }
      case 'start': { if (s.phase === 'lobby' && s.selectas.A && s.selectas.B && this.mySide(a) === 'A') { s.phase = 'drop'; s.turn = 'A'; s.round = 1; this.log('CLASH ON. A to drop.'); s.phaseEnds = null; } break; }
      case 'drop': {
        const side = this.mySide(a); if (s.phase !== 'drop' || side !== s.turn || typeof m.trackId !== 'string' || !/^[\w-]{11}$/.test(m.trackId)) break;
        s.current = { side, trackId: m.trackId, startedAt: Date.now() }; s.phaseEnds = Date.now() + DROP_SECS * 1000; this.log(`${side} drops ${m.label ?? m.trackId}`);
        await this.ctx.storage.setAlarm(s.phaseEnds); break; }
      case 'done': { const side = this.mySide(a); if (s.phase === 'drop' && side === s.turn && s.current) await this.advance(); break; }
      case 'vote': {
        if (s.phase !== 'vote' || (m.side !== 'A' && m.side !== 'B') || a.votedRound === s.round) break; const my = this.mySide(a); if (my === m.side) break;
        s.votes[m.side as Side]++; a.votedRound = s.round; ws.serializeAttachment(a); this.log(`${nick} → ${m.side}`); break; }
      case 'horn': { if (['siren', 'horn', 'pullup'].includes(m.kind)) { this.broadcast({ t: 'horn', kind: m.kind, from: nick, side: this.mySide(a) }); } return; }
      case 'chat': { const text = String(m.text ?? '').slice(0, 140).trim(); if (text) this.broadcast({ t: 'chat', nick, text }); return; }
      case 'reset': { if (s.phase === 'done' && this.mySide(a)) { const keep = s.selectas; this.state = fresh(s.code); this.state.selectas = keep; this.log('rematch'); } break; }
      default: return;
    }
    await this.save(); this.pushState();
  }
  private mySide(a: { cid: string }): Side | null { const s = this.state!; if (s.selectas.A?.cid === a.cid) return 'A'; if (s.selectas.B?.cid === a.cid) return 'B'; return null; }
  private async advance() {
    const s = this.state!;
    if (s.phase === 'drop') {
      if (s.turn === 'A') { s.turn = 'B'; s.current = null; s.phaseEnds = null; this.log('B to drop.'); await this.ctx.storage.deleteAlarm(); }
      else { s.phase = 'vote'; s.current = null; s.votes = { A: 0, B: 0 }; s.phaseEnds = Date.now() + VOTE_SECS * 1000; this.log('VOTE.'); await this.ctx.storage.setAlarm(s.phaseEnds); }
    } else if (s.phase === 'vote') {
      const w: Side | 'draw' = s.votes.A > s.votes.B ? 'A' : s.votes.B > s.votes.A ? 'B' : 'draw';
      if (w !== 'draw') s.score[w]++; this.log(`round ${s.round}: ${w === 'draw' ? 'draw' : w + ' takes it'} (${s.votes.A}–${s.votes.B})`);
      if (s.round >= s.rounds) { s.phase = 'done'; s.winner = s.score.A > s.score.B ? 'A' : s.score.B > s.score.A ? 'B' : 'draw'; this.log(`CLASH OVER. ${s.winner === 'draw' ? 'DRAW.' : s.winner + ' WINS.'}`); s.phaseEnds = null; }
      else { s.round++; s.phase = 'drop'; s.turn = 'A'; s.phaseEnds = null; this.log(`round ${s.round}. A to drop.`); }
    }
  }
  async alarm() { if (!this.state) await this.load('?'); await this.advance(); await this.save(); this.pushState(); }
  async webSocketClose(ws: WebSocket) {
    const s = this.state ?? await this.load('?'); const a = this.att(ws); const side = this.mySide(a);
    if (side) { delete s.selectas[side]; this.log(`${a.nick} left the booth`); if (s.phase !== 'lobby' && s.phase !== 'done') { s.phase = 'done'; s.winner = side === 'A' ? 'B' : 'A'; s.phaseEnds = null; this.log('walkover'); } }
    await this.save(); this.pushState();
  }
  async webSocketError(ws: WebSocket) { await this.webSocketClose(ws); }
}

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/new') { const code = Array.from(crypto.getRandomValues(new Uint8Array(5))).map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); return Response.json({ code }, { headers: cors }); }
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/i);
    if (!m) return new Response('selekkyyy clash', { headers: cors });
    const id = env.ROOM.idFromName(m[1].toUpperCase());
    return env.ROOM.get(id).fetch(req);
  },
};
