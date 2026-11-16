import { type Env, json, bad, isId } from '../_lib';
export const onRequestPost: PagesFunction<Env> = async ({ params, env }) => {
  const id = params.id as string; if (!isId(id)) return bad('bad id');
  await env.DB.prepare('INSERT INTO plays (track_id, count) VALUES (?, 1) ON CONFLICT(track_id) DO UPDATE SET count = count + 1').bind(id).run();
  return json({ ok: true });
};
