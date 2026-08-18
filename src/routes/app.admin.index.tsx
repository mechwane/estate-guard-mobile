import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, startOfDay, subDays } from "date-fns";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  Clock,
  FileText,
  LogIn,
  Phone,
  Receipt,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  TimerOff,
  UserX,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { MetricTile } from "@/components/metric-tile";
import {
  ChartCard,
  DonutChart,
  InteractiveTrendChart,
  LineBarChart,
  ProgressRing,
  RangeTabs,
  VerticalBarChart,
  type AdminRangeKey,
} from "@/components/dashboard-charts";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
} from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [visitorRange, setVisitorRange] = useState<AdminRangeKey>("7d");


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
    queryFn: () => fetchEstateActivity(estateId!, 25),
  });


  const charts = useQuery({
    queryKey: ["admin-dashboard-charts", estateId, visitorRange],
    enabled: !!estateId,
    queryFn: async () => {
      const since = adminRangeStart(visitorRange);
      const [profiles, guests, requests, issues, bills, orders, estateProfiles, guardRoles] =
        await Promise.all([
          supabase.from("profiles").select("id,verification_status").eq("estate_id", estateId!),
          supabase
            .from("guest_invites")
            .select("id,created_at,checked_in_at,checked_out_at,expires_at,validated_by,exited_by")
            .eq("estate_id", estateId!),
          supabase.from("resident_requests").select("id,category").eq("estate_id", estateId!),
          supabase
            .from("issues")
            .select("id,status,severity,created_at,reporter_id,reporter_role")
            .eq("estate_id", estateId!),
          supabase.from("bills").select("id,status,amount").eq("estate_id", estateId!),
          supabase.from("shop_orders").select("id,status").eq("estate_id", estateId!),
          supabase.from("profiles").select("id,full_name,email").eq("estate_id", estateId!),
          supabase.from("user_roles").select("user_id,role").eq("role", "guard"),
        ]);

      const error = [
        profiles.error,
        guests.error,
        requests.error,
        issues.error,
        bills.error,
        orders.error,
        estateProfiles.error,
        guardRoles.error,
      ].find(Boolean);
      if (error) throw error;

      const profileRows = profiles.data ?? [];
      const guestRows = guests.data ?? [];
      const requestRows = requests.data ?? [];
      const issueRows = issues.data ?? [];
      const billRows = bills.data ?? [];
      const orderRows = orders.data ?? [];

      const verificationCounts = countStrings(
        profileRows.map((profile) => profile.verification_status ?? "not_submitted"),
      );
      const guardIds = new Set((guardRoles.data ?? []).map((role) => role.user_id));
      const guardNames = new Map(
        (estateProfiles.data ?? [])
          .filter((profile) => guardIds.has(profile.id))
          .map((profile) => [
            profile.id,
            profile.full_name || profile.email || profile.id.slice(0, 8),
          ]),
      );
      const guardActivity = Array.from(guardNames.entries())
        .map(([id, name]) => ({
          name,
          validations: guestRows.filter(
            (guest) => guest.validated_by === id && inRange(guest.checked_in_at, since),
          ).length,
          checkIns: guestRows.filter(
            (guest) => guest.validated_by === id && inRange(guest.checked_in_at, since),
          ).length,
          checkOuts: guestRows.filter(
            (guest) => guest.exited_by === id && inRange(guest.checked_out_at, since),
          ).length,
          incidents: issueRows.filter(
            (issue) =>
              issue.reporter_id === id &&
              issue.reporter_role === "guard" &&
              inRange(issue.created_at, since),
          ).length,
        }))
        .filter((row) => row.validations + row.checkIns + row.checkOuts + row.incidents > 0)
        .slice(0, 8);
      const billCounts = countStrings(billRows.map((bill) => String(bill.status)));
      const outstandingAmount = billRows
        .filter((bill) =>
          ["unpaid", "overdue", "partially_paid", "partial"].includes(String(bill.status)),
        )
        .reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0);

      return {
        timeline: buildTimeline(guestRows, visitorRange),
        verificationShare: {
          verified: verificationCounts.approved ?? 0,
          total: profileRows.length,
        },
        billShare: {
          paid: billRows.filter((bill) => String(bill.status) === "paid").length,
          total: billRows.length,
        },
        insideShare: {
          inside: guestRows.filter((guest) => guest.checked_in_at && !guest.checked_out_at).length,
          total: guestRows.filter((guest) => guest.checked_in_at).length,
        },
        verification: [
          { name: "Verified", value: verificationCounts.approved ?? 0 },
          { name: "Pending", value: verificationCounts.pending ?? 0 },
          { name: "Rejected", value: verificationCounts.rejected ?? 0 },
          {
            name: "Unverified",
            value: (verificationCounts.not_submitted ?? 0) + (verificationCounts.incomplete ?? 0),
          },
        ],
        visitorActivity: [
          {
            name: "Invites",
            count: guestRows.filter((guest) => inRange(guest.created_at, since)).length,
          },
          {
            name: "Check-ins",
            count: guestRows.filter((guest) => inRange(guest.checked_in_at, since)).length,
          },
          {
            name: "Check-outs",
            count: guestRows.filter((guest) => inRange(guest.checked_out_at, since)).length,
          },
          {
            name: "Inside",
            count: guestRows.filter((guest) => guest.checked_in_at && !guest.checked_out_at).length,
          },
          {
            name: "Missing exits",
            count: guestRows.filter(
              (guest) =>
                guest.checked_in_at &&
                !guest.checked_out_at &&
                new Date(guest.expires_at) < new Date(),
            ).length,
          },
        ],
        requestCategories: requestCategoryRows(requestRows.map((request) => request.category)),
        issueBreakdown: [
          { name: "Open", count: issueRows.filter((issue) => issue.status === "open").length },
          {
            name: "In progress",
            count: issueRows.filter((issue) => issue.status === "in_progress").length,
          },
          {
            name: "Resolved",
            count: issueRows.filter((issue) => issue.status === "resolved").length,
          },
          { name: "Low", count: issueRows.filter((issue) => issue.severity === "low").length },
          {
            name: "Medium",
            count: issueRows.filter((issue) => issue.severity === "medium").length,
          },
          { name: "High", count: issueRows.filter((issue) => issue.severity === "high").length },
          {
            name: "Critical",
            count: issueRows.filter((issue) => issue.severity === "critical").length,
          },
        ],
        bills: [
          { name: "Paid", count: billCounts.paid ?? 0 },
          { name: "Unpaid", count: billCounts.unpaid ?? 0 },
          {
            name: "Partially paid",
            count: (billCounts.partially_paid ?? 0) + (billCounts.partial ?? 0),
          },
          { name: "Overdue", count: billCounts.overdue ?? 0 },
          { name: "Outstanding", amount: outstandingAmount },
        ],
        orders: statusRows(
          orderRows.map((order) => order.status),
          ["pending", "confirmed", "processing", "ready", "completed", "cancelled", "rejected"],
        ),
        guardActivity,
      };
    },
  });




  if (!estateId)
    return (
      <EmptyState
        title="No estate assigned"
        description="Your admin account is not linked to an estate yet."
      />
    );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-5">
      <div className="min-w-0 space-y-5">
      {(metrics.isLoading ? (
          <ListSkeleton rows={4} />
        ) : metrics.isError || !metrics.data ? (
          <ErrorState onRetry={() => metrics.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <MetricTile
              label="Total residents"
              value={metrics.data.totalResidents}
              icon={<Users />}
              tone="primary"
              share={100}
              hint="View everyone in this estate"
              to="/app/admin/residents"
              search={{ view: "all" }}
            />
            <MetricTile
              label="Verified"
              value={metrics.data.verifiedResidents}
              icon={<ShieldCheck />}
              tone="success"
              share={pct(metrics.data.verifiedResidents, metrics.data.totalResidents)}
              hint={`${Math.round(pct(metrics.data.verifiedResidents, metrics.data.totalResidents))}% of residents`}
              to="/app/admin/residents"
              search={{ view: "verified" }}
            />
            <MetricTile
              label="Unverified"
              value={metrics.data.unverifiedResidents}
              icon={<UserX />}
              tone={metrics.data.unverifiedResidents ? "warning" : "default"}
              share={pct(metrics.data.unverifiedResidents, metrics.data.totalResidents)}
              to="/app/admin/residents"
              search={{ view: "unverified" }}
            />
            <MetricTile
              label="Pending approvals"
              value={metrics.data.pendingVerify}
              icon={<Clock />}
              tone={metrics.data.pendingVerify ? "warning" : "default"}
              share={pct(metrics.data.pendingVerify, metrics.data.totalResidents)}
              hint="Awaiting verification review"
              to="/app/admin/residents"
              search={{ view: "pending" }}
            />
            <MetricTile
              label="Revoked / suspended"
              value={metrics.data.inactive}
              icon={<Ban />}
              tone={metrics.data.inactive ? "error" : "default"}
              share={pct(metrics.data.inactive, metrics.data.totalResidents)}
              to="/app/admin/residents"
              search={{ view: "revoked" }}
            />
            <MetricTile
              label="Total guards"
              value={metrics.data.totalGuards}
              icon={<Shield />}
              tone="accent"
              hint="Gate team on this estate"
              to="/app/admin/residents"
              search={{ view: "guards" }}
            />
            <MetricTile
              label="Visitors inside"
              value={metrics.data.visitorsInside}
              icon={<LogIn />}
              tone={metrics.data.visitorsInside ? "primary" : "default"}
              to="/app/admin/guests"
              search={{ tab: "inside" }}
            />
            <MetricTile
              label="Invites today"
              value={metrics.data.invitesToday}
              icon={<Ticket />}
              spark={charts.data?.timeline?.map((d) => d.invites)}
              to="/app/admin/guests"
              search={{ tab: "all" }}
            />
            <MetricTile
              label="Expired codes"
              value={metrics.data.expiredInvites}
              icon={<TimerOff />}
              to="/app/admin/guests"
              search={{ tab: "expired" }}
            />
            <MetricTile
              label="Missing exits"
              value={metrics.data.missingExits}
              icon={<AlertTriangle />}
              tone={metrics.data.missingExits ? "warning" : "default"}
              to="/app/admin/alerts"
            />
            <MetricTile
              label="Open incidents"
              value={metrics.data.openIncidents}
              icon={<AlertTriangle />}
              tone={metrics.data.openIncidents ? "error" : "default"}
              to="/app/admin/issues"
            />
            <MetricTile
              label="Support tickets"
              value={metrics.data.pendingRequests}
              icon={<FileText />}
              tone={metrics.data.pendingRequests ? "warning" : "default"}
              to="/app/admin/tickets"
            />
            <MetricTile
              label="Pending orders"
              value={metrics.data.pendingOrders}
              icon={<ShoppingCart />}
              to="/app/admin/shop"
            />
            <MetricTile
              label="Unpaid bills"
              value={metrics.data.unpaidBills}
              icon={<Receipt />}
              tone={metrics.data.unpaidBills ? "warning" : "default"}
              to="/app/admin/collections"
            />
            <MetricTile
              label="Upcoming meetings"
              value={metrics.data.upcomingMeetings}
              icon={<CalendarClock />}
              to="/app/admin/community"
            />
            <MetricTile
              label="Estate contacts"
              value={metrics.data.contacts}
              icon={<Phone />}
              to="/app/admin/estate"
            />
          </div>

        ))}

      {(charts.isLoading ? (
          <ListSkeleton rows={4} />
        ) : charts.isError || !charts.data ? (
          <ErrorState onRetry={() => charts.refetch()} />
        ) : (
          <div className="space-y-3">
            <ChartCard
              title="Estate access trend"
              subtitle="Invites, check-ins and check-outs over time — tap a metric to focus it"
              action={
                <RangeTabs
                  value={visitorRange}
                  onChange={setVisitorRange}
                  options={adminRangeOptions}
                />
              }
            >
              <InteractiveTrendChart
                data={charts.data.timeline}
                series={[
                  { key: "invites", label: "Codes", color: "var(--color-primary)" },
                  { key: "checkIns", label: "Check-ins", color: "var(--color-success)" },
                  { key: "checkOuts", label: "Check-outs", color: "var(--color-warning)" },
                ]}
              />
            </ChartCard>

            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/app/admin/residents" search={{ view: "verified" }} className="block">
                <Card className="p-4 lift-3d">
                  <ProgressRing
                    value={share(
                      charts.data.verificationShare.verified,
                      charts.data.verificationShare.total,
                    )}
                    label="Verified residents"
                    caption={`${charts.data.verificationShare.verified} of ${charts.data.verificationShare.total}`}
                  />
                </Card>
              </Link>
              <Link to="/app/admin/collections" className="block">
                <Card className="p-4 lift-3d">
                  <ProgressRing
                    value={share(charts.data.billShare.paid, charts.data.billShare.total)}
                    label="Bills settled"
                    caption={`${charts.data.billShare.paid} of ${charts.data.billShare.total}`}
                    color="var(--color-success)"
                  />
                </Card>
              </Link>
              <Link
                to="/app/admin/guests"
                search={{ tab: "inside", code: undefined }}
                className="block"
              >
                <Card className="p-4 lift-3d">
                  <ProgressRing
                    value={share(charts.data.insideShare.inside, charts.data.insideShare.total)}
                    label="Visitors still inside"
                    caption={`${charts.data.insideShare.inside} of ${charts.data.insideShare.total} check-ins`}
                    color="var(--color-warning)"
                  />
                </Card>
              </Link>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <ChartCard title="Resident verification">
                <DonutChart data={charts.data.verification} />
              </ChartCard>

              <ChartCard
                title="Visitor activity"
                action={
                  <RangeTabs
                    value={visitorRange}
                    onChange={setVisitorRange}
                    options={adminRangeOptions}
                  />
                }
              >
                <VerticalBarChart
                  data={charts.data.visitorActivity}
                  bars={[{ key: "count", label: "Records" }]}
                />
              </ChartCard>
              <ChartCard title="Requests by category">
                <VerticalBarChart
                  data={charts.data.requestCategories}
                  bars={[{ key: "count", label: "Requests" }]}
                />
              </ChartCard>
              <ChartCard title="Issues by status and severity">
                <VerticalBarChart
                  data={charts.data.issueBreakdown}
                  bars={[{ key: "count", label: "Issues" }]}
                />
              </ChartCard>
              <ChartCard title="Bills">
                <VerticalBarChart
                  data={charts.data.bills}
                  bars={[
                    { key: "count", label: "Bills" },
                    { key: "amount", label: "Amount" },
                  ]}
                  currencyKeys={["amount", "Amount"]}
                />
              </ChartCard>
              <ChartCard title="Shop orders">
                <VerticalBarChart
                  data={charts.data.orders}
                  bars={[{ key: "count", label: "Orders" }]}
                />
              </ChartCard>
              <ChartCard title="Guard activity">
                <LineBarChart
                  data={charts.data.guardActivity}
                  bars={[
                    { key: "validations", label: "Validations" },
                    { key: "checkIns", label: "Check-ins" },
                    { key: "checkOuts", label: "Check-outs" },
                    { key: "incidents", label: "Incidents" },
                  ]}
                />
              </ChartCard>
            </div>
          </div>
        ))}


      </div>

      <aside className="mt-5 min-w-0 space-y-2 lg:mt-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto lg:pr-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
          <Link to="/app/admin/audit" className="text-[11px] font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
      {(activity.isLoading ? (
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
      </aside>
    </div>
  );
}

const adminRangeOptions = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
] as const;

function adminRangeStart(range: AdminRangeKey) {
  if (range === "today") return startOfDay(new Date());
  return startOfDay(subDays(new Date(), range === "7d" ? 6 : 29));
}

function inRange(value: string | null | undefined, since: Date) {
  return !!value && new Date(value) >= since;
}

function countStrings(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusRows(values: string[], statuses: string[]) {
  const counts = countStrings(values.map((value) => String(value)));
  return statuses.map((status) => ({ name: titleCase(status), count: counts[status] ?? 0 }));
}

function requestCategoryRows(values: string[]) {
  const rows = {
    "Development/Renovation": 0,
    Events: 0,
    Code: 0,
    Billing: 0,
    Others: 0,
  };
  values.forEach((raw) => {
    const value = raw.toLowerCase();
    if (value.includes("development") || value.includes("renovation"))
      rows["Development/Renovation"] += 1;
    else if (value.includes("event")) rows.Events += 1;
    else if (value.includes("code")) rows.Code += 1;
    else if (value.includes("bill") || value.includes("payment")) rows.Billing += 1;
    else rows.Others += 1;
  });
  return Object.entries(rows).map(([name, count]) => ({ name, count }));
}

type GuestTimelineRow = {
  created_at: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

/**
 * Builds a daily (or hourly for "today") access timeline so the dashboard can
 * plot invite / check-in / check-out movement as a continuous trend line.
 */
function buildTimeline(rows: GuestTimelineRow[], range: AdminRangeKey) {
  const now = new Date();
  if (range === "today") {
    const start = startOfDay(now);
    return Array.from({ length: 24 }, (_, hour) => {
      const from = new Date(start.getTime() + hour * 3600_000);
      const to = new Date(from.getTime() + 3600_000);
      return {
        name: `${String(hour).padStart(2, "0")}:00`,
        invites: countBetween(rows, (row) => row.created_at, from, to),
        checkIns: countBetween(rows, (row) => row.checked_in_at, from, to),
        checkOuts: countBetween(rows, (row) => row.checked_out_at, from, to),
      };
    });
  }
  const days = range === "7d" ? 7 : 30;
  return Array.from({ length: days }, (_, index) => {
    const from = startOfDay(subDays(now, days - 1 - index));
    const to = new Date(from.getTime() + 86_400_000);
    return {
      name: `${from.getDate()}/${from.getMonth() + 1}`,
      invites: countBetween(rows, (row) => row.created_at, from, to),
      checkIns: countBetween(rows, (row) => row.checked_in_at, from, to),
      checkOuts: countBetween(rows, (row) => row.checked_out_at, from, to),
    };
  });
}

function countBetween(
  rows: GuestTimelineRow[],
  pick: (row: GuestTimelineRow) => string | null,
  from: Date,
  to: Date,
) {
  return rows.filter((row) => {
    const raw = pick(row);
    if (!raw) return false;
    const at = new Date(raw).getTime();
    return at >= from.getTime() && at < to.getTime();
  }).length;
}

function share(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}

function pct(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : 0;
}
