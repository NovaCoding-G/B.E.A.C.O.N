import { describe, it, expect } from "vitest";
import {
  normalizeDesignation,
  designationsMatch,
  reconcileSources,
  filterReconciledObjects,
  approachDateKey,
  impactProbabilitiesDiverge,
  palermoScalesDiverge,
  DIVERGENCE_THRESHOLDS,
} from "@/lib/reconcile";
import { mapCadRow } from "@/lib/sources/jpl-cad";
import { parseJplSentryResponse } from "@/lib/sources/jpl-sentry";
import {
  parseEsaRiskList,
  parseEsaObjectColumn,
} from "@/lib/sources/esa-neocc";

const baseStatus = {
  "jpl-cad": {
    source: "jpl-cad" as const,
    fetchedAt: "2026-01-01T00:00:00Z",
    success: true,
    url: "https://example.com/cad",
  },
  "jpl-sentry": {
    source: "jpl-sentry" as const,
    fetchedAt: "2026-01-01T00:00:00Z",
    success: true,
    url: "https://example.com/sentry",
  },
  "esa-neocc": {
    source: "esa-neocc" as const,
    fetchedAt: "2026-01-01T00:00:00Z",
    success: true,
    url: "https://example.com/esa",
  },
};

describe("normalizeDesignation", () => {
  it("normalizes provisional designations with/without space", () => {
    expect(normalizeDesignation("2024 YR4")).toBe("2024YR4");
    expect(normalizeDesignation("2024YR4")).toBe("2024YR4");
    expect(normalizeDesignation("1979 XB")).toBe("1979XB");
    expect(normalizeDesignation("1979XB")).toBe("1979XB");
  });

  it("normalizes numbered asteroids", () => {
    expect(normalizeDesignation("433 Eros")).toBe("433EROS");
    expect(normalizeDesignation("433 eros")).toBe("433EROS");
  });

  it("matches variant designations", () => {
    expect(designationsMatch("1979 XB", "1979XB")).toBe(true);
    expect(designationsMatch("2024 YR4", "2024YR4")).toBe(true);
    expect(designationsMatch("2026 OU", "2026 OD1")).toBe(false);
  });
});

describe("mapCadRow", () => {
  it("maps positional CAD data using runtime fields", () => {
    const fields = [
      "des",
      "orbit_id",
      "jd",
      "cd",
      "dist",
      "dist_min",
      "dist_max",
      "v_rel",
      "v_inf",
      "t_sigma_f",
      "h",
    ];
    const row = [
      "2026 OU",
      "3",
      "2461244.763452746",
      "2026-Jul-23 06:19",
      "0.024537322928836",
      "0.0244679028178699",
      "0.0246067408912594",
      "6.27898068301489",
      "6.26166277800492",
      "00:01",
      "25.377",
    ];

    const result = mapCadRow(fields, row);
    expect(result).not.toBeNull();
    expect(result!.designation).toBe("2026 OU");
    expect(result!.distanceAu).toBeCloseTo(0.024537, 5);
    expect(result!.velocityRelativeKms).toBeCloseTo(6.279, 2);
  });

  it("returns null for malformed rows", () => {
    const result = mapCadRow(["des", "dist"], ["", ""]);
    expect(result).toBeNull();
  });
});

describe("parseJplSentryResponse", () => {
  it("parses sentry entries", () => {
    const raw = {
      signature: { source: "NASA/JPL Sentry Data API", version: "2.0" },
      count: "1",
      data: [
        {
          des: "1979 XB",
          fullname: "(1979 XB)",
          ip: "8.515158e-07",
          ps_cum: "-2.69",
          ps_max: "-2.99",
          ts_max: "0",
          range: "2056-2113",
          diameter: "0.66",
          h: "18.54",
          v_inf: "23.76",
          n_imp: 4,
          last_obs: "1979-12-15",
        },
      ],
    };

    const entries = parseJplSentryResponse(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0].designation).toBe("1979 XB");
    expect(entries[0].torinoScaleMax).toBe(0);
    expect(entries[0].cumulativeImpactProbability).toBeCloseTo(8.515158e-7);
  });
});

