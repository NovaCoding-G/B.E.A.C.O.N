import Link from "next/link";
import type { ReconcileResult } from "@/lib/types";
import { SOURCE_ATTRIBUTION } from "@/lib/types";
import { SITE } from "@/lib/site";

interface DataProvenanceFooterProps {
  meta?: ReconcileResult["meta"];
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

export function DataProvenanceFooter({ meta }: DataProvenanceFooterProps) {
  const sources = meta
    ? [
        { key: "jpl-cad" as const, status: meta.sourceStatus["jpl-cad"] },
        { key: "jpl-sentry" as const, status: meta.sourceStatus["jpl-sentry"] },
        { key: "esa-neocc" as const, status: meta.sourceStatus["esa-neocc"] },
      ]
    : [];

  return (
    <footer className="provenance-footer mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {meta && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="text-xs text-[var(--text-muted)]">
              <span className="uppercase tracking-[0.12em] text-[0.65rem]">
                Provenance
              </span>
              <div className="mt-1">
                Pulled{" "}
                <span className="num text-[var(--foreground)]">
                  {formatTimestamp(meta.reconciledAt)} UTC
                </span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="num">{meta.totalObjects}</span> objects
                <span className="mx-1.5 opacity-40">·</span>
                <span className="num text-[var(--accent-amber)]">
                  {meta.stats.significantDivergences}
                </span>{" "}
                risk Δ
                <span className="mx-1.5 opacity-40">·</span>
                <span className="num">{meta.stats.totalFieldDivergences}</span>{" "}
                field flags
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 sm:gap-4 flex-1 lg:max-w-3xl">
              {sources.map(({ key, status }) => {
                const attr = SOURCE_ATTRIBUTION[key];
                return (
                  <div key={key} className="flex items-start gap-2 min-w-0">
                    <span
                      className={`status-dot mt-1.5 ${
                        status.success ? "status-dot-live" : "status-dot-warn"
                      }`}
                      title={status.success ? "OK" : (status.error ?? "Error")}
                    />
                    <div className="min-w-0">
                      <a
                        href={attr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent-green)] hover:underline"
                      >
                        {attr.label}
                      </a>
                      <div className="num text-[0.65rem] text-[var(--text-muted)] truncate">
                        {status.success
                          ? formatTimestamp(status.fetchedAt)
                          : (status.error ?? "unavailable")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={`text-[0.65rem] text-[var(--text-muted)] leading-relaxed ${meta ? "mt-3 border-t border-[var(--border-subtle)] pt-2" : ""}`}
        >
          <p>
            {SITE.disclaimerShort} Sources:{" "}
            <a
              href="https://cneos.jpl.nasa.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-green)] hover:underline"
            >
              cneos.jpl.nasa.gov
            </a>
            {" · "}
            <a
              href="https://neo.ssa.esa.int/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-green)] hover:underline"
            >
              neo.ssa.esa.int
            </a>
          </p>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            <span>
              Maintainer:{" "}
              <span className="text-[var(--foreground)]">
                {SITE.maintainerName}
              </span>
            </span>
            <a
              href={`mailto:${SITE.email}`}
              className="text-[var(--accent-green)] hover:underline"
            >
              {SITE.email}
            </a>
            <a
              href={SITE.githubIssues}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-green)] hover:underline"
            >
              GitHub Issues
            </a>
            <Link href="/about" className="text-[var(--accent-green)] hover:underline">
              About
            </Link>
            <Link
              href="/methodology"
              className="text-[var(--accent-green)] hover:underline"
            >
              Methodology
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
