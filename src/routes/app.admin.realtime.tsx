import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Car, Footprints, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/realtime")({
  component: RealtimeAccess,
  head: () => ({
    meta: [
      { title: "Realtime Access — Estate Guard" },
      {
        name: "description",
        content:
          "Live pedestrian and vehicle entry/exit movement across your estate gates, updated in realtime.",
      },
      { property: "og:title", content: "Realtime Access — Estate Guard" },
      {
        property: "og:description",
        content: "Live pedestrian and vehicle entry/exit movement across your estate gates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Movement = {
  key: string;
  ts: string;
  name: string;
  detail: string;
  vehicle: boolean;
  direction: "in" | "out";
  source: "guest" | "pass";
};

type Range = "today" | "24h" | "7d";

function ColumnHeader({
  icon,
  label,
  count,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: "success" | "neutral" | "primary" | "warning";
}) {
  const bg = {
    success: "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]",
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    warning: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
  }[tone];
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${bg}`}>{icon}</span>
        <h2 className="truncate text-sm font-semibold">{label}</h2>
      </div>
      <StatusBadge tone={tone}>{count}</StatusBadge>
    </div>
  );
}

function MovementColumn({
  icon,
  label,
  tone,
  rows,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "success" | "neutral" | "primary" | "warning";
  rows: Movement[];
}) {
  return (
    <Card className="flex min-h-[220px] flex-col">
      <ColumnHeader icon={icon} label={label} count={rows.length} tone={tone} />
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No movement recorded.</p>
      ) : (
        <ul className="scroll-y -mr-1 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {rows.slice(0, 40).map((m) => (
            <li
              key={m.key}
              className="page-enter rounded-lg border border-border/60 bg-card px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.detail}</div>
                </div>
                <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                  {format(new Date(m.ts), "HH:mm")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RealtimeAccess() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>("today");

  const sinceIso = useMemo(() => {
    const days = range === "7d" ? 7 : 1;
    if (range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  }, [range]);

  const feed = useQuery({
    queryKey: ["admin-realtime-feed", estateId, range],
    enabled: !!estateId,
    queryFn: async () => {
      const [guests, passes] = await Promise.all([
        supabase
          .from("guest_invites")
          .select(
            "id,guest_name,code,status,checked_in_at,checked_out_at,vehicle_number,num_guests,purpose,created_at",
          )
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("resident_passes")
          .select("id,code,kind,guest_name,used_at,created_at")
          .eq("estate_id", estateId!)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (guests.error) throw guests.error;
      if (passes.error) throw passes.error;
      return { guests: guests.data ?? [], passes: passes.data ?? [] };
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!estateId) return;
    const ch = supabase
      .channel(`realtime-access-${estateId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guest_invites",
          filter: `estate_id=eq.${estateId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["admin-realtime-feed", estateId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resident_passes",
          filter: `estate_id=eq.${estateId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["admin-realtime-feed", estateId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [estateId, qc]);

  const movements = useMemo<Movement[]>(() => {
    if (!feed.data) return [];
    const since = new Date(sinceIso).getTime();
    const rows: Movement[] = [];
    for (const g of feed.data.guests) {
      const vehicle = !!g.vehicle_number;
      const detailBase = [
        g.vehicle_number ? `Vehicle ${g.vehicle_number}` : "On foot",
        g.num_guests && g.num_guests > 1 ? `${g.num_guests} guests` : null,
        g.purpose || null,
        `Code ${g.code}`,
      ]
        .filter(Boolean)
        .join(" · ");
      if (g.checked_in_at && new Date(g.checked_in_at).getTime() >= since) {
        rows.push({
          key: `gi-${g.id}`,
          ts: g.checked_in_at,
          name: g.guest_name ?? "Guest",
          detail: detailBase,
          vehicle,
          direction: "in",
          source: "guest",
        });
      }
      if (g.checked_out_at && new Date(g.checked_out_at).getTime() >= since) {
        rows.push({
          key: `go-${g.id}`,
          ts: g.checked_out_at,
          name: g.guest_name ?? "Guest",
          detail: detailBase,
          vehicle,
          direction: "out",
          source: "guest",
        });
      }
    }
    for (const p of feed.data.passes) {
      if (!p.used_at || new Date(p.used_at).getTime() < since) continue;
      rows.push({
        key: `p-${p.id}`,
        ts: p.used_at,
        name: p.guest_name ?? (p.kind === "self" ? "Resident pass" : "Guest pass"),
        detail: `Resident pass · Code ${p.code}`,
        vehicle: false,
        direction: "in",
        source: "pass",
      });
    }
    return rows.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [feed.data, sinceIso]);

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (feed.isLoading) return <ListSkeleton rows={5} />;
  if (feed.isError || !feed.data) return <ErrorState onRetry={() => feed.refetch()} />;

  const pedIn = movements.filter((m) => !m.vehicle && m.direction === "in");
  const pedOut = movements.filter((m) => !m.vehicle && m.direction === "out");
  const vehIn = movements.filter((m) => m.vehicle && m.direction === "in");
  const vehOut = movements.filter((m) => m.vehicle && m.direction === "out");

  const inside = feed.data.guests.filter((g) => g.checked_in_at && !g.checked_out_at);
  const entriesToday = feed.data.guests.filter(
    (g) => g.checked_in_at && isToday(new Date(g.checked_in_at)),
  ).length;
  const exitsToday = feed.data.guests.filter(
    (g) => g.checked_out_at && isToday(new Date(g.checked_out_at)),
  ).length;

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Realtime access</h1>
        <div className="flex items-center gap-2">
          <ScrollTabs
            value={range}
            onChange={setRange}
            tabs={
              [
                { key: "today", label: "Today" },
                { key: "24h", label: "24 hours" },
                { key: "7d", label: "7 days" },
              ] as const
            }
          />
          <button
            onClick={() => feed.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${feed.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Inside now" value={inside.length} tone={inside.length ? "primary" : "default"} />
        <StatCard label="Entries today" value={entriesToday} tone="success" />
        <StatCard label="Exits today" value={exitsToday} />
        <StatCard label="Pedestrian traffic" value={pedIn.length + pedOut.length} />
        <StatCard label="Vehicle traffic" value={vehIn.length + vehOut.length} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MovementColumn
          icon={<Footprints className="h-4 w-4" />}
          label="Pedestrian In"
          tone="success"
          rows={pedIn}
        />
        <MovementColumn
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Pedestrian Out"
          tone="neutral"
          rows={pedOut}
        />
        <MovementColumn
          icon={<Car className="h-4 w-4" />}
          label="Vehicle In"
          tone="primary"
          rows={vehIn}
        />
        <MovementColumn
          icon={<ArrowDownLeft className="h-4 w-4" />}
          label="Vehicle Out"
          tone="warning"
          rows={vehOut}
        />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Currently inside ({inside.length})</h2>
        {inside.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is checked in right now.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {inside.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{g.guest_name ?? "Guest"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {g.vehicle_number ? `Vehicle ${g.vehicle_number}` : "On foot"} · since{" "}
                    {formatDistanceToNow(new Date(g.checked_in_at!), { addSuffix: true })}
                  </div>
                </div>
                <StatusBadge tone="success">Inside</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
