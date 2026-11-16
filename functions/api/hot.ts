import { type Env, json } from './_lib';
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT track_id, count FROM plays ORDER BY count DESC LIMIT 12').all();
  return new Response(JSON.stringify(results), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } });
};
