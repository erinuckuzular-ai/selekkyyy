type Listener = () => void;
class Emitter { private l = new Set<Listener>(); on(f: Listener) { this.l.add(f); return () => this.l.delete(f); } emit() { for (const f of this.l) f(); } }

const load = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export const bag = {
  ids: load<string[]>('bag', []),
  ev: new Emitter(),
  has(id: string) { return this.ids.includes(id); },
  add(id: string) { if (!this.has(id)) { this.ids.push(id); this.commit(); } },
  remove(id: string) { this.ids = this.ids.filter(x => x !== id); this.commit(); },
  toggle(id: string) { this.has(id) ? this.remove(id) : this.add(id); },
  set(ids: string[]) { this.ids = [...new Set(ids)]; this.commit(); },
  clear() { this.ids = []; this.commit(); },
  commit() { save('bag', this.ids); this.ev.emit(); },
};

export const fired = {
  ids: new Set(load<string[]>('fired', [])),
  has(id: string) { return this.ids.has(id); },
  add(id: string) { this.ids.add(id); save('fired', [...this.ids]); },
};

export const prefs = {
  get nick() { return load('nick', ''); }, set nick(v: string) { save('nick', v); },
  get video() { return load('video', false); }, set video(v: boolean) { save('video', v); },
  get view() { return load<'shop' | 'browse'>('view', 'shop'); }, set view(v: 'shop' | 'browse') { save('view', v); },
};

export interface Queue { ids: string[]; index: number; source: string }
export const queue: Queue & { ev: Emitter; setQueue(ids: string[], index: number, source: string): void; current(): string | undefined; step(d: number): string | undefined } = {
  ids: [], index: -1, source: '', ev: new Emitter(),
  setQueue(ids, index, source) { this.ids = ids; this.index = index; this.source = source; this.ev.emit(); },
  current() { return this.ids[this.index]; },
  step(d) { if (!this.ids.length) return; this.index = (this.index + d + this.ids.length) % this.ids.length; this.ev.emit(); return this.current(); },
};

export const shuffle = <T>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
