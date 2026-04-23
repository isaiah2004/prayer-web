# Prayer Web

A tiny, fun web app for small-group prayer:

- **Create a space**, share a 6-character code with your friends.
- Everyone adds their name and a **prayer request** (rich-text, via [TipTap](https://tiptap.dev/)).
- Hit **Randomize** to pair every person with someone to pray for (guaranteed no self-pairing).
- Hit **Prayer Roulette** to pick one person at random — say, whoever's leading opening or closing prayer. Picked people's odds are halved each time so the same person doesn't keep coming up.

Animations by [GSAP](https://gsap.com/). UI built with Next.js App Router, React 19, Tailwind v4, and shadcn/ui.

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Notes on storage

Spaces are kept in an in-memory `Map` on the server with a 24-hour TTL. That is intentional: this app is designed for a single prayer-circle session. On Vercel with [Fluid Compute](https://vercel.com/docs/functions/runtimes/fluid-compute) the function instance is reused across concurrent requests, so in practice a group can use the same space together for a while. If you want strong durability across deploys, swap `lib/store.ts` for a Redis / Postgres backend.

## Deploy

This repo is deployed on Vercel straight from `main`. To deploy your own fork:

```bash
npm i -g vercel
vercel
```
