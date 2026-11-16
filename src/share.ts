import { toast } from './ui-bits';

export async function share(title: string, text: string, urlStr: string) {
  if ("share" in navigator && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    try { await navigator.share({ title, text, url: urlStr }); return; } catch { /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(urlStr); toast('Link copied'); }
  catch { prompt('Copy this link', urlStr); }
}

export const socials = (text: string, u: string) => ({
  whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${u}`)}`,
  x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(u)}`,
  telegram: `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(text)}`,
  mail: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(u)}`,
});
