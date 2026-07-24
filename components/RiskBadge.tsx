interface RiskBadgeProps {
  torino?: number;
  palermo?: number;
  compact?: boolean;
  sourceLabel?: string;
}

function torinoLabel(level: number | undefined): string {
  if (level === undefined) return "—";
  return `T${level}`;
}

function torinoClass(level: number | undefined): string {
  if (level === undefined) return "badge-neutral";
  if (level === 0) return "badge-nominal";
  if (level <= 2) return "badge-attention";
  return "badge-critical";
}

function palermoClass(value: number | undefined): string {
  if (value === undefined) return "badge-neutral";
  if (value < -2) return "badge-nominal";
  if (value < 0) return "badge-attention";
  return "badge-critical";
}

function formatPalermo(value: number | undefined): string {
  if (value === undefined) return "—";
  return value.toFixed(2);
}

export function RiskBadge({
  torino,
  palermo,
  compact,
  sourceLabel,
}: RiskBadgeProps) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`badge ${torinoClass(torino)} num`}>
          {torinoLabel(torino)}
        </span>
        <span className={`badge ${palermoClass(palermo)} num`}>
          PS {formatPalermo(palermo)}
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--text-muted)] w-20">
          Torino
        </span>
        <span className={`badge ${torinoClass(torino)} num`}>
          {torinoLabel(torino)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.65rem] uppercase tracking-[0.14em] text-[var(--text-muted)] w-20">
          Palermo
        </span>
        <span className={`badge ${palermoClass(palermo)} num`}>
          {formatPalermo(palermo)}
        </span>
      </div>
      {sourceLabel && (
        <p className="text-[0.65rem] text-[var(--text-muted)]">
          Source: {sourceLabel}
        </p>
      )}
    </div>
  );
}
