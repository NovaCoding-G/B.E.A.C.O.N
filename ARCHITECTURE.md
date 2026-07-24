# Architecture

Next.js App Router. Fetch public NEO APIs, validate, match, diff. No DB.

## Flow

```
JPL CAD / Sentry / ESA NEOCC
        ↓
lib/sources/*  (+ Zod)
        ↓
lib/reconcile.ts
        ↓
app pages + components
```

## Pieces

**Sources** — one module each: fetch, parse, Zod, 15 min cache.

**API** — `/api/close-approaches`, `/sentry`, `/neocc-risk`, `/neocc-close-approaches`, `/reconcile`.

**Reconcile** — IAU designation key (`1979 XB` → `1979XB`). Keep raw values. Flag Δ on IP, Palermo, Torino, miss distance, date. Filters: `?view=all|multi|divergent|risk`. No homemade risk score.

**UI** — dark instrument look (IBM Plex). Amber for Δ, red only when scales are actually hot.

## Cache

Sources 15 min · reconcile 5 min. Data barely moves day-to-day.

## Tests

`tests/reconcile.test.ts` — designation normalize, matching, Δ, CAD/ESA parse.

## Out of scope (v1)

DB · NeoWs · full Kepler orbits · aggregate “BEACON score”
