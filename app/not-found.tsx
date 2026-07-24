import Link from "next/link";
import { MissionHeader } from "@/components/MissionHeader";
import { DataProvenanceFooter } from "@/components/DataProvenanceFooter";

export default function NotFound() {
  return (
    <>
      <MissionHeader currentPath="/404" showNav eyebrow="404" />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-10">
        <div className="panel p-8 text-center">
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Object or route not in the current pull.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              href="/"
              className="text-[var(--accent-green)] hover:underline"
            >
              ← Dashboard
            </Link>
            <Link
              href="/about"
              className="text-[var(--accent-green)] hover:underline"
            >
              About
            </Link>
          </div>
        </div>
      </main>
      <DataProvenanceFooter />
    </>
  );
}
