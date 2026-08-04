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

function okMeta(
  source: SourceFetchResult["source"],
  url: string,
): SourceFetchResult {
  return {
    source,
    fetchedAt: "2026-08-04T12:00:00.000Z",
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
    fetchedAt: "2026-08-04T12:00:00.000Z",
    success: false,
    error,
    url,
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
  it("requires every top-level source to succeed", () => {
    const healthy = {
      "jpl-cad": okMeta("jpl-cad", "https://example.com/cad"),
      "jpl-sentry": okMeta("jpl-sentry", "https://example.com/sentry"),
      "esa-neocc": okMeta("esa-neocc", "https://example.com/esa"),
    };
    expect(shouldCacheReconcileResult(healthy)).toBe(true);

    expect(
      shouldCacheReconcileResult({
        ...healthy,
        "jpl-cad": failMeta("jpl-cad", "https://example.com/cad", "HTTP 503"),
      }),
    ).toBe(false);

    expect(
      shouldCacheReconcileResult({
        ...healthy,
        "esa-neocc": {
          ...failMeta("esa-neocc", "https://example.com/esa", "partial"),
          partial: true,
        },
      }),
    ).toBe(false);
  });
});

describe("getReconcileData degraded-result cache", () => {
  it("does not cache when a source fails, so the next call refetches", async () => {
    mockedCad.mockResolvedValueOnce({
      data: [],
      meta: failMeta("jpl-cad", "https://example.com/cad", "HTTP 503 after 3 attempts"),
    });
    mockedSentry.mockResolvedValue({
      data: [],
      meta: okMeta("jpl-sentry", "https://example.com/sentry"),
    });
    mockedEsa.mockResolvedValue({
      risk: [],
      closeApproaches: [],
      meta: okMeta("esa-neocc", "https://example.com/esa"),
    });

    const degraded = await getReconcileData();
    expect(degraded.meta.sourceStatus["jpl-cad"].success).toBe(false);
    expect(getCached(CACHE_KEYS.RECONCILE)).toBeUndefined();
    expect(mockedCad).toHaveBeenCalledTimes(1);

    mockedCad.mockResolvedValueOnce({
      data: [
        {
          designation: "2026 AB",
          closeApproachDate: "2026-Aug-10",
          distanceAu: 0.04,
        },
      ],
      meta: okMeta("jpl-cad", "https://example.com/cad"),
    });

    const recovered = await getReconcileData();
    expect(mockedCad).toHaveBeenCalledTimes(2);
    expect(recovered.meta.sourceStatus["jpl-cad"].success).toBe(true);
    expect(recovered.objects.some((o) => o.normalizedKey === "2026AB")).toBe(
      true,
    );
    expect(getCached(CACHE_KEYS.RECONCILE)).toBeDefined();
  });

  it("caches healthy results and serves them on the next call", async () => {
    mockedCad.mockResolvedValue({
      data: [],
      meta: okMeta("jpl-cad", "https://example.com/cad"),
    });
    mockedSentry.mockResolvedValue({
      data: [],
      meta: okMeta("jpl-sentry", "https://example.com/sentry"),
    });
    mockedEsa.mockResolvedValue({
      risk: [],
      closeApproaches: [],
      meta: okMeta("esa-neocc", "https://example.com/esa"),
    });

    await getReconcileData();
    await getReconcileData();

    expect(mockedCad).toHaveBeenCalledTimes(1);
    expect(mockedSentry).toHaveBeenCalledTimes(1);
    expect(mockedEsa).toHaveBeenCalledTimes(1);
  });
});
