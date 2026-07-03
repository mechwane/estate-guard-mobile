import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  StatCard,
  StatusBadge,
  EmptyState,
  ListSkeleton,
  ErrorState,
  SectionTitle,
} from "@/components/ui-kit";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/admin/")({
  component: AdminDashboard,
});

type RangeKey = "24h" | "7d" | "30d" | "all";
const RANGE_LABEL: Record<RangeKey, string> = {
  "24h": "Last 24h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

function rangeStartIso(range: RangeKey): string | null {
  if (range === "all") return null;
  const now = Date.now();
  const ms = range === "24h" ? 864e5 : range === "7d" ? 7 * 864e5 : 30 * 864e5;
  return new Date(now - ms).toISOString();
}

function AdminDashboard() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [range, setRange] = useState<RangeKey>("7d");
  const sinceIso = useMemo(() => rangeStartIso(range), [range]);

  // ---------- Resident metrics ----------
  const residentStats = useQuery({
    queryKey: ["admin.residents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const base = () =>
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!);
      const [total, approved, revoked, pendingVerify, rejectedVerify, newResidents] =
        await Promise.all([
          base(),
          base().eq("approved", true),
          base().eq("approved", false),
          base().eq("verification_status", "pending"),
          base().eq("verification_status", "rejected"),
          sinceIso
            ? base().gte("created_at", sinceIso)
            : Promise.resolve({ count: null, error: null } as {
                count: number | null;
                error: unknown;
              }),
        ]);
      return {
        total: total.count ?? 0,
        approved: approved.count ?? 0,
        revoked: revoked.count ?? 0,
        pendingVerify: pendingVerify.count ?? 0,
        rejectedVerify: rejectedVerify.count ?? 0,
        newResidents: newResidents.count ?? 0,
      };
    },
  });

  // ---------- Guest pass metrics ----------
  const guestStats = useQuery({
    queryKey: ["admin.guests", estateId, sinceIso],
    enabled: !!estateId,
    queryFn: async () => {
      const base = () =>
        supabase
          .from("guest_invites")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!);
      const scoped = () => (sinceIso ? base().gte("created_at", sinceIso) : base());
      const [active, used, expired, revoked, created, validated] = await Promise.all([
        scoped().eq("status", "active"),
        scoped().eq("status", "used"),
        scoped().eq("status", "expired"),
        scoped().eq("status", "revoked"),
        scoped(),
        sinceIso
          ? base().not("checked_in_at", "is", null).gte("checked_in_at", sinceIso)
          : base().not("checked_in_at", "is", null),
      ]);
      return {
        active: active.count ?? 0,
        used: used.count ?? 0,
        expired: expired.count ?? 0,
        revoked: revoked.count ?? 0,
        created: created.count ?? 0,
        validated: validated.count ?? 0,
      };
    },
  });

  // ---------- Issue metrics ----------
  const issueStats = useQuery({
    queryKey: ["admin.issues", estateId, sinceIso],
    enabled: !!estateId,
    queryFn: async () => {
      const base = () =>
        supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!);
      const scoped = () => (sinceIso ? base().gte("created_at", sinceIso) : base());
      const [open, inProgress, resolved] = await Promise.all([
        scoped().eq("status", "open"),
        scoped().eq("status", "in_progress"),
        scoped().eq("status", "resolved"),
      ]);
      return {
        open: open.count ?? 0,
        inProgress: inProgress.count ?? 0,
        resolved: resolved.count ?? 0,
      };
    },
  });

  // ---------- Billing totals ----------
  const billingStats = useQuery({
    queryKey: ["admin.billing", estateId, sinceIso],
    enabled: !!estateId,
    queryFn: async () => {
      let q = supabase.from("bills").select("amount,status,created_at").eq("estate_id", estateId!);
      if (sinceIso) q = q.gte("created_at", sinceIso);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];
      const paid = rows.filter((b) => b.status === "paid");
      const overdue = rows.filter((b) => b.status === "overdue");
      const unpaid = rows.filter((b) => b.status === "unpaid");
      const sum = (arr: typeof rows) => arr.reduce((s, r) => s + Number(r.amount), 0);
      return {
        billed: sum(rows),
        collected: sum(paid),
        outstanding: sum(unpaid) + sum(overdue),
        overdueCount: overdue.length,
      };
    },
  });

  // ---------- Recent guest validations ----------
  const recentValidations = useQuery({
    queryKey: ["admin.recentValidations", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_invites")
        .select("id,guest_name,status,checked_in_at,checked_out_at,num_guests")
        .eq("estate_id", estateId!)
        .not("checked_in_at", "is", null)
        .order("checked_in_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---------- Recent resident registrations ----------
  const recentResidents = useQuery({
    queryKey: ["admin.recentResidents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,unit,created_at,verification_status,approved")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---------- Recent estate activity ----------
  const recentActivity = useQuery({
    queryKey: ["admin.activity", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,action,entity,created_at,actor_id")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!estateId) {
    return (
      <EmptyState
        title="No estate assigned"
        description="Your admin account isn't linked to an estate yet. Contact a Super Admin."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Estate overview</h1>
          <p className="text-xs text-muted-foreground">{session?.estate?.name}</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setRange(k)}
              className={
                "rounded-md px-2.5 py-1 text-xs font-medium transition " +
                (range === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {RANGE_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Residents */}
      <SectionTitle>Residents</SectionTitle>
      {residentStats.isLoading ? (
        <ListSkeleton rows={2} />
      ) : residentStats.error ? (
        <ErrorState onRetry={() => residentStats.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Total residents" value={residentStats.data!.total} />
          <StatCard label="Approved" value={residentStats.data!.approved} tone="success" />
          <StatCard
            label="Revoked / inactive"
            value={residentStats.data!.revoked}
            tone={residentStats.data!.revoked ? "warning" : "default"}
          />
          <StatCard
            label="Pending verification"
            value={residentStats.data!.pendingVerify}
            tone={residentStats.data!.pendingVerify ? "warning" : "default"}
            hint={residentStats.data!.pendingVerify ? "Review queue" : undefined}
          />
          <StatCard
            label="Rejected verification"
            value={residentStats.data!.rejectedVerify}
            tone="error"
          />
          <StatCard
            label={`New (${RANGE_LABEL[range].toLowerCase()})`}
            value={residentStats.data!.newResidents}
            tone="primary"
          />
        </div>
      )}

      {/* Issues */}
      <SectionTitle>Incidents & issues</SectionTitle>
      {issueStats.isLoading ? (
        <ListSkeleton rows={1} />
      ) : issueStats.error ? (
        <ErrorState onRetry={() => issueStats.refetch()} />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Open"
            value={issueStats.data!.open}
            tone={issueStats.data!.open ? "error" : "default"}
          />
          <StatCard label="In progress" value={issueStats.data!.inProgress} tone="warning" />
          <StatCard label="Resolved" value={issueStats.data!.resolved} tone="success" />
        </div>
      )}

      {/* Guest passes */}
      <SectionTitle>Guest passes</SectionTitle>
      {guestStats.isLoading ? (
        <ListSkeleton rows={2} />
      ) : guestStats.error ? (
        <ErrorState onRetry={() => guestStats.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Active" value={guestStats.data!.active} tone="primary" />
          <StatCard label="Used" value={guestStats.data!.used} tone="success" />
          <StatCard label="Expired" value={guestStats.data!.expired} />
          <StatCard label="Revoked" value={guestStats.data!.revoked} tone="warning" />
          <StatCard label="Created" value={guestStats.data!.created} />
          <StatCard label="Validated" value={guestStats.data!.validated} tone="success" />
        </div>
      )}

      {/* Billing */}
      <SectionTitle>Billing</SectionTitle>
      {billingStats.isLoading ? (
        <ListSkeleton rows={1} />
      ) : billingStats.error ? (
        <ErrorState onRetry={() => billingStats.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Billed" value={`₦${billingStats.data!.billed.toLocaleString()}`} />
          <StatCard
            label="Collected"
            value={`₦${billingStats.data!.collected.toLocaleString()}`}
            tone="success"
          />
          <StatCard
            label="Outstanding"
            value={`₦${billingStats.data!.outstanding.toLocaleString()}`}
            tone="warning"
          />
          <StatCard
            label="Overdue bills"
            value={billingStats.data!.overdueCount}
            tone={billingStats.data!.overdueCount ? "error" : "default"}
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickLink to="/app/admin/verifications" label="Verify" />
        <QuickLink to="/app/admin/residents" label="Residents" />
        <QuickLink to="/app/admin/bills" label="Bills" />
        <QuickLink to="/app/admin/issues" label="Issues" />
        <QuickLink to="/app/admin/guests" label="Guest logs" />
        <QuickLink to="/app/admin/staff" label="Staff" />
        <QuickLink to="/app/admin/events" label="Events" />
      </div>

      {/* Recent activity + validations */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <SectionTitle>Recent guest validations</SectionTitle>
          {recentValidations.isLoading ? (
            <ListSkeleton rows={3} />
          ) : recentValidations.error ? (
            <ErrorState onRetry={() => recentValidations.refetch()} />
          ) : recentValidations.data!.length === 0 ? (
            <EmptyState
              title="No validations yet"
              description="Guest check-ins will appear here."
            />
          ) : (
            <div className="space-y-2">
              {recentValidations.data!.map((v) => (
                <Card key={v.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{v.guest_name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {v.num_guests > 1 ? `${v.num_guests} guests · ` : ""}
                        {v.checked_out_at ? "Exited " : "Entered "}
                        {formatDistanceToNow(new Date(v.checked_out_at ?? v.checked_in_at!), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                    <StatusBadge
                      tone={
                        v.status === "used"
                          ? "success"
                          : v.status === "active"
                            ? "primary"
                            : "neutral"
                      }
                    >
                      {v.status}
                    </StatusBadge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionTitle>Recent registrations</SectionTitle>
          {recentResidents.isLoading ? (
            <ListSkeleton rows={3} />
          ) : recentResidents.error ? (
            <ErrorState onRetry={() => recentResidents.refetch()} />
          ) : recentResidents.data!.length === 0 ? (
            <EmptyState title="No residents yet" description="New sign-ups will appear here." />
          ) : (
            <div className="space-y-2">
              {recentResidents.data!.map((r) => (
                <Card key={r.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.full_name || "Unnamed"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.unit ? `${r.unit} · ` : ""}
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <StatusBadge
                      tone={
                        r.verification_status === "approved"
                          ? "success"
                          : r.verification_status === "pending"
                            ? "warning"
                            : r.verification_status === "rejected"
                              ? "error"
                              : "neutral"
                      }
                    >
                      {r.verification_status.replace("_", " ")}
                    </StatusBadge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionTitle>Recent activity</SectionTitle>
        {recentActivity.isLoading ? (
          <ListSkeleton rows={4} />
        ) : recentActivity.error ? (
          <ErrorState onRetry={() => recentActivity.refetch()} />
        ) : recentActivity.data!.length === 0 ? (
          <EmptyState title="No activity yet" description="Estate events will show up here." />
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {recentActivity.data!.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{a.action}</span>
                    {a.entity && <span className="ml-1 text-muted-foreground">· {a.entity}</span>}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="card-surface flex items-center justify-center py-3 text-sm font-medium text-foreground hover:bg-muted/50"
    >
      {label}
    </Link>
  );
}
