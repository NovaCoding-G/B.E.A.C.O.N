import { z } from "zod";

/** Data source identifiers */
export const SourceId = z.enum(["jpl-cad", "jpl-sentry", "esa-neocc"]);
export type SourceId = z.infer<typeof SourceId>;

/** Normalized IAU designation key for cross-source matching */
export const NormalizedDesignation = z.string().min(1);
export type NormalizedDesignation = z.infer<typeof NormalizedDesignation>;

/** JPL Close Approach Data API response */
export const JplCadResponseSchema = z.object({
  signature: z
    .object({
      version: z.string().optional(),
      source: z.string().optional(),
    })
    .optional(),
  count: z.union([z.number(), z.string()]).optional(),
  total: z.union([z.number(), z.string()]).optional(),
  fields: z.array(z.string()),
  data: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});
export type JplCadResponse = z.infer<typeof JplCadResponseSchema>;

export const JplCloseApproachSchema = z.object({
  designation: z.string(),
  orbitId: z.string().optional(),
  julianDate: z.number().optional(),
  closeApproachDate: z.string(),
  /** Nominal miss distance in au */
  distanceAu: z.number(),
  distanceMinAu: z.number().optional(),
  distanceMaxAu: z.number().optional(),
  /** Relative velocity km/s */
  velocityRelativeKms: z.number().optional(),
  velocityInfinityKms: z.number().optional(),
  timeUncertainty: z.string().optional(),
  absoluteMagnitudeH: z.number().optional(),
  /** Estimated diameter in meters (derived from H if needed) */
  diameterMeters: z.number().optional(),
});
export type JplCloseApproach = z.infer<typeof JplCloseApproachSchema>;

/** JPL Sentry API response */
export const JplSentryResponseSchema = z.object({
  signature: z
    .object({
      version: z.string().optional(),
      source: z.string().optional(),
    })
    .optional(),
  count: z.union([z.number(), z.string()]).optional(),
  data: z.array(z.record(z.string(), z.unknown())),
});
export type JplSentryResponse = z.infer<typeof JplSentryResponseSchema>;

export const JplSentryEntrySchema = z.object({
  designation: z.string(),
  fullName: z.string().optional(),
  cumulativeImpactProbability: z.number().optional(),
  palermoScaleCumulative: z.number().optional(),
  palermoScaleMax: z.number().optional(),
  torinoScaleMax: z.number().optional(),
  riskWindowYears: z.string().optional(),
  diameterKm: z.number().optional(),
  absoluteMagnitudeH: z.number().optional(),
  velocityInfinityKms: z.number().optional(),
  impactCount: z.number().optional(),
  lastObservation: z.string().optional(),
});
export type JplSentryEntry = z.infer<typeof JplSentryEntrySchema>;

/** ESA NEOCC risk list entry */
export const EsaRiskEntrySchema = z.object({
  designation: z.string(),
  name: z.string().optional(),
  diameterMeters: z.number().optional(),
  diameterFromMagnitude: z.boolean().optional(),
  viMaxDate: z.string().optional(),
  maxImpactProbability: z.number().optional(),
  palermoScaleMax: z.number().optional(),
  torinoScaleMax: z.number().optional(),
  velocityKms: z.number().optional(),
  riskYears: z.string().optional(),
  cumulativeImpactProbability: z.number().optional(),
  palermoScaleCumulative: z.number().optional(),
});
export type EsaRiskEntry = z.infer<typeof EsaRiskEntrySchema>;

/** ESA NEOCC close approach entry */
export const EsaCloseApproachSchema = z.object({
  designation: z.string(),
  name: z.string().optional(),
  date: z.string(),
  missDistanceKm: z.number().optional(),
  missDistanceAu: z.number().optional(),
  missDistanceLd: z.number().optional(),
  diameterMeters: z.number().optional(),
  diameterFromMagnitude: z.boolean().optional(),
  absoluteMagnitudeH: z.number().optional(),
  maxBrightnessMag: z.number().optional(),
  relativeVelocityKms: z.number().optional(),
  caiIndex: z.number().optional(),
});
export type EsaCloseApproach = z.infer<typeof EsaCloseApproachSchema>;

/** Fetch result wrapper for any source */
export const FeedComponentStatusSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  fetchedAt: z.string().optional(),
  url: z.string().optional(),
});
export type FeedComponentStatus = z.infer<typeof FeedComponentStatusSchema>;

