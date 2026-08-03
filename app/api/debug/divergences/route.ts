import { NextResponse } from "next/server";
import { getReconcileData } from "@/lib/get-reconcile-data";
import { riskYearRangesDiffer } from "@/lib/reconcile";

/** GET /api/debug/divergences */
export async function GET() {
  const data = await getReconcileData();
  const { stats } = data.meta;

  const significantObjects = data.objects.filter(
    (o) => o.significantDivergences > 0,
  );

  return NextResponse.json({
    totalObjects: stats.total,
    totalFieldDivergences: stats.totalFieldDivergences,
    significantDivergences: stats.significantDivergences,
    significantObjects: significantObjects.map((o) => {
      const jplRiskYears = o.sources.jplSentry.risk?.riskWindowYears;
      const esaRiskYears = o.sources.esaNeocc.risk?.riskYears;
      return {
        designation: o.designation,
        significantDivergences: o.significantDivergences,
        totalFieldDivergences: o.totalFieldDivergences,
        jplRiskYears: jplRiskYears ?? null,
        esaRiskYears: esaRiskYears ?? null,
        riskYearsDiffer: riskYearRangesDiffer(jplRiskYears, esaRiskYears),
        riskFields: o.divergences
          .filter((d) => d.category === "risk")
          .map((d) => ({
            field: d.field,
            notes: d.notes ?? null,
          })),
      };
    }),
  });
}
