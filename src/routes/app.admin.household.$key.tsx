import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SectionTitle,
  StatusBadge,
} from "@/components/ui-kit";
import { addressOf, houseTypeOf, matchesAddressKey, type HouseholdProfile } from "@/lib/households";
import { initialsFor, useAvatarUrls } from "@/lib/avatar";
import { friendlyAction } from "@/lib/activity-feed";
import { ArrowLeft, Home, Phone, ReceiptText, Users } from "lucide-react";

export const Route = createFileRoute("/app/admin/household/$key")({
  component: HouseholdDetail,
  head: () => ({
    meta: [
      { title: "Household — Estate Guard" },
      { name: "description", content: "Household details, occupants and status for one estate address." },
      { property: "og:title", content: "Household — Estate Guard" },
      {
        property: "og:description",
        content: "Household details, occupants and status for one estate address.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type MemberRow = HouseholdProfile & { avatar_url: string | null; phone: string | null };

const money = (n: number) => `₦${Number(n || 0).toLocaleString()}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function HouseholdDetail() {
  const { key } = Route.useParams();
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const rows = useQuery({
    queryKey: ["household-detail", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,full_name,approved,verification_status,occupant_type,block,street,house_number,unit,avatar_url,phone",
        )
        .eq("estate_id", estateId!);
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });

  const household = useMemo(() => {
    const members = (rows.data ?? []).filter((p) => matchesAddressKey(addressOf(p), key));
    if (members.length === 0) return null;
    const address = addressOf(members[0]!);
    return {
      address,
      members,
      status: members.some((m) => m.approved)
        ? "active"
        : members.some((m) => m.verification_status === "rejected")
          ? "disapproved"
          : "disabled",
    };
  }, [rows.data, key]);

  const memberIds = household?.members.map((m) => m.id) ?? [];
  const avatars = useAvatarUrls(household?.members.map((m) => m.avatar_url) ?? []);

  const billing = useQuery({
    queryKey: ["household-billing", estateId, memberIds.join(",")],
    enabled: !!estateId && memberIds.length > 0,
    queryFn: async () => {
      const [bills, pays] = await Promise.all([
        supabase
          .from("bills")
          .select("id,resident_id,title,amount,status,due_date")
          .eq("estate_id", estateId!)
          .in("resident_id", memberIds)
          .order("due_date", { ascending: false })
          .limit(30),
        supabase
          .from("payments")
          .select("id,resident_id,amount,method,paid_at")
          .eq("estate_id", estateId!)
          .in("resident_id", memberIds)
          .order("paid_at", { ascending: false })
          .limit(15),
      ]);
      if (bills.error) throw bills.error;
      if (pays.error) throw pays.error;
      return { bills: bills.data ?? [], payments: pays.data ?? [] };
    },
  });

  const activity = useQuery({
    queryKey: ["household-activity", estateId, memberIds.join(",")],
    enabled: !!estateId && memberIds.length > 0,
    queryFn: async () => {
      const [logs, guests] = await Promise.all([
        supabase
          .from("audit_logs")
          .select("id,action,entity,actor_id,created_at")
          .eq("estate_id", estateId!)
          .in("actor_id", memberIds)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("guest_invites")
          .select("id,resident_id,guest_name,code,checked_in_at,checked_out_at")
          .eq("estate_id", estateId!)
          .in("resident_id", memberIds)
          .order("updated_at", { ascending: false })
          .limit(15),
      ]);
      const items: { id: string; title: string; description: string; at: string }[] = [];
      for (const g of guests.data ?? []) {
        if (g.checked_in_at)
          items.push({
            id: `${g.id}-in`,
            title: "New Check In",
            description: `${g.guest_name} checked in · ${g.code}`,
            at: g.checked_in_at,
          });
        if (g.checked_out_at)
          items.push({
            id: `${g.id}-out`,
            title: "New Check Out",
            description: `${g.guest_name} checked out · ${g.code}`,
            at: g.checked_out_at,
          });
      }
      for (const l of logs.data ?? [])
        items.push({
          id: `log-${l.id}`,
          title: friendlyAction(l.action),
          description: l.entity ?? "Estate record updated",
          at: l.created_at,
        });
      return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 12);
    },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (rows.isLoading) return <ListSkeleton rows={6} />;
  if (rows.isError) return <ErrorState onRetry={() => rows.refetch()} />;
  if (!household) return <EmptyState title="Household not found" icon={<Home className="h-6 w-6" />} />;

  const first = household.members[0]!;
  const bills = billing.data?.bills ?? [];
  const payments = billing.data?.payments ?? [];
  const outstanding = bills
    .filter((b) => b.status !== "paid" && b.status !== "waived")
    .reduce((s, b) => s + Number(b.amount), 0);
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <Link
        to="/app/admin/households"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Households
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Home className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{household.address}</h1>
            <p className="text-xs text-muted-foreground">
              {houseTypeOf(household.address)} · {household.members.length} occupant
              {household.members.length === 1 ? "" : "s"}
            </p>
          </div>
          <StatusBadge
            tone={
              household.status === "active"
                ? "success"
                : household.status === "disapproved"
                  ? "error"
                  : "neutral"
            }
          >
            {household.status}
          </StatusBadge>
        </div>
        <dl className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["House type", houseTypeOf(household.address)],
            ["Street", first.street ?? "—"],
            ["House number", first.house_number ?? "—"],
            ["Block", first.block ?? "—"],
            ["Unit", first.unit ?? "—"],
            ["Occupants", String(household.members.length)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <SectionTitle>Occupants</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {household.members.map((m) => {
                const src = m.avatar_url ? avatars[m.avatar_url] : undefined;
                return (
                  <Card key={m.id} className="flex items-center gap-3 p-3">
                    <Link
                      to="/app/admin/resident/$id"
                      params={{ id: m.id }}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={m.full_name}
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                          {initialsFor(m.full_name)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{m.full_name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {m.occupant_type === "commercial" ? "Commercial" : "Resident"} ·{" "}
                          {m.approved ? "Active" : "Inactive"}
                        </span>
                      </span>
                    </Link>
                    {m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        aria-label={`Call ${m.full_name}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <SectionTitle>Billing</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Card className="p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Outstanding
                </div>
                <div className="text-lg font-semibold">{money(outstanding)}</div>
              </Card>
              <Card className="p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Paid to date
                </div>
                <div className="text-lg font-semibold text-emerald-600">{money(paid)}</div>
              </Card>
            </div>
            {billing.isLoading ? (
              <ListSkeleton rows={3} />
            ) : bills.length === 0 ? (
              <EmptyState title="No bills yet" icon={<ReceiptText className="h-6 w-6" />} />
            ) : (
              <Card className="divide-y divide-border">
                {bills.slice(0, 8).map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{b.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Due {new Date(b.due_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold">{money(Number(b.amount))}</div>
                    <StatusBadge
                      tone={b.status === "paid" ? "success" : b.status === "waived" ? "neutral" : "warning"}
                    >
                      {b.status}
                    </StatusBadge>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <SectionTitle>Recent activity</SectionTitle>
          {activity.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState title="No activity yet" icon={<Users className="h-6 w-6" />} />
          ) : (
            <div className="space-y-2">
              {(activity.data ?? []).map((a) => (
                <Card key={a.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{a.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{when(a.at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.description}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
