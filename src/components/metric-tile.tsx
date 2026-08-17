import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MetricTone = "default" | "primary" | "success" | "warning" | "error" | "accent";

const toneMap: Record<MetricTone, { text: string; ring: string; bg: string; bar: string }> = {
  default: {
    text: "text-foreground",
    ring: "text-muted-foreground",
    bg: "from-muted/60 to-transparent",
    bar: "bg-muted-foreground/40",
  },
  primary: {
    text: "text-primary",
    ring: "text-primary",
    bg: "from-primary/15 to-transparent",
    bar: "bg-primary",
  },
  success: {
    text: "text-[color:var(--color-success)]",
    ring: "text-[color:var(--color-success)]",
    bg: "from-[color:var(--color-success)]/15 to-transparent",
    bar: "bg-[color:var(--color-success)]",
  },
  warning: {
    text: "text-[color:var(--color-warning)]",
    ring: "text-[color:var(--color-warning)]",
    bg: "from-[color:var(--color-warning)]/15 to-transparent",
    bar: "bg-[color:var(--color-warning)]",
  },
  error: {
    text: "text-destructive",
    ring: "text-destructive",
    bg: "from-destructive/15 to-transparent",
    bar: "bg-destructive",
  },
  accent: {
    text: "text-[color:var(--color-accent)]",
    ring: "text-[color:var(--color-accent)]",
    bg: "from-[color:var(--color-accent)]/15 to-transparent",
    bar: "bg-[color:var(--color-accent)]",
  },
};

export type MetricTileProps = {
  label: string;
  value: number | string;
  icon?: ReactNode;
  hint?: string;
  tone?: MetricTone;
  /** Portion of the whole this metric represents, 0-100. Renders a slim bar. */
  share?: number;
  /** Tiny trend used for the inline sparkline. */
  spark?: number[];
  to?: string;
  search?: Record<string, string>;
};

/**
 * Clickable KPI tile used on the admin overview. Adds an icon, a share bar and
 * a sparkline so the number is not the only thing on the card.
 */
export function MetricTile({
  label,
  value,
  icon,
  hint,
  tone = "default",
  share,
  spark,
  to,
  search,
}: MetricTileProps) {
  const t = toneMap[tone];
  const body = (
    <div
      className={cn(
        "card-surface lift-3d relative flex h-full min-h-[132px] min-w-0 flex-col overflow-hidden p-3 sm:min-h-[148px] sm:p-4",
        to && "cursor-pointer transition-shadow hover:shadow-lg",
      )}
    >

      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", t.bg)} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[11px]">
            {label}
          </div>
          <div className={cn("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", t.text)}>
            {value}
          </div>
        </div>
        {icon && (
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-card/80 [&>svg]:h-4 [&>svg]:w-4",
              t.ring,
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="relative mt-auto">
        {typeof share === "number" && (
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", t.bar)}
              style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
            />
          </div>
        )}

        {spark && spark.length > 1 && (
          <div className="mt-2 flex h-6 items-end gap-[3px]">
            {spark.slice(-12).map((n, i) => {
              const max = Math.max(...spark.slice(-12), 1);
              return (
                <span
                  key={i}
                  className={cn("flex-1 rounded-sm opacity-70", t.bar)}
                  style={{ height: `${Math.max(8, (n / max) * 100)}%` }}
                />
              );
            })}
          </div>
        )}

        {hint && <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );

  if (!to) return body;
  return (
    <Link to={to} search={search as never} className="block h-full min-w-0">
      {body}
    </Link>
  );
}