export const SourceFetchResultSchema = z.object({
  source: SourceId,
  fetchedAt: z.string(),
  success: z.boolean(),
  /** True when some but not all ESA sub-feeds succeeded. */
  partial: z.boolean().optional(),
  error: z.string().optional(),
  url: z.string(),
  components: z
    .object({
      risk: FeedComponentStatusSchema,
      close: FeedComponentStatusSchema,
    })
    .optional(),
});
export type SourceFetchResult = z.infer<typeof SourceFetchResultSchema>;

export const FeedStatusSchema = z.object({
  "jpl-cad": FeedComponentStatusSchema,
  "jpl-sentry": FeedComponentStatusSchema,
  "esa-risk": FeedComponentStatusSchema,
  "esa-close": FeedComponentStatusSchema,
});
export type FeedStatus = z.infer<typeof FeedStatusSchema>;

/** Per-source presence and values for reconciliation */
export const SourcePresenceSchema = z.object({
  present: z.boolean(),
  fetchedAt: z.string().optional(),
});

export const ReconciledObjectSchema = z.object({
  designation: z.string(),
  normalizedKey: NormalizedDesignation,
  displayName: z.string().optional(),
  sources: z.object({
    jplCad: SourcePresenceSchema.extend({
      closeApproach: JplCloseApproachSchema.optional(),
    }),
    jplSentry: SourcePresenceSchema.extend({
      risk: JplSentryEntrySchema.optional(),
    }),
    esaNeocc: SourcePresenceSchema.extend({
      risk: EsaRiskEntrySchema.optional(),
      closeApproach: EsaCloseApproachSchema.optional(),
    }),
  }),
  divergences: z.array(
    z.object({
      field: z.string(),
      sources: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
      threshold: z.string().optional(),
      thresholdExplanation: z.string().optional(),
      /** Informational context (e.g. unequal risk-year aggregation windows). */
      notes: z.string().optional(),
      category: z.enum(["orbital", "risk"]),
    }),
  ),
  totalFieldDivergences: z.number(),
  significantDivergences: z.number(),
  sourceCoverage: z.number().min(0).max(3),
  crossSourceMatch: z.boolean(),
});
export type ReconciledObject = z.infer<typeof ReconciledObjectSchema>;

export const ReconcileStatsSchema = z.object({
  total: z.number(),
  multiSource: z.number(),
  totalFieldDivergences: z.number(),
  significantDivergences: z.number(),
  /** Sentry ∩ any ESA presence (risk or close). Dashboard intersection metric. */
  sentryAndEsa: z.number(),
  /** Same predicate as view=risk: Sentry OR ESA risk list. */
  riskListed: z.number(),
});
export type ReconcileStats = z.infer<typeof ReconcileStatsSchema>;

export type ReconcileView = "all" | "multi" | "divergent" | "risk";

/** Shared JPL CAD / ESA close-approach comparison horizon (inclusive days from now). */
export const CLOSE_APPROACH_HORIZON_DAYS = 365;

export const ComparisonWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
  days: z.number(),
});
export type ComparisonWindow = z.infer<typeof ComparisonWindowSchema>;

export const ReconcileResultSchema = z.object({
  objects: z.array(ReconciledObjectSchema),
  meta: z.object({
    reconciledAt: z.string(),
    sourceStatus: z.record(SourceId, SourceFetchResultSchema),
    feedStatus: FeedStatusSchema,
    totalObjects: z.number(),
    stats: ReconcileStatsSchema,
    comparisonWindow: ComparisonWindowSchema,
  }),
});
export type ReconcileResult = z.infer<typeof ReconcileResultSchema>;

export const SOURCE_URLS = {
  "jpl-cad": `https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.05&date-min=now&date-max=%2B${CLOSE_APPROACH_HORIZON_DAYS}`,
  "jpl-sentry": "https://ssd-api.jpl.nasa.gov/sentry.api",
  "esa-neocc-risk":
    "https://neo.ssa.esa.int/PSDB-portlet/download?file=esa_risk_list",
  "esa-neocc-close":
    "https://neo.ssa.esa.int/PSDB-portlet/download?file=esa_upcoming_close_app",
} as const;

export const SOURCE_ATTRIBUTION = {
  "jpl-cad": {
    label: "JPL Close Approach Data (CAD)",
    url: "https://cneos.jpl.nasa.gov/ca/",
    agency: "NASA/JPL CNEOS",
  },
  "jpl-sentry": {
    label: "JPL Sentry Impact Monitoring",
    url: "https://cneos.jpl.nasa.gov/sentry/",
    agency: "NASA/JPL CNEOS",
  },
  "esa-neocc": {
    label: "ESA NEO Coordination Centre (Aegis)",
    url: "https://neo.ssa.esa.int/",
    agency: "ESA SSA-NEO",
  },
} as const;
