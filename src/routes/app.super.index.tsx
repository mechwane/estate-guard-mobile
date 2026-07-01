import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, StatCard, StatusBadge } from "@/components/ui-kit";
import { format } from "date-fns";

export const Route = createFileRoute("/app/super/")({
  component: SuperDashboard,
});

function SuperDashboard() {
  const { data: estates } = useQuery({
    queryKey: ["all-estates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: platform } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [users, invites, issues] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("guest_invites").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
        supabase.from("issues").select("id", { count: "exact", head: true }).neq("status", "resolved"),
      ]);
      return { users: users.count ?? 0, invites: invites.count ?? 0, openIssues: issues.count ?? 0 };
    },
  });

  const toggle = async (id: string, status: string) => {
    const next = status === "active" ? "suspended" : "active";
    await supabase.from("estates").update({ status: next }).eq("id", id);
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Estates" value={estates?.length ?? "—"} />
        <StatCard label="Users" value={platform?.users ?? "—"} />
        <StatCard label="Open issues" value={platform?.openIssues ?? "—"} tone={platform?.openIssues ? "warning" : "default"} />
      </div>

      <Link to="/app/super/audit" className="card-surface flex items-center justify-center py-3 text-sm font-medium text-primary hover:bg-muted/40">
        View audit logs
      </Link>

      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estates</h2>
      <div className="space-y-2">
        {(estates ?? []).map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{e.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Code {e.code} · Created {format(new Date(e.created_at), "MMM d, yyyy")}</div>
              </div>
              <StatusBadge tone={e.status === "active" ? "success" : "warning"}>{e.status}</StatusBadge>
            </div>
            <button onClick={() => toggle(e.id, e.status)} className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
              {e.status === "active" ? "Suspend estate" : "Reactivate estate"}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
