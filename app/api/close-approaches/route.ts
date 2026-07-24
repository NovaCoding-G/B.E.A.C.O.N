import { NextResponse } from "next/server";
import { fetchJplCloseApproaches } from "@/lib/sources/jpl-cad";

export async function GET() {
  const result = await fetchJplCloseApproaches();
  return NextResponse.json(result);
}
