import { NextResponse } from "next/server";
import { fetchEsaRiskList } from "@/lib/sources/esa-neocc";

export async function GET() {
  const result = await fetchEsaRiskList();
  return NextResponse.json(result);
}
