export interface Env { DB: D1Database }
export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const bad = (msg: string, status = 400) => new Response(msg, { status });
export const isId = (s: string | undefined): s is string => !!s && /^[\w-]{11}$/.test(s);
export const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export async function ipHash(req: Request) {
  const ip = req.headers.get('cf-connecting-ip') ?? '0';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + 'selekkyyy-salt'));
  return [...new Uint8Array(buf)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function tooFast(db: D1Database, table: 'comments' | 'requests', ip: string, seconds: number) {
  const r = await db.prepare(`SELECT created_at FROM ${table} WHERE ip_hash = ? ORDER BY created_at DESC LIMIT 1`).bind(ip).first<{ created_at: number }>();
  return !!r && Date.now() - r.created_at < seconds * 1000;
}
