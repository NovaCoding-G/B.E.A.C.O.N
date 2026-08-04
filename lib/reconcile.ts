import {
  CLOSE_APPROACH_HORIZON_DAYS,
  type ComparisonWindow,
  type EsaCloseApproach,
  type EsaRiskEntry,
  type FeedStatus,
  type JplCloseApproach,
  type JplSentryEntry,
  type ReconcileResult,
  type ReconcileStats,
  type ReconcileView,
  type ReconciledObject,
  type SourceFetchResult,
} from "@/lib/types";

/** Per-field divergence thresholds (see /methodology). */
export const DIVERGENCE_THRESHOLDS = {
  missDistanceAuRelative: 0.03,
  relativeVelocityRelative: 0.01,
  impactProbabilityRatio: 2,
  impactProbabilityFloor: 1e-7,
  palermoAbsolute: 0.5,
} as const;

/** ESA NEOCC close-approach relative velocity is published as DD.D km/s. */
export const ESA_RELATIVE_VELOCITY_DECIMALS = 1;

/** Short labels for comparison-panel tooltips. */
export const FIELD_THRESHOLD_INFO: Record<
  string,
  { short: string; explanation: string; category: "orbital" | "risk" }
> = {
  missDistanceAu: {
    short: "3% rel",
    explanation: "JPL vs ESA miss distance; flag above 3% relative.",
    category: "orbital",
  },
  relativeVelocity: {
    short: "1% rel (ESA 0.1 km/s)",
    explanation:
      "Relative speed; round JPL to ESA's 0.1 km/s reporting precision, then flag above 1%. Raw values unchanged.",
    category: "orbital",
  },
  closeApproachDate: {
    short: "date",
    explanation: "Calendar day only (drop time).",
    category: "orbital",
  },
  cumulativeImpactProbability: {
    short: ">2× (floor 1e-7)",
    explanation: "Ratio >2×; ignore if both <1e-7.",
    category: "risk",
  },
  palermoScaleCumulative: {
    short: "|Δ| > 0.5",
    explanation: "Absolute Palermo gap > 0.5.",
    category: "risk",
  },
  torinoScaleMax: {
    short: "exact",
    explanation: "Any Torino mismatch counts.",
    category: "risk",
  },
};

const RISK_FIELDS = new Set([
  "cumulativeImpactProbability",
  "palermoScaleCumulative",
  "torinoScaleMax",
]);

/** Normalize IAU designation for cross-source matching. */
export function normalizeDesignation(designation: string): string {
  let normalized = designation.trim().toUpperCase();

  normalized = normalized.replace(/\s+/g, " ");

  const provisionalMatch = normalized.match(/^(\d{4})\s+([A-Z]{1,2}\d*)$/);
  if (provisionalMatch) {
    return `${provisionalMatch[1]}${provisionalMatch[2]}`;
  }

  const compactProvisional = normalized.match(/^(\d{4})([A-Z]{1,2}\d*)$/);
  if (compactProvisional) {
    return normalized.replace(/\s/g, "");
  }

  const numberedMatch = normalized.match(/^(\d+)\s+(.+)$/);
  if (numberedMatch) {
    return `${numberedMatch[1]}${numberedMatch[2].replace(/\s/g, "")}`;
  }

  return normalized.replace(/\s/g, "");
}

export function designationsMatch(a: string, b: string): boolean {
  return normalizeDesignation(a) === normalizeDesignation(b);
}

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** Calendar date key YYYY-MM-DD (ignores time of day). */
export function approachDateKey(date: string): string | null {
  const s = date.trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const jpl = s.match(/^(\d{4})-([A-Za-z]{3})-(\d{1,2})\b/);
  if (jpl) {
    const month = MONTH_MAP[jpl[2].toLowerCase()];
    if (!month) return null;
    return `${jpl[1]}-${month}-${jpl[3].padStart(2, "0")}`;
  }

  return null;
}

function utcDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateOnly(d);
}

/** Inclusive shared encounter window used for JPL CAD and ESA close approaches. */
export function buildComparisonWindow(
  referenceDate: Date = new Date(),
): ComparisonWindow {
  const start = utcDateOnly(referenceDate);
  return {
    start,
    end: addUtcDays(start, CLOSE_APPROACH_HORIZON_DAYS),
    days: CLOSE_APPROACH_HORIZON_DAYS,
  };
}

/** True when the approach calendar day falls inside the inclusive comparison window. */
export function isWithinComparisonWindow(
  date: string,
  window: ComparisonWindow,
): boolean {
  const key = approachDateKey(date);
  if (!key) return false;
  return key >= window.start && key <= window.end;
}

