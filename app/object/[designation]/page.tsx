import { notFound } from "next/navigation";
import { getReconcileData } from "@/lib/get-reconcile-data";
import { findReconciledObject } from "@/lib/reconcile";
import { SourceComparisonPanel } from "@/components/SourceComparisonPanel";
import { DataProvenanceFooter } from "@/components/DataProvenanceFooter";
import { RiskBadge } from "@/components/RiskBadge";
import { MissionHeader } from "@/components/MissionHeader";
import { OrbitView3D } from "@/components/OrbitView3D";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ designation: string }>;
}

export default async function ObjectDetailPage({ params }: PageProps) {
  const { designation: rawDesignation } = await params;
  const designation = decodeURIComponent(rawDesignation);

  let data;
  try {
    data = await getReconcileData();
  } catch {
    notFound();
  }

  const object = findReconciledObject(data, designation);

  if (!object) {
    notFound();
  }

  const sentry = object.sources.jplSentry.risk;
  const esaRisk = object.sources.esaNeocc.risk;
  const hasApproach =
    !!object.sources.jplCad.closeApproach ||
    !!object.sources.esaNeocc.closeApproach;

  return (
    <>
      <MissionHeader
        currentPath={`/object/${encodeURIComponent(object.designation)}`}
        backHref="/"
        eyebrow="Object"
        title={object.designation}
        titleMono
        subtitle={
          object.displayName && object.displayName !== object.designation
            ? object.displayName
            : undefined
        }
        meta={`${object.normalizedKey} · ${object.sourceCoverage}/3 sources${
          object.crossSourceMatch ? " · cross-match" : ""
        }${
          object.significantDivergences > 0
            ? ` · ${object.significantDivergences} risk div.`
            : object.totalFieldDivergences > 0
              ? ` · ${object.totalFieldDivergences} orbital div.`
              : ""
        }`}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        {(sentry || esaRisk) && (
          <section className="panel anim-fade-up-delay-1">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Risk scales</h2>
              </div>
            </div>
            <div className="px-4 py-4">
              <RiskBadge
                torino={sentry?.torinoScaleMax ?? esaRisk?.torinoScaleMax}
                palermo={
                  sentry?.palermoScaleCumulative ??
                  esaRisk?.palermoScaleCumulative
                }
                sourceLabel={sentry ? "JPL Sentry" : "ESA NEOCC"}
              />
              {sentry && (
                <p className="num text-xs text-[var(--text-muted)] mt-4">
                  JPL window: {sentry.riskWindowYears ?? "—"}
                  <span className="mx-1.5 opacity-40">·</span>
                  Last obs: {sentry.lastObservation ?? "—"}
                </p>
              )}
            </div>
          </section>
        )}

        {hasApproach && <OrbitView3D object={object} />}

        <SourceComparisonPanel object={object} />
      </main>

      <DataProvenanceFooter meta={data.meta} />
    </>
  );
}