describe("parseEsaNeocc", () => {
  const riskSample = `Last Update: 2026-07-22 15:48 UTC
           Object             |    Diameter    |             VI Max                                   |          VIs                  |
Num/des.           Name       |   m  |   *=Y   |      Date/Time   |  IP max  | PS max |TS  | Vel km/s | Years     | IP cum   | PS cum |
AAAAAAAAAAAA AAAAAAAAAAAAAAAA | NNNN |    A    | YYYY-MM-DD HH:MM | EEEEEEEE | NNN.NN | NN |  NNN.NN  | YYYY-YYYY | EEEEEEEE | NNN.NN |
1979XB                        |  500 |    *    | 2056-12-12 21:38 |  2.34E-7 |  -2.82 |  0 |   27.54  | 2056-2113 |  7.34E-7 |  -2.70 |`;

  it("parses ESA risk list", () => {
    const { entries, lastUpdate } = parseEsaRiskList(riskSample);
    expect(lastUpdate).toContain("2026-07-22");
    expect(entries).toHaveLength(1);
    expect(entries[0].designation).toBe("1979XB");
    expect(entries[0].diameterFromMagnitude).toBe(true);
    expect(entries[0].torinoScaleMax).toBe(0);
  });

  it("parses object column variants", () => {
    expect(parseEsaObjectColumn("101955 Bennu")).toEqual({
      designation: "101955 Bennu",
      name: "Bennu",
    });
    expect(parseEsaObjectColumn("2023VD3")).toEqual({
      designation: "2023VD3",
    });
  });
});

describe("calibrated field thresholds (helpers)", () => {
  it("does not flag tiny velocity-scale relative differences under 1%", () => {
    const a = 13.54;
    const b = 13.5;
    const rel = Math.abs(a - b) / Math.max(a, b);
    expect(rel).toBeLessThan(DIVERGENCE_THRESHOLDS.relativeVelocityRelative);
  });

  it("uses ratio for impact probability, with 1e-7 floor", () => {
    expect(impactProbabilitiesDiverge(0.000096, 0.0000224)).toBe(true);
    expect(impactProbabilitiesDiverge(0.000246, 0.000297)).toBe(false);
    expect(impactProbabilitiesDiverge(1e-8, 5e-8)).toBe(false);
  });

  it("uses absolute Palermo threshold of 0.5", () => {
    expect(palermoScalesDiverge(-9.7, -10.69)).toBe(true);
    expect(palermoScalesDiverge(-8.63, -7.14)).toBe(true);
    expect(palermoScalesDiverge(-3.0, -3.2)).toBe(false);
  });

  it("compares close-approach dates by calendar day only", () => {
    expect(approachDateKey("2026-Jul-23 06:19")).toBe("2026-07-23");
    expect(approachDateKey("2026-07-23")).toBe("2026-07-23");
    expect(approachDateKey("2026-Jul-23 06:19")).toBe("2026-07-23");
  });
});

describe("reconcileSources", () => {
  it("matches object present in all three sources with concordant values", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "1979 XB",
          closeApproachDate: "2056-Dec-12 21:38",
          distanceAu: 0.001,
          velocityRelativeKms: 27.5,
        },
      ],
      jplSentry: [
        {
          designation: "1979 XB",
          cumulativeImpactProbability: 7.34e-7,
          palermoScaleCumulative: -2.7,
          torinoScaleMax: 0,
        },
      ],
      esaRisk: [
        {
          designation: "1979XB",
          cumulativeImpactProbability: 7.34e-7,
          palermoScaleCumulative: -2.7,
          torinoScaleMax: 0,
        },
      ],
      esaClose: [],
      sourceStatus: baseStatus,
    });

    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].normalizedKey).toBe("1979XB");
    expect(result.objects[0].crossSourceMatch).toBe(true);
    expect(result.objects[0].divergences).toHaveLength(0);
    expect(result.objects[0].totalFieldDivergences).toBe(0);
    expect(result.objects[0].significantDivergences).toBe(0);
    expect(result.meta.stats.significantDivergences).toBe(0);
    expect(result.meta.stats.totalFieldDivergences).toBe(0);
  });

  it("handles object present in only one source", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "2026 OU",
          closeApproachDate: "2026-Jul-23 06:19",
          distanceAu: 0.024,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [],
      sourceStatus: baseStatus,
    });

    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].sources.jplCad.present).toBe(true);
  });

  it("continues with valid objects when a source fails", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "2026 OD1",
          closeApproachDate: "2026-Jul-23 12:41",
          distanceAu: 0.045,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [],
      sourceStatus: {
        ...baseStatus,
        "esa-neocc": {
          ...baseStatus["esa-neocc"],
          success: false,
          error: "Fonte ESA temporaneamente non disponibile",
        },
      },
    });

    expect(result.objects).toHaveLength(1);
    expect(result.meta.sourceStatus["esa-neocc"].success).toBe(false);
  });

  it("flags designation variants between sources", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [{ designation: "2000 SG344", torinoScaleMax: 0 }],
      esaRisk: [{ designation: "2000SG344", torinoScaleMax: 0 }],
      esaClose: [],
      sourceStatus: baseStatus,
    });

    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].crossSourceMatch).toBe(true);
  });

  it("does not flag closeApproachDate when only time granularity differs", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "2026 OU",
          closeApproachDate: "2026-Jul-23 06:19",
          distanceAu: 0.024,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        {
          designation: "2026 OU",
          date: "2026-07-23",
          missDistanceAu: 0.024,
        },
      ],
      sourceStatus: baseStatus,
    });

    expect(
      result.objects[0].divergences.some((d) => d.field === "closeApproachDate"),
    ).toBe(false);
  });

  it("flags closeApproachDate when calendar days differ", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "2026 OU",
          closeApproachDate: "2026-Jul-23",
          distanceAu: 0.024,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        { designation: "2026 OU", date: "2026-07-24", missDistanceAu: 0.024 },
      ],
      sourceStatus: baseStatus,
    });

    expect(
      result.objects[0].divergences.some((d) => d.field === "closeApproachDate"),
    ).toBe(true);
    expect(result.objects[0].significantDivergences).toBe(0);
  });

  it("filters multi-source and significant divergent views", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [
        {
          designation: "2026 OU",
          cumulativeImpactProbability: 0.001,
          palermoScaleCumulative: -3,
        },
      ],
      esaRisk: [
        {
          designation: "2026 OU",
          cumulativeImpactProbability: 0.005,
          palermoScaleCumulative: -3,
        },
      ],
      esaClose: [],
      sourceStatus: baseStatus,
    });

    expect(filterReconciledObjects(result.objects, "multi")).toHaveLength(1);
    expect(filterReconciledObjects(result.objects, "divergent")).toHaveLength(1);
  });
});

