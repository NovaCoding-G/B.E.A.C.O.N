import { getReconcileData } from "@/lib/get-reconcile-data";
import {
  filterReconciledObjects,
  parseReconcileView,
} from "@/lib/reconcile";
import { ObjectTable } from "@/components/ObjectTable";
import { DataProvenanceFooter } from "@/components/DataProvenanceFooter";
import { ReconcileViewTabs } from "@/components/ReconcileViewTabs";
import { DivergenceSummary } from "@/components/DivergenceSummary";
import { MissionHeader } from "@/components/MissionHeader";
import type { ReconcileView } from "@/lib/types";

export const revalidate = 300;

const VIEW_DESCRIPTIONS: Record<ReconcileView, string> = {
  all: "Everything we pulled from at least one source.",
  multi: "Seen in 2+ sources.",
  divergent: "IP / Palermo / Torino disagree past threshold.",
  risk: "On Sentry and/or ESA risk list.",
};

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { view: rawView } = await searchParams;
  const view = parseReconcileView(rawView);

  let data;
  let error: string | null = null;

  try {
    data = await getReconcileData();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const filtered = data ? filterReconciledObjects(data.objects, view) : [];
  const stats = data?.meta.stats;

  return (
    <>
      <MissionHeader
        currentPath="/"
        eyebrow="JPL CAD · Sentry · ESA NEOCC"
        subtitle="Same objects, source values next to each other."
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        {error && (
          <div className="panel p-4 border-l-2 border-[var(--accent-amber)] anim-fade-up">
            <p className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--accent-amber)] mb-1">
              Data unavailable
            </p>
            <p className="text-sm text-[var(--text-muted)]">{error}</p>
          </div>
        )}

        {data && stats && (
          <>
            <section
              className="stat-rail anim-fade-up-delay-1"
              aria-label="Statistics"
            >
              <StatCell label="Objects" value={stats.total} />
              <StatCell label="Multi-source" value={stats.multiSource} />
              <StatCell
                label="Risk Δ"
                value={stats.significantDivergences}
                attention={stats.significantDivergences > 0}
                hint="IP / Palermo / Torino"
              />
              <StatCell
                label="Field flags"
                value={stats.totalFieldDivergences}
                muted
                hint="distance, v_rel, date too"
              />
              <StatCell label="Sentry+ESA" value={stats.sentryAndEsa} />
            </section>

            {!data.meta.sourceStatus["esa-neocc"].success && (
              <div className="panel p-4 border-l-2 border-[var(--accent-amber)]">
                <p className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--accent-amber)] mb-1">
                  ESA unavailable
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  Using JPL only for now.
                </p>
              </div>
            )}

            {view === "all" && stats.significantDivergences > 0 && (
              <DivergenceSummary objects={data.objects} />
            )}

            <section className="space-y-4 anim-fade-up-delay-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Objects
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xl">
                    {VIEW_DESCRIPTIONS[view]}
                  </p>
                </div>
                <ReconcileViewTabs active={view} stats={stats} />
              </div>
              <ObjectTable
                objects={filtered}
                emptyMessage="Nothing in this filter."
              />
            </section>
          </>
        )}
      </main>

      {data && <DataProvenanceFooter meta={data.meta} />}
    </>
  );
}

function StatCell({
  label,
  value,
  attention,
  muted,
  hint,
}: {
  label: string;
  value: number;
  attention?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`stat-cell ${attention ? "stat-cell-attention" : ""}`}
      title={hint}
    >
      <div className="text-[0.6rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`num text-2xl mt-1 tabular-nums ${
          attention
            ? "text-[var(--accent-amber)]"
            : muted
              ? "text-[var(--text-muted)]"
              : "text-[var(--accent-green)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
