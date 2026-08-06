import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, ScrollTabs, SearchInput } from "@/components/ui-kit";
import { ChartCard, DonutChart } from "@/components/dashboard-charts";
import { Home } from "lucide-react";

export const Route = createFileRoute("/app/admin/households")({
  component: Households,
  head: () => ({
    meta: [
      { title: "Households — Estate Guard" },
      { name: "description", content: "Estate households grouped by address with occupancy breakdown." },
      { property: "og:title", content: "Households — Estate Guard" },
      { property: "og:description", content: "Estate households grouped by address with occupancy breakdown." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "active" | "pending" | "disabled";
const TABS = [
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "disabled", label: "Disabled" },
] as const;

type Row = {
  id: string;
  full_name: string;
  approved: boolean;
  verification_status: string;
  occupant_type: string | null;
  block: string | null;
  street: string | null;
  house_number: string | null;
  unit: string | null;
};

const addressOf = (p: Row) =>
  [p.street || p.block, p.house_number ? `No ${p.house_number}` : null, p.unit ? `Unit ${p.unit}` : null]
    .filter(Boolean)
    .join(", ") || "Unassigned address";

function Households() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [tab, setTab] = useState<Tab>("active");
  const [q, setQ] = useState("");

  const rows = useQuery({
    queryKey: ["admin-households", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,approved,verification_status,occupant_type,block,street,house_number,unit")
        .eq("estate_id", estateId!)
        .order("street", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const all = rows.data ?? [];

  const households = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const p of all) {
      const key = addressOf(p);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].map(([address, members]) => ({
      address,
      members,
      status: members.some((m) => m.approved)
        ? "active"
        : members.some((m) => m.verification_status === "pending")
          ? "pending"
          : "disabled",
    }));
  }, [all]);

  const counts = useMemo(
    () => ({
      active: households.filter((h) => h.status === "active").length,
      pending: households.filter((h) => h.status === "pending").length,
      disabled: households.filter((h) => h.status === "disabled").length,
    }),
    [households],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return households
      .filter((h) => h.status === tab)
      .filter((h) => !needle || h.address.toLowerCase().includes(needle));
  }, [households, tab, q]);

  const occupants = useMemo(() => {
    const acc = new Map<string, number>();
    for (const p of all) {
      const k = p.occupant_type ?? "unspecified";
      acc.set(k, (acc.get(k) ?? 0) + 1);
    }
    return [...acc.entries()].map(([name, value]) => ({ name, value }));
  }, [all]);

  const houseTypes = useMemo(
    () => [
      { name: "Active", value: counts.active },
      { name: "Pending", value: counts.pending },
      { name: "Disabled", value: counts.disabled },
    ],
    [counts],
  );

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
            <div className="min-w-0">
              <ScrollTabs
                value={tab}
                onChange={setTab}
                tabs={TABS.map((t) => ({ key: t.key, label: `${t.label} ${counts[t.key]}` }))}
              />
            </div>
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="Search households by address" />

          {rows.isLoading ? (
            <ListSkeleton rows={6} />
          ) : rows.isError ? (
            <ErrorState onRetry={() => rows.refetch()} />
          ) : visible.length === 0 ? (
            <EmptyState title="No households" icon={<Home className="h-6 w-6" />} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((h) => (
                <Card key={h.address} className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Home className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="line-clamp-2 break-words text-sm font-medium leading-snug">
                          {h.address}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {h.members.length} occupant{h.members.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                        h.status === "active"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : h.status === "pending"
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(h.members.map((m) => m.occupant_type ?? "resident"))].map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto truncate border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                    {h.members.map((m) => m.full_name).join(", ")}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <ChartCard title="Households">
            <DonutChart data={houseTypes} />
          </ChartCard>
          <ChartCard title="Occupants">
            <DonutChart data={occupants} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
