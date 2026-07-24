import { NextResponse } from "next/server";
import { getReconcileData } from "@/lib/get-reconcile-data";

export async function GET() {
  const result = await getReconcileData();
  return NextResponse.json(result);
}
