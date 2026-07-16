import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, StatCard, StatusBadge } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/realtime")({
  component: RealtimeAccess,
  head: () => ({ meta: [{ title: "Realtime Access — Estate Guard" }] }),
});

function RealtimeAccess() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();

  const feed = useQuery({
    queryKey: ["admin-realtime-feed", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [guests, passes] = await Promise.all([
        supabase
          .from("guest_invites")
          .select("id,guest_name,code,status,checked_in_at,checked_out_at,expires_at,vehicle_number,created_at")
          .eq("estate_id", estateId!)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("resident_passes")
          .select("id,code,kind,guest_name,used_at,expires_at,created_at")
          .eq("estate_id", estateId!)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(80),
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
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_invites", filter: `estate_id=eq.${estateId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-realtime-feed", estateId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "resident_passes", filter: `estate_id=eq.${estateId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-realtime-feed", estateId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [estateId, qc]);

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (feed.isLoading) return <ListSkeleton rows={5} />;
  if (feed.isError || !feed.data) return <ErrorState onRetry={() => feed.refetch()} />;

  const inside = feed.data.guests.filter((g) => g.checked_in_at && !g.checked_out_at);
  const entriesToday = feed.data.guests.filter(
    (g) => g.checked_in_at && new Date(g.checked_in_at).toDateString() === new Date().toDateString(),
  );
  const exitsToday = feed.data.guests.filter(
    (g) => g.checked_out_at && new Date(g.checked_out_at).toDateString() === new Date().toDateString(),
  );
  const passUses = feed.data.passes.filter((p) => p.used_at).length;

  const events = [
    ...feed.data.guests.flatMap((g) => {
      const rows: { key: string; ts: string; label: string; sub: string; tone: "success" | "warning" | "neutral" | "primary" }[] = [];
      if (g.checked_in_at) rows.push({ key: `gi-${g.id}`, ts: g.checked_in_at, label: `Check-in · ${g.guest_name ?? "Guest"}`, sub: `Code ${g.code}${g.vehicle_number ? ` · ${g.vehicle_number}` : ""}`, tone: "success" });
      if (g.checked_out_at) rows.push({ key: `go-${g.id}`, ts: g.checked_out_at, label: `Check-out · ${g.guest_name ?? "Guest"}`, sub: `Code ${g.code}`, tone: "neutral" });
      if (!g.checked_in_at) rows.push({ key: `gc-${g.id}`, ts: g.created_at, label: `Invite created · ${g.guest_name ?? "Guest"}`, sub: `Code ${g.code}`, tone: "primary" });
      return rows;
    }),
    ...feed.data.passes.map((p) => ({
      key: `p-${p.id}`,
      ts: p.used_at ?? p.created_at,
      label: p.used_at ? `Resident pass used (${p.kind})` : `Resident pass issued (${p.kind})`,
      sub: `Code ${p.code}${p.guest_name ? ` · ${p.guest_name}` : ""}`,
      tone: (p.used_at ? "success" : "primary") as "success" | "primary",
    })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Realtime access</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Inside now" value={inside.length} tone={inside.length ? "primary" : "default"} />
        <StatCard label="Entries today" value={entriesToday.length} />
        <StatCard label="Exits today" value={exitsToday.length} />
        <StatCard label="Pass uses (24h)" value={passUses} />
      </div>

      {inside.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Currently inside</h2>
          <div className="space-y-2">
            {inside.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{g.guest_name ?? "Guest"}</div>
                  <div className="text-xs text-muted-foreground">Since {formatDistanceToNow(new Date(g.checked_in_at!), { addSuffix: true })}</div>
                </div>
                <StatusBadge tone="success">Inside</StatusBadge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Live activity (last 24h)</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded.</p>
        ) : (
          <ul className="space-y-2">
            {events.slice(0, 80).map((e) => (
              <li key={e.key} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{e.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.sub}</div>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge tone={e.tone}>{formatDistanceToNow(new Date(e.ts), { addSuffix: true })}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
