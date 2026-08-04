# Changelog

## [0.2.0] — 2026-08-04

Audit & reliability release: honest feed status, aligned comparisons, safer caching, and cleared production dependency advisories.

### Reliability
- ESA numbered-object matching uses permanent designation correctly
- Shared 365-day close-approach comparison window for JPL CAD and ESA
- Risk-list tab count aligned with filter rows (`riskListed`)
- Source outages and partial ESA failures surfaced in UI (per-feed status)
- Cache preserves original `fetchedAt` on hits; degraded reconcile results are not cached
- Malformed ESA bodies rejected as unhealthy (not cached as empty success)
- Chronological sort by calendar date key for close approaches
- Risk-year ranges shown when JPL/ESA aggregation windows differ
- Relative velocity compared at ESA reporting precision (0.1 km/s)
- HTTP retries for transient 408/429/5xx with capped Retry-After

### Dependencies & tooling
- Next.js / eslint-config-next 16.3.0; overrides for nested postcss, sharp, brace-expansion
- Dependabot (npm + GitHub Actions) and CI `npm audit --omit=dev` gate

## [0.1.0] — 2026-07-23

- Dashboard over JPL CAD, Sentry, ESA NEOCC
- Match on normalized IAU designation
- Per-field Δ thresholds (`significantDivergences` / `totalFieldDivergences`)
- Comparison panel, provenance footer, miss-distance 3D sketch
- About + methodology
- Vitest for matching / parsing / known cases
- `GET /api/debug/divergences`