describe("calibrated divergences — real observed cases", () => {
  it("2025 CL3: impact prob ratio >4× flags; missDistance ~6.6% also flags at 3%", () => {
    // |Δdist|/max ≈ 6.63% > 3% → orbital field flag; IP ratio is risk/significant
    const jplDist = 0.0244830764137726;
    const esaDist = 0.022859;
    const missRel = Math.abs(jplDist - esaDist) / Math.max(jplDist, esaDist);
    expect(missRel).toBeGreaterThan(DIVERGENCE_THRESHOLDS.missDistanceAuRelative);

    const result = reconcileSources({
      jplCad: [
        {
          designation: "2025 CL3",
          closeApproachDate: "2026-Jan-01",
          distanceAu: jplDist,
        },
      ],
      jplSentry: [
        {
          designation: "2025 CL3",
          cumulativeImpactProbability: 0.000096010586,
        },
      ],
      esaRisk: [
        {
          designation: "2025CL3",
          cumulativeImpactProbability: 0.0000224,
        },
      ],
      esaClose: [
        {
          designation: "2025 CL3",
          date: "2026-01-01",
          missDistanceAu: esaDist,
        },
      ],
      sourceStatus: baseStatus,
    });

    const obj = result.objects[0];
    const fields = obj.divergences.map((d) => d.field);
    expect(fields).toContain("cumulativeImpactProbability");
    expect(fields).toContain("missDistanceAu");
    expect(obj.significantDivergences).toBeGreaterThanOrEqual(1);
    expect(obj.totalFieldDivergences).toBeGreaterThanOrEqual(2);
    expect(
      obj.divergences.find((d) => d.field === "missDistanceAu")?.category,
    ).toBe("orbital");
    expect(
      obj.divergences.find((d) => d.field === "cumulativeImpactProbability")
        ?.category,
    ).toBe("risk");
  });

  it("2007 EK: Palermo |Δ|=0.99 > 0.5 → flags significant", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [{ designation: "2007 EK", palermoScaleCumulative: -9.7 }],
      esaRisk: [{ designation: "2007EK", palermoScaleCumulative: -10.69 }],
      esaClose: [],
      sourceStatus: baseStatus,
    });

    const obj = result.objects[0];
    expect(
      obj.divergences.some((d) => d.field === "palermoScaleCumulative"),
    ).toBe(true);
    expect(obj.significantDivergences).toBe(1);
    expect(result.meta.stats.significantDivergences).toBe(1);
  });

  it("2026 OS: impact prob ratio ~1.2× → does NOT flag", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [
        {
          designation: "2026 OS",
          cumulativeImpactProbability: 0.000246197169,
        },
      ],
      esaRisk: [
        {
          designation: "2026OS",
          cumulativeImpactProbability: 0.000297,
        },
      ],
      esaClose: [],
      sourceStatus: baseStatus,
    });

    expect(
      result.objects[0].divergences.some(
        (d) => d.field === "cumulativeImpactProbability",
      ),
    ).toBe(false);
    expect(result.objects[0].significantDivergences).toBe(0);
  });

  it("2026 OB1: Palermo |Δ|=1.49 > 0.5 → flags significant", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [{ designation: "2026 OB1", palermoScaleCumulative: -8.63 }],
      esaRisk: [{ designation: "2026OB1", palermoScaleCumulative: -7.14 }],
      esaClose: [],
      sourceStatus: baseStatus,
    });

    expect(
      result.objects[0].divergences.some(
        (d) => d.field === "palermoScaleCumulative",
      ),
    ).toBe(true);
    expect(result.objects[0].significantDivergences).toBe(1);
  });
});
