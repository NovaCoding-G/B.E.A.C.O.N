import { getCached, setCached, CACHE_KEYS } from "@/lib/cache";
import { fetchJplCloseApproaches } from "@/lib/sources/jpl-cad";
import { fetchJplSentry } from "@/lib/sources/jpl-sentry";
import { fetchEsaNeocc } from "@/lib/sources/esa-neocc";
import { reconcileSources } from "@/lib/reconcile";
import type { ReconcileResult, SourceFetchResult } from "@/lib/types";

const RECONCILE_TTL_MS = 5 * 60 * 1000;

/** Cache reconcile payloads only when every upstream source reported success. */
export function shouldCacheReconcileResult(
  sourceStatus: ReconcileResult["meta"]["sourceStatus"],
): boolean {
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

  const sourceStatus: Record<
    "jpl-cad" | "jpl-sentry" | "esa-neocc",
    SourceFetchResult
  > = {
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

  // Do not pin degraded/partial reconcile results for the 5-minute TTL —
  // healthy per-source caches still avoid refetching upstream on the next call.
  if (shouldCacheReconcileResult(result.meta.sourceStatus)) {
    setCached(CACHE_KEYS.RECONCILE, result, RECONCILE_TTL_MS);
  }

  return result;
}
