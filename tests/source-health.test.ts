import { describe, it, expect } from "vitest";
import {
  buildFeedStatus,
  FEED_STATUS_LABELS,
  listFailedFeeds,
  reconcileSources,
} from "@/lib/reconcile";
import { aggregateEsaFetchMeta } from "@/lib/sources/esa-neocc";
import type { SourceFetchResult } from "@/lib/types";

const REF_DATE = "2026-01-01T12:00:00.000Z";

function okMeta(source: SourceFetchResult["source"], url: string): SourceFetchResult {
  return {
    source,
    fetchedAt: "2026-01-01T00:00:00Z",
    success: true,
    url,
  };
}

function failMeta(
  source: SourceFetchResult["source"],
  url: string,
  error: string,
): SourceFetchResult {
  return {
    source,
    fetchedAt: "2026-01-01T00:00:00Z",
    success: false,
    error,
    url,
  };
}

const baseUrls = {
  cad: "https://example.com/cad",
  sentry: "https://example.com/sentry",
  esa: "https://example.com/esa",
};

describe("aggregateEsaFetchMeta", () => {
  it("is healthy only when both risk and close succeed", () => {
    const meta = aggregateEsaFetchMeta(
      okMeta("esa-neocc", baseUrls.esa),
      okMeta("esa-neocc", baseUrls.esa),
    );
    expect(meta.success).toBe(true);
    expect(meta.partial).toBeUndefined();
    expect(meta.error).toBeUndefined();
    expect(meta.fetchedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("keeps component fetchedAt and does not mint a fresh aggregate time", () => {
    const risk = {
      ...okMeta("esa-neocc", baseUrls.esa),
      fetchedAt: "2026-01-01T00:00:00Z",
    };
    const close = {
      ...okMeta("esa-neocc", baseUrls.esa),
      fetchedAt: "2026-01-01T00:30:00Z",
    };
    const meta = aggregateEsaFetchMeta(risk, close);
    expect(meta.fetchedAt).toBe("2026-01-01T00:30:00Z");
    expect(meta.components?.risk.fetchedAt).toBe("2026-01-01T00:00:00Z");
    expect(meta.components?.close.fetchedAt).toBe("2026-01-01T00:30:00Z");
  });

  it("marks partial when ESA risk fails but close succeeds", () => {
    const meta = aggregateEsaFetchMeta(
      failMeta("esa-neocc", baseUrls.esa, "risk down"),
      okMeta("esa-neocc", baseUrls.esa),
    );
    expect(meta.success).toBe(false);
    expect(meta.partial).toBe(true);
    expect(meta.error).toContain("ESA risk list");
    expect(meta.components?.risk.success).toBe(false);
    expect(meta.components?.close.success).toBe(true);
  });

  it("marks partial when ESA close fails but risk succeeds", () => {
    const meta = aggregateEsaFetchMeta(
      okMeta("esa-neocc", baseUrls.esa),
      failMeta("esa-neocc", baseUrls.esa, "close down"),
    );
    expect(meta.success).toBe(false);
    expect(meta.partial).toBe(true);
    expect(meta.error).toContain("ESA close approaches");
    expect(meta.components?.risk.success).toBe(true);
    expect(meta.components?.close.success).toBe(false);
  });
});

describe("feed status outage cases", () => {
  it("1. JPL CAD fails, others succeed — CAD flagged, data from others kept", () => {
    const esa = aggregateEsaFetchMeta(
      okMeta("esa-neocc", baseUrls.esa),
      okMeta("esa-neocc", baseUrls.esa),
    );
    const sourceStatus = {
      "jpl-cad": failMeta("jpl-cad", baseUrls.cad, "CAD timeout"),
      "jpl-sentry": okMeta("jpl-sentry", baseUrls.sentry),
      "esa-neocc": esa,
    };
    const feedStatus = buildFeedStatus(sourceStatus);
    expect(listFailedFeeds(feedStatus)).toEqual(["jpl-cad"]);
    expect(feedStatus["jpl-sentry"].success).toBe(true);
    expect(feedStatus["esa-risk"].success).toBe(true);

    const result = reconcileSources({
      jplCad: [],
      jplSentry: [{ designation: "2026 OU", torinoScaleMax: 0 }],
      esaRisk: [{ designation: "2026 OU", torinoScaleMax: 0 }],
      esaClose: [],
      sourceStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects).toHaveLength(1);
    expect(result.meta.feedStatus["jpl-cad"].success).toBe(false);
    expect(listFailedFeeds(result.meta.feedStatus)).not.toHaveLength(4);
  });

  it("2. JPL Sentry fails, others succeed — Sentry flagged", () => {
    const esa = aggregateEsaFetchMeta(
      okMeta("esa-neocc", baseUrls.esa),
      okMeta("esa-neocc", baseUrls.esa),
    );
    const sourceStatus = {
      "jpl-cad": okMeta("jpl-cad", baseUrls.cad),
      "jpl-sentry": failMeta("jpl-sentry", baseUrls.sentry, "Sentry 503"),
      "esa-neocc": esa,
    };
    const feedStatus = buildFeedStatus(sourceStatus);
    expect(listFailedFeeds(feedStatus)).toEqual(["jpl-sentry"]);

    const result = reconcileSources({
      jplCad: [
        {
          designation: "2026 OU",
          closeApproachDate: "2026-Jul-15",
          distanceAu: 0.04,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        { designation: "2026 OU", date: "2026-07-15", missDistanceAu: 0.04 },
      ],
      sourceStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].sources.jplCad.present).toBe(true);
    expect(result.meta.feedStatus["jpl-sentry"].success).toBe(false);
  });

  it("3. ESA risk fails but close succeeds — partial ESA, close data kept", () => {
    const esa = aggregateEsaFetchMeta(
      failMeta("esa-neocc", baseUrls.esa, "risk HTML"),
      okMeta("esa-neocc", baseUrls.esa),
    );
    expect(esa.partial).toBe(true);
    expect(esa.success).toBe(false);

    const sourceStatus = {
      "jpl-cad": okMeta("jpl-cad", baseUrls.cad),
      "jpl-sentry": okMeta("jpl-sentry", baseUrls.sentry),
      "esa-neocc": esa,
    };
    const failed = listFailedFeeds(buildFeedStatus(sourceStatus));
    expect(failed).toEqual(["esa-risk"]);
    expect(FEED_STATUS_LABELS["esa-risk"]).toBe("ESA risk list");

    const result = reconcileSources({
      jplCad: [
        {
          designation: "2026 OU",
          closeApproachDate: "2026-Jul-15",
          distanceAu: 0.04,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        { designation: "2026 OU", date: "2026-07-15", missDistanceAu: 0.04 },
      ],
      sourceStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects[0].sources.esaNeocc.closeApproach).toBeDefined();
    expect(result.meta.sourceStatus["esa-neocc"].partial).toBe(true);
    expect(result.meta.feedStatus["esa-close"].success).toBe(true);
  });

  it("4. ESA close fails but risk succeeds — partial ESA, risk data kept", () => {
    const esa = aggregateEsaFetchMeta(
      okMeta("esa-neocc", baseUrls.esa),
      failMeta("esa-neocc", baseUrls.esa, "close down"),
    );
    const sourceStatus = {
      "jpl-cad": okMeta("jpl-cad", baseUrls.cad),
      "jpl-sentry": okMeta("jpl-sentry", baseUrls.sentry),
      "esa-neocc": esa,
    };
    expect(listFailedFeeds(buildFeedStatus(sourceStatus))).toEqual([
      "esa-close",
    ]);

    const result = reconcileSources({
      jplCad: [],
      jplSentry: [{ designation: "2026 OU", torinoScaleMax: 0 }],
      esaRisk: [{ designation: "2026 OU", torinoScaleMax: 0 }],
      esaClose: [],
      sourceStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects[0].sources.esaNeocc.risk).toBeDefined();
    expect(result.meta.feedStatus["esa-risk"].success).toBe(true);
    expect(result.meta.feedStatus["esa-close"].success).toBe(false);
  });

  it("5. every feed fails — all-sources state, no false JPL-only implication", () => {
    const esa = aggregateEsaFetchMeta(
      failMeta("esa-neocc", baseUrls.esa, "risk down"),
      failMeta("esa-neocc", baseUrls.esa, "close down"),
    );
    expect(esa.success).toBe(false);
    expect(esa.partial).toBeUndefined();

    const sourceStatus = {
      "jpl-cad": failMeta("jpl-cad", baseUrls.cad, "CAD down"),
      "jpl-sentry": failMeta("jpl-sentry", baseUrls.sentry, "Sentry down"),
      "esa-neocc": esa,
    };
    const feedStatus = buildFeedStatus(sourceStatus);
    const failed = listFailedFeeds(feedStatus);
    expect(failed).toHaveLength(4);

    const result = reconcileSources({
      jplCad: [],
      jplSentry: [],
      esaRisk: [],
      esaClose: [],
      sourceStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects).toHaveLength(0);
    expect(listFailedFeeds(result.meta.feedStatus)).toHaveLength(4);
    // Aggregate ESA error must not look like "JPL only"
    expect(result.meta.sourceStatus["esa-neocc"].error).not.toMatch(/JPL only/i);
    expect(result.meta.sourceStatus["jpl-cad"].success).toBe(false);
    expect(result.meta.sourceStatus["jpl-sentry"].success).toBe(false);
  });
});
