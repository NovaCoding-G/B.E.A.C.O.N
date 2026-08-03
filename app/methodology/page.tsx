import Link from "next/link";
import { MissionHeader } from "@/components/MissionHeader";
import { DataProvenanceFooter } from "@/components/DataProvenanceFooter";
import { DIVERGENCE_THRESHOLDS, FIELD_THRESHOLD_INFO } from "@/lib/reconcile";
import { CLOSE_APPROACH_HORIZON_DAYS } from "@/lib/types";

export const metadata = {
  title: "Methodology — BEACON",
  description: "Matching keys and divergence thresholds.",
};

export default function MethodologyPage() {
  return (
    <>
      <MissionHeader currentPath="/methodology" eyebrow="Methodology" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Matching</h2>
            </div>
          </div>
          <div className="px-4 py-4 text-sm text-[var(--text-muted)] leading-relaxed space-y-3">
            <p>
              Key = normalized IAU designation.{" "}
              <span className="num">1979 XB</span> and{" "}
              <span className="num">1979XB</span> are the same object. We keep
              each source’s raw values; no averaging.
            </p>
            <p>
              Close-approach comparisons use a shared inclusive window of{" "}
              <span className="num">{CLOSE_APPROACH_HORIZON_DAYS}</span> days
              from the reconcile reference date. JPL CAD is requested with the
              same horizon; ESA upcoming encounters outside that window are
              excluded from coverage and field comparisons.
            </p>
            <p>
              Cumulative IP and Palermo compare source values as published.
              JPL <span className="num">riskWindowYears</span> and ESA{" "}
              <span className="num">riskYears</span> are shown side-by-side.
              Unequal aggregation windows are{" "}
              <span className="text-[var(--foreground)]">informational
              context</span>
              — they do not create a separate risk divergence and do not
              suppress the cumulative thresholds.
            </p>
            <p>
              Relative velocity: ESA publishes{" "}
              <span className="num">DD.D</span> km/s. Before the{" "}
              <span className="num">1%</span> check, JPL is rounded to that
              0.1 km/s precision. Displayed source values stay raw.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Counts</h2>
            </div>
          </div>
          <div className="px-4 py-4 text-sm text-[var(--text-muted)] space-y-3 leading-relaxed">
            <p>
              <span className="num text-[var(--accent-amber)]">
                significantDivergences
              </span>{" "}
              — IP, Palermo, or Torino past threshold.
            </p>
            <p>
              <span className="num text-[var(--foreground)]">
                totalFieldDivergences
              </span>{" "}
              — everything flagged, including distance / v_rel / date.
            </p>
            <p className="text-xs">
              <Link
                href="/api/debug/divergences"
                className="num text-[var(--accent-green)] hover:underline"
              >
                /api/debug/divergences
              </Link>
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Thresholds</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Kind</th>
                  <th>Cut</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(FIELD_THRESHOLD_INFO).map(([field, info]) => (
                  <tr key={field}>
                    <td className="num text-xs">{field}</td>
                    <td className="text-xs">
                      {info.category === "risk" ? (
                        <span className="badge badge-attention">risk</span>
                      ) : (
                        <span className="badge badge-neutral">orbital</span>
                      )}
                    </td>
                    <td className="num text-xs">{info.short}</td>
                    <td className="text-xs text-[var(--text-muted)] max-w-md">
                      {info.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-[0.65rem] num text-[var(--text-muted)] border-t border-[var(--border)]">
            miss {DIVERGENCE_THRESHOLDS.missDistanceAuRelative * 100}% · v_rel{" "}
            {DIVERGENCE_THRESHOLDS.relativeVelocityRelative * 100}% · IP ×
            {DIVERGENCE_THRESHOLDS.impactProbabilityRatio} · floor{" "}
            {DIVERGENCE_THRESHOLDS.impactProbabilityFloor} · PS |Δ|{" "}
            {DIVERGENCE_THRESHOLDS.palermoAbsolute}
          </p>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Caveats</h2>
            </div>
          </div>
          <ul className="px-4 py-4 text-sm text-[var(--text-muted)] space-y-2 list-disc list-inside leading-relaxed">
            <li>ESA format can change.</li>
            <li>No DB — short TTL memory cache.</li>
            <li>3D panel is miss distance only.</li>
            <li>We don’t recompute impact probabilities.</li>
          </ul>
        </section>
      </main>

      <DataProvenanceFooter />
    </>
  );
}
