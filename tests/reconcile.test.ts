import { describe, it, expect } from "vitest";
import {
  normalizeDesignation,
  designationsMatch,
  reconcileSources,
  filterReconciledObjects,
  approachDateKey,
  impactProbabilitiesDiverge,
  palermoScalesDiverge,
  relativeVelocitiesDiverge,
  roundToDecimals,
  buildComparisonWindow,
  isWithinComparisonWindow,
  normalizeRiskYears,
  riskYearRangesDiffer,
  unequalRiskYearsNote,
  DIVERGENCE_THRESHOLDS,
} from "@/lib/reconcile";
import { mapCadRow } from "@/lib/sources/jpl-cad";
import { parseJplSentryResponse } from "@/lib/sources/jpl-sentry";
import {
  parseEsaRiskList,
  parseEsaObjectColumn,
} from "@/lib/sources/esa-neocc";
import {
  CLOSE_APPROACH_HORIZON_DAYS,
  SOURCE_URLS,
} from "@/lib/types";

/** Stable reference so close-approach fixtures stay inside the shared window. */
const REF_DATE = "2026-01-01T12:00:00.000Z";

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

  it("rejects malformed ESA bodies that previously looked like empty feeds", () => {
    expect(() => parseEsaRiskList(" maintenance ")).toThrow(/unrecognized/);
  });

  it("parses object column variants", () => {
    expect(parseEsaObjectColumn("101955 Bennu")).toEqual({
      designation: "101955",
      name: "Bennu",
    });
    expect(parseEsaObjectColumn("443104 2013XK22")).toEqual({
      designation: "443104",
      name: "2013XK22",
    });
    expect(parseEsaObjectColumn("2023VD3")).toEqual({
      designation: "2023VD3",
    });
  });
});

describe("calibrated field thresholds (helpers)", () => {
  it("does not flag JPL/ESA velocity pairs that agree at ESA 0.1 km/s precision", () => {
    // Raw relative gap ~0.3% but also rounds to the same tenth
    expect(relativeVelocitiesDiverge(13.54, 13.5)).toBe(false);
    // Audited false positive: 2025 SC (~1.004% raw) rounds to ESA 1.9
    expect(relativeVelocitiesDiverge(1.91927306868757, 1.9)).toBe(false);
    expect(roundToDecimals(1.91927306868757, 1)).toBe(1.9);
  });

  it("flags velocity when rounded tenths differ and exceed 1%", () => {
    // 2.0 vs 1.9 → 5% after rounding
    expect(relativeVelocitiesDiverge(1.96, 1.9)).toBe(true);
    expect(roundToDecimals(1.96, 1)).toBe(2.0);
    // Exact tenth match after rounding → no flag even if raw differs
    expect(relativeVelocitiesDiverge(1.94, 1.9)).toBe(false);
    expect(roundToDecimals(1.94, 1)).toBe(1.9);
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

describe("reconcileSources chronological date sort", () => {
  it("orders JPL month-name dates chronologically (Jul before Aug)", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "2017 RH16",
          closeApproachDate: "2026-Aug-31 21:05",
          distanceAu: 0.1,
        },
        {
          designation: "2026 OR",
          closeApproachDate: "2026-Jul-28 21:16",
          distanceAu: 0.1,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects.map((o) => o.normalizedKey)).toEqual([
      "2026OR",
      "2017RH16",
    ]);
  });

  it("orders mixed JPL and ESA date formats chronologically", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "173561",
          closeApproachDate: "2026-Aug-09 05:12",
          distanceAu: 0.1,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        {
          designation: "2021 PF7",
          date: "2026-12-26",
          missDistanceAu: 0.1,
        },
      ],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects.map((o) => o.normalizedKey)).toEqual([
      "173561",
      "2021PF7",
    ]);
  });

  it("treats equivalent JPL/ESA calendar days as equal and uses designation tie-breaker", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "ZZZ999",
          closeApproachDate: "2026-Jul-15 12:00",
          distanceAu: 0.1,
        },
        {
          designation: "AAA111",
          closeApproachDate: "2026-Jul-15 06:00",
          distanceAu: 0.1,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        {
          designation: "MMM555",
          date: "2026-07-15",
          missDistanceAu: 0.1,
        },
      ],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects.map((o) => o.normalizedKey)).toEqual([
      "AAA111",
      "MMM555",
      "ZZZ999",
    ]);
  });

  it("places missing approach dates after dated objects (same priority group)", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "DATED",
          closeApproachDate: "2026-Jul-01",
          distanceAu: 0.1,
        },
      ],
      jplSentry: [],
      esaRisk: [{ designation: "NODATE", torinoScaleMax: 0 }],
      esaClose: [],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });
    expect(result.objects.map((o) => o.normalizedKey)).toEqual([
      "DATED",
      "NODATE",
    ]);
  });

  it("approachDateKey returns null for invalid date strings", () => {
    expect(approachDateKey("")).toBeNull();
    expect(approachDateKey("not-a-date")).toBeNull();
    expect(approachDateKey("2026-Foo-01")).toBeNull();
  });
});

