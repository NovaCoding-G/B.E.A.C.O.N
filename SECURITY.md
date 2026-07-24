# Security

This app only displays public NASA/JPL and ESA data. It does not issue alerts.

## Vulns

Private issue if you can, else email in `lib/site.ts`. Don’t dump exploit details in a public issue before a fix.

## Data

Don’t fake NEO numbers. When talking about risk mismatches, use `significantDivergences`, not the raw field count.

Sources: [CNEOS](https://cneos.jpl.nasa.gov/), [ESA NEOCC](https://neo.ssa.esa.int/).

## Network

Windows may need `--use-system-ca` (already in the npm scripts). Don’t turn off TLS checks in prod.
