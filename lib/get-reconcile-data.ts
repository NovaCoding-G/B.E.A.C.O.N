import { getCached, setCached, CACHE_KEYS } from "@/lib/cache";
import { fetchJplCloseApproaches } from "@/lib/sources/jpl-cad";
import { fetchJplSentry } from "@/lib/sources/jpl-sentry";
import { fetchEsaNeocc } from "@/lib/sources/esa-neocc";
import { reconcileSources } from "@/lib/reconcile";
import type { ReconcileResult } from "@/lib/types";

export async function getReconcileData(): Promise<ReconcileResult> {
  const cached = getCached<ReconcileResult>(CACHE_KEYS.RECONCILE);
  if (cached) return cached;

  const [cad, sentry, esa] = await Promise.all([
    fetchJplCloseApproaches(),
    fetchJplSentry(),
    fetchEsaNeocc(),
  ]);

  const result = reconcileSources({
    jplCad: cad.data,
    jplSentry: sentry.data,
    esaRisk: esa.risk,
    esaClose: esa.closeApproaches,
    sourceStatus: {
      "jpl-cad": cad.meta,
      "jpl-sentry": sentry.meta,
      "esa-neocc": esa.meta,
    },
  });

  setCached(CACHE_KEYS.RECONCILE, result, 5 * 60 * 1000);
  return result;
}
