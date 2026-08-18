import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
} from "@/components/ui-kit";
import { ChartCard, DonutChart } from "@/components/dashboard-charts";
import { Download, Home } from "lucide-react";
import { addressKey, addressOf, houseTypeOf, type HouseholdProfile } from "@/lib/households";

export const Route = createFileRoute("/app/admin/households")({
  component: Households,
  head: () => ({
    meta: [
      { title: "Households — Estate Guard" },
      {
        name: "description",
        content: "Estate households grouped by address with occupancy breakdown.",
      },
      { property: "og:title", content: "Households — Estate Guard" },
      {
        property: "og:description",
        content: "Estate households grouped by address with occupancy breakdown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "active" | "disabled" | "disapproved";
const TABS = [
  { key: "active", label: "Active" },
  { key: "disabled", label: "Disabled" },
  { key: "disapproved", label: "Disapproved" },
] as const;

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
        .select(
          "id,full_name,approved,verification_status,occupant_type,block,street,house_number,unit",
        )
        .eq("estate_id", estateId!)
        .order("street", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HouseholdProfile[];
    },
  });

  const all = rows.data ?? [];

  const households = useMemo(() => {
    const map = new Map<string, HouseholdProfile[]>();
    for (const p of all) {
      const key = addressOf(p);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()]
      .map(([address, members]) => ({
        address,
        members,
        status: members.some((m) => m.approved)
          ? ("active" as const)
          : members.some((m) => m.verification_status === "rejected")
            ? ("disapproved" as const)
            : ("disabled" as const),
      }))
      .sort((a, b) => a.address.localeCompare(b.address));
  }, [all]);

  const counts = useMemo(
    () => ({
      active: households.filter((h) => h.status === "active").length,
      disabled: households.filter((h) => h.status === "disabled").length,
      disapproved: households.filter((h) => h.status === "disapproved").length,
    }),
    [households],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return households
      .filter((h) => h.status === tab)
      .filter(
        (h) =>
          !needle ||
          h.address.toLowerCase().includes(needle) ||
          h.members.some((m) => m.full_name.toLowerCase().includes(needle)),
      );
  }, [households, tab, q]);

  const houseTypes = useMemo(() => {
    const acc = new Map<string, number>();
    for (const h of households) {
      const t = houseTypeOf(h.address);
      acc.set(t, (acc.get(t) ?? 0) + 1);
    }
    return [...acc.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [households]);

  const occupants = useMemo(() => {
    const acc = new Map<string, number>();
    for (const p of all) {
      const k = p.occupant_type === "commercial" ? "Commercial" : "Resident";
      acc.set(k, (acc.get(k) ?? 0) + 1);
    }
    return [...acc.entries()].map(([name, value]) => ({ name, value }));
  }, [all]);

  const downloadReport = () => {
    const header = "Address,House type,Status,Occupants,Occupant names\n";
    const body = households
      .map((h) =>
        [
          `"${h.address}"`,
          houseTypeOf(h.address),
          h.status,
          h.members.length,
          `"${h.members.map((m) => m.full_name).join("; ")}"`,
        ].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `households-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <ScrollTabs
              value={tab}
              onChange={setTab}
              tabs={TABS.map((t) => ({ key: t.key, label: `${t.label} ${counts[t.key]}` }))}
            />
          </div>
          <button
            onClick={downloadReport}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download Report
          </button>
        </div>

        <SearchInput value={q} onChange={setQ} placeholder="Search address or occupant" />

        {rows.isLoading ? (
          <ListSkeleton rows={8} />
        ) : rows.isError ? (
          <ErrorState onRetry={() => rows.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState title="No households" icon={<Home className="h-6 w-6" />} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((h) => (
              <Link
                key={h.address}
                to="/app/admin/household/$key"
                params={{ key: addressKey(h.address) }}
                className="block"
              >
                <Card className="flex items-center gap-2 p-3 transition hover:border-primary/40 hover:bg-muted/40">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Home className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.address}</span>
                  {h.members.length > 1 && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {h.members.length}
                    </span>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <ChartCard title="Houses">
          <DonutChart data={houseTypes} />
        </ChartCard>
        <ChartCard title="Occupants">
          <DonutChart data={occupants} />
        </ChartCard>
      </div>
    </div>
  );
}
