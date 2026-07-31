import Link from "next/link";
import type { ReconcileStats, ReconcileView } from "@/lib/types";

const VIEWS: {
  id: ReconcileView;
  label: string;
  statKey: keyof ReconcileStats;
}[] = [
  { id: "all", label: "All", statKey: "total" },
  { id: "multi", label: "Multi-source", statKey: "multiSource" },
  { id: "divergent", label: "Risk Δ", statKey: "significantDivergences" },
  { id: "risk", label: "On risk list", statKey: "riskListed" },
];

interface ReconcileViewTabsProps {
  active: ReconcileView;
  stats: ReconcileStats;
}

export function ReconcileViewTabs({ active, stats }: ReconcileViewTabsProps) {
  return (
    <nav
      className="flex flex-wrap gap-1.5"
      aria-label="Reconciliation view filters"
    >
      {VIEWS.map(({ id, label, statKey }) => {
        const isActive = active === id;
        const count = stats[statKey];

        return (
          <Link
            key={id}
            href={id === "all" ? "/" : `/?view=${id}`}
            className={`view-tab ${isActive ? "view-tab-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
            <span className="num opacity-80">{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
