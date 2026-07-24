import { NextResponse } from "next/server";
import { getReconcileData } from "@/lib/get-reconcile-data";

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
    significantObjects: significantObjects.map((o) => ({
      designation: o.designation,
      significantDivergences: o.significantDivergences,
      totalFieldDivergences: o.totalFieldDivergences,
      riskFields: o.divergences
        .filter((d) => d.category === "risk")
        .map((d) => d.field),
    })),
  });
}
