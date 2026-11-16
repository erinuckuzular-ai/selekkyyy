import { type Env, json, bad, clean, ipHash, tooFast } from './_lib';
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT id, nick, body, created_at FROM requests ORDER BY created_at DESC LIMIT 40').all();
  return json(results);
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await request.json().catch(() => ({})) as { nick?: string; body?: string };
  const nick = clean(b.nick, 24) || 'anon'; const body = clean(b.body, 300);
  if (body.length < 3) return bad('tell us the tune');
  const ip = await ipHash(request);
  if (await tooFast(env.DB, 'requests', ip, 60)) return bad('one request a minute, please', 429);
  const now = Date.now();
  const r = await env.DB.prepare('INSERT INTO requests (nick, body, created_at, ip_hash) VALUES (?,?,?,?) RETURNING id').bind(nick, body, now, ip).first<{ id: number }>();
  return json({ id: r?.id, nick, body, created_at: now }, 201);
};
