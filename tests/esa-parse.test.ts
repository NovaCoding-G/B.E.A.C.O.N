import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "@/lib/cache";
import {
  fetchEsaRiskList,
  parseEsaCloseApproaches,
  parseEsaRiskList,
} from "@/lib/sources/esa-neocc";

vi.mock("@/lib/fetch-external", () => ({
  fetchExternalText: vi.fn(),
}));

import { fetchExternalText } from "@/lib/fetch-external";

const mockedText = vi.mocked(fetchExternalText);

const riskFixture = `Last Update: 2026-07-22 15:48 UTC
           Object             |    Diameter    |             VI Max                                   |          VIs                  |
Num/des.           Name       |   m  |   *=Y   |      Date/Time   |  IP max  | PS max |TS  | Vel km/s | Years     | IP cum   | PS cum |
AAAAAAAAAAAA AAAAAAAAAAAAAAAA | NNNN |    A    | YYYY-MM-DD HH:MM | EEEEEEEE | NNN.NN | NN |  NNN.NN  | YYYY-YYYY | EEEEEEEE | NNN.NN |
1979XB                        |  500 |    *    | 2056-12-12 21:38 |  2.34E-7 |  -2.82 |  0 |   27.54  | 2056-2113 |  7.34E-7 |  -2.70 |`;

const closeFixture = `Last Update: 2026-07-22 15:48 UTC
           Object             |    Date    | Miss distance |  |  | Diameter |  | H | Mag | Vrel | CAI |
Num/des.           Name       | YYYY-MM-DD | km | au | ld | m | *=Y |  |  | km/s |  |
AAAAAAAAAAAA AAAAAAAAAAAAAAAA | YYYY-MM-DD | N | E | E | N | A | E | E | E | E |
1979XB                        | 2026-07-15 | 6000000 | 4.0E-2 | 15.5 | 500 | * | 20.1 | 18.0 | 27.5 | 1.2 |`;

const headerOnlyFixture = `Last Update: 2026-07-22 15:48 UTC
           Object             |    Diameter    |
Num/des.           Name       |   m  |   *=Y   |
AAAAAAAAAAAA AAAAAAAAAAAAAAAA | NNNN |    A    |`;

describe("parseEsaRiskList / parseEsaCloseApproaches validation", () => {
  it("parses valid current ESA fixtures", () => {
    const risk = parseEsaRiskList(riskFixture);
    expect(risk.entries).toHaveLength(1);
    expect(risk.entries[0].designation).toBe("1979XB");
    expect(risk.lastUpdate).toContain("2026-07-22");

    const close = parseEsaCloseApproaches(closeFixture);
    expect(close.entries).toHaveLength(1);
    expect(close.entries[0].designation).toBe("1979XB");
    expect(close.entries[0].missDistanceAu).toBeCloseTo(0.04);
  });

  it("treats a valid header-only feed as an empty success", () => {
    const risk = parseEsaRiskList(headerOnlyFixture);
    expect(risk.entries).toEqual([]);
    expect(risk.lastUpdate).toContain("2026-07-22");

    const close = parseEsaCloseApproaches(headerOnlyFixture);
    expect(close.entries).toEqual([]);
    expect(close.lastUpdate).toContain("2026-07-22");
  });

  it("rejects HTML and arbitrary text bodies", () => {
    expect(() =>
      parseEsaRiskList("<!DOCTYPE html><html><body>maintenance</body></html>"),
    ).toThrow(/HTML body rejected/);
    expect(() => parseEsaRiskList(" maintenance ")).toThrow(/unrecognized/);
    expect(() =>
      parseEsaCloseApproaches("upstream format changed"),
    ).toThrow(/unrecognized/);
  });

  it("does not throw trim errors on truncated rows; fails the feed if all rows are bad", () => {
    const truncated = `${headerOnlyFixture}
1979XB                        |  500 |    *    | 2056-12-12 21:38 |  2.34E-7 |  -2.82 |  0 |   27.54 |`;
    expect(() => parseEsaRiskList(truncated)).not.toThrow(/trim/);
    expect(() => parseEsaRiskList(truncated)).toThrow(/all 1 data row/);
    expect(() => parseEsaCloseApproaches(truncated)).toThrow(/all 1 data row/);
  });

  it("fails when every data row is rejected (format drift / unusable layout)", () => {
    const drifted = `${headerOnlyFixture}
DRIFT1 | only | a | few | cols |
DRIFT2 | still | truncated | layout |`;
    expect(() => parseEsaRiskList(drifted)).toThrow(/all 2 data row/);
  });
});

describe("fetchEsaRiskList does not cache malformed bodies as healthy", () => {
  beforeEach(() => {
    clearCache();
    mockedText.mockReset();
  });

  afterEach(() => {
    clearCache();
  });

  it("marks meta.success=false for unrecognized body and does not cache it", async () => {
    mockedText.mockResolvedValue(" maintenance ");
    const first = await fetchEsaRiskList();
    expect(first.meta.success).toBe(false);
    expect(first.data).toEqual([]);

    mockedText.mockResolvedValue(riskFixture);
    const second = await fetchEsaRiskList();
    expect(second.meta.success).toBe(true);
    expect(second.data).toHaveLength(1);
    expect(mockedText).toHaveBeenCalledTimes(2);
  });
});
