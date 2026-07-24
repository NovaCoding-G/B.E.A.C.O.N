import { NextResponse } from "next/server";
import { fetchEsaCloseApproaches } from "@/lib/sources/esa-neocc";

export async function GET() {
  const result = await fetchEsaCloseApproaches();
  return NextResponse.json(result);
}
