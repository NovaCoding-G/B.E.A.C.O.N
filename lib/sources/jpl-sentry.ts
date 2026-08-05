import { fetchExternalJson } from "@/lib/fetch-external";
import { getCached, setCached, CACHE_KEYS } from "@/lib/cache";
import {
  JplSentryResponseSchema,
  JplSentryEntrySchema,
  SOURCE_URLS,
  type JplSentryEntry,
  type SourceFetchResult,
} from "@/lib/types";

const SENTRY_URL = SOURCE_URLS["jpl-sentry"];

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function sentryField(value: unknown): string | number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" || typeof value === "number") return value;
  return undefined;
}

function mapJplSentryItem(item: Record<string, unknown>): JplSentryEntry | null {
  const des = item.des;
  if (typeof des !== "string" || !des) return null;

  const entry = JplSentryEntrySchema.safeParse({
    designation: des,
    fullName: typeof item.fullname === "string" ? item.fullname : undefined,
    cumulativeImpactProbability: toNumber(sentryField(item.ip)),
    palermoScaleCumulative: toNumber(sentryField(item.ps_cum)),
    palermoScaleMax: toNumber(sentryField(item.ps_max)),
    torinoScaleMax: toNumber(sentryField(item.ts_max)),
    riskWindowYears: typeof item.range === "string" ? item.range : undefined,
    diameterKm: toNumber(sentryField(item.diameter)),
    absoluteMagnitudeH: toNumber(sentryField(item.h)),
    velocityInfinityKms: toNumber(sentryField(item.v_inf)),
    impactCount:
      item.n_imp !== undefined && item.n_imp !== null
        ? Number(item.n_imp)
        : undefined,
    lastObservation:
      typeof item.last_obs === "string" ? item.last_obs : undefined,
  });

  if (entry.success) return entry.data;
  console.warn("[jpl-sentry] Entry validation failed:", entry.error.message, des);
  return null;
}

export function parseJplSentryResponse(raw: unknown): JplSentryEntry[] {
  const validated = JplSentryResponseSchema.safeParse(raw);
  if (!validated.success) {
    throw new Error(`JPL Sentry response invalid: ${validated.error.message}`);
  }

  const results: JplSentryEntry[] = [];
  const rows = validated.data.data;

  for (const item of rows) {
    const mapped = mapJplSentryItem(item);
    if (mapped) results.push(mapped);
  }

  // Same guard as ESA: reject total row-loss as unhealthy format drift.
  if (rows.length > 0 && results.length === 0) {
    throw new Error(
      `JPL Sentry: all ${rows.length} data row(s) rejected (format drift)`,
    );
  }

  return results;
}

type CachedJplSentry = {
  data: JplSentryEntry[];
  fetchedAt: string;
};

export async function fetchJplSentry(): Promise<{
  data: JplSentryEntry[];
  meta: SourceFetchResult;
}> {
  const cached = getCached<CachedJplSentry>(CACHE_KEYS.JPL_SENTRY);
  if (cached) {
    return {
      data: cached.data,
      meta: {
        source: "jpl-sentry",
        fetchedAt: cached.fetchedAt,
        success: true,
        url: SENTRY_URL,
      },
    };
  }

  const fetchedAt = new Date().toISOString();

  try {
    const json = await fetchExternalJson(SENTRY_URL, {
      next: { revalidate: 900 },
    });
    const data = parseJplSentryResponse(json);
    setCached(CACHE_KEYS.JPL_SENTRY, { data, fetchedAt });

    return {
      data,
      meta: {
        source: "jpl-sentry",
        fetchedAt,
        success: true,
        url: SENTRY_URL,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[jpl-sentry] Fetch failed:", message);
    return {
      data: [],
      meta: {
        source: "jpl-sentry",
        fetchedAt,
        success: false,
        error: message,
        url: SENTRY_URL,
      },
    };
  }
}
