# BEACON

[![CI](https://github.com/NovaCoding-G/B.E.A.C.O.N/actions/workflows/ci.yml/badge.svg)](https://github.com/NovaCoding-G/B.E.A.C.O.N/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

**Bayesian Earth-impact Assessment & Cross-source Observation Network**

Cross-checks near-Earth object data from **JPL CAD**, **JPL Sentry**, and **ESA NEOCC**. Same designations, source values side by side — flags where they disagree.

> Not an alert system. Upstream: [CNEOS](https://cneos.jpl.nasa.gov/) · [ESA NEOCC](https://neo.ssa.esa.int/)

<br />

<p align="center">
  <img src="docs/images/dashboard.png" alt="BEACON dashboard" width="900" />
</p>

<p align="center">
  <em>Dashboard — live pull from JPL + ESA, risk Δ highlighted</em>
</p>

## Features

- Pulls public feeds: CAD (close approaches), Sentry (impact risk), ESA NEOCC (Aegis)
- Matches objects on normalized IAU designation (`1979 XB` ≡ `1979XB`)
- Keeps original values per source — no averaging, no homemade risk score
- Per-field Δ thresholds (IP / Palermo / Torino vs orbital distance / v_rel / date)
- Object detail with source table + miss-distance 3D sketch
- Methodology page documenting cuts and caveats

<p align="center">
  <img src="docs/images/methodology.png" alt="BEACON methodology" width="900" />
</p>

## Quick start

```bash
git clone https://github.com/NovaCoding-G/B.E.A.C.O.N.git
cd B.E.A.C.O.N
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No database, no API keys. On Windows use the npm scripts (they set `NODE_OPTIONS=--use-system-ca` for ESA TLS).

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router) · React 19 · TypeScript |
| UI | Tailwind 4 · Three.js / R3F (orbit sketch) |
| Data | Zod validation · in-memory TTL cache |
| Tests | Vitest |

## Metrics

| Metric | Meaning |
|--------|---------|
| `significantDivergences` | IP / Palermo / Torino past threshold |
| `totalFieldDivergences` | All flagged fields (incl. distance, v_rel, date) |

Threshold table: [`/methodology`](./app/methodology/page.tsx) · live dump: `GET /api/debug/divergences`

## Scripts

```bash
npm run dev      # local server
npm run build    # production build
npm run start    # serve build
npm test         # vitest
npm run lint     # eslint
```

## Project layout

```
app/           pages + API routes
components/    dashboard UI
lib/sources/   JPL CAD · Sentry · ESA NEOCC
lib/reconcile.ts
docs/images/   README screenshots
```

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Limits

- ESA API format can move
- Cache is in-memory only
- 3D view = miss distance sketch, not a full orbit
- We don’t recompute impact probabilities

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Cite

```
NovaCoding (2026). BEACON. v0.1.0. https://github.com/NovaCoding-G/B.E.A.C.O.N
```

Also [CITATION.cff](./CITATION.cff).

## License

[MIT](./LICENSE)

## Data attribution

- [NASA/JPL CNEOS](https://cneos.jpl.nasa.gov/)
- [ESA NEO Coordination Centre](https://neo.ssa.esa.int/)
