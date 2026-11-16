// Serves the SPA for deep links and injects Open Graph tags for /t, /crate and /bag so
// shared links get proper cards on WhatsApp, X, iMessage and friends.
import catalogue from '../src/data/catalogue.json';

interface Env { ASSETS: Fetcher; DB: D1Database }
type Track = { id: string; artist: string; title: string; crate: string };
const tracks = catalogue.tracks as Track[];
const byId = new Map(tracks.map(t => [t.id, t]));
const crateBySlug = new Map(catalogue.crates.map(c => [c.slug, c]));
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const onRequest: PagesFunction<Env> = async ctx => {
  const url = new URL(ctx.request.url);
  const p = url.pathname;
  if (p.startsWith('/api/')) return ctx.next();

  let og: { title: string; desc: string; image: string } | null = null;
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^\/t\/([\w-]{11})\/?$/))) {
    const t = byId.get(m[1]);
    if (t) og = { title: `${t.artist} – ${t.title}`, desc: `Playing in the ${crateBySlug.get(t.crate)?.name ?? ''} crate at Selekkyyy. Free to listen.`, image: `https://i.ytimg.com/vi/${t.id}/maxresdefault.jpg` };
  } else if ((m = p.match(/^\/crate\/([\w-]+)\/?$/))) {
    const c = crateBySlug.get(m[1]);
    if (c) { const n = tracks.filter(t => t.crate === c.slug).length; const first = tracks.find(t => t.crate === c.slug); og = { title: `${c.name} crate · Selekkyyy`, desc: `${c.blurb} ${n} records to dig through.`, image: first ? `https://i.ytimg.com/vi/${first.id}/maxresdefault.jpg` : `${url.origin}/og.png` }; }
  } else if ((m = p.match(/^\/bag\/([\w,-]+)\/?$/))) {
    const ids = m[1].split(',').filter(id => byId.has(id));
    if (ids.length) { const first = byId.get(ids[0])!; og = { title: `A bag of ${ids.length} tune${ids.length === 1 ? '' : 's'} from Selekkyyy`, desc: ids.slice(0, 4).map(id => { const t = byId.get(id)!; return `${t.artist} – ${t.title}`; }).join(' · ') + (ids.length > 4 ? ' · …' : ''), image: `https://i.ytimg.com/vi/${first.id}/maxresdefault.jpg` }; }
  } else if (p === '/radio') {
    og = { title: 'Selekkyyy Radio', desc: 'The whole shop on shuffle. Soul, jazz, dub, disco, library.', image: `${url.origin}/og.png` };
  }

  const isDeep = /^\/(t|crate|bag|clash)\//.test(p) || p === "/radio";
  if (!isDeep) return ctx.next();

  const index = await ctx.env.ASSETS.fetch(new URL('/', url.origin));
  if (!og) return new Response(index.body, index);
  const canonical = `${url.origin}${p}`;
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(og!.title.includes('Selekkyyy') ? og!.title : `${og!.title} · Selekkyyy`); } })
    .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', og!.title); } })
    .on('meta[property="og:description"], meta[name="description"]', { element(e) { e.setAttribute('content', og!.desc); } })
    .on('meta[property="og:image"]', { element(e) { e.setAttribute('content', og!.image); } })
    .on('head', { element(e) { e.append(`<meta property="og:url" content="${esc(canonical)}"><meta name="twitter:title" content="${esc(og!.title)}"><meta name="twitter:description" content="${esc(og!.desc)}"><meta name="twitter:image" content="${esc(og!.image)}">`, { html: true }); } })
    .transform(new Response(index.body, index));
};
