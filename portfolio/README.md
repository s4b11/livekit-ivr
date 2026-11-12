# Portfolio — sabithsb

My personal site: a single static page, hand-built with no framework, deployed to
**Cloudflare Pages**.

- `index.html` — all content, rendered as plain HTML (fast first paint, crawlable)
- `src/styles.css` — design tokens, light/dark themes, every animation
- `src/main.ts` — interactions: headline reveal, scroll reveals, nav state,
  card tilt, magnetic buttons, project filter, theme switch, and the voice assistant
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
