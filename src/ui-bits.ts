let timer: number | undefined;
export function toast(msg: string, ms = 2200) {
  const el = document.getElementById('toast')!;
  el.textContent = msg; el.hidden = false;
  clearTimeout(timer); timer = window.setTimeout(() => { el.hidden = true; }, ms);
}
export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const h = (html: string) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild as HTMLElement; };
export const ago = (ts: number) => { const d = (Date.now() - ts) / 1000; if (d < 60) return 'just now'; if (d < 3600) return `${Math.floor(d / 60)}m ago`; if (d < 86400) return `${Math.floor(d / 3600)}h ago`; return `${Math.floor(d / 86400)}d ago`; };
