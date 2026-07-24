import type { ReconciledObject } from "@/lib/types";
import { FIELD_THRESHOLD_INFO } from "@/lib/reconcile";

interface SourceComparisonPanelProps {
  object: ReconciledObject;
}

function absent(): string {
  return "—";
}

function formatProb(p: number | undefined): string {
  if (p === undefined) return absent();
  if (p === 0) return "0";
  return p.toExponential(3);
}

function formatNum(n: number | undefined, digits = 6): string {
  if (n === undefined) return absent();
  return n.toFixed(digits);
}

function isDivergent(
  divergences: ReconciledObject["divergences"],
  field: string,
  source: string,
): boolean {
  return divergences.some((d) => d.field === field && source in d.sources);
}

function cellClass(highlight: boolean, present: boolean): string {
  if (!present) return "diff-cell diff-cell-absent";
  if (highlight) return "diff-cell diff-cell-divergent";
  return "diff-cell";
}

function fieldTooltip(field: string | undefined): string | undefined {
  if (!field) return undefined;
  return FIELD_THRESHOLD_INFO[field]?.explanation;
}

export function SourceComparisonPanel({ object }: SourceComparisonPanelProps) {
  const { jplCad, jplSentry, esaNeocc } = object.sources;
  const { divergences } = object;

  const diameterEsa =
    esaNeocc.risk?.diameterMeters !== undefined
      ? `${esaNeocc.risk.diameterMeters} m${esaNeocc.risk.diameterFromMagnitude ? " *" : ""}`
      : esaNeocc.closeApproach?.diameterMeters !== undefined
        ? `${esaNeocc.closeApproach.diameterMeters} m${esaNeocc.closeApproach.diameterFromMagnitude ? " *" : ""}`
        : absent();

  const rows: {
    label: string;
    note?: string;
    cad: string;
    sentry: string;
    esa: string;
    field?: string;
  }[] = [
    {
      label: "Close-approach date",
      cad: jplCad.closeApproach?.closeApproachDate ?? absent(),
      sentry: absent(),
      esa: esaNeocc.closeApproach?.date ?? absent(),
      field: "closeApproachDate",
    },
    {
      label: "Miss distance",
      note: "au",
      cad: formatNum(jplCad.closeApproach?.distanceAu),
      sentry: absent(),
      esa: formatNum(esaNeocc.closeApproach?.missDistanceAu),
      field: "missDistanceAu",
    },
    {
      label: "Relative velocity",
      note: "km/s",
      cad: formatNum(jplCad.closeApproach?.velocityRelativeKms, 2),
      sentry: absent(),
      esa: formatNum(esaNeocc.closeApproach?.relativeVelocityKms, 2),
      field: "relativeVelocity",
    },
    {
      label: "Cumulative impact probability",
      cad: absent(),
      sentry: formatProb(jplSentry.risk?.cumulativeImpactProbability),
      esa: formatProb(esaNeocc.risk?.cumulativeImpactProbability),
      field: "cumulativeImpactProbability",
    },
    {
      label: "Palermo Scale",
      note: "cumulative",
      cad: absent(),
      sentry: formatNum(jplSentry.risk?.palermoScaleCumulative, 2),
      esa: formatNum(esaNeocc.risk?.palermoScaleCumulative, 2),
      field: "palermoScaleCumulative",
    },
    {
      label: "Torino Scale",
      note: "max",
      cad: absent(),
      sentry:
        jplSentry.risk?.torinoScaleMax !== undefined
          ? `T${jplSentry.risk.torinoScaleMax}`
          : absent(),
      esa:
        esaNeocc.risk?.torinoScaleMax !== undefined
          ? `T${esaNeocc.risk.torinoScaleMax}`
          : absent(),
      field: "torinoScaleMax",
    },
    {
      label: "Estimated diameter",
      note: "* from absolute magnitude",
      cad: absent(),
      sentry:
        jplSentry.risk?.diameterKm !== undefined
          ? `${(jplSentry.risk.diameterKm * 1000).toFixed(0)} m`
          : absent(),
      esa: diameterEsa,
    },
  ];

  const columns = [
    {
      id: "jpl-cad" as const,
      label: "JPL CAD",
      present: jplCad.present,
      agency: "NASA/JPL",
    },
    {
      id: "jpl-sentry" as const,
      label: "JPL Sentry",
      present: jplSentry.present,
      agency: "NASA/JPL",
    },
    {
      id: "esa-neocc" as const,
      label: "ESA NEOCC",
      present: esaNeocc.present,
      agency: "ESA Aegis",
    },
  ];

  return (
    <div className="panel overflow-x-auto anim-fade-up-delay-2">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Sources</h2>
          <p className="panel-subtitle">
            Amber = past cut. Risk {object.significantDivergences} · fields{" "}
            {object.totalFieldDivergences}.
          </p>
        </div>
        <div className="num text-xs text-[var(--text-muted)] whitespace-nowrap">
          {object.sourceCoverage}/3 sources
          {object.crossSourceMatch ? " · match" : ""}
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Field</th>
            {columns.map((col) => (
              <th key={col.id}>
                <span
                  className={
                    col.present
                      ? "text-[var(--accent-green)]"
                      : "text-[var(--text-muted)]"
                  }
                >
                  {col.label}
                </span>
                <span className="block text-[0.6rem] font-normal normal-case tracking-normal mt-0.5 opacity-70">
                  {col.present ? col.agency : "not present"}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tip = fieldTooltip(row.field);
            const thresholdShort = row.field
              ? FIELD_THRESHOLD_INFO[row.field]?.short
              : undefined;
            return (
              <tr key={row.label}>
                <td title={tip}>
                  <span className="text-xs text-[var(--foreground)]">
                    {row.label}
                  </span>
                  {row.note && (
                    <span className="block text-[0.65rem] text-[var(--text-muted)] mt-0.5">
                      {row.note}
                    </span>
                  )}
                  {thresholdShort && (
                    <span
                      className="block text-[0.6rem] text-[var(--text-muted)] mt-0.5"
                      title={tip}
                    >
                      threshold: {thresholdShort}
                    </span>
                  )}
                </td>
                <td
                  className={cellClass(
                    row.field
                      ? isDivergent(divergences, row.field, "jpl-cad")
                      : false,
                    jplCad.present,
                  )}
                  title={tip}
                >
                  {row.cad}
                </td>
                <td
                  className={cellClass(
                    row.field
                      ? isDivergent(divergences, row.field, "jpl-sentry")
                      : false,
                    jplSentry.present,
                  )}
                  title={tip}
                >
                  {row.sentry}
                </td>
                <td
                  className={cellClass(
                    row.field
                      ? isDivergent(divergences, row.field, "esa-neocc")
                      : false,
                    esaNeocc.present,
                  )}
                  title={tip}
                >
                  {row.esa}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {divergences.length > 0 && (
        <div className="px-4 py-4 border-t border-[var(--border)] bg-[var(--surface-highlight)]">
          <h3 className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--accent-amber)] mb-3">
            Detected · {divergences.length} fields
            {object.significantDivergences > 0
              ? ` · ${object.significantDivergences} risk`
              : ""}
          </h3>
          <ul className="space-y-2">
            {divergences.map((d) => (
              <li
                key={d.field}
                className="num text-xs"
                title={d.thresholdExplanation}
              >
                <span className="text-[var(--accent-amber)]">{d.field}</span>
                <span className="text-[var(--text-muted)]">
                  {" "}
                  [{d.category}
                  {d.threshold ? ` · ${d.threshold}` : ""}]
                </span>
                <span className="text-[var(--text-muted)]"> · </span>
                {Object.entries(d.sources)
                  .map(([src, val]) => `${src}=${val}`)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
