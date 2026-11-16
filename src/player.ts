// YouTube IFrame API wrapper. One instance per deck. The queue (radio, crate, bag) drives deck A.
import { byId, label } from './catalogue';
import { queue } from './store';
import { api } from './api';

declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }
export type State = 'idle' | 'playing' | 'paused' | 'buffering' | 'ended' | 'cued';
let apiReady: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (apiReady) return apiReady;
  apiReady = new Promise(res => {
    if (window.YT?.Player) return res();
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
  return apiReady;
}

export class Player {
  private yt: any = null;
  private pendingId: string | null = null;
  private wantedRate = 1;
  private vol = 1;
  private listeners = new Set<(s: State) => void>();
  state: State = 'idle';
  currentId: string | null = null;
  onEnded: (() => void) | null = null;
  constructor(public elId: string) {}
  onState(f: (s: State) => void) { this.listeners.add(f); return () => this.listeners.delete(f); }
  private set(s: State) { this.state = s; for (const f of this.listeners) f(s); }
  private async ensure() {
    await loadApi(); if (this.yt) return this.yt;
    await new Promise<void>(res => {
      this.yt = new window.YT.Player(this.elId, {
        width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, origin: location.origin },
        events: {
          onReady: () => { this.yt.setVolume(Math.round(this.vol * 100)); res(); },
          onStateChange: (e: any) => {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) { this.set('playing'); if (Math.abs(this.yt.getPlaybackRate() - this.wantedRate) > 0.01) this.yt.setPlaybackRate(this.wantedRate); }
            else if (e.data === S.PAUSED) this.set('paused');
            else if (e.data === S.BUFFERING) this.set('buffering');
            else if (e.data === S.CUED) this.set('cued');
            else if (e.data === S.ENDED) { this.set('ended'); this.onEnded?.(); }
          },
          onError: () => { setTimeout(() => this.onEnded?.(), 600); },
        },
      });
    });
    return this.yt;
  }
  async play(id: string, start = 0, count = true) {
    this.currentId = id; this.pendingId = id; this.set('buffering');
    const p = await this.ensure(); if (this.pendingId !== id) return;
    p.loadVideoById({ videoId: id, startSeconds: start });
    if (count) { api.played(id); document.title = `${label(byId.get(id)!)} · Selekkyyy`; }
  }
  async cue(id: string) { this.currentId = id; this.pendingId = id; const p = await this.ensure(); if (this.pendingId !== id) return; p.cueVideoById(id); this.set('cued'); }
  toggle() { if (!this.yt) return; this.state === 'playing' ? this.yt.pauseVideo() : this.yt.playVideo(); }
  pause() { this.yt?.pauseVideo(); }
  resume() { this.yt?.playVideo(); }
  stop() { try { this.yt?.stopVideo(); } catch { /* not ready */ } this.currentId = null; this.set('idle'); }
  seek(sec: number) { this.yt?.seekTo(Math.max(0, sec), true); }
  time(): number { try { return this.yt?.getCurrentTime() ?? 0; } catch { return 0; } }
  duration(): number { try { return this.yt?.getDuration() ?? 0; } catch { return 0; } }
  setRate(r: number) { this.wantedRate = Math.min(2, Math.max(0.25, r)); try { this.yt?.setPlaybackRate(this.wantedRate); } catch { /* not ready */ } }
  rate(): number { try { return this.yt?.getPlaybackRate() ?? this.wantedRate; } catch { return this.wantedRate; } }
  setVolume(v: number) { this.vol = Math.max(0, Math.min(1, v)); try { this.yt?.setVolume(Math.round(this.vol * 100)); } catch { /* not ready */ } }
  get volume() { return this.vol; }
}

export const players = { A: new Player('yt-a'), B: new Player('yt-b') };
export const player = players.A;
export function next() { const id = queue.step(1); if (id) player.play(id); }
export function prev() { const id = queue.step(-1); if (id) player.play(id); }
export function playQueue(ids: string[], index: number, source: string, start = 0) {
  queue.setQueue(ids, index, source);
  const id = queue.current(); if (id) player.play(id, start);
}
player.onEnded = () => { if (queue.ids.length) next(); };
