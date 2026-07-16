import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, StatCard, StatusBadge } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/alerts")({
  component: SecurityAlerts,
  head: () => ({ meta: [{ title: "Security Alerts — Estate Guard" }] }),
});

const sevTone: Record<string, "warning" | "error" | "primary" | "neutral"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "primary",
};

function SecurityAlerts() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const q = useQuery({
    queryKey: ["admin-security-alerts", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [issues, missingExits, expired, revoked] = await Promise.all([
        supabase
          .from("issues")
          .select("id,title,severity,status,created_at,reporter_role,location")
          .eq("estate_id", estateId!)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("guest_invites")
          .select("id,guest_name,code,checked_in_at,expires_at")
          .eq("estate_id", estateId!)
          .not("checked_in_at", "is", null)
          .is("checked_out_at", null)
          .lt("expires_at", nowIso)
          .order("expires_at", { ascending: true })
          .limit(50),
        supabase
          .from("guest_invites")
          .select("id,guest_name,code,expires_at")
          .eq("estate_id", estateId!)
          .neq("status", "revoked")
          .lt("expires_at", nowIso)
          .order("expires_at", { ascending: false })
          .limit(30),
        supabase
          .from("guest_invites")
          .select("id,guest_name,code,created_at")
          .eq("estate_id", estateId!)
          .eq("status", "revoked")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (issues.error) throw issues.error;
      if (missingExits.error) throw missingExits.error;
      return {
        issues: issues.data ?? [],
        missingExits: missingExits.data ?? [],
        expired: expired.data ?? [],
        revoked: revoked.data ?? [],
      };
    },
    refetchInterval: 30_000,
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  const critical = q.data.issues.filter((i) => i.severity === "critical" || i.severity === "high").length;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-[color:var(--color-warning)]" /> Security alerts
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="High/critical" value={critical} tone={critical ? "error" : "default"} />
        <StatCard label="Open incidents" value={q.data.issues.length} tone={q.data.issues.length ? "warning" : "default"} />
        <StatCard label="Missing exits" value={q.data.missingExits.length} tone={q.data.missingExits.length ? "warning" : "default"} />
        <StatCard label="Revoked passes" value={q.data.revoked.length} />
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Open incidents</h2>
          <Link to="/app/admin/issues" className="text-xs font-medium text-primary hover:underline">Manage</Link>
        </div>
        {q.data.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open incidents. Nice.</p>
        ) : (
          <ul className="space-y-2">
            {q.data.issues.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{i.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Reported by {i.reporter_role ?? "resident"} · {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                    {i.location ? ` · ${i.location}` : ""}
                  </div>
                </div>
                <div className="shrink-0 flex gap-1">
                  <StatusBadge tone={sevTone[i.severity ?? "medium"] ?? "neutral"}>{i.severity ?? "medium"}</StatusBadge>
                  <StatusBadge tone={i.status === "open" ? "warning" : "primary"}>{i.status}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Missing exits</h2>
        {q.data.missingExits.length === 0 ? (
          <p className="text-sm text-muted-foreground">All guests accounted for.</p>
        ) : (
          <ul className="space-y-2">
            {q.data.missingExits.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{g.guest_name ?? "Guest"} <span className="text-xs text-muted-foreground">· {g.code}</span></div>
                  <div className="text-xs text-muted-foreground">Entered {formatDistanceToNow(new Date(g.checked_in_at!), { addSuffix: true })} · pass expired</div>
                </div>
                <StatusBadge tone="warning">Overdue</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Recently revoked passes</h2>
        {q.data.revoked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No revoked passes.</p>
        ) : (
          <ul className="space-y-2">
            {q.data.revoked.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{g.guest_name ?? "Guest"} <span className="text-xs text-muted-foreground">· {g.code}</span></div>
                  <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(g.created_at), { addSuffix: true })}</div>
                </div>
                <StatusBadge tone="error">Revoked</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
