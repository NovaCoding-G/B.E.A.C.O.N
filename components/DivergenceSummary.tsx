import Link from "next/link";
import type { ReconciledObject } from "@/lib/types";

interface DivergenceSummaryProps {
  objects: ReconciledObject[];
  limit?: number;
}

export function DivergenceSummary({
  objects,
  limit = 5,
}: DivergenceSummaryProps) {
  const divergent = objects.filter((o) => o.significantDivergences > 0);

  if (divergent.length === 0) {
    return (
      <div className="panel p-4 text-sm text-[var(--text-muted)]">
        No risk Δ right now.
      </div>
    );
  }

  const top = divergent.slice(0, limit);

  return (
    <div className="panel anim-fade-up-delay-1">
      <div className="panel-header">
        <div>
          <h2 className="panel-title" style={{ color: "var(--accent-amber)" }}>
            Risk Δ
          </h2>
          <p className="panel-subtitle">
            <span className="num text-[var(--accent-amber)]">
              {divergent.length}
            </span>{" "}
            with IP / Palermo / Torino Δ.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {top.map((obj) => {
          const riskDivs = obj.divergences.filter((d) => d.category === "risk");
          return (
            <li key={obj.normalizedKey} className="px-4 py-3">
              <Link
                href={`/object/${encodeURIComponent(obj.designation)}`}
                className="text-[var(--accent-green)] hover:underline num text-sm"
              >
                {obj.designation}
              </Link>
              <ul className="mt-2 space-y-1">
                {riskDivs.map((d) => (
                  <li
                    key={d.field}
                    className="num text-xs text-[var(--text-muted)]"
                    title={d.thresholdExplanation}
                  >
                    <span className="text-[var(--accent-amber)]">{d.field}</span>
                    {d.threshold ? (
                      <span className="opacity-70"> · {d.threshold}</span>
                    ) : null}
                    {" · "}
                    {Object.entries(d.sources)
                      .map(([src, val]) => `${src}=${val}`)
                      .join(" · ")}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {divergent.length > limit && (
        <div className="px-4 py-2.5 border-t border-[var(--border)] text-xs">
          <Link
            href="/?view=divergent"
            className="text-[var(--accent-green)] hover:underline"
          >
            View all {divergent.length} →
          </Link>
        </div>
      )}
    </div>
  );
}
