import { MissionHeader } from "@/components/MissionHeader";
import { DataProvenanceFooter } from "@/components/DataProvenanceFooter";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "About — BEACON",
  description: "What this is, who maintains it.",
};

export default function AboutPage() {
  return (
    <>
      <MissionHeader currentPath="/about" eyebrow="About" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">BEACON</h2>
              <p className="panel-subtitle">{SITE.fullName}</p>
            </div>
            <span className="num text-xs text-[var(--text-muted)]">
              v{SITE.version}
            </span>
          </div>
          <div className="px-4 py-4 text-sm text-[var(--text-muted)] leading-relaxed">
            <p>
              Pulls public NEO feeds from JPL (CAD, Sentry) and ESA NEOCC, matches
              them by designation, and puts the numbers next to each other.
            </p>
          </div>
        </section>

        <section className="panel border-l-2 border-[var(--accent-amber)]">
          <div className="panel-header">
            <div>
              <h2
                className="panel-title"
                style={{ color: "var(--accent-amber)" }}
              >
                Disclaimer
              </h2>
            </div>
          </div>
          <div className="px-4 py-4 text-sm text-[var(--text-muted)] leading-relaxed space-y-2">
            <p>{SITE.disclaimerShort}</p>
            <p>
              Upstream:{" "}
              <a
                href="https://cneos.jpl.nasa.gov/"
                className="text-[var(--accent-green)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                CNEOS
              </a>{" "}
              ·{" "}
              <a
                href="https://neo.ssa.esa.int/"
                className="text-[var(--accent-green)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                ESA NEOCC
              </a>
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Maintainer</h2>
            </div>
          </div>
          <div className="px-4 py-4 space-y-3 text-sm">
            <p>
              <span className="text-[var(--foreground)] font-medium">
                {SITE.maintainerName}
              </span>
            </p>
            <ul className="space-y-2 text-[var(--text-muted)]">
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-[var(--accent-green)] hover:underline num"
                >
                  {SITE.email}
                </a>
              </li>
              <li>
                <a
                  href={SITE.githubIssues}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-green)] hover:underline"
                >
                  Issues
                </a>
              </li>
              <li>
                <a
                  href={SITE.githubRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-green)] hover:underline"
                >
                  {SITE.githubRepo}
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Cite</h2>
            </div>
          </div>
          <div className="px-4 py-4">
            <pre className="num text-xs text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed">
              {`${SITE.maintainerName} (${SITE.citationYear}). ${SITE.name}. v${SITE.version}. ${SITE.githubRepo}`}
            </pre>
            <p className="text-xs text-[var(--text-muted)] mt-3">
              Also <span className="num">CITATION.cff</span>.
            </p>
          </div>
        </section>
      </main>

      <DataProvenanceFooter />
    </>
  );
}
