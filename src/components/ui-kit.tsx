import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card-surface p-5", className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "success" | "error";
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary",
    warning: "text-[color:var(--color-warning)]",
    success: "text-[color:var(--color-success)]",
    error: "text-destructive",
  }[tone];
  return (
    <div className="card-surface p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "error" | "accent";
export function StatusBadge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const map: Record<BadgeTone, string> = {
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]",
    warning: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    error: "bg-destructive/10 text-destructive",
    accent: "bg-accent/15 text-accent-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", map[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description, icon, action }: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 p-8 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
