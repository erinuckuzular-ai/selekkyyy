import { type Env, json, bad, isId } from '../_lib';
export const onRequestPost: PagesFunction<Env> = async ({ params, env }) => {
  const id = params.id as string; if (!isId(id)) return bad('bad id');
  const r = await env.DB.prepare('INSERT INTO fires (track_id, count) VALUES (?, 1) ON CONFLICT(track_id) DO UPDATE SET count = count + 1 RETURNING count').bind(id).first<{ count: number }>();
  return json({ count: r?.count ?? 1 });
};
