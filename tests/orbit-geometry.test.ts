import { describe, it, expect } from "vitest";
import {
  buildApproachGeometry,
  auToSceneRadius,
  LD_AU,
} from "@/lib/orbit-geometry";

describe("orbit-geometry", () => {
  it("returns null without distance data", () => {
    expect(buildApproachGeometry({ designation: "2026 OU" })).toBeNull();
  });

  it("builds geometry from JPL CAD only", () => {
    const g = buildApproachGeometry({
      designation: "2026 OU",
      jplDistanceAu: 0.024537,
      jplDistanceMinAu: 0.0244,
      jplDistanceMaxAu: 0.0247,
      jplDate: "2026-Jul-23 06:19",
    });
    expect(g).not.toBeNull();
    expect(g!.markers).toHaveLength(1);
    expect(g!.markers[0].source).toBe("jpl-cad");
    expect(g!.uncertainty).toBeDefined();
    expect(g!.hasDivergence).toBe(false);
  });

  it("flags divergence when JPL and ESA distances differ beyond threshold", () => {
    const g = buildApproachGeometry({
      designation: "2026 OU",
      jplDistanceAu: 0.02,
      esaDistanceAu: 0.03,
    });
    expect(g!.markers).toHaveLength(2);
    expect(g!.hasDivergence).toBe(true);
  });

  it("maps LD ring inside frame", () => {
    const g = buildApproachGeometry({
      designation: "X",
      jplDistanceAu: 0.05,
    });
    expect(g!.ldRingRadius).toBeLessThan(g!.frameRadius);
    expect(auToSceneRadius(LD_AU, 0.05)).toBeGreaterThan(0);
  });
});
