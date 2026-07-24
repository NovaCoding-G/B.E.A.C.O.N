import { NextResponse } from "next/server";
import { fetchJplSentry } from "@/lib/sources/jpl-sentry";

export async function GET() {
  const result = await fetchJplSentry();
  return NextResponse.json(result);
}
