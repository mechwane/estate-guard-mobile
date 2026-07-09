import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, startOfDay } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [section, setSection] = useState<"overview" | "operations" | "activity">("overview");

  const metrics = useQuery({
    queryKey: ["admin-control-center", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString();
      const [
        profiles,
        guardsRoles,
        verified,
        pendingVerify,
        inactive,
        visitorsInside,
        invitesToday,
        expiredInvites,
        missingExits,
        openIncidents,
        pendingRequests,
        pendingOrders,
        unpaidBills,
        upcomingMeetings,
        contacts,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,approved", { count: "exact" })
          .eq("estate_id", estateId!),
        supabase.from("user_roles").select("user_id,role").eq("role", "guard"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .eq("verification_status", "approved"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .eq("verification_status", "pending"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .eq("approved", false),
        supabase
          .from("guest_invites")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .not("checked_in_at", "is", null)
          .is("checked_out_at", null),
        supabase
          .from("guest_invites")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .gte("created_at", today),
        supabase
          .from("guest_invites")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .lt("expires_at", new Date().toISOString())
          .neq("status", "revoked"),
        supabase
          .from("guest_invites")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .not("checked_in_at", "is", null)
          .is("checked_out_at", null)
          .lt("expires_at", new Date().toISOString()),
        supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .in("status", ["open", "in_progress"]),
        supabase
          .from("resident_requests")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .in("status", ["pending", "under_review", "more_info"]),
        supabase
          .from("shop_orders")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .in("status", ["pending", "confirmed", "processing"]),
        supabase
          .from("bills")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .in("status", ["unpaid", "overdue"]),
        supabase
          .from("meetings")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .gte("starts_at", new Date().toISOString()),
        supabase
          .from("estate_contacts")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!),
      ]);
      const profileIds = new Set((profiles.data ?? []).map((p) => p.id));
      const totalGuards = (guardsRoles.data ?? []).filter((r) => profileIds.has(r.user_id)).length;
      return {
        totalResidents: profiles.count ?? 0,
        verifiedResidents: verified.count ?? 0,
        unverifiedResidents: Math.max((profiles.count ?? 0) - (verified.count ?? 0), 0),
        pendingVerify: pendingVerify.count ?? 0,
        inactive: inactive.count ?? 0,
        totalGuards,
        visitorsInside: visitorsInside.count ?? 0,
        invitesToday: invitesToday.count ?? 0,
        expiredInvites: expiredInvites.count ?? 0,
        missingExits: missingExits.count ?? 0,
        openIncidents: openIncidents.count ?? 0,
        pendingRequests: pendingRequests.count ?? 0,
        pendingOrders: pendingOrders.count ?? 0,
        unpaidBills: unpaidBills.count ?? 0,
        upcomingMeetings: upcomingMeetings.count ?? 0,
        contacts: contacts.count ?? 0,
      };
    },
  });

  const activity = useQuery({
    queryKey: ["admin-recent-activity", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const operations = useMemo(
    () =>
      [
        ["Residents", "/app/admin/residents"],
        ["Guards", "/app/admin/staff"],
        ["Guest logs", "/app/admin/guests"],
        ["Requests", "/app/admin/requests"],
        ["Issues", "/app/admin/issues"],
        ["Bills", "/app/admin/bills"],
        ["Shop", "/app/admin/shop"],
        ["Community", "/app/admin/community"],
        ["Verifications", "/app/admin/verifications"],
      ] as const,
    [],
  );

  if (!estateId)
    return (
      <EmptyState
        title="No estate assigned"
        description="Your admin account is not linked to an estate yet."
      />
    );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-1">
        {(["overview", "operations", "activity"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`rounded-md px-2 py-2 text-xs font-medium capitalize ${section === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {section === "overview" &&
        (metrics.isLoading ? (
          <ListSkeleton rows={4} />
        ) : metrics.isError || !metrics.data ? (
          <ErrorState onRetry={() => metrics.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total residents" value={metrics.data.totalResidents} />
            <StatCard label="Verified" value={metrics.data.verifiedResidents} tone="success" />
            <StatCard
              label="Unverified"
              value={metrics.data.unverifiedResidents}
              tone={metrics.data.unverifiedResidents ? "warning" : "default"}
            />
            <StatCard
              label="Pending approvals"
              value={metrics.data.pendingVerify}
              tone={metrics.data.pendingVerify ? "warning" : "default"}
            />
            <StatCard
              label="Revoked/suspended"
              value={metrics.data.inactive}
              tone={metrics.data.inactive ? "error" : "default"}
            />
            <StatCard label="Total guards" value={metrics.data.totalGuards} />
            <StatCard
              label="Visitors inside"
              value={metrics.data.visitorsInside}
              tone={metrics.data.visitorsInside ? "primary" : "default"}
            />
            <StatCard label="Invites today" value={metrics.data.invitesToday} />
            <StatCard label="Expired invites" value={metrics.data.expiredInvites} />
            <StatCard
              label="Missing exits"
              value={metrics.data.missingExits}
              tone={metrics.data.missingExits ? "warning" : "default"}
            />
            <StatCard
              label="Open incidents"
              value={metrics.data.openIncidents}
              tone={metrics.data.openIncidents ? "error" : "default"}
            />
            <StatCard
              label="Pending requests"
              value={metrics.data.pendingRequests}
              tone={metrics.data.pendingRequests ? "warning" : "default"}
            />
            <StatCard label="Pending orders" value={metrics.data.pendingOrders} />
            <StatCard
              label="Unpaid bills"
              value={metrics.data.unpaidBills}
              tone={metrics.data.unpaidBills ? "warning" : "default"}
            />
            <StatCard label="Upcoming meetings" value={metrics.data.upcomingMeetings} />
            <StatCard label="Estate contacts" value={metrics.data.contacts} />
          </div>
        ))}

      {section === "operations" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {operations.map(([label, to]) => (
            <Link
              key={to}
              to={to}
              className="card-surface flex min-h-16 items-center justify-center px-3 py-3 text-center text-sm font-medium text-foreground hover:bg-muted/50"
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {section === "activity" &&
        (activity.isLoading ? (
          <ListSkeleton rows={5} />
        ) : activity.isError ? (
          <ErrorState onRetry={() => activity.refetch()} />
        ) : (activity.data ?? []).length === 0 ? (
          <EmptyState title="No recent estate activity" />
        ) : (
          <div className="space-y-2">
            {activity.data!.map((a) => (
              <Card key={a.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{a.action}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.entity ?? "record"}
                      {a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {section === "operations" && (
        <Card className="p-3 text-xs text-muted-foreground">
          <StatusBadge>Scoped</StatusBadge>
          <span className="ml-2">
            All admin reads and actions on these pages are filtered to{" "}
            {session?.estate?.name ?? "your estate"}.
          </span>
        </Card>
      )}
    </div>
  );
}
