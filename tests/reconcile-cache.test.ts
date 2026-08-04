import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache, getCached, CACHE_KEYS } from "@/lib/cache";
import {
  getReconcileData,
  shouldCacheReconcileResult,
} from "@/lib/get-reconcile-data";
import type { SourceFetchResult } from "@/lib/types";

vi.mock("@/lib/sources/jpl-cad", () => ({
  fetchJplCloseApproaches: vi.fn(),
}));
vi.mock("@/lib/sources/jpl-sentry", () => ({
  fetchJplSentry: vi.fn(),
}));
vi.mock("@/lib/sources/esa-neocc", () => ({
  fetchEsaNeocc: vi.fn(),
}));

import { fetchJplCloseApproaches } from "@/lib/sources/jpl-cad";
import { fetchJplSentry } from "@/lib/sources/jpl-sentry";
import { fetchEsaNeocc } from "@/lib/sources/esa-neocc";

const mockedCad = vi.mocked(fetchJplCloseApproaches);
const mockedSentry = vi.mocked(fetchJplSentry);
const mockedEsa = vi.mocked(fetchEsaNeocc);

function okMeta(source: SourceFetchResult["source"]): SourceFetchResult {
  return {
    source,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    success: true,
    url: `https://example.com/${source}`,
  };
}

function failMeta(
  source: SourceFetchResult["source"],
  error = "down",
): SourceFetchResult {
  return {
    source,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    success: false,
    error,
    url: `https://example.com/${source}`,
  };
}

beforeEach(() => {
  clearCache();
  mockedCad.mockReset();
  mockedSentry.mockReset();
  mockedEsa.mockReset();
});

afterEach(() => {
  clearCache();
});

describe("shouldCacheReconcileResult", () => {
  it("is true only when all three sources succeed", () => {
    expect(
      shouldCacheReconcileResult({
        "jpl-cad": okMeta("jpl-cad"),
        "jpl-sentry": okMeta("jpl-sentry"),
        "esa-neocc": okMeta("esa-neocc"),
      }),
    ).toBe(true);

    expect(
      shouldCacheReconcileResult({
        "jpl-cad": failMeta("jpl-cad"),
        "jpl-sentry": okMeta("jpl-sentry"),
        "esa-neocc": okMeta("esa-neocc"),
      }),
    ).toBe(false);

    expect(
      shouldCacheReconcileResult({
        "jpl-cad": okMeta("jpl-cad"),
        "jpl-sentry": okMeta("jpl-sentry"),
        "esa-neocc": {
          ...failMeta("esa-neocc"),
          partial: true,
        },
      }),
    ).toBe(false);
  });
});

describe("getReconcileData reconcile cache", () => {
  it("caches a fully healthy reconcile result", async () => {
    mockedCad.mockResolvedValue({ data: [], meta: okMeta("jpl-cad") });
    mockedSentry.mockResolvedValue({ data: [], meta: okMeta("jpl-sentry") });
    mockedEsa.mockResolvedValue({
      risk: [],
      closeApproaches: [],
      meta: okMeta("esa-neocc"),
    });

    await getReconcileData();
    expect(getCached(CACHE_KEYS.RECONCILE)).toBeDefined();

    await getReconcileData();
    expect(mockedCad).toHaveBeenCalledTimes(1);
    expect(mockedSentry).toHaveBeenCalledTimes(1);
    expect(mockedEsa).toHaveBeenCalledTimes(1);
  });

  it("does not cache a degraded result after a transient source failure", async () => {
    mockedCad.mockResolvedValue({
      data: [],
      meta: failMeta("jpl-cad", "HTTP 503"),
    });
    mockedSentry.mockResolvedValue({ data: [], meta: okMeta("jpl-sentry") });
    mockedEsa.mockResolvedValue({
      risk: [],
      closeApproaches: [],
      meta: okMeta("esa-neocc"),
    });

    const first = await getReconcileData();
    expect(first.meta.sourceStatus["jpl-cad"].success).toBe(false);
    expect(getCached(CACHE_KEYS.RECONCILE)).toBeUndefined();

    // Recovery on the next request
    mockedCad.mockResolvedValue({
      data: [
        {
          designation: "2026 OU",
          closeApproachDate: "2026-Sep-15",
          distanceAu: 0.04,
        },
      ],
      meta: okMeta("jpl-cad"),
    });

    const second = await getReconcileData();
    expect(second.meta.sourceStatus["jpl-cad"].success).toBe(true);
    expect(second.objects.length).toBeGreaterThan(0);
    expect(mockedCad).toHaveBeenCalledTimes(2);
    expect(getCached(CACHE_KEYS.RECONCILE)).toBeDefined();
  });
});
