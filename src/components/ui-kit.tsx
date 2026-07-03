import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card-surface p-5", className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
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
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "error" | "accent";
export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  const map: Record<BadgeTone, string> = {
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]",
    warning: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    error: "bg-destructive/10 text-destructive",
    accent: "bg-accent/15 text-accent-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        map[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
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

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card-surface p-4">
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="card-surface p-6 text-center">
      <h3 className="text-sm font-semibold text-foreground">Couldn't load this</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {message ?? "Please check your connection and try again."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Search"}
      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const btn =
    tone === "destructive"
      ? "bg-destructive text-destructive-foreground hover:opacity-90"
      : "bg-primary text-primary-foreground hover:bg-primary-dark";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl bg-background p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <div className="mt-2 text-sm text-muted-foreground">{description}</div>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={cn("rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60", btn)}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
