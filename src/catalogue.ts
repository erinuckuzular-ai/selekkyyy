import data from './data/catalogue.json';

export interface Track { id: string; artist: string; title: string; crate: string; decade: string; seconds: number; order: number }
export interface Crate { slug: string; name: string; blurb: string; color: string }

export const channel = data.channel as { handle: string; url: string; id: string };
export const crates: Crate[] = data.crates;
export const tracks: Track[] = data.tracks;
export const byId = new Map(tracks.map(t => [t.id, t]));
export const crateBySlug = new Map(crates.map(c => [c.slug, c]));
export const tracksIn = (slug: string) => tracks.filter(t => t.crate === slug);

export const staffPicks = ['lK3vYP7_6XM', 'DmXbDb_f1Y4', 'kxjny6zLsz8', 'kqsHjTG2268', 'ipXFgZ-RZnM', '-huoTzQBPuk', 'mu3M95iLOoc', '0b0ndV52jxI']
  .map(id => byId.get(id)!).filter(Boolean);
export const newArrivals = tracks.slice(0, 10);

export const thumb = (id: string, size: 'mq' | 'hq' | 'maxres' = 'mq') => `https://i.ytimg.com/vi/${id}/${size}default.jpg`;
export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const label = (t: Track) => `${t.artist} – ${t.title}`;
