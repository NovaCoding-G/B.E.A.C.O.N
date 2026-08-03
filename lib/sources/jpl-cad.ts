import { fetchExternalJson } from "@/lib/fetch-external";
import { getCached, setCached, CACHE_KEYS } from "@/lib/cache";
import {
  JplCadResponseSchema,
  JplCloseApproachSchema,
  SOURCE_URLS,
  type JplCloseApproach,
  type SourceFetchResult,
} from "@/lib/types";

const CAD_URL = SOURCE_URLS["jpl-cad"];

function parseNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseString(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

/** Map positional CAD row to object using runtime `fields` array */
export function mapCadRow(
  fields: string[],
  row: (string | number | null)[],
): JplCloseApproach | null {
  const record: Record<string, string | number | null> = {};
  fields.forEach((field, i) => {
    record[field] = row[i] ?? null;
  });

  const designation = parseString(record.des);
  const closeApproachDate = parseString(record.cd);
  const distanceAu = parseNumber(record.dist);

  if (!designation || !closeApproachDate || distanceAu === undefined) {
    return null;
  }

  const parsed = JplCloseApproachSchema.safeParse({
    designation,
    orbitId: parseString(record.orbit_id),
    julianDate: parseNumber(record.jd),
    closeApproachDate,
    distanceAu,
    distanceMinAu: parseNumber(record.dist_min),
    distanceMaxAu: parseNumber(record.dist_max),
    velocityRelativeKms: parseNumber(record.v_rel),
    velocityInfinityKms: parseNumber(record.v_inf),
    timeUncertainty: parseString(record.t_sigma_f),
    absoluteMagnitudeH: parseNumber(record.h),
  });

  if (!parsed.success) {
    console.warn("[jpl-cad] Row validation failed:", parsed.error.message, record);
    return null;
  }

  return parsed.data;
}

export function parseJplCadResponse(raw: unknown): JplCloseApproach[] {
  const validated = JplCadResponseSchema.safeParse(raw);
  if (!validated.success) {
    throw new Error(`JPL CAD response invalid: ${validated.error.message}`);
  }

  const { fields, data } = validated.data;
  const results: JplCloseApproach[] = [];

  for (const row of data) {
    const mapped = mapCadRow(fields, row);
    if (mapped) results.push(mapped);
  }

  return results;
}

type CachedJplCad = {
  data: JplCloseApproach[];
  fetchedAt: string;
};

export async function fetchJplCloseApproaches(): Promise<{
  data: JplCloseApproach[];
  meta: SourceFetchResult;
}> {
  const cached = getCached<CachedJplCad>(CACHE_KEYS.JPL_CAD);
  if (cached) {
    return {
      data: cached.data,
      meta: {
        source: "jpl-cad",
        fetchedAt: cached.fetchedAt,
        success: true,
        url: CAD_URL,
      },
    };
  }

  const fetchedAt = new Date().toISOString();

  try {
    const json = await fetchExternalJson(CAD_URL, {
      next: { revalidate: 900 },
    });
    const data = parseJplCadResponse(json);
    setCached(CACHE_KEYS.JPL_CAD, { data, fetchedAt });

    return {
      data,
      meta: {
        source: "jpl-cad",
        fetchedAt,
        success: true,
        url: CAD_URL,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[jpl-cad] Fetch failed:", message);
    return {
      data: [],
      meta: {
        source: "jpl-cad",
        fetchedAt,
        success: false,
        error: message,
        url: CAD_URL,
      },
    };
  }
}