function relativeExceeds(
  a: number | undefined,
  b: number | undefined,
  relativeTolerance: number,
): boolean {
  if (a === undefined || b === undefined) return false;
  if (a === b) return false;
  const maxVal = Math.max(Math.abs(a), Math.abs(b));
  if (maxVal === 0) return false;
  return Math.abs(a - b) / maxVal > relativeTolerance;
}

export function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Relative-velocity divergence: compare after rounding JPL to ESA's DD.D km/s
 * precision so quantization alone does not flag a disagreement.
 */
export function relativeVelocitiesDiverge(
  jpl: number | undefined,
  esa: number | undefined,
  relativeTolerance: number = DIVERGENCE_THRESHOLDS.relativeVelocityRelative,
): boolean {
  if (jpl === undefined || esa === undefined) return false;
  const jplAtEsaPrecision = roundToDecimals(
    jpl,
    ESA_RELATIVE_VELOCITY_DECIMALS,
  );
  return relativeExceeds(jplAtEsaPrecision, esa, relativeTolerance);
}

export function impactProbabilitiesDiverge(
  a: number | undefined,
  b: number | undefined,
  ratioFactor: number = DIVERGENCE_THRESHOLDS.impactProbabilityRatio,
  floor: number = DIVERGENCE_THRESHOLDS.impactProbabilityFloor,
): boolean {
  if (a === undefined || b === undefined) return false;
  if (a === b) return false;

  if (a < floor && b < floor) return false;

  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (lo <= 0) return hi > floor;

  return hi / lo > ratioFactor;
}

export function palermoScalesDiverge(
  a: number | undefined,
  b: number | undefined,
  absolute: number = DIVERGENCE_THRESHOLDS.palermoAbsolute,
): boolean {
  if (a === undefined || b === undefined) return false;
  return Math.abs(a - b) > absolute;
}

function countSourceCoverage(opts: {
  jplCad?: JplCloseApproach;
  jplSentry?: JplSentryEntry;
  esaRisk?: EsaRiskEntry;
  esaClose?: EsaCloseApproach;
}): number {
  let count = 0;
  if (opts.jplCad) count++;
  if (opts.jplSentry) count++;
  if (opts.esaRisk || opts.esaClose) count++;
  return count;
}

function addDivergence(
  divergences: ReconciledObject["divergences"],
  field: keyof typeof FIELD_THRESHOLD_INFO | string,
  sources: Record<string, number | string | null>,
  notes?: string,
): void {
  const info = FIELD_THRESHOLD_INFO[field];
  divergences.push({
    field,
    sources,
    threshold: info?.short,
    thresholdExplanation: info?.explanation,
    notes,
    category: info?.category ?? (RISK_FIELDS.has(field) ? "risk" : "orbital"),
  });
}

/** Normalize risk-year range strings for equality checks. */
export function normalizeRiskYears(
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().replace(/\s+/g, "");
  return trimmed.length > 0 ? trimmed : undefined;
}

/** True when both sources publish a range and they differ (informational only). */
export function riskYearRangesDiffer(
  jplWindow: string | undefined,
  esaYears: string | undefined,
): boolean {
  const jpl = normalizeRiskYears(jplWindow);
  const esa = normalizeRiskYears(esaYears);
  if (jpl === undefined || esa === undefined) return false;
  return jpl !== esa;
}

export function unequalRiskYearsNote(
  jplWindow: string | undefined,
  esaYears: string | undefined,
): string | undefined {
  if (!riskYearRangesDiffer(jplWindow, esaYears)) return undefined;
  return (
    `Aggregation windows differ (informational): JPL ${normalizeRiskYears(jplWindow)} ` +
    `vs ESA ${normalizeRiskYears(esaYears)}. Cumulative threshold still applies.`
  );
}

