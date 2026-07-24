# Contributing

PRs welcome. Keep the science honest — see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

```bash
git clone <repo-url>
cd beacon
npm install
npm run dev
```

Contacts: `lib/site.ts`.

## Before a PR

`npm test` · `npm run lint` · `npm run build`

## Useful work

- ESA parser (API moves around)
- Designation normalization edge cases
- Real divergence fixtures
- Docs / thresholds

## Rules of thumb

Do: Zod on upstream payloads · keep source labels · split risk vs orbital Δ · keep going if one feed dies.

Don’t: invent numbers · roll your own impact odds · paint Torino 0 red · call this an official alert channel.

Bugs → GitHub Issues. Email on `/about`.

MIT on contribution.
