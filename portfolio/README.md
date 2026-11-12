# Portfolio — sabithsb

My personal site: a single static page, hand-built with no framework, deployed to
**Cloudflare Pages** at <https://sabithsb.pages.dev>. One theme: white and lavender.

- `index.html` — all content, rendered as plain HTML (fast first paint, crawlable)
- `src/styles.css` — design tokens and every layout and animation
- `src/main.ts` — interactions: headline reveal, scroll reveals, stacking case
  studies, the fill-in statement, live local time, and the voice assistant
- `src/aura.ts` — the Aura audio visualizer (WebGL), the same one the assistant
  widget uses; it drives the scripted call preview in the hero
- `vite.config.ts` — inlines icons at build time (`<i data-icon="…">`), so no icon
  library ships to the browser
- `public/` — favicon, social preview image, Pages `_headers`

The "Talk to my AI assistant" buttons load the embed widget from the assistant's
Cloudflare Worker (see `web/` in this repo). Motion respects `prefers-reduced-motion`.

```bash
npm install && npm run dev
```

## Deploy

[`.github/workflows/portfolio.yml`](../.github/workflows/portfolio.yml) builds every
change and deploys `main` to the Pages project `sabithsb`, creating it on the first
run. It uses the repository's `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
secrets; the token needs the **Cloudflare Pages: Edit** permission.