function buildReconciledObject(
  designation: string,
  normalizedKey: string,
  opts: {
    jplCad?: JplCloseApproach;
    jplSentry?: JplSentryEntry;
    esaRisk?: EsaRiskEntry;
    esaClose?: EsaCloseApproach;
    cadFetchedAt?: string;
    sentryFetchedAt?: string;
    esaFetchedAt?: string;
  },
): ReconciledObject {
  const divergences: ReconciledObject["divergences"] = [];

  const displayName =
    opts.jplSentry?.fullName?.replace(/[()]/g, "") ??
    opts.esaRisk?.name ??
    opts.esaClose?.name;

  const riskYearsNote = unequalRiskYearsNote(
    opts.jplSentry?.riskWindowYears,
    opts.esaRisk?.riskYears,
  );

  const jplIp = opts.jplSentry?.cumulativeImpactProbability;
  const esaIp = opts.esaRisk?.cumulativeImpactProbability;
  if (impactProbabilitiesDiverge(jplIp, esaIp)) {
    addDivergence(
      divergences,
      "cumulativeImpactProbability",
      {
        "jpl-sentry": jplIp ?? null,
        "esa-neocc": esaIp ?? null,
      },
      riskYearsNote,
    );
  }

  const jplPs = opts.jplSentry?.palermoScaleCumulative;
  const esaPs = opts.esaRisk?.palermoScaleCumulative;
  if (palermoScalesDiverge(jplPs, esaPs)) {
    addDivergence(
      divergences,
      "palermoScaleCumulative",
      {
        "jpl-sentry": jplPs ?? null,
        "esa-neocc": esaPs ?? null,
      },
      riskYearsNote,
    );
  }

  const jplTorino = opts.jplSentry?.torinoScaleMax;
  const esaTorino = opts.esaRisk?.torinoScaleMax;
  if (
    jplTorino !== undefined &&
    esaTorino !== undefined &&
    jplTorino !== esaTorino
  ) {
    addDivergence(divergences, "torinoScaleMax", {
      "jpl-sentry": jplTorino,
      "esa-neocc": esaTorino,
    });
  }

  const jplDate = opts.jplCad?.closeApproachDate;
  const esaDate = opts.esaClose?.date;
  const jplKey = jplDate ? approachDateKey(jplDate) : null;
  const esaKey = esaDate ? approachDateKey(esaDate) : null;
  const sameEncounterDay =
    jplKey !== null && esaKey !== null && jplKey === esaKey;

  if (jplDate && esaDate && jplKey && esaKey && jplKey !== esaKey) {
    addDivergence(divergences, "closeApproachDate", {
      "jpl-cad": jplDate,
      "esa-neocc": esaDate,
    });
  }

  // Geometry is encounter-specific: only compare when both sides share a day.
  if (sameEncounterDay) {
    const jplDist = opts.jplCad?.distanceAu;
    const esaDist = opts.esaClose?.missDistanceAu;
    if (
      relativeExceeds(
        jplDist,
        esaDist,
        DIVERGENCE_THRESHOLDS.missDistanceAuRelative,
      )
    ) {
      addDivergence(divergences, "missDistanceAu", {
        "jpl-cad": jplDist ?? null,
        "esa-neocc": esaDist ?? null,
      });
    }

    const jplVel = opts.jplCad?.velocityRelativeKms;
    const esaVel = opts.esaClose?.relativeVelocityKms;
    if (relativeVelocitiesDiverge(jplVel, esaVel)) {
      addDivergence(divergences, "relativeVelocity", {
        "jpl-cad": jplVel ?? null,
        "esa-neocc": esaVel ?? null,
      });
    }
  }

  const sourceCoverage = countSourceCoverage(opts);
  const totalFieldDivergences = divergences.length;
  const significantDivergences = divergences.filter(
    (d) => d.category === "risk",
  ).length;

  return {
    designation,
    normalizedKey,
    displayName,
    sourceCoverage,
    crossSourceMatch: sourceCoverage >= 2,
    totalFieldDivergences,
    significantDivergences,
    sources: {
      jplCad: {
        present: !!opts.jplCad,
        fetchedAt: opts.cadFetchedAt,
        closeApproach: opts.jplCad,
      },
      jplSentry: {
        present: !!opts.jplSentry,
        fetchedAt: opts.sentryFetchedAt,
        risk: opts.jplSentry,
      },
      esaNeocc: {
        present: !!(opts.esaRisk || opts.esaClose),
        fetchedAt: opts.esaFetchedAt,
        risk: opts.esaRisk,
        closeApproach: opts.esaClose,
      },
    },
    divergences,
  };
}

export interface ReconcileInput {
  jplCad: JplCloseApproach[];
  jplSentry: JplSentryEntry[];
  esaRisk: EsaRiskEntry[];
  esaClose: EsaCloseApproach[];
  sourceStatus: {
    "jpl-cad": SourceFetchResult;
    "jpl-sentry": SourceFetchResult;
    "esa-neocc": SourceFetchResult;
  };
  /** ISO timestamp or YYYY-MM-DD; defaults to now (for tests / stable windows). */
  referenceDate?: string;
}

