import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "@/lib/cache";
import { fetchJplCloseApproaches } from "@/lib/sources/jpl-cad";
import { fetchJplSentry } from "@/lib/sources/jpl-sentry";
import {
  aggregateEsaFetchMeta,
  fetchEsaCloseApproaches,
  fetchEsaRiskList,
} from "@/lib/sources/esa-neocc";
import { reconcileSources } from "@/lib/reconcile";
import type { SourceFetchResult } from "@/lib/types";

vi.mock("@/lib/fetch-external", () => ({
  fetchExternalJson: vi.fn(),
  fetchExternalText: vi.fn(),
}));

import {
  fetchExternalJson,
  fetchExternalText,
} from "@/lib/fetch-external";

const mockedJson = vi.mocked(fetchExternalJson);
const mockedText = vi.mocked(fetchExternalText);

const T0 = "2026-07-28T21:26:50.000Z";
const T_HIT = "2026-07-28T21:26:51.000Z";
const T_AFTER_TTL = "2026-07-28T21:42:50.000Z";

const cadPayload = {
  fields: ["des", "cd", "dist"],
  data: [["2026 OU", "2026-Jul-15", "0.04"]],
};

const sentryPayload = {
  data: [{ des: "2026 OU", ip: "1e-5", ts_max: "0" }],
};

const esaHeaderOnly = `Last Update: 2026-07-22 15:48 UTC
           Object             |    Diameter    |
Num/des.           Name       |   m  |   *=Y   |
AAAAAAAAAAAA AAAAAAAAAAAAAAAA | NNNN |    A    |
`;

beforeEach(() => {
  clearCache();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(T0));
  mockedJson.mockReset();
  mockedText.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  clearCache();
});

describe("source cache preserves fetchedAt", () => {
  it("JPL CAD: first fetch records time; cache hit keeps it; TTL miss advances", async () => {
    mockedJson.mockResolvedValue(cadPayload);

    const first = await fetchJplCloseApproaches();
    expect(first.meta.fetchedAt).toBe(T0);
    expect(mockedJson).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(T_HIT));
    const hit = await fetchJplCloseApproaches();
    expect(hit.meta.fetchedAt).toBe(T0);
    expect(hit.data).toEqual(first.data);
    expect(mockedJson).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(T_AFTER_TTL));
    const refreshed = await fetchJplCloseApproaches();
    expect(refreshed.meta.fetchedAt).toBe(T_AFTER_TTL);
    expect(mockedJson).toHaveBeenCalledTimes(2);
  });

  it("JPL Sentry: cache hit returns original fetchedAt", async () => {
    mockedJson.mockResolvedValue(sentryPayload);

    const first = await fetchJplSentry();
    expect(first.meta.fetchedAt).toBe(T0);

    vi.setSystemTime(new Date(T_HIT));
    const hit = await fetchJplSentry();
    expect(hit.meta.fetchedAt).toBe(T0);
    expect(mockedJson).toHaveBeenCalledTimes(1);
  });

  it("ESA risk and close: cache hits preserve fetchedAt", async () => {
    mockedText.mockResolvedValue(esaHeaderOnly);

    const risk = await fetchEsaRiskList();
    const close = await fetchEsaCloseApproaches();
    expect(risk.meta.fetchedAt).toBe(T0);
    expect(close.meta.fetchedAt).toBe(T0);
    expect(mockedText).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date(T_HIT));
    const riskHit = await fetchEsaRiskList();
    const closeHit = await fetchEsaCloseApproaches();
    expect(riskHit.meta.fetchedAt).toBe(T0);
    expect(closeHit.meta.fetchedAt).toBe(T0);
    expect(mockedText).toHaveBeenCalledTimes(2);
  });
});

describe("aggregateEsaFetchMeta fetchedAt", () => {
  it("uses max successful component fetchedAt instead of now()", () => {
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));
    const risk: SourceFetchResult = {
      source: "esa-neocc",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      success: true,
      url: "https://example.com/risk",
    };
    const close: SourceFetchResult = {
      source: "esa-neocc",
      fetchedAt: "2026-01-01T01:00:00.000Z",
      success: true,
      url: "https://example.com/close",
    };
    const meta = aggregateEsaFetchMeta(risk, close);
    expect(meta.fetchedAt).toBe("2026-01-01T01:00:00.000Z");
  });
});

describe("reconciledAt independent of source fetchedAt", () => {
  it("advances reconciledAt without changing source fetchedAt values", () => {
    const sourceStatus = {
      "jpl-cad": {
        source: "jpl-cad" as const,
        fetchedAt: T0,
        success: true,
        url: "https://example.com/cad",
      },
      "jpl-sentry": {
        source: "jpl-sentry" as const,
        fetchedAt: T0,
        success: true,
        url: "https://example.com/sentry",
      },
      "esa-neocc": {
        source: "esa-neocc" as const,
        fetchedAt: T0,
        success: true,
        url: "https://example.com/esa",
      },
    };

    const input = {
      jplCad: [],
      jplSentry: [],
      esaRisk: [],
      esaClose: [],
      sourceStatus,
      referenceDate: T0,
    };

    const first = reconcileSources(input);
    expect(first.meta.reconciledAt).toBe(T0);
    expect(first.meta.sourceStatus["jpl-cad"].fetchedAt).toBe(T0);

    vi.setSystemTime(new Date(T_HIT));
    const second = reconcileSources(input);
    expect(second.meta.reconciledAt).toBe(T_HIT);
    expect(second.meta.sourceStatus["jpl-cad"].fetchedAt).toBe(T0);
    expect(second.meta.sourceStatus["jpl-sentry"].fetchedAt).toBe(T0);
    expect(second.meta.sourceStatus["esa-neocc"].fetchedAt).toBe(T0);
  });
});
