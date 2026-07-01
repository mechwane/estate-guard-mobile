import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, StatCard, StatusBadge } from "@/components/ui-kit";
import { Users, Receipt, MessageSquare, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const { data: stats } = useQuery({
    queryKey: ["admin-stats", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [residents, invites, bills, issues] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("estate_id", estateId!),
        supabase.from("guest_invites").select("id", { count: "exact", head: true }).eq("estate_id", estateId!).gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
        supabase.from("bills").select("amount,status").eq("estate_id", estateId!),
        supabase.from("issues").select("id,status").eq("estate_id", estateId!),
      ]);
      const outstanding = (bills.data ?? []).filter((b) => b.status !== "paid").reduce((s, b) => s + Number(b.amount), 0);
      const openIssues = (issues.data ?? []).filter((i) => i.status !== "resolved").length;
      return {
        residents: residents.count ?? 0,
        weekInvites: invites.count ?? 0,
        outstanding,
        openIssues,
      };
    },
  });

  const { data: recentIssues } = useQuery({
    queryKey: ["admin-recent-issues", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data } = await supabase.from("issues").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Residents" value={stats?.residents ?? "—"} />
        <StatCard label="Invites (7d)" value={stats?.weekInvites ?? "—"} />
        <StatCard label="Outstanding" value={stats ? `₦${stats.outstanding.toLocaleString()}` : "—"} tone="warning" />
        <StatCard label="Open issues" value={stats?.openIssues ?? "—"} tone={stats?.openIssues ? "error" : "default"} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <QuickLink to="/app/admin/residents" label="Residents" />
        <QuickLink to="/app/admin/bills" label="Bills" />
        <QuickLink to="/app/admin/issues" label="Issues" />
        <QuickLink to="/app/admin/guests" label="Guest logs" />
      </div>

      <div>
        <SectionTitle title="Recent issues" />
        {(recentIssues ?? []).length === 0 ? (
          <Card><p className="text-sm text-muted-foreground">No issues reported.</p></Card>
        ) : (
          <div className="space-y-2">
            {recentIssues!.map((i) => (
              <Card key={i.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{i.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{i.category} · {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}</div>
                  </div>
                  <StatusBadge tone={i.status === "resolved" ? "success" : i.status === "in_progress" ? "warning" : "neutral"}>{i.status.replace("_", " ")}</StatusBadge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="card-surface flex items-center justify-center py-3 text-sm font-medium text-foreground hover:bg-muted/50">
      {label}
    </Link>
  );
}
function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>;
}
