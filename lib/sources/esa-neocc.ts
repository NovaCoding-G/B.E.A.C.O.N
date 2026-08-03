import { fetchExternalText } from "@/lib/fetch-external";
import { getCached, setCached, CACHE_KEYS } from "@/lib/cache";
import {
  EsaCloseApproachSchema,
  EsaRiskEntrySchema,
  SOURCE_URLS,
  type EsaCloseApproach,
  type EsaRiskEntry,
  type SourceFetchResult,
} from "@/lib/types";

const RISK_URL = SOURCE_URLS["esa-neocc-risk"];
const CLOSE_URL = SOURCE_URLS["esa-neocc-close"];

function parsePipeLine(line: string): string[] {
  return line.split("|").map((part) => part.trim());
}

function parseScientific(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "n/a") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntField(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Split ESA object column "Num/des. Name" into designation and optional name */
export function parseEsaObjectColumn(objectCol: string): {
  designation: string;
  name?: string;
} {
  const trimmed = objectCol.trim();
  if (!trimmed) return { designation: "" };

  // Numbered object: permanent number is the matching key; remainder is display name/alias
  const numberedMatch = trimmed.match(/^(\d+)\s+(.+)$/);
  if (numberedMatch) {
    return {
      designation: numberedMatch[1],
      name: numberedMatch[2],
    };
  }

  // Provisional designation with optional trailing name
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && /^\d/.test(parts[0])) {
    return {
      designation: parts[0],
      name: parts.slice(1).join(" ") || undefined,
    };
  }

  return { designation: trimmed.replace(/\s+/g, "") };
}

export function parseEsaRiskList(text: string): {
  lastUpdate?: string;
  entries: EsaRiskEntry[];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  let lastUpdate: string | undefined;
  const entries: EsaRiskEntry[] = [];

  for (const line of lines) {
    if (line.startsWith("Last Update:")) {
      lastUpdate = line.replace("Last Update:", "").trim();
      continue;
    }
    if (
      line.includes("Object") ||
      line.includes("Num/des.") ||
      line.includes("AAAAAAAA")
    ) {
      continue;
    }

    const cols = parsePipeLine(line);
    if (cols.length < 8) continue;

    const { designation, name } = parseEsaObjectColumn(cols[0]);
    if (!designation) continue;

    const entry = EsaRiskEntrySchema.safeParse({
      designation,
      name,
      diameterMeters: parseIntField(cols[1]),
      diameterFromMagnitude: cols[2] === "*",
      viMaxDate: cols[3] || undefined,
      maxImpactProbability: parseScientific(cols[4]),
      palermoScaleMax: parseScientific(cols[5]),
      torinoScaleMax: parseIntField(cols[6]),
      velocityKms: parseScientific(cols[7]),
      riskYears: cols[8] || undefined,
      cumulativeImpactProbability: parseScientific(cols[9]),
      palermoScaleCumulative: parseScientific(cols[10]),
    });

    if (entry.success) {
      entries.push(entry.data);
    } else {
      console.warn("[esa-neocc] Risk row failed:", entry.error.message, designation);
    }
  }

  return { lastUpdate, entries };
}

export function parseEsaCloseApproaches(text: string): {
  lastUpdate?: string;
  entries: EsaCloseApproach[];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  let lastUpdate: string | undefined;
  const entries: EsaCloseApproach[] = [];

  for (const line of lines) {
    if (line.startsWith("Last Update:")) {
      lastUpdate = line.replace("Last Update:", "").trim();
      continue;
    }
    if (
      line.includes("Object") ||
      line.includes("Num/des.") ||
      line.includes("AAAAAAAA")
    ) {
      continue;
    }

    const cols = parsePipeLine(line);
    if (cols.length < 9) continue;

    const { designation, name } = parseEsaObjectColumn(cols[0]);
    if (!designation) continue;

    const entry = EsaCloseApproachSchema.safeParse({
      designation,
      name,
      date: cols[1],
      missDistanceKm: parseIntField(cols[2]),
      missDistanceAu: parseScientific(cols[3]),
      missDistanceLd: parseScientific(cols[4]),
      diameterMeters: parseIntField(cols[5]),
      diameterFromMagnitude: cols[6] === "*",
      absoluteMagnitudeH: parseScientific(cols[7]),
      maxBrightnessMag: parseScientific(cols[8]),
      relativeVelocityKms: parseScientific(cols[9]),
      caiIndex: parseScientific(cols[10]),
    });

    if (entry.success) {
      entries.push(entry.data);
    } else {
      console.warn(
        "[esa-neocc] Close approach row failed:",
        entry.error.message,
        designation,
      );
    }
  }

  return { lastUpdate, entries };
}

async function fetchEsaText(url: string): Promise<string> {
  return fetchExternalText(url, {
    next: { revalidate: 900 },
  });
}

type CachedEsaRisk = {
  entries: EsaRiskEntry[];
  lastUpdate?: string;
  fetchedAt: string;
};

type CachedEsaClose = {
  entries: EsaCloseApproach[];
  lastUpdate?: string;
  fetchedAt: string;
};

