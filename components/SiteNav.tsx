import Link from "next/link";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
] as const;

export function SiteNav({ currentPath }: { currentPath?: string }) {
  return (
    <nav
      className="flex flex-wrap items-center gap-1 md:gap-2"
      aria-label="Primary navigation"
    >
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/"
            ? currentPath === "/" || currentPath?.startsWith("/object")
            : currentPath === href || currentPath?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`view-tab ${active ? "view-tab-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
      <a
        href={SITE.githubIssues}
        target="_blank"
        rel="noopener noreferrer"
        className="view-tab"
      >
        Issues
      </a>
    </nav>
  );
}