/** Per-feed health for dashboard alerts (CAD, Sentry, ESA risk, ESA close). */
export function buildFeedStatus(sourceStatus: {
  "jpl-cad": SourceFetchResult;
  "jpl-sentry": SourceFetchResult;
  "esa-neocc": SourceFetchResult;
}): FeedStatus {
  const esa = sourceStatus["esa-neocc"];
  const risk = esa.components?.risk ?? {
    success: esa.success,
    error: esa.error,
    fetchedAt: esa.fetchedAt,
    url: esa.url,
  };
  const close = esa.components?.close ?? {
    success: esa.success,
    error: esa.error,
    fetchedAt: esa.fetchedAt,
    url: esa.url,
  };

  return {
    "jpl-cad": {
      success: sourceStatus["jpl-cad"].success,
      error: sourceStatus["jpl-cad"].error,
      fetchedAt: sourceStatus["jpl-cad"].fetchedAt,
      url: sourceStatus["jpl-cad"].url,
    },
    "jpl-sentry": {
      success: sourceStatus["jpl-sentry"].success,
      error: sourceStatus["jpl-sentry"].error,
      fetchedAt: sourceStatus["jpl-sentry"].fetchedAt,
      url: sourceStatus["jpl-sentry"].url,
    },
    "esa-risk": risk,
    "esa-close": close,
  };
}

export const FEED_STATUS_LABELS: Record<keyof FeedStatus, string> = {
  "jpl-cad": "JPL CAD",
  "jpl-sentry": "JPL Sentry",
  "esa-risk": "ESA risk list",
  "esa-close": "ESA close approaches",
};

export function listFailedFeeds(feedStatus: FeedStatus): (keyof FeedStatus)[] {
  return (Object.keys(feedStatus) as (keyof FeedStatus)[]).filter(
    (id) => !feedStatus[id].success,
  );
}

/** On Sentry and/or ESA risk list — shared by risk filter and riskListed count. */
export function isOnRiskList(object: ReconciledObject): boolean {
  return object.sources.jplSentry.present || !!object.sources.esaNeocc.risk;
}

export function computeReconcileStats(objects: ReconciledObject[]): ReconcileStats {
  const totalFieldDivergences = objects.reduce(
    (sum, o) => sum + o.totalFieldDivergences,
    0,
  );
  const significantDivergences = objects.filter(
    (o) => o.significantDivergences > 0,
  ).length;

  return {
    total: objects.length,
    multiSource: objects.filter((o) => o.crossSourceMatch).length,
    totalFieldDivergences,
    significantDivergences,
    sentryAndEsa: objects.filter(
      (o) => o.sources.jplSentry.present && o.sources.esaNeocc.present,
    ).length,
    riskListed: objects.filter(isOnRiskList).length,
  };
}

export function filterReconciledObjects(
  objects: ReconciledObject[],
  view: ReconcileView = "all",
): ReconciledObject[] {
  switch (view) {
    case "multi":
      return objects.filter((o) => o.crossSourceMatch);
    case "divergent":
      return objects.filter((o) => o.significantDivergences > 0);
    case "risk":
      return objects.filter(isOnRiskList);
    default:
      return objects;
  }
}

/**
 * Choose the close-approach pair to surface for a designation.
 * Prefer the earliest calendar day present in both feeds; otherwise the
 * earliest encounter from each source (geometry is compared only on same-day pairs).
 */
export function selectPrimaryCloseApproaches(
  jplCad: JplCloseApproach[],
  esaClose: EsaCloseApproach[],
): { jplCad?: JplCloseApproach; esaClose?: EsaCloseApproach } {
  const jplByDay = new Map<string, JplCloseApproach>();
  for (const ca of jplCad) {
    const key = approachDateKey(ca.closeApproachDate);
    if (!key) continue;
    const existing = jplByDay.get(key);
    if (!existing) {
      jplByDay.set(key, ca);
      continue;
    }
    // Stable pick when a feed repeats the same calendar day.
    if (ca.closeApproachDate.localeCompare(existing.closeApproachDate) < 0) {
      jplByDay.set(key, ca);
    }
  }

  const esaByDay = new Map<string, EsaCloseApproach>();
  for (const ca of esaClose) {
    const key = approachDateKey(ca.date);
    if (!key) continue;
    const existing = esaByDay.get(key);
    if (!existing) {
      esaByDay.set(key, ca);
      continue;
    }
    if (ca.date.localeCompare(existing.date) < 0) {
      esaByDay.set(key, ca);
    }
  }

  const sharedDays = [...jplByDay.keys()]
    .filter((day) => esaByDay.has(day))
    .sort((a, b) => a.localeCompare(b));

  if (sharedDays.length > 0) {
    const day = sharedDays[0];
    return { jplCad: jplByDay.get(day), esaClose: esaByDay.get(day) };
  }

  const earliestJpl = [...jplByDay.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )[0]?.[1];
  const earliestEsa = [...esaByDay.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )[0]?.[1];

  return { jplCad: earliestJpl, esaClose: earliestEsa };
}

