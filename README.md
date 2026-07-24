# BEACON

[![CI](https://github.com/NovaCoding-G/B.E.A.C.O.N/actions/workflows/ci.yml/badge.svg)](https://github.com/NovaCoding-G/B.E.A.C.O.N/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/NovaCoding-G/B.E.A.C.O.N/blob/main/LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![NovaCheck](https://img.shields.io/badge/NovaCheck-100%2F100-brightgreen)](https://github.com/NovaCoding-G/B.E.A.C.O.N/blob/main/.novacheck/report.html)

**Bayesian Earth-impact Assessment & Cross-source Observation Network**

Cross-checks near-Earth object data from **JPL CAD**, **JPL Sentry**, and **ESA NEOCC**. Same designations, source values side by side — flags where they disagree.

> Not an alert system. Upstream: [CNEOS](https://cneos.jpl.nasa.gov/) · [ESA NEOCC](https://neo.ssa.esa.int/)

**🔴 Live demo: [novabeacon.vercel.app](https://novabeacon.vercel.app)**

![BEACON dashboard](docs/images/dashboard.png)

*Dashboard — live pull from JPL + ESA, risk Δ highlighted*

## Features

- Pulls public feeds: CAD (close approaches), Sentry (impact risk), ESA NEOCC (Aegis)
- Matches objects on normalized IAU designation (`1979 XB` ≡ `1979XB`)
- Keeps original values per source — no averaging, no homemade risk score
- Per-field Δ thresholds (IP / Palermo / Torino vs orbital distance / v_rel / date)
- Object detail with source table + miss-distance 3D sketch
- Methodology page documenting cuts and caveats

![BEACON methodology](docs/images/methodology.png)

## Quick start

```bash
git clone https://github.com/NovaCoding-G/B.E.A.C.O.N.git
cd B.E.A.C.O.N
npm install
npm run dev
```

Open <http://localhost:3000>. Or skip setup entirely and use the [live demo](https://novabeacon.vercel.app).

No database, no API keys. On Windows use the npm scripts (they set `NODE_OPTIONS=--use-system-ca` for ESA TLS).

## Stack

|       |                                                 |
| ----- | ----------------------------------------------- |
| App   | Next.js 16 (App Router) · React 19 · TypeScript |
| UI    | Tailwind 4 · Three.js / R3F (orbit sketch)      |
| Data  | Zod validation · in-memory TTL cache            |
| Tests | Vitest                                          |

## Metrics

| Metric                   | Meaning                                           |
| ------------------------ | ------------------------------------------------- |
| `significantDivergences` | IP / Palermo / Torino past threshold              |
| `totalFieldDivergences`  | All flagged fields (incl. distance, v_rel, date) |

Threshold table: [`/methodology`](https://github.com/NovaCoding-G/B.E.A.C.O.N/blob/main/app/methodology/page.tsx) · live dump: `GET /api/debug/divergences`

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

See [ARCHITECTURE.md](https://github.com/NovaCoding-G/B.E.A.C.O.N/blob/main/ARCHITECTURE.md).

## Limits

- ESA API format can move
- Cache is in-memory only
- 3D view = miss distance sketch, not a full orbit
- We don't recompute impact probabilities

 ## Roadmap
- **v0.2.0** — Third independent source (NEODyS/Clomon2), persistent cache, and UI redesign
 - **v0.3.0** — History: tracking how estimates change over time, rather than just a snapshot
- **v0.4.0** — Real Keplerian orbit (moving beyond a mere sketch), public API
- **v1.0.0** — Consolidation: comprehensive testing and review by industry experts

**Deliberately excluded from the roadmap:** no proprietary risk scores, no operational alert functions, and no recalculation of impact probabilities—BEACON remains a transparent visualization client, not an alternative to official systems.

## Contributing

See [CONTRIBUTING.md](https://github.com/NovaCoding-G/B.E.A.C.O.N/blob/main/CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](https://github.com/NovaCoding-G/B.E.A.C.O.N/blob/main/CODE_OF_CONDUCT.md).

## Cite

```
NovaCoding (2026). BEACON. v0.1.0. https://github.com/NovaCoding-G/B.E.A.C.O.N
```

Also [CITATION.cff](https://github.com/NovaCoding-G/B.E.A.C.O.N/blob/main/CITATION.cff).

## License

[MIT](https://github.com/NovaCoding-G/B.E.A.C.O.N/blob/main/LICENSE)

## Data attribution

- [NASA/JPL CNEOS](https://cneos.jpl.nasa.gov/)
- [ESA NEO Coordination Centre](https://neo.ssa.esa.int/)

