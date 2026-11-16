import { type Env, json, bad, isId, clean, ipHash, tooFast } from '../_lib';
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const id = params.id as string; if (!isId(id)) return bad('bad id');
  const { results } = await env.DB.prepare('SELECT id, nick, body, created_at FROM comments WHERE track_id = ? ORDER BY created_at DESC LIMIT 100').bind(id).all();
  return json(results);
};
export const onRequestPost: PagesFunction<Env> = async ({ params, request, env }) => {
  const id = params.id as string; if (!isId(id)) return bad('bad id');
  const b = await request.json().catch(() => ({})) as { nick?: string; body?: string };
  const nick = clean(b.nick, 24) || 'anon'; const body = clean(b.body, 400);
  if (body.length < 2) return bad('say something');
  const ip = await ipHash(request);
  if (await tooFast(env.DB, 'comments', ip, 20)) return bad('slow down a sec', 429);
  const now = Date.now();
  const r = await env.DB.prepare('INSERT INTO comments (track_id, nick, body, created_at, ip_hash) VALUES (?,?,?,?,?) RETURNING id').bind(id, nick, body, now, ip).first<{ id: number }>();
  return json({ id: r?.id, nick, body, created_at: now }, 201);
};
