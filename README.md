# Selekkyyy

A free, non-profit, community record shop you can walk around in a browser.
Every record is a video from the [@selekkyyy](https://www.youtube.com/@selekkyyy) YouTube channel, sorted into crates by genre. Listen, dig, build a bag, share tunes.

Nothing is sold. "Checkout" turns your bag into a YouTube playlist you can keep.

## What is in the shop

- **3D shop** (Three.js): a warm wooden room with seven crates, a counter and a turntable. Click a crate to glide over and flip through it. Drag to look, WASD or scroll to walk. Touch: drag to look, pinch to move.
- **Browse view**: the same records laid flat, lighter on phones. Toggle with the button top-right.
- **Crates**: 60s Soul, 70s Soul, The Vault, 70s Disco, Jazz, Library & OST, Dub. Assignments live in `data/playlists.json` and are built into `src/data/catalogue.json`.
- **Player**: YouTube IFrame API. Turntable in the bottom bar, mini video at the left; the Video button makes it big.
- **Bag**: stored in `localStorage`. Play it, share it as a link, or check out to a YouTube playlist.
- **Sharing**: `/t/<id>` (optionally `?t=<seconds>`), `/crate/<slug>`, `/bag/<id,id,id>`, `/radio`. A Pages Function injects Open Graph tags so links unfurl with the record's artwork on WhatsApp, X, Telegram and iMessage.
- **Community**: fire counter, comments per tune ("shop floor chat"), a request box, radio mode (whole shop on shuffle), staff picks and new arrivals shelves. No accounts; a nickname is optional and remembered on the device.

## Stack

- Vite + TypeScript + Three.js front end, no framework.
- Cloudflare Pages for hosting, Pages Functions (`functions/`) for the API and OG injection, D1 for fires, comments, requests and play counts.
- Everything audio-visual streams from YouTube. No media is hosted here.

## Run it locally

```bash
npm install
npm run build
npx wrangler d1 execute selekkyyy --local --file=schema.sql   # first time only
npx wrangler pages dev --port 8788
```

`npm run dev` gives you Vite with hot reload, but without the API (fires, comments, requests fall back gracefully).

## Update the catalogue

1. Add the new video IDs to `data/all.json` (id, title, length) and to the right crate in `data/playlists.json`.
2. `npm run catalogue` regenerates `src/data/catalogue.json`.
3. Staff picks are the ID list in `src/catalogue.ts`.

Titles are expected as `Artist - Title`; the build splits on the dash.

## Deploy

```bash
npm run deploy                 # builds and uploads to the Cloudflare Pages project "selekkyyy"
npm run db:schema              # applies schema.sql to the remote D1 database (idempotent)
```

Pushes to `main` also deploy through `.github/workflows/deploy.yml`, which needs two repository secrets: `CLOUDFLARE_API_TOKEN` (Pages + D1 edit) and `CLOUDFLARE_ACCOUNT_ID`.

## Takedowns

If you own a recording here and want it removed, drop a note in the request box or open an issue. It comes down, no questions.

## Licence

MIT for the code. The music belongs to the people who made it.
