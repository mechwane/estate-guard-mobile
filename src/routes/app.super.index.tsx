import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, startOfDay, subDays } from "date-fns";
import { Building2, Loader2, Pencil, Plus, Power, PowerOff, UserCog } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  ChartCard,
  DonutChart,
  RangeTabs,
  TrendChart,
  VerticalBarChart,
  type RangeKey,
} from "@/components/dashboard-charts";
import {
  Card,
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SearchInput,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { ngn } from "@/lib/format";

export const Route = createFileRoute("/app/super/")({
  component: SuperDashboard,
});

type Estate = {
  id: string;
  name: string;
  code: string;
  status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  admin_user_id: string | null;
  created_at: string;
};

type PublicTable = keyof Database["public"]["Tables"];
type PlatformActivity = Database["public"]["Tables"]["audit_logs"]["Row"] & {
  estate?: { id: string; name: string; code: string } | null;
};
type ProfileLite = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email"
>;

function SuperDashboard() {
  const qc = useQueryClient();
  const [section, setSection] = useState<"overview" | "estates" | "activity">("overview");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Estate | null>(null);
  const [assigning, setAssigning] = useState<Estate | null>(null);
  const [toggling, setToggling] = useState<Estate | null>(null);
  const [growthRange, setGrowthRange] = useState<RangeKey>("30d");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["all-estates"] });
    qc.invalidateQueries({ queryKey: ["platform-stats"] });
    qc.invalidateQueries({ queryKey: ["platform-activity"] });
  };

  const estatesQ = useQuery({
    queryKey: ["all-estates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Estate[];
    },
  });

  const stats = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const count = (table: PublicTable) =>
        supabase.from(table).select("id", { count: "exact", head: true });
      const [
        totalEstates,
        activeEstates,
        suspendedEstates,
        users,
        residents,
        guards,
        admins,
        pendingVerifications,
        supportOpen,
        incidentsOpen,
        shopOrders,
        residentRequests,
        meetings,
        bills,
        devicesTotal,
        devicesOnline,
        devicesOffline,
        biometricEnrolled,
      ] = await Promise.all([
        count("estates"),
        supabase
          .from("estates")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("estates")
          .select("id", { count: "exact", head: true })
          .eq("status", "suspended"),
        count("profiles"),
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "resident"),
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "guard"),
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "estate_admin"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("verification_status", "pending"),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "in_progress"]),
        count("shop_orders"),
        count("resident_requests"),
        count("meetings"),
        count("bills"),
        count("access_devices"),
        supabase
          .from("access_devices")
          .select("id", { count: "exact", head: true })
          .eq("status", "online"),
        supabase
          .from("access_devices")
          .select("id", { count: "exact", head: true })
          .eq("status", "offline"),
        supabase
          .from("biometric_access")
          .select("id", { count: "exact", head: true })
          .eq("enrollment_status", "enrolled"),
      ]);
      return {
        totalEstates: totalEstates.count ?? 0,
        activeEstates: activeEstates.count ?? 0,
        suspendedEstates: suspendedEstates.count ?? 0,
        users: users.count ?? 0,
        residents: residents.count ?? 0,
        guards: guards.count ?? 0,
        admins: admins.count ?? 0,
        pendingVerifications: pendingVerifications.count ?? 0,
        supportOpen: supportOpen.count ?? 0,
        incidentsOpen: incidentsOpen.count ?? 0,
        shopOrders: shopOrders.count ?? 0,
        residentRequests: residentRequests.count ?? 0,
        meetings: meetings.count ?? 0,
        bills: bills.count ?? 0,
        devicesTotal: devicesTotal.count ?? 0,
        devicesOnline: devicesOnline.count ?? 0,
        devicesOffline: devicesOffline.count ?? 0,
        biometricEnrolled: biometricEnrolled.count ?? 0,
      };
    },
  });

  const activity = useQuery({
    queryKey: ["platform-activity"],
    queryFn: async () => {
      const [{ data: logs, error }, { data: estates }] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("estates").select("id,name,code"),
      ]);
      if (error) throw error;
      const estateMap = new Map((estates ?? []).map((e) => [e.id, e]));
      return (logs ?? []).map((l) => ({
        ...l,
        estate: l.estate_id ? estateMap.get(l.estate_id) : null,
      }));
    },
  });

  const charts = useQuery({
    queryKey: ["super-dashboard-charts", growthRange],
    queryFn: async () => {
      const [
        estates,
        profiles,
        roles,
        guests,
        requests,
        issues,
        meetings,
        posts,
        support,
        bills,
        orders,
      ] = await Promise.all([
        supabase.from("estates").select("id,name,status,created_at"),
        supabase.from("profiles").select("id,created_at,estate_id"),
        supabase.from("user_roles").select("user_id,role"),
        supabase
          .from("guest_invites")
          .select("id,estate_id,created_at,checked_in_at,checked_out_at"),
        supabase.from("resident_requests").select("id,estate_id,created_at,status"),
        supabase.from("issues").select("id,estate_id,created_at,status"),
        supabase.from("meetings").select("id,estate_id,created_at"),
        supabase.from("community_posts").select("id,estate_id,created_at,post_type"),
        supabase.from("support_tickets").select("id,status,created_at"),
        supabase.from("bills").select("id,estate_id,status,amount,created_at"),
        supabase.from("shop_orders").select("id,estate_id,status,created_at"),
      ]);

      const error = [
        estates.error,
        profiles.error,
        roles.error,
        guests.error,
        requests.error,
        issues.error,
        meetings.error,
        posts.error,
        support.error,
        bills.error,
        orders.error,
      ].find(Boolean);
      if (error) throw error;

      const estateRows = estates.data ?? [];
      const profileRows = profiles.data ?? [];
      const roleRows = roles.data ?? [];
      const guestRows = guests.data ?? [];
      const requestRows = requests.data ?? [];
      const issueRows = issues.data ?? [];
      const meetingRows = meetings.data ?? [];
      const postRows = posts.data ?? [];
      const supportRows = support.data ?? [];
      const billRows = bills.data ?? [];
      const orderRows = orders.data ?? [];
      const start = rangeStart(
        growthRange,
        [...profileRows, ...estateRows].map((row) => row.created_at),
      );
      const residentIds = new Set(
        roleRows.filter((role) => role.role === "resident").map((role) => role.user_id),
      );
      const guardIds = new Set(
        roleRows.filter((role) => role.role === "guard").map((role) => role.user_id),
      );
      const roleCounts = countStrings(roleRows.map((role) => role.role));
      const estateStatusCounts = countStrings(estateRows.map((estate) => String(estate.status)));
      const billCounts = countStrings(billRows.map((bill) => String(bill.status)));
      const collectedAmount = billRows
        .filter((bill) => bill.status === "paid")
        .reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0);
      const outstandingAmount = billRows
        .filter((bill) => bill.status !== "paid")
        .reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0);

      return {
        growth: buildGrowthRows({
          start,
          users: profileRows,
          estates: estateRows,
          residents: profileRows.filter((profile) => residentIds.has(profile.id)),
        }),
        roleDistribution: [
          { name: "Residents", value: roleCounts.resident ?? 0 },
          { name: "Guards", value: roleCounts.guard ?? 0 },
          { name: "Estate Admins", value: roleCounts.estate_admin ?? 0 },
          { name: "Super Admins", value: roleCounts.super_admin ?? 0 },
        ],
        estateStatus: [
          { name: "Active", value: estateStatusCounts.active ?? 0 },
          { name: "Suspended", value: estateStatusCounts.suspended ?? 0 },
          { name: "Pending", value: estateStatusCounts.pending ?? 0 },
        ],
        activity: [
          { name: "Invites", count: guestRows.length },
          { name: "Check-ins", count: guestRows.filter((guest) => guest.checked_in_at).length },
          { name: "Check-outs", count: guestRows.filter((guest) => guest.checked_out_at).length },
          { name: "Requests", count: requestRows.length },
          { name: "Issues", count: issueRows.length },
          { name: "Meetings", count: meetingRows.length },
          {
            name: "Announcements",
            count: postRows.filter((post) =>
              String(post.post_type).toLowerCase().includes("announcement"),
            ).length,
          },
        ],
        support: statusRows(
          supportRows.map((ticket) => ticket.status),
          ["open", "in_progress", "resolved", "closed"],
        ),
        bills: [
          { name: "Paid bills", count: billCounts.paid ?? 0 },
          { name: "Unpaid bills", count: billCounts.unpaid ?? 0 },
          { name: "Overdue bills", count: billCounts.overdue ?? 0 },
          { name: "Collected", amount: collectedAmount },
          { name: "Outstanding", amount: outstandingAmount },
        ],
        estates: estateRows.map((estate) => ({
          id: estate.id,
          name: estate.name,
          residents: profileRows.filter(
            (profile) => profile.estate_id === estate.id && residentIds.has(profile.id),
          ).length,
          guards: profileRows.filter(
            (profile) => profile.estate_id === estate.id && guardIds.has(profile.id),
          ).length,
          openIncidents: issueRows.filter(
            (issue) =>
              estate.id === issue.estate_id &&
              ["open", "in_progress"].includes(String(issue.status)),
          ).length,
          pendingRequests: requestRows.filter(
            (request) =>
              estate.id === request.estate_id &&
              !["resolved", "closed", "approved", "rejected"].includes(String(request.status)),
          ).length,
          unpaidBills: billRows.filter(
            (bill) => estate.id === bill.estate_id && bill.status !== "paid",
          ).length,
          shopOrders: orderRows.filter((order) => estate.id === order.estate_id).length,
        })),
      };
    },
  });

  const filtered = (estatesQ.data ?? []).filter((e) => {
    const needle = q.trim().toLowerCase();
    if (status !== "all" && e.status !== status) return false;
    if (!needle) return true;
    return (
      e.name.toLowerCase().includes(needle) ||
      e.code.toLowerCase().includes(needle) ||
      (e.city ?? "").toLowerCase().includes(needle)
    );
  });

  const toggle = useMutation({
    mutationFn: async (estate: Estate) => {
      const fn = estate.status === "active" ? "suspend_estate" : "activate_estate";
      const args =
        estate.status === "active"
          ? { _estate_id: estate.id, _reason: "Suspended from platform dashboard" }
          : { _estate_id: estate.id };
      const { error } =
        estate.status === "active"
          ? await supabase.rpc("suspend_estate", args)
          : await supabase.rpc("activate_estate", args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate updated");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-1">
        {(["overview", "estates", "activity"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`rounded-md px-2 py-2 text-xs font-medium capitalize ${section === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <>
          {stats.isLoading ? (
            <ListSkeleton rows={4} />
          ) : stats.isError || !stats.data ? (
            <ErrorState onRetry={() => stats.refetch()} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total estates" value={stats.data!.totalEstates} />
              <StatCard label="Active estates" value={stats.data!.activeEstates} tone="success" />
              <StatCard
                label="Suspended"
                value={stats.data!.suspendedEstates}
                tone={stats.data!.suspendedEstates ? "warning" : "default"}
              />
              <StatCard label="Total users" value={stats.data!.users} />
              <StatCard label="Residents" value={stats.data!.residents} />
              <StatCard label="Guards" value={stats.data!.guards} />
              <StatCard label="Estate admins" value={stats.data!.admins} />
              <StatCard
                label="Pending verifications"
                value={stats.data!.pendingVerifications}
                tone={stats.data!.pendingVerifications ? "warning" : "default"}
              />
              <StatCard
                label="Open support"
                value={stats.data!.supportOpen}
                tone={stats.data!.supportOpen ? "warning" : "default"}
              />
              <StatCard
                label="Open incidents"
                value={stats.data!.incidentsOpen}
                tone={stats.data!.incidentsOpen ? "error" : "default"}
              />
              <StatCard label="Shop orders" value={stats.data!.shopOrders} />
              <StatCard label="Resident requests" value={stats.data!.residentRequests} />
              <StatCard label="Meetings" value={stats.data!.meetings} />
              <StatCard label="Bills created" value={stats.data!.bills} />
              <StatCard label="Access devices" value={stats.data!.devicesTotal} />
              <StatCard label="Devices online" value={stats.data!.devicesOnline} tone="success" />
              <StatCard
                label="Devices offline"
                value={stats.data!.devicesOffline}
                tone={stats.data!.devicesOffline ? "warning" : "default"}
              />
              <StatCard
                label="Biometric enrolled"
                value={stats.data!.biometricEnrolled}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <QuickLink to="/app/super/plans" label="Plans & revenue" />
            <QuickLink to="/app/super/features" label="Feature flags" />
            <QuickLink to="/app/super/users" label="Users & roles" />
            <QuickLink to="/app/super/devices" label="Access devices" />
            <QuickLink to="/app/super/invites" label="Admin invites" />
            <QuickLink to="/app/super/support" label="Support center" />
            <QuickLink to="/app/super/settings" label="Platform settings" />
          </div>
          {charts.isLoading ? (
            <ListSkeleton rows={4} />
          ) : charts.isError || !charts.data ? (
            <ErrorState onRetry={() => charts.refetch()} />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <ChartCard
                  title="Platform growth"
                  subtitle="New users, estates, and residents"
                  action={
                    <RangeTabs
                      value={growthRange}
                      onChange={setGrowthRange}
                      options={growthRangeOptions}
                    />
                  }
                >
                  <TrendChart
                    data={charts.data.growth}
                    series={[
                      { key: "users", label: "New users" },
                      { key: "estates", label: "New estates" },
                      { key: "residents", label: "New residents" },
                    ]}
                  />
                </ChartCard>
                <ChartCard title="User role distribution">
                  <DonutChart data={charts.data.roleDistribution} />
                </ChartCard>
                <ChartCard title="Estate status">
                  <DonutChart data={charts.data.estateStatus} />
                </ChartCard>
                <ChartCard title="Platform activity">
                  <VerticalBarChart
                    data={charts.data.activity}
                    bars={[{ key: "count", label: "Records" }]}
                  />
                </ChartCard>
                <ChartCard title="Support status">
                  <VerticalBarChart
                    data={charts.data.support}
                    bars={[{ key: "count", label: "Tickets" }]}
                  />
                </ChartCard>
                <ChartCard title="Bills and payments">
                  <VerticalBarChart
                    data={charts.data.bills}
                    bars={[
                      { key: "count", label: "Bills" },
                      { key: "amount", label: "Amount" },
                    ]}
                    currencyKeys={["amount", "Amount"]}
                  />
                </ChartCard>
              </div>
              <EstateComparisonTable rows={charts.data.estates} />
            </div>
          )}
        </>
      )}

      {section === "estates" && (
        <>
          <button
            onClick={() => setCreating(!creating)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> {creating ? "Close estate form" : "Create estate"}
          </button>
          {creating && (
            <NewEstateForm
              onDone={() => {
                setCreating(false);
                invalidate();
              }}
            />
          )}
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search estates by name, code, or city"
          />
          <div className="grid grid-cols-3 gap-2">
            {(["all", "active", "suspended"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-lg px-3 py-2 text-xs font-medium capitalize ${status === s ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-muted"}`}
              >
                {s}
              </button>
            ))}
          </div>
          {estatesQ.isLoading ? (
            <ListSkeleton rows={5} />
          ) : estatesQ.isError ? (
            <ErrorState onRetry={() => estatesQ.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No estates match" icon={<Building2 className="h-6 w-6" />} />
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <EstateCard
                  key={e.id}
                  estate={e}
                  onEdit={() => setEditing(e)}
                  onAssign={() => setAssigning(e)}
                  onToggle={() => setToggling(e)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {section === "activity" && <ActivityList query={activity} />}

      <ConfirmActionDialog
        open={!!toggling}
        title={
          toggling?.status === "active"
            ? `Suspend ${toggling?.name}?`
            : `Activate ${toggling?.name}?`
        }
        description={
          toggling?.status === "active"
            ? "Residents and guards in this estate will lose access until it is reactivated."
            : "Residents and guards will regain access to this estate immediately."
        }
        confirmLabel={toggling?.status === "active" ? "Suspend estate" : "Activate estate"}
        tone={toggling?.status === "active" ? "destructive" : "default"}
        busy={toggle.isPending}
        onCancel={() => setToggling(null)}
        onConfirm={() =>
          toggling && toggle.mutate(toggling, { onSettled: () => setToggling(null) })
        }
      />
      {editing && (
        <EditEstateModal
          estate={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}
      {assigning && (
        <AssignAdminModal
          estate={assigning}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

const growthRangeOptions = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All" },
] as const;

type CreatedRow = { created_at: string };

function rangeStart(range: RangeKey, dates: string[]) {
  if (range === "all") {
    const earliest = dates.length
      ? dates.reduce((min, date) => (new Date(date) < new Date(min) ? date : min), dates[0])
      : new Date().toISOString();
    return startOfDay(new Date(earliest));
  }
  const days = range === "7d" ? 6 : range === "30d" ? 29 : 89;
  return startOfDay(subDays(new Date(), days));
}

function buildGrowthRows({
  start,
  users,
  estates,
  residents,
}: {
  start: Date;
  users: CreatedRow[];
  estates: CreatedRow[];
  residents: CreatedRow[];
}) {
  const rows: { name: string; users: number; estates: number; residents: number }[] = [];
  const today = startOfDay(new Date());
  for (let day = new Date(start); day <= today; day.setDate(day.getDate() + 1)) {
    const key = format(day, "yyyy-MM-dd");
    rows.push({
      name: format(day, "MMM d"),
      users: users.filter((row) => format(new Date(row.created_at), "yyyy-MM-dd") === key).length,
      estates: estates.filter((row) => format(new Date(row.created_at), "yyyy-MM-dd") === key)
        .length,
      residents: residents.filter((row) => format(new Date(row.created_at), "yyyy-MM-dd") === key)
        .length,
    });
  }
  return rows;
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

function EstateComparisonTable({
  rows,
}: {
  rows: {
    id: string;
    name: string;
    residents: number;
    guards: number;
    openIncidents: number;
    pendingRequests: number;
    unpaidBills: number;
    shopOrders: number;
  }[];
}) {
  if (rows.length === 0) return <EmptyState title="No estates yet" />;
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Estate comparison</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Estate</th>
              <th className="px-3 py-3 font-medium">Residents</th>
              <th className="px-3 py-3 font-medium">Guards</th>
              <th className="px-3 py-3 font-medium">Open incidents</th>
              <th className="px-3 py-3 font-medium">Pending requests</th>
              <th className="px-3 py-3 font-medium">Unpaid bills</th>
              <th className="px-3 py-3 font-medium">Shop orders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="max-w-52 truncate px-4 py-3 font-medium text-foreground">
                  {row.name}
                </td>
                <td className="px-3 py-3 tabular-nums">{row.residents}</td>
                <td className="px-3 py-3 tabular-nums">{row.guards}</td>
                <td className="px-3 py-3 tabular-nums">{row.openIncidents}</td>
                <td className="px-3 py-3 tabular-nums">{row.pendingRequests}</td>
                <td className="px-3 py-3 tabular-nums">{row.unpaidBills}</td>
                <td className="px-3 py-3 tabular-nums">{row.shopOrders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EstateCard({
  estate,
  onEdit,
  onAssign,
  onToggle,
}: {
  estate: Estate;
  onEdit: () => void;
  onAssign: () => void;
  onToggle: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/app/super/estates/$estateId"
          params={{ estateId: estate.id }}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate text-sm font-medium text-foreground hover:text-primary">
            {estate.name}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Code {estate.code} · {format(new Date(estate.created_at), "MMM d, yyyy")}
          </div>
          {(estate.city || estate.state) && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {[estate.city, estate.state].filter(Boolean).join(", ")}
            </div>
          )}
        </Link>
        <StatusBadge tone={estate.status === "active" ? "success" : "warning"}>
          {estate.status}
        </StatusBadge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ActionBtn onClick={onEdit} icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" />
        <ActionBtn
          onClick={onAssign}
          icon={<UserCog className="h-3.5 w-3.5" />}
          label={estate.admin_user_id ? "Reassign" : "Assign"}
        />
        <ActionBtn
          onClick={onToggle}
          icon={
            estate.status === "active" ? (
              <PowerOff className="h-3.5 w-3.5" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )
          }
          label={estate.status === "active" ? "Suspend" : "Activate"}
        />
      </div>
    </Card>
  );
}

function ActivityList({ query }: { query: ReturnType<typeof useQuery<PlatformActivity[]>> }) {
  if (query.isLoading) return <ListSkeleton rows={5} />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  const rows = query.data ?? [];
  if (rows.length === 0) return <EmptyState title="No platform activity yet" />;
  return (
    <div className="space-y-2">
      {rows.map((a) => (
        <Card key={a.id} className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{a.action}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Actor {a.actor_id?.slice(0, 8) ?? "system"} · {a.entity ?? "record"}
                {a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}
                {a.estate ? ` · ${a.estate.name}` : ""}
              </div>
            </div>
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function QuickLink({
  to,
  label,
}: {
  to: "/app/super/users" | "/app/super/invites" | "/app/super/support" | "/app/super/settings" | "/app/super/plans" | "/app/super/features";
  label: string;
}) {
  return (
    <Link
      to={to}
      className="card-surface flex items-center justify-center py-3 text-sm font-medium text-foreground hover:bg-muted/50"
    >
      {label}
    </Link>
  );
}

function ActionBtn({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted"
    >
      {icon} {label}
    </button>
  );
}

function NewEstateForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    state: "",
    contact_email: "",
    contact_phone: "",
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      let code = form.code.trim().toUpperCase();
      if (!code) {
        const { data, error } = await supabase.rpc("generate_unique_estate_code");
        if (error) throw error;
        code = data as string;
      }
      const { data, error } = await supabase
        .from("estates")
        .insert({
          name: form.name.trim(),
          code,
          status: "active",
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
        })
        .select("id,code")
        .single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        estate_id: data.id,
        action: "estate.created",
        entity: "estates",
        entity_id: data.id,
        metadata: { code: data.code },
      });
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Estate created · code ${data.code}`);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Card className="space-y-3">
      <Field label="Estate name">
        <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      </Field>
      <Field label="Code (blank = auto-generate)">
        <Input value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} />
      </Field>
      <Field label="Address">
        <Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="City">
          <Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        </Field>
        <Field label="State">
          <Input value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
        </Field>
      </div>
      <Field label="Contact email">
        <Input
          value={form.contact_email}
          onChange={(v) => setForm({ ...form, contact_email: v })}
        />
      </Field>
      <Field label="Contact phone">
        <Input
          value={form.contact_phone}
          onChange={(v) => setForm({ ...form, contact_phone: v })}
        />
      </Field>
      <button
        onClick={() => create.mutate()}
        disabled={create.isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
      >
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create estate
      </button>
    </Card>
  );
}

function EditEstateModal({
  estate,
  onClose,
  onDone,
}: {
  estate: Estate;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: estate.name,
    address: estate.address ?? "",
    city: estate.city ?? "",
    state: estate.state ?? "",
    contact_email: estate.contact_email ?? "",
    contact_phone: estate.contact_phone ?? "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_estate", {
        _estate_id: estate.id,
        _name: form.name,
        _address: form.address,
        _city: form.city,
        _state: form.state,
        _contact_email: form.contact_email,
        _contact_phone: form.contact_phone,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate updated");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Overlay onClose={onClose} title={`Edit ${estate.name}`}>
      <div className="space-y-3">
        <Field label="Estate name">
          <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        </Field>
        <Field label="Address">
          <Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City">
            <Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          </Field>
          <Field label="State">
            <Input value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
          </Field>
        </div>
        <Field label="Contact email">
          <Input
            value={form.contact_email}
            onChange={(v) => setForm({ ...form, contact_email: v })}
          />
        </Field>
        <Field label="Contact phone">
          <Input
            value={form.contact_phone}
            onChange={(v) => setForm({ ...form, contact_phone: v })}
          />
        </Field>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </div>
    </Overlay>
  );
}

function AssignAdminModal({
  estate,
  onClose,
  onDone,
}: {
  estate: Estate;
  onClose: () => void;
  onDone: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [q, setQ] = useState("");
  const search = useQuery({
    queryKey: ["assign-admin-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  const assign = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Choose a user");
      const rpc = estate.admin_user_id ? "reassign_estate_admin" : "assign_estate_admin";
      const { error } = await supabase.rpc(rpc, {
        _estate_id: estate.id,
        [estate.admin_user_id ? "_new_admin_user_id" : "_user_id"]: userId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admin assigned");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Overlay
      onClose={onClose}
      title={estate.admin_user_id ? "Reassign estate admin" : "Assign estate admin"}
    >
      <div className="space-y-3">
        <Field label="Search users by name or email">
          <Input value={q} onChange={setQ} />
        </Field>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {(search.data ?? []).map((u: ProfileLite) => (
            <button
              key={u.id}
              onClick={() => setUserId(u.id)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${userId === u.id ? "bg-primary/10 text-primary" : ""}`}
            >
              <span className="truncate">{u.full_name || u.email || u.id}</span>
              {userId === u.id && <span className="text-xs">Selected</span>}
            </button>
          ))}
          {q.length >= 2 && (search.data ?? []).length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No matches</div>
          )}
        </div>
        <button
          onClick={() => assign.mutate()}
          disabled={assign.isPending || !userId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-background p-5 shadow-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}