export function reconcileSources(input: ReconcileInput): ReconcileResult {
  const comparisonWindow = buildComparisonWindow(
    input.referenceDate ? new Date(input.referenceDate) : new Date(),
  );

  const jplCad = input.jplCad.filter((ca) =>
    isWithinComparisonWindow(ca.closeApproachDate, comparisonWindow),
  );
  const esaClose = input.esaClose.filter((ca) =>
    isWithinComparisonWindow(ca.date, comparisonWindow),
  );

  const map = new Map<
    string,
    {
      designation: string;
      jplCad: JplCloseApproach[];
      jplSentry?: JplSentryEntry;
      esaRisk?: EsaRiskEntry;
      esaClose: EsaCloseApproach[];
    }
  >();

  const register = (
    rawDesignation: string,
    updater: (entry: NonNullable<ReturnType<typeof map.get>>) => void,
  ) => {
    const key = normalizeDesignation(rawDesignation);
    const existing = map.get(key) ?? {
      designation: rawDesignation,
      jplCad: [],
      esaClose: [],
    };
    updater(existing);
    if (!existing.designation.includes(" ") && rawDesignation.includes(" ")) {
      existing.designation = rawDesignation;
    }
    map.set(key, existing);
  };

  for (const ca of jplCad) {
    register(ca.designation, (e) => {
      e.jplCad.push(ca);
    });
  }

  for (const entry of input.jplSentry) {
    register(entry.designation, (e) => {
      e.jplSentry = entry;
    });
  }

  for (const entry of input.esaRisk) {
    register(entry.designation, (e) => {
      e.esaRisk = entry;
    });
  }

  for (const entry of esaClose) {
    register(entry.designation, (e) => {
      e.esaClose.push(entry);
    });
  }

  const objects: ReconciledObject[] = [];

  for (const [key, entry] of map) {
    const primary = selectPrimaryCloseApproaches(entry.jplCad, entry.esaClose);
    objects.push(
      buildReconciledObject(entry.designation, key, {
        jplCad: primary.jplCad,
        jplSentry: entry.jplSentry,
        esaRisk: entry.esaRisk,
        esaClose: primary.esaClose,
        cadFetchedAt: input.sourceStatus["jpl-cad"].fetchedAt,
        sentryFetchedAt: input.sourceStatus["jpl-sentry"].fetchedAt,
        esaFetchedAt: input.sourceStatus["esa-neocc"].fetchedAt,
      }),
    );
  }

  objects.sort((a, b) => {
    if (b.significantDivergences !== a.significantDivergences) {
      return b.significantDivergences - a.significantDivergences;
    }
    if (b.totalFieldDivergences !== a.totalFieldDivergences) {
      return b.totalFieldDivergences - a.totalFieldDivergences;
    }
    if (b.sourceCoverage !== a.sourceCoverage) {
      return b.sourceCoverage - a.sourceCoverage;
    }
    const aSentry = a.sources.jplSentry.present ? 1 : 0;
    const bSentry = b.sources.jplSentry.present ? 1 : 0;
    if (bSentry !== aSentry) return bSentry - aSentry;

    // Chronological by calendar day (JPL Mmm + ESA ISO); missing/invalid last.
    const aDateKey = approachDateKey(
      a.sources.jplCad.closeApproach?.closeApproachDate ??
        a.sources.esaNeocc.closeApproach?.date ??
        "",
    );
    const bDateKey = approachDateKey(
      b.sources.jplCad.closeApproach?.closeApproachDate ??
        b.sources.esaNeocc.closeApproach?.date ??
        "",
    );
    if (aDateKey !== bDateKey) {
      if (aDateKey === null) return 1;
      if (bDateKey === null) return -1;
      return aDateKey.localeCompare(bDateKey);
    }
    return a.normalizedKey.localeCompare(b.normalizedKey);
  });

  const stats = computeReconcileStats(objects);

  return {
    objects,
    meta: {
      reconciledAt: new Date().toISOString(),
      sourceStatus: input.sourceStatus,
      feedStatus: buildFeedStatus(input.sourceStatus),
      totalObjects: objects.length,
      stats,
      comparisonWindow,
    },
  };
}

export function findReconciledObject(
  result: ReconcileResult,
  designation: string,
): ReconciledObject | undefined {
  const key = normalizeDesignation(designation);
  return result.objects.find((o) => o.normalizedKey === key);
}

export function parseReconcileView(value: string | undefined): ReconcileView {
  if (value === "multi" || value === "divergent" || value === "risk") {
    return value;
  }
  return "all";
}
