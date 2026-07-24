import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

interface MissionHeaderProps {
  brandHref?: string;
  eyebrow?: string;
  title?: string;
  titleMono?: boolean;
  subtitle?: string;
  meta?: string;
  backHref?: string;
  backLabel?: string;
  currentPath?: string;
  showNav?: boolean;
}

export function MissionHeader({
  brandHref = "/",
  eyebrow = "NEO cross-check",
  title,
  titleMono = false,
  subtitle,
  meta,
  backHref,
  backLabel = "← Dashboard",
  currentPath = "/",
  showNav = true,
}: MissionHeaderProps) {
  return (
    <header className="mission-header anim-fade-up">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          {showNav ? <SiteNav currentPath={currentPath} /> : <span />}
          <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            <span className="status-dot status-dot-live" aria-hidden />
            <span>Live</span>
          </div>
        </div>

        {backHref && (
          <Link
            href={backHref}
            className="text-xs text-[var(--accent-green)] hover:underline mb-3 inline-block"
          >
            {backLabel}
          </Link>
        )}

        <div>
          <Link href={brandHref} className="inline-block no-underline">
            <div className="brand-mark">BEACON</div>
          </Link>
          <span className="brand-underline" aria-hidden />
          <p className="mt-3 text-[0.65rem] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
          {title && (
            <h1
              className={`mt-3 text-xl md:text-2xl font-semibold text-[var(--foreground)] ${
                titleMono ? "num" : ""
              }`}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
          {meta && (
            <p className="mt-2 text-xs num text-[var(--text-muted)]">{meta}</p>
          )}
        </div>
      </div>
    </header>
  );
}
