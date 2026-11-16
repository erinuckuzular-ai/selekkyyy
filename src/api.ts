export interface Comment { id: number; nick: string; body: string; created_at: number }
export interface Request { id: number; nick: string; body: string; created_at: number }

const j = async <T>(r: Promise<Response>): Promise<T> => { const res = await r; if (!res.ok) throw new Error(await res.text()); return res.json(); };
const post = (u: string, body?: unknown) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

export const api = {
  fires: () => j<Record<string, number>>(fetch(`/api/fires`)).catch(() => ({} as Record<string, number>)),
  fire: (id: string) => j<{ count: number }>(post(`/api/fire/${id}`)),
  comments: (id: string) => j<Comment[]>(fetch(`/api/comments/${id}`)).catch(() => [] as Comment[]),
  comment: (id: string, nick: string, body: string) => j<Comment>(post(`/api/comments/${id}`, { nick, body })),
  requests: () => j<Request[]>(fetch('/api/requests')).catch(() => [] as Request[]),
  request: (nick: string, body: string) => j<Request>(post('/api/requests', { nick, body })),
  played: (id: string) => post(`/api/play/${id}`).catch(() => {}),
  hot: () => j<{ track_id: string; count: number }[]>(fetch('/api/hot')).catch(() => []),
};
export interface Discogs { url?: string | null; title?: string | null; year?: number | null; label?: string | null; format?: string | null; lowest?: number | null; currency?: string; for_sale?: number; searchUrl: string; noToken?: boolean }
export interface Score { nick: string; score: number; created_at: number }
export const api2 = {
  discogs: (id: string) => j<Discogs>(fetch(`/api/discogs/${id}`)),
  scores: () => j<Score[]>(fetch('/api/scores')).catch(() => [] as Score[]),
  score: (nick: string, score: number) => j<{ rank: number }>(post('/api/scores', { nick, score })),
};
