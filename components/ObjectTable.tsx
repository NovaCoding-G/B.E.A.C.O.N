import Link from "next/link";
import type { ReconciledObject } from "@/lib/types";
import { LD_AU } from "@/lib/orbit-geometry";
import { RiskBadge } from "@/components/RiskBadge";

interface ObjectTableProps {
  objects: ReconciledObject[];
  emptyMessage?: string;
}

function formatDistanceAu(au: number | undefined): string {
  if (au === undefined) return "—";
  return `${au.toFixed(6)} au`;
}

function formatLd(au: number | undefined): string {
  if (au === undefined) return "";
  return ` · ${(au / LD_AU).toFixed(2)} LD`;
}

function bestDistance(obj: ReconciledObject): number | undefined {
  return (
    obj.sources.jplCad.closeApproach?.distanceAu ??
    obj.sources.esaNeocc.closeApproach?.missDistanceAu
  );
}

function bestApproachDate(obj: ReconciledObject): string | undefined {
  return (
    obj.sources.jplCad.closeApproach?.closeApproachDate ??
    obj.sources.esaNeocc.closeApproach?.date
  );
}

function bestVelocity(obj: ReconciledObject): number | undefined {
  return (
    obj.sources.jplCad.closeApproach?.velocityRelativeKms ??
    obj.sources.esaNeocc.closeApproach?.relativeVelocityKms
  );
}

function SourceBadges({ obj }: { obj: ReconciledObject }) {
  const badges = [
    { key: "CAD", on: obj.sources.jplCad.present },
    { key: "SNT", on: obj.sources.jplSentry.present },
    { key: "ESA", on: obj.sources.esaNeocc.present },
  ];

  return (
    <div className="flex gap-1">
      {badges.map(({ key, on }) => (
        <span
          key={key}
          className={`source-chip ${on ? "source-chip-on" : ""}`}
          title={on ? key : `${key} missing`}
        >
          {key}
        </span>
      ))}
    </div>
  );
}

function ComparisonBadge({ obj }: { obj: ReconciledObject }) {
  const href = `/object/${encodeURIComponent(obj.designation)}`;

  if (obj.significantDivergences > 0) {
    return (
      <Link
        href={href}
        className="badge badge-attention num hover:opacity-80"
        title="Divergence on impact probability / Palermo / Torino"
      >
        risk {obj.significantDivergences}
      </Link>
    );
  }

  if (obj.totalFieldDivergences > 0) {
    return (
      <Link
        href={href}
        className="badge badge-neutral num hover:opacity-80"
        title="Orbital fields only (distance / velocity / date)"
      >
        orbital {obj.totalFieldDivergences}
      </Link>
    );
  }

  if (obj.crossSourceMatch) {
    return <span className="badge badge-nominal">agree</span>;
  }

  return (
    <span className="text-xs text-[var(--text-muted)]">single source</span>
  );
}

export function ObjectTable({ objects, emptyMessage }: ObjectTableProps) {
  if (objects.length === 0) {
    return (
      <div className="panel p-10 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          {emptyMessage ??
            "No objects in this filter."}
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <table className="data-table min-w-[640px]">
        <thead>
          <tr>
            <th>Designation</th>
            <th>Coverage</th>
            <th>Approach</th>
            <th>Distance</th>
            <th>v_rel</th>
            <th>Risk</th>
            <th>Comparison</th>
          </tr>
        </thead>
        <tbody>
          {objects.map((obj) => {
            const sentry = obj.sources.jplSentry.risk;
            const esaRisk = obj.sources.esaNeocc.risk;
            const dist = bestDistance(obj);
            const velocity = bestVelocity(obj);
            const rowClass =
              obj.significantDivergences > 0 ? "row-divergent" : undefined;

            return (
              <tr key={obj.normalizedKey} className={rowClass}>
                <td>
                  <Link
                    href={`/object/${encodeURIComponent(obj.designation)}`}
                    className="text-[var(--accent-green)] hover:underline font-medium num"
                  >
                    {obj.designation}
                  </Link>
                  {obj.displayName && obj.displayName !== obj.designation && (
                    <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                      {obj.displayName}
                    </span>
                  )}
                  {obj.crossSourceMatch && (
                    <span className="block text-[0.6rem] uppercase tracking-[0.12em] text-[var(--accent-green)] mt-1">
                      cross-match
                    </span>
                  )}
                </td>
                <td>
                  <SourceBadges obj={obj} />
                  <span className="block num text-[0.65rem] text-[var(--text-muted)] mt-1.5">
                    {obj.sourceCoverage}/3
                  </span>
                </td>
                <td className="num text-xs whitespace-nowrap">
                  {bestApproachDate(obj) ?? "—"}
                </td>
                <td className="num text-xs">
                  {formatDistanceAu(dist)}
                  <span className="text-[var(--text-muted)]">
                    {formatLd(dist)}
                  </span>
                  {obj.divergences.some((d) => d.field === "missDistanceAu") && (
                    <span className="block text-[0.65rem] text-[var(--text-muted)] mt-0.5">
                      dist. ≠
                    </span>
                  )}
                </td>
                <td className="num text-xs whitespace-nowrap">
                  {velocity !== undefined ? `${velocity.toFixed(2)} km/s` : "—"}
                </td>
                <td>
                  {sentry ? (
                    <RiskBadge
                      torino={sentry.torinoScaleMax}
                      palermo={sentry.palermoScaleCumulative}
                      compact
                    />
                  ) : esaRisk ? (
                    <RiskBadge
                      torino={esaRisk.torinoScaleMax}
                      palermo={esaRisk.palermoScaleCumulative}
                      compact
                    />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </td>
                <td>
                  <ComparisonBadge obj={obj} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
