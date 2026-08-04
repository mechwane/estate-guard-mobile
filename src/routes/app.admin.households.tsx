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
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((h) => (
                <Card key={h.address} className="p-3">
                  <div className="flex items-start gap-2">
                    <Home className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{h.address}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {h.members.length} occupant{h.members.length === 1 ? "" : "s"} ·{" "}
                        {h.members
                          .map((m) => m.occupant_type ?? "resident")
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .join(", ")}
                      </div>
                    </div>
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