describe("risk-year aggregation windows", () => {
  it("normalizes and detects equal vs unequal ranges", () => {
    expect(normalizeRiskYears(" 2064-2088 ")).toBe("2064-2088");
    expect(riskYearRangesDiffer("2064-2088", "2064-2088")).toBe(false);
    expect(riskYearRangesDiffer("2064-2088", "2057-2103")).toBe(true);
    expect(riskYearRangesDiffer("2064-2088", undefined)).toBe(false);
    expect(unequalRiskYearsNote("2064-2088", "2057-2103")).toMatch(
      /informational/,
    );
    expect(unequalRiskYearsNote("2064-2088", "2064-2088")).toBeUndefined();
  });

  it("annotates cumulative divergences when JPL/ESA risk years differ", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [
        {
          designation: "2025 CL3",
          cumulativeImpactProbability: 0.000096,
          palermoScaleCumulative: -3,
          riskWindowYears: "2064-2088",
        },
      ],
      esaRisk: [
        {
          designation: "2025CL3",
          cumulativeImpactProbability: 0.0000224,
          palermoScaleCumulative: -4,
          riskYears: "2057-2103",
        },
      ],
      esaClose: [],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });

    const obj = result.objects[0];
    const ip = obj.divergences.find(
      (d) => d.field === "cumulativeImpactProbability",
    );
    const ps = obj.divergences.find(
      (d) => d.field === "palermoScaleCumulative",
    );
    expect(ip?.notes).toMatch(/2064-2088/);
    expect(ip?.notes).toMatch(/2057-2103/);
    expect(ps?.notes).toMatch(/Aggregation windows differ/);
    // Unequal ranges are context only — still counted as risk divergences
    expect(obj.significantDivergences).toBe(2);
    expect(obj.divergences.some((d) => d.field === "riskYears")).toBe(false);
  });

  it("does not annotate cumulative divergences when risk years match", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [
        {
          designation: "EQRANGE",
          cumulativeImpactProbability: 0.001,
          riskWindowYears: "2050-2100",
        },
      ],
      esaRisk: [
        {
          designation: "EQRANGE",
          cumulativeImpactProbability: 0.005,
          riskYears: "2050-2100",
        },
      ],
      esaClose: [],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });

    const ip = result.objects[0].divergences.find(
      (d) => d.field === "cumulativeImpactProbability",
    );
    expect(ip).toBeDefined();
    expect(ip?.notes).toBeUndefined();
  });

  it("preserves available range on JPL-only and ESA-only objects", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [
        {
          designation: "JPLONLY",
          cumulativeImpactProbability: 1e-5,
          riskWindowYears: "2039-2122",
        },
      ],
      esaRisk: [
        {
          designation: "ESAONLY",
          cumulativeImpactProbability: 2e-5,
          riskYears: "2072-2121",
        },
      ],
      esaClose: [],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });

    const jpl = result.objects.find((o) => o.normalizedKey === "JPLONLY");
    const esa = result.objects.find((o) => o.normalizedKey === "ESAONLY");
    expect(jpl?.sources.jplSentry.risk?.riskWindowYears).toBe("2039-2122");
    expect(esa?.sources.esaNeocc.risk?.riskYears).toBe("2072-2121");
    expect(jpl?.divergences.every((d) => !d.notes)).toBe(true);
    expect(esa?.divergences.every((d) => !d.notes)).toBe(true);
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
      referenceDate: "2056-01-01T12:00:00.000Z",
    });

    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].normalizedKey).toBe("1979XB");
    expect(result.objects[0].crossSourceMatch).toBe(true);
    expect(result.objects[0].sources.jplCad.present).toBe(true);
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
      referenceDate: REF_DATE,
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
      referenceDate: REF_DATE,
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
      referenceDate: REF_DATE,
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
      referenceDate: REF_DATE,
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
      referenceDate: REF_DATE,
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
      referenceDate: REF_DATE,
    });

    expect(filterReconciledObjects(result.objects, "multi")).toHaveLength(1);
    expect(filterReconciledObjects(result.objects, "divergent")).toHaveLength(1);
  });

  it("riskListed matches view=risk filter (union of Sentry and ESA risk)", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "CLOSE ONLY",
          closeApproachDate: "2026-Jul-15",
          distanceAu: 0.04,
        },
      ],
      jplSentry: [
        { designation: "JPL ONLY", torinoScaleMax: 0 },
        { designation: "BOTH", torinoScaleMax: 0 },
        {
          designation: "SENTRY+ESA CLOSE",
          torinoScaleMax: 0,
        },
      ],
      esaRisk: [
        { designation: "ESA ONLY", torinoScaleMax: 0 },
        { designation: "BOTH", torinoScaleMax: 0 },
      ],
      esaClose: [
        {
          designation: "SENTRY+ESA CLOSE",
          date: "2026-07-15",
          missDistanceAu: 0.04,
        },
        {
          designation: "CLOSE ONLY",
          date: "2026-07-15",
          missDistanceAu: 0.03,
        },
      ],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });

    const riskRows = filterReconciledObjects(result.objects, "risk");
    expect(result.meta.stats.riskListed).toBe(riskRows.length);
    expect(result.meta.stats.riskListed).toBe(4);

    const keys = riskRows.map((o) => o.normalizedKey).sort();
    expect(keys).toEqual(
      ["BOTH", "ESAONLY", "JPLONLY", "SENTRY+ESACLOSE"].sort(),
    );

    // Intersection metric stays distinct: BOTH + SENTRY+ESA CLOSE (any ESA)
    expect(result.meta.stats.sentryAndEsa).toBe(2);

    // Close-only (no Sentry, no ESA risk) is excluded from the risk tab
    expect(keys).not.toContain("CLOSEONLY");
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
      referenceDate: REF_DATE,
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
      referenceDate: REF_DATE,
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
      referenceDate: REF_DATE,
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
      referenceDate: REF_DATE,
    });

    expect(
      result.objects[0].divergences.some(
        (d) => d.field === "palermoScaleCumulative",
      ),
    ).toBe(true);
    expect(result.objects[0].significantDivergences).toBe(1);
  });

  it("joins numbered ESA risk (443104 2013XK22) to JPL and reports IP + Palermo Δ", () => {
    const esaParsed = parseEsaObjectColumn("443104 2013XK22");
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [
        {
          designation: "443104",
          cumulativeImpactProbability: 4.456e-6,
          palermoScaleCumulative: -5.28,
        },
      ],
      esaRisk: [
        {
          designation: esaParsed.designation,
          name: esaParsed.name,
          cumulativeImpactProbability: 1.18e-6,
          palermoScaleCumulative: -5.85,
        },
      ],
      esaClose: [],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });

    expect(result.objects).toHaveLength(1);
    const obj = result.objects[0];
    expect(obj.normalizedKey).toBe("443104");
    expect(obj.crossSourceMatch).toBe(true);
    expect(obj.displayName).toBe("2013XK22");
    const fields = obj.divergences.map((d) => d.field);
    expect(fields).toContain("cumulativeImpactProbability");
    expect(fields).toContain("palermoScaleCumulative");
    expect(obj.significantDivergences).toBe(2);
  });

  it("joins numbered CAD examples to ESA close-approach records", () => {
    const numbered = [
      { id: "173561", esaCol: "173561 2000YV137" },
      { id: "523609", esaCol: "523609 2008EY5" },
      { id: "221455", esaCol: "221455 2005YZ128" },
    ];

    for (const { id, esaCol } of numbered) {
      const esaParsed = parseEsaObjectColumn(esaCol);
      const result = reconcileSources({
        jplCad: [
          {
            designation: id,
            closeApproachDate: "2026-Aug-01 12:00",
            distanceAu: 0.05,
            velocityRelativeKms: 10,
          },
        ],
        jplSentry: [],
        esaRisk: [],
        esaClose: [
          {
            designation: esaParsed.designation,
            name: esaParsed.name,
            date: "2026-08-01",
            missDistanceAu: 0.05,
            relativeVelocityKms: 10,
          },
        ],
        sourceStatus: baseStatus,
        referenceDate: REF_DATE,
      });

      expect(result.objects).toHaveLength(1);
      expect(result.objects[0].normalizedKey).toBe(id);
      expect(result.objects[0].crossSourceMatch).toBe(true);
      expect(result.objects[0].sources.jplCad.present).toBe(true);
      expect(result.objects[0].sources.esaNeocc.present).toBe(true);
    }
  });
});

