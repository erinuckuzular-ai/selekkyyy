import { type Env, json } from './_lib';
// The whole fire table is tiny (one row per record), so just send it all.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT track_id, count FROM fires').all<{ track_id: string; count: number }>();
  return json(Object.fromEntries(results.map(r => [r.track_id, r.count])));
};
