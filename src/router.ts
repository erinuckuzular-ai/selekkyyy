export type Route =
  | { kind: 'home' }
  | { kind: 'track'; id: string; t?: number }
  | { kind: 'crate'; slug: string }
  | { kind: 'bag'; ids: string[] }
  | { kind: 'radio' };

export function parse(loc: Location = location): Route {
  const p = loc.pathname.replace(/\/+$/, '');
  const q = new URLSearchParams(loc.search);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^\/t\/([\w-]{11})$/))) return { kind: 'track', id: m[1], t: q.has('t') ? Number(q.get('t')) : undefined };
  if ((m = p.match(/^\/crate\/([\w-]+)$/))) return { kind: 'crate', slug: m[1] };
  if ((m = p.match(/^\/bag\/([\w,-]+)$/))) return { kind: 'bag', ids: m[1].split(',').filter(x => /^[\w-]{11}$/.test(x)) };
  if (p === '/radio') return { kind: 'radio' };
  return { kind: 'home' };
}

export const url = {
  track: (id: string, t?: number) => `/t/${id}${t && t > 2 ? `?t=${Math.floor(t)}` : ''}`,
  crate: (slug: string) => `/crate/${slug}`,
  bag: (ids: string[]) => `/bag/${ids.join(',')}`,
  radio: () => '/radio',
};

export function go(path: string, replace = false) {
  if (location.pathname + location.search === path) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
}
export const abs = (path: string) => new URL(path, location.origin).toString();
