// Discogs lookup with a 7-day D1 cache. Needs DISCOGS_TOKEN (personal access token) for prices;
// without it we still hand back a search link.
import catalogue from '../../../src/data/catalogue.json';
import { json, bad, isId } from '../_lib';

interface Env { DB: D1Database; DISCOGS_TOKEN?: string }
type Track = { id: string; artist: string; title: string };
const byId = new Map((catalogue.tracks as Track[]).map(t => [t.id, t]));
const UA = 'Selekkyyy/1.0 +https://selekkyyy.pages.dev';
const WEEK = 7 * 24 * 3600 * 1000;

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const id = params.id as string; if (!isId(id)) return bad('bad id');
  const t = byId.get(id); if (!t) return bad('unknown', 404);
  const searchUrl = `https://www.discogs.com/search/?q=${encodeURIComponent(`${t.artist} ${t.title}`)}&type=all`;
  const cached = await env.DB.prepare('SELECT * FROM discogs WHERE track_id = ?').bind(id).first<any>();
  if (cached && Date.now() - cached.fetched_at < WEEK) return json({ ...cached, searchUrl, cached: true });
  if (!env.DISCOGS_TOKEN) return json({ searchUrl, noToken: true });

  const headers = { 'User-Agent': UA, Authorization: `Discogs token=${env.DISCOGS_TOKEN}` };
  try {
    const q = new URL('https://api.discogs.com/database/search');
    q.searchParams.set('artist', t.artist); q.searchParams.set('track', t.title); q.searchParams.set('type', 'release'); q.searchParams.set('per_page', '5');
    let r = await fetch(q, { headers }); if (r.status === 429) return json({ searchUrl, rateLimited: true });
    let data = await r.json<any>();
    if (!data.results?.length) { q.searchParams.delete('track'); q.searchParams.set('q', t.title); r = await fetch(q, { headers }); data = await r.json<any>(); }
    const rel = data.results?.[0];
    const row: any = { track_id: id, release_id: null, url: null, title: null, year: null, label: null, format: null, lowest: null, currency: 'GBP', for_sale: 0, fetched_at: Date.now() };
    if (rel) {
      Object.assign(row, { release_id: rel.id, url: `https://www.discogs.com${rel.uri}`, title: rel.title, year: Number(rel.year) || null, label: rel.label?.[0] ?? null, format: rel.format?.slice(0, 3).join(', ') ?? null });
      const s = await fetch(`https://api.discogs.com/marketplace/stats/${rel.id}?curr_abbr=GBP`, { headers });
      if (s.ok) { const st = await s.json<any>(); row.lowest = st.lowest_price?.value ?? null; row.currency = st.lowest_price?.currency ?? 'GBP'; row.for_sale = st.num_for_sale ?? 0; }
    }
    await env.DB.prepare('INSERT OR REPLACE INTO discogs (track_id, release_id, url, title, year, label, format, lowest, currency, for_sale, fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(row.track_id, row.release_id, row.url, row.title, row.year, row.label, row.format, row.lowest, row.currency, row.for_sale, row.fetched_at).run();
    return json({ ...row, searchUrl });
  } catch (e) {
    return json({ searchUrl, error: String(e) });
  }
};
