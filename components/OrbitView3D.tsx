"use client";

import dynamic from "next/dynamic";
import type { ReconciledObject } from "@/lib/types";
import { buildApproachGeometry } from "@/lib/orbit-geometry";

const OrbitScene = dynamic(
  () => import("@/components/OrbitScene").then((m) => m.OrbitScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-[var(--surface)]">
        <p className="num text-xs text-[var(--text-muted)] uppercase tracking-[0.14em]">
          Loading 3D view…
        </p>
      </div>
    ),
  },
);

interface OrbitView3DProps {
  object: ReconciledObject;
}

export function OrbitView3D({ object }: OrbitView3DProps) {
  const jpl = object.sources.jplCad.closeApproach;
  const esa = object.sources.esaNeocc.closeApproach;

  const geometry = buildApproachGeometry({
    designation: object.designation,
    jplDistanceAu: jpl?.distanceAu,
    jplDistanceMinAu: jpl?.distanceMinAu,
    jplDistanceMaxAu: jpl?.distanceMaxAu,
    jplVelocityKms: jpl?.velocityRelativeKms,
    jplDate: jpl?.closeApproachDate,
    esaDistanceAu: esa?.missDistanceAu,
    esaDistanceLd: esa?.missDistanceLd,
    esaDate: esa?.date,
    esaVelocityKms: esa?.relativeVelocityKms,
  });

  if (!geometry) {
    return (
      <div className="panel anim-fade-up-delay-1">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Close approach</h2>
            <p className="panel-subtitle">
              No miss distance in CAD or ESA for this one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden anim-fade-up-delay-1">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Close approach</h2>
          <p className="panel-subtitle">
            Miss distance sketch — not a real orbit plot.
          </p>
        </div>
        {geometry.hasDivergence && (
          <span className="badge badge-attention num whitespace-nowrap">
            JPL ≠ ESA
          </span>
        )}
      </div>

      <div className="relative h-[360px] md:h-[420px] border-b border-[var(--border)] bg-[var(--surface)]">
        <OrbitScene geometry={geometry} />
        <div className="pointer-events-none absolute left-3 top-3 num text-[0.6rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          drag · zoom · auto-rotate
        </div>
      </div>

      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
        {geometry.markers.map((m) => (
          <div key={m.source} className="min-w-0">
            <div
              className={`text-[0.65rem] uppercase tracking-[0.12em] ${
                geometry.hasDivergence
                  ? "text-[var(--accent-amber)]"
                  : "text-[var(--accent-green)]"
              }`}
            >
              {m.label}
            </div>
            <div className="num text-sm mt-1">
              {m.distanceAu.toFixed(6)} au
              <span className="text-[var(--text-muted)]">
                {" "}
                · {m.distanceLd.toFixed(2)} LD
              </span>
            </div>
            {(m.date || m.velocityKms !== undefined) && (
              <div className="num text-[0.65rem] text-[var(--text-muted)] mt-0.5 truncate">
                {m.date ?? "—"}
                {m.velocityKms !== undefined
                  ? ` · ${m.velocityKms.toFixed(2)} km/s`
                  : ""}
              </div>
            )}
          </div>
        ))}

        {geometry.uncertainty && (
          <div className="min-w-0">
            <div className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              JPL uncertainty (dist_min–max)
            </div>
            <div className="num text-sm mt-1 text-[var(--accent-amber)]">
              {geometry.uncertainty.minAu.toFixed(6)} –{" "}
              {geometry.uncertainty.maxAu.toFixed(6)} au
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
