// Thin wrapper around the YouTube IFrame API. One player, one queue.
import { byId, label } from './catalogue';
import { queue } from './store';
import { api } from './api';

declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

type State = 'idle' | 'playing' | 'paused' | 'buffering' | 'ended';
const listeners = new Set<(s: State) => void>();
let yt: any = null;
let ready: Promise<void> | null = null;
let pendingId: string | null = null;
let pendingStart = 0;
let currentId: string | null = null;
let state: State = 'idle';

function loadApi(): Promise<void> {
  if (ready) return ready;
  ready = new Promise(res => {
    if (window.YT?.Player) return res();
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
  return ready;
}

function setState(s: State) { state = s; for (const f of listeners) f(s); }

async function ensurePlayer() {
  await loadApi();
  if (yt) return yt;
  await new Promise<void>(res => {
    yt = new window.YT.Player('yt', {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: () => res(),
        onStateChange: (e: any) => {
          const S = window.YT.PlayerState;
          if (e.data === S.PLAYING) setState('playing');
          else if (e.data === S.PAUSED) setState('paused');
          else if (e.data === S.BUFFERING) setState('buffering');
          else if (e.data === S.ENDED) { setState('ended'); next(); }
        },
        onError: () => { setTimeout(next, 600); },
      },
    });
  });
  return yt;
}

export const player = {
  get state() { return state; },
  get currentId() { return currentId; },
  onState(f: (s: State) => void) { listeners.add(f); return () => listeners.delete(f); },
  async play(id: string, start = 0) {
    currentId = id; pendingId = id; pendingStart = start;
    setState('buffering');
    const p = await ensurePlayer();
    if (pendingId !== id) return;
    p.loadVideoById({ videoId: id, startSeconds: start });
    api.played(id);
    document.title = `${label(byId.get(id)!)} · Selekkyyy`;
  },
  toggle() { if (!yt) return; state === 'playing' ? yt.pauseVideo() : yt.playVideo(); },
  pause() { yt?.pauseVideo(); },
  resume() { yt?.playVideo(); },
  seek(frac: number) { if (!yt) return; yt.seekTo(frac * (yt.getDuration() || 0), true); },
  time(): number { try { return yt?.getCurrentTime() ?? 0; } catch { return 0; } },
  duration(): number { try { return yt?.getDuration() ?? 0; } catch { return 0; } },
};

export function next() { const id = queue.step(1); if (id) player.play(id); }
export function prev() { const id = queue.step(-1); if (id) player.play(id); }
export function playQueue(ids: string[], index: number, source: string, start = 0) {
  queue.setQueue(ids, index, source);
  const id = queue.current(); if (id) player.play(id, start);
}