export async function fetchEsaRiskList(): Promise<{
  data: EsaRiskEntry[];
  lastUpdate?: string;
  meta: SourceFetchResult;
}> {
  const cached = getCached<CachedEsaRisk>(CACHE_KEYS.ESA_RISK);
  if (cached) {
    return {
      data: cached.entries,
      lastUpdate: cached.lastUpdate,
      meta: {
        source: "esa-neocc",
        fetchedAt: cached.fetchedAt,
        success: true,
        url: RISK_URL,
      },
    };
  }

  const fetchedAt = new Date().toISOString();

  try {
    const text = await fetchEsaText(RISK_URL);
    const parsed = parseEsaRiskList(text);
    setCached(CACHE_KEYS.ESA_RISK, {
      entries: parsed.entries,
      lastUpdate: parsed.lastUpdate,
      fetchedAt,
    });

    return {
      data: parsed.entries,
      lastUpdate: parsed.lastUpdate,
      meta: {
        source: "esa-neocc",
        fetchedAt,
        success: true,
        url: RISK_URL,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("[esa-neocc] Risk list fetch failed:", message);
    return {
      data: [],
      meta: {
        source: "esa-neocc",
        fetchedAt,
        success: false,
        error: message,
        url: RISK_URL,
      },
    };
  }
}

export async function fetchEsaCloseApproaches(): Promise<{
  data: EsaCloseApproach[];
  lastUpdate?: string;
  meta: SourceFetchResult;
}> {
  const cached = getCached<CachedEsaClose>(CACHE_KEYS.ESA_CLOSE);
  if (cached) {
    return {
      data: cached.entries,
      lastUpdate: cached.lastUpdate,
      meta: {
        source: "esa-neocc",
        fetchedAt: cached.fetchedAt,
        success: true,
        url: CLOSE_URL,
      },
    };
  }

  const fetchedAt = new Date().toISOString();

  try {
    const text = await fetchEsaText(CLOSE_URL);
    const parsed = parseEsaCloseApproaches(text);
    setCached(CACHE_KEYS.ESA_CLOSE, {
      entries: parsed.entries,
      lastUpdate: parsed.lastUpdate,
      fetchedAt,
    });

    return {
      data: parsed.entries,
      lastUpdate: parsed.lastUpdate,
      meta: {
        source: "esa-neocc",
        fetchedAt,
        success: true,
        url: CLOSE_URL,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn("[esa-neocc] Close approaches fetch failed:", message);
    return {
      data: [],
      meta: {
        source: "esa-neocc",
        fetchedAt,
        success: false,
        error: message,
        url: CLOSE_URL,
      },
    };
  }
}

export async function fetchEsaNeocc(): Promise<{
  risk: EsaRiskEntry[];
  closeApproaches: EsaCloseApproach[];
  meta: SourceFetchResult;
}> {
  const [riskResult, closeResult] = await Promise.all([
    fetchEsaRiskList(),
    fetchEsaCloseApproaches(),
  ]);

  return {
    risk: riskResult.data,
    closeApproaches: closeResult.data,
    meta: aggregateEsaFetchMeta(riskResult.meta, closeResult.meta),
  };
}

/** Prefer latest successful component fetch; otherwise max of both attempt times. */
function aggregateFetchedAt(
  riskMeta: SourceFetchResult,
  closeMeta: SourceFetchResult,
): string {
  const successful: string[] = [];
  if (riskMeta.success) successful.push(riskMeta.fetchedAt);
  if (closeMeta.success) successful.push(closeMeta.fetchedAt);
  const pool =
    successful.length > 0
      ? successful
      : [riskMeta.fetchedAt, closeMeta.fetchedAt];
  return pool.reduce((a, b) => (a >= b ? a : b));
}

/** Aggregate ESA risk + close metas (success only when both feeds succeed). */
export function aggregateEsaFetchMeta(
  riskMeta: SourceFetchResult,
  closeMeta: SourceFetchResult,
): SourceFetchResult {
  const success = riskMeta.success && closeMeta.success;
  const partial = !success && (riskMeta.success || closeMeta.success);
  const failures: string[] = [];
  if (!riskMeta.success) {
    failures.push(`ESA risk list: ${riskMeta.error ?? "unavailable"}`);
  }
  if (!closeMeta.success) {
    failures.push(`ESA close approaches: ${closeMeta.error ?? "unavailable"}`);
  }
  return {
    source: "esa-neocc",
    fetchedAt: aggregateFetchedAt(riskMeta, closeMeta),
    success,
    partial: partial || undefined,
    error: failures.length > 0 ? failures.join("; ") : undefined,
    url: riskMeta.url || RISK_URL,
    components: {
      risk: {
        success: riskMeta.success,
        error: riskMeta.error,
        fetchedAt: riskMeta.fetchedAt,
        url: riskMeta.url,
      },
      close: {
        success: closeMeta.success,
        error: closeMeta.error,
        fetchedAt: closeMeta.fetchedAt,
        url: closeMeta.url,
      },
    },
  };
}