describe("shared close-approach comparison window", () => {
  it("exposes the effective comparison window in reconciliation metadata", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [],
      esaRisk: [],
      esaClose: [],
      sourceStatus: baseStatus,
      referenceDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.meta.comparisonWindow).toEqual({
      start: "2026-07-28",
      end: "2027-07-28",
      days: CLOSE_APPROACH_HORIZON_DAYS,
    });
    expect(CLOSE_APPROACH_HORIZON_DAYS).toBe(365);
    expect(SOURCE_URLS["jpl-cad"]).toContain(
      `date-max=%2B${CLOSE_APPROACH_HORIZON_DAYS}`,
    );
    expect(SOURCE_URLS["jpl-cad"]).not.toContain("date-max=%2B60");
  });

  it("includes fixtures inside the horizon and excludes those outside", () => {
    const window = buildComparisonWindow(new Date("2026-07-28T00:00:00.000Z"));
    expect(isWithinComparisonWindow("2026-07-28", window)).toBe(true);
    expect(isWithinComparisonWindow("2026-Sep-27 20:54", window)).toBe(true); // day 61
    expect(isWithinComparisonWindow("2027-07-28", window)).toBe(true);
    expect(isWithinComparisonWindow("2027-07-29", window)).toBe(false);
    expect(isWithinComparisonWindow("2026-07-27", window)).toBe(false);
  });

  it("2025 SC: does not flag velocity when JPL rounds to ESA 1.9 km/s", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "2025 SC",
          closeApproachDate: "2026-Jul-15",
          distanceAu: 0.05,
          velocityRelativeKms: 1.91927306868757,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        {
          designation: "2025SC",
          date: "2026-07-15",
          missDistanceAu: 0.05,
          relativeVelocityKms: 1.9,
        },
      ],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });
    const obj = result.objects[0];
    expect(
      obj.divergences.some((d) => d.field === "relativeVelocity"),
    ).toBe(false);
    // Raw values preserved on the object / would be in sources if flagged
    expect(obj.sources.jplCad.closeApproach?.velocityRelativeKms).toBe(
      1.91927306868757,
    );
    expect(obj.sources.esaNeocc.closeApproach?.relativeVelocityKms).toBe(1.9);
  });

  it("flags relativeVelocity when rounded tenths disagree beyond 1%", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "VELDIFF",
          closeApproachDate: "2026-Jul-15",
          distanceAu: 0.05,
          velocityRelativeKms: 1.96,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        {
          designation: "VELDIFF",
          date: "2026-07-15",
          missDistanceAu: 0.05,
          relativeVelocityKms: 1.9,
        },
      ],
      sourceStatus: baseStatus,
      referenceDate: REF_DATE,
    });
    const div = result.objects[0].divergences.find(
      (d) => d.field === "relativeVelocity",
    );
    expect(div).toBeDefined();
    expect(div?.sources["jpl-cad"]).toBe(1.96);
    expect(div?.sources["esa-neocc"]).toBe(1.9);
  });

  it("joins an ESA encounter at day 61 when JPL CAD also has it (not ESA-only)", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "2018 SP2",
          closeApproachDate: "2026-Sep-30 20:54",
          distanceAu: 0.04,
          velocityRelativeKms: 12,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        {
          designation: "2018SP2",
          date: "2026-09-30",
          missDistanceAu: 0.04,
          relativeVelocityKms: 12,
        },
      ],
      sourceStatus: baseStatus,
      referenceDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.objects).toHaveLength(1);
    const obj = result.objects[0];
    expect(obj.crossSourceMatch).toBe(true);
    expect(obj.sources.jplCad.present).toBe(true);
    expect(obj.sources.esaNeocc.present).toBe(true);
    expect(obj.sourceCoverage).toBe(2);
  });

  it("does not treat an ESA encounter beyond the horizon as ESA-only coverage", () => {
    const result = reconcileSources({
      jplCad: [],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        {
          designation: "2099 ZZ99",
          date: "2027-08-15",
          missDistanceAu: 0.03,
        },
      ],
      sourceStatus: baseStatus,
      referenceDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.objects).toHaveLength(0);
    expect(result.meta.comparisonWindow.end).toBe("2027-07-28");
  });

  it("applies the same inclusive date boundaries to JPL CAD and ESA close approaches", () => {
    const result = reconcileSources({
      jplCad: [
        {
          designation: "INSIDE",
          closeApproachDate: "2027-Jul-28",
          distanceAu: 0.02,
        },
        {
          designation: "OUTSIDE",
          closeApproachDate: "2027-Jul-29",
          distanceAu: 0.02,
        },
      ],
      jplSentry: [],
      esaRisk: [],
      esaClose: [
        { designation: "INSIDE", date: "2027-07-28", missDistanceAu: 0.02 },
        { designation: "OUTSIDE", date: "2027-07-29", missDistanceAu: 0.02 },
      ],
      sourceStatus: baseStatus,
      referenceDate: "2026-07-28T00:00:00.000Z",
    });

    expect(result.objects).toHaveLength(1);
    expect(result.objects[0].normalizedKey).toBe("INSIDE");
    expect(result.objects[0].sources.jplCad.present).toBe(true);
    expect(result.objects[0].sources.esaNeocc.present).toBe(true);
  });
});
