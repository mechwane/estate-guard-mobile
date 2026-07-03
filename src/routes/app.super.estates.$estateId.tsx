import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, StatCard, StatusBadge, ListSkeleton, ErrorState, ConfirmActionDialog } from "@/components/ui-kit";
import { format } from "date-fns";
import { ArrowLeft, Pencil, UserCog, Power, PowerOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/super/estates/$estateId")({
  component: EstateDetail,
});

type Overview = {
  estate: any;
  admin: any | null;
  users: Record<string, number>;
  guests: Record<string, number>;
  incidents: { open: number; in_progress: number; resolved: number; by_severity: Record<string, number> | null };
  billing: Record<string, number>;
  recent_activity: Array<{ id: string; action: string; entity: string; entity_id: string | null; actor_id: string | null; metadata: any; created_at: string }>;
};

function EstateDetail() {
  const { estateId } = Route.useParams();
  const qc = useQueryClient();
  const [toggling, setToggling] = useState(false);

  const overview = useQuery({
    queryKey: ["super-estate-overview", estateId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_estate_overview" as any, { _estate_id: estateId } as any);
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  const toggle = useMutation({
    mutationFn: async (isActive: boolean) => {
      const fn = isActive ? "suspend_estate" : "activate_estate";
      const args = isActive ? { _estate_id: estateId, _reason: null } : { _estate_id: estateId };
      const { error } = await supabase.rpc(fn as any, args as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate updated");
      qc.invalidateQueries({ queryKey: ["super-estate-overview", estateId] });
      qc.invalidateQueries({ queryKey: ["all-estates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (overview.isError) return <ErrorState onRetry={() => overview.refetch()} />;
  if (overview.isLoading || !overview.data) return <ListSkeleton rows={6} />;

  const d = overview.data;
  const e = d.estate;
  const active = e?.status === "active";
  const money = (n: number) => `₦${Number(n ?? 0).toLocaleString()}`;

  return (
    <div className="space-y-5">
      <Link to="/app/super" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All estates
      </Link>

      {/* Identity */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">{e.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">Code {e.code} · Created {format(new Date(e.created_at), "MMM d, yyyy")}</p>
            {(e.address || e.city || e.state) && (
              <p className="mt-1 text-xs text-muted-foreground">{[e.address, e.city, e.state].filter(Boolean).join(", ")}</p>
            )}
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {e.contact_email && <div>Email: <span className="text-foreground">{e.contact_email}</span></div>}
              {e.contact_phone && <div>Phone: <span className="text-foreground">{e.contact_phone}</span></div>}
              <div>Admin: <span className="text-foreground">{d.admin?.full_name ?? "Unassigned"}</span></div>
              <div>Admin phone: <span className="text-foreground">{d.admin?.phone ?? "—"}</span></div>
            </div>
          </div>
          <StatusBadge tone={active ? "success" : "warning"}>{e.status}</StatusBadge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link to="/app/super" className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <Link to="/app/super" className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted">
            <UserCog className="h-3.5 w-3.5" /> {e.admin_user_id ? "Reassign" : "Assign"}
          </Link>
          <button
            onClick={() => setToggling(true)}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            {active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />} {active ? "Suspend" : "Activate"}
          </button>
        </div>
      </Card>

      {/* Users */}
      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">People</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Total users" value={d.users.total} />
          <StatCard label="Residents" value={d.users.residents} />
          <StatCard label="Guards" value={d.users.guards} />
          <StatCard label="Admins" value={d.users.admins} />
          <StatCard label="Approved" value={d.users.approved} tone="success" />
          <StatCard label="Pending verif." value={d.users.verif_pending} tone={d.users.verif_pending ? "warning" : "default"} />
          <StatCard label="Approved verif." value={d.users.verif_approved} />
          <StatCard label="Rejected verif." value={d.users.verif_rejected} tone={d.users.verif_rejected ? "error" : "default"} />
        </div>
      </section>

      {/* Guests */}
      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Guest passes</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Total" value={d.guests.total} />
          <StatCard label="Active" value={d.guests.active} tone="primary" />
          <StatCard label="Inside now" value={d.guests.inside} tone={d.guests.inside ? "primary" : "default"} />
          <StatCard label="Used" value={d.guests.used} />
          <StatCard label="Expired" value={d.guests.expired} />
          <StatCard label="Revoked" value={d.guests.revoked} />
          <StatCard label="Entries" value={d.guests.entries} />
          <StatCard label="Missing exit" value={d.guests.missing_exit} tone={d.guests.missing_exit ? "warning" : "default"} />
        </div>
      </section>

      {/* Incidents */}
      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Incidents</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Open" value={d.incidents.open} tone={d.incidents.open ? "warning" : "default"} />
          <StatCard label="In progress" value={d.incidents.in_progress} />
          <StatCard label="Resolved" value={d.incidents.resolved} tone="success" />
        </div>
        {d.incidents.by_severity && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(d.incidents.by_severity).map(([k, v]) => (
              <StatusBadge key={k} tone={k === "critical" ? "error" : k === "high" ? "warning" : "neutral"}>{k}: {v}</StatusBadge>
            ))}
          </div>
        )}
      </section>

      {/* Billing / VTU */}
      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Billing (NGN)</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Billed" value={money(d.billing.billed)} />
          <StatCard label="Collected" value={money(d.billing.collected)} tone="success" />
          <StatCard label="Outstanding" value={money((d.billing.billed ?? 0) - (d.billing.collected ?? 0))} tone="warning" />
          <StatCard label="Payments" value={d.billing.payments} />
        </div>
        <h2 className="mb-2 mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">VTU (NGN)</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Volume" value={money(d.billing.vtu_total)} tone="primary" />
          <StatCard label="Transactions" value={d.billing.vtu_count} />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent activity</h2>
        {d.recent_activity.length === 0 ? (
          <Card><p className="text-xs text-muted-foreground">No recorded activity yet.</p></Card>
        ) : (
          <div className="space-y-1.5">
            {d.recent_activity.map((a) => (
              <Card key={a.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{a.action}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{a.entity}{a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}</div>
                  </div>
                  <div className="whitespace-nowrap text-[11px] text-muted-foreground">{format(new Date(a.created_at), "MMM d, p")}</div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConfirmActionDialog
        open={toggling}
        title={active ? `Suspend ${e.name}?` : `Activate ${e.name}?`}
        description={active
          ? "Residents and guards will lose access until this estate is reactivated."
          : "Residents and guards will regain access immediately."}
        confirmLabel={active ? "Suspend estate" : "Activate estate"}
        tone={active ? "destructive" : "default"}
        busy={toggle.isPending}
        onCancel={() => setToggling(false)}
        onConfirm={() => toggle.mutate(active, { onSettled: () => setToggling(false) })}
      />

      {toggle.isPending && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Working…
        </div>
      )}
    </div>
  );
}
