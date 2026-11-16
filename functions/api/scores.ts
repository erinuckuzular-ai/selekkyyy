import { type Env, json, bad, clean, ipHash } from './_lib';
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT nick, score, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT 20').all();
  return json(results);
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await request.json().catch(() => ({})) as { nick?: string; score?: number };
  const nick = clean(b.nick, 16) || 'anon'; const score = Math.max(0, Math.min(5000, Math.floor(Number(b.score) || 0)));
  if (!score) return bad('no score');
  const ip = await ipHash(request);
  await env.DB.prepare('INSERT INTO scores (nick, score, created_at, ip_hash) VALUES (?,?,?,?)').bind(nick, score, Date.now(), ip).run();
  const rank = await env.DB.prepare('SELECT COUNT(*) + 1 AS r FROM scores WHERE score > ?').bind(score).first<{ r: number }>();
  return json({ ok: true, rank: rank?.r ?? 1 }, 201);
};
