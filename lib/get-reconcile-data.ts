import { getCached, setCached, CACHE_KEYS } from "@/lib/cache";
import { fetchJplCloseApproaches } from "@/lib/sources/jpl-cad";
import { fetchJplSentry } from "@/lib/sources/jpl-sentry";
import { fetchEsaNeocc } from "@/lib/sources/esa-neocc";
import { reconcileSources } from "@/lib/reconcile";
import type { ReconcileResult, SourceFetchResult } from "@/lib/types";

/** Only cache fully healthy reconciliations so a transient outage cannot stick. */
export function shouldCacheReconcileResult(sourceStatus: {
  "jpl-cad": SourceFetchResult;
  "jpl-sentry": SourceFetchResult;
  "esa-neocc": SourceFetchResult;
}): boolean {
  return (
    sourceStatus["jpl-cad"].success &&
    sourceStatus["jpl-sentry"].success &&
    sourceStatus["esa-neocc"].success
  );
}

export async function getReconcileData(): Promise<ReconcileResult> {
  const cached = getCached<ReconcileResult>(CACHE_KEYS.RECONCILE);
  if (cached) return cached;

  const [cad, sentry, esa] = await Promise.all([
    fetchJplCloseApproaches(),
    fetchJplSentry(),
    fetchEsaNeocc(),
  ]);

  const sourceStatus = {
    "jpl-cad": cad.meta,
    "jpl-sentry": sentry.meta,
    "esa-neocc": esa.meta,
  };

  const result = reconcileSources({
    jplCad: cad.data,
    jplSentry: sentry.data,
    esaRisk: esa.risk,
    esaClose: esa.closeApproaches,
    sourceStatus,
  });

  if (shouldCacheReconcileResult(sourceStatus)) {
    setCached(CACHE_KEYS.RECONCILE, result, 5 * 60 * 1000);
  }
  return result;
}
