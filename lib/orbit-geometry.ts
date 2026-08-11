import {
  DIVERGENCE_THRESHOLDS,
  encounterDaysAlign,
} from "@/lib/reconcile";

export const LD_AU = 0.002569;

export interface ApproachGeometryInput {
  designation: string;
  jplDistanceAu?: number;
  jplDistanceMinAu?: number;
  jplDistanceMaxAu?: number;
  jplVelocityKms?: number;
  jplDate?: string;
  esaDistanceAu?: number;
  esaDistanceLd?: number;
  esaDate?: string;
  esaVelocityKms?: number;
}

export interface ApproachMarker {
  source: "jpl-cad" | "esa-neocc";
  label: string;
  distanceAu: number;
  distanceLd: number;
  date?: string;
  velocityKms?: number;
  sceneRadius: number;
  angle: number;
}

export interface ApproachGeometry {
  designation: string;
  markers: ApproachMarker[];
  frameRadius: number;
  ldRingRadius: number;
  uncertainty?: {
    minScene: number;
    maxScene: number;
    minAu: number;
    maxAu: number;
  };
  hasDivergence: boolean;
}

export function auToSceneRadius(distanceAu: number, maxAu: number): number {
  if (!Number.isFinite(distanceAu) || distanceAu <= 0) return 1.5;
  const floor = Math.max(maxAu, LD_AU * 2);
  const scale = 10 / floor;
  return Math.max(1.4, distanceAu * scale);
}

export function buildApproachGeometry(
  input: ApproachGeometryInput,
): ApproachGeometry | null {
  const candidates: { source: "jpl-cad" | "esa-neocc"; au: number }[] = [];
  if (input.jplDistanceAu !== undefined && input.jplDistanceAu > 0) {
    candidates.push({ source: "jpl-cad", au: input.jplDistanceAu });
  }
  if (input.esaDistanceAu !== undefined && input.esaDistanceAu > 0) {
    candidates.push({ source: "esa-neocc", au: input.esaDistanceAu });
  }

  if (candidates.length === 0) return null;

  const maxAu = Math.max(...candidates.map((c) => c.au), LD_AU * 4);
  const markers: ApproachMarker[] = [];

  if (input.jplDistanceAu !== undefined && input.jplDistanceAu > 0) {
    markers.push({
      source: "jpl-cad",
      label: "JPL CAD",
      distanceAu: input.jplDistanceAu,
      distanceLd: input.jplDistanceAu / LD_AU,
      date: input.jplDate,
      velocityKms: input.jplVelocityKms,
      sceneRadius: auToSceneRadius(input.jplDistanceAu, maxAu),
      angle: 0.15,
    });
  }

  if (input.esaDistanceAu !== undefined && input.esaDistanceAu > 0) {
    markers.push({
      source: "esa-neocc",
      label: "ESA NEOCC",
      distanceAu: input.esaDistanceAu,
      distanceLd: input.esaDistanceLd ?? input.esaDistanceAu / LD_AU,
      date: input.esaDate,
      velocityKms: input.esaVelocityKms,
      sceneRadius: auToSceneRadius(input.esaDistanceAu, maxAu),
      angle: -0.45,
    });
  }

  const frameRadius = Math.max(
    ...markers.map((m) => m.sceneRadius),
    auToSceneRadius(LD_AU, maxAu),
  );

  let uncertainty: ApproachGeometry["uncertainty"];
  if (
    input.jplDistanceMinAu !== undefined &&
    input.jplDistanceMaxAu !== undefined &&
    input.jplDistanceMinAu > 0 &&
    input.jplDistanceMaxAu > input.jplDistanceMinAu
  ) {
    uncertainty = {
      minAu: input.jplDistanceMinAu,
      maxAu: input.jplDistanceMaxAu,
      minScene: auToSceneRadius(input.jplDistanceMinAu, maxAu),
      maxScene: auToSceneRadius(input.jplDistanceMaxAu, maxAu),
    };
  }

  // Mirror reconcile: only flag geometric Δ for the same flyby (±2 days).
  const hasDivergence =
    markers.length === 2 &&
    encounterDaysAlign(input.jplDate, input.esaDate) &&
    Math.abs(markers[0].distanceAu - markers[1].distanceAu) /
      Math.max(markers[0].distanceAu, markers[1].distanceAu) >
      DIVERGENCE_THRESHOLDS.missDistanceAuRelative;

  return {
    designation: input.designation,
    markers,
    frameRadius,
    ldRingRadius: auToSceneRadius(LD_AU, maxAu),
    uncertainty,
    hasDivergence,
  };
}
