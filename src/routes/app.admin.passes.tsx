import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, StatCard, StatusBadge } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/passes")({
  component: PassesAdmin,
  head: () => ({ meta: [{ title: "Access Passes — Estate Guard" }] }),
});

type Tab = "passes" | "cards" | "vehicles";

function PassesAdmin() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [tab, setTab] = useState<Tab>("passes");

  const q = useQuery({
    queryKey: ["admin-passes", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [passes, cards, tags, residents] = await Promise.all([
        supabase.from("resident_passes").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false }).limit(80),
        supabase.from("access_cards").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false }),
        supabase.from("vehicle_tags").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name,unit").eq("estate_id", estateId!),
      ]);
      if (passes.error) throw passes.error;
      if (cards.error) throw cards.error;
      if (tags.error) throw tags.error;
      const nameMap = new Map((residents.data ?? []).map((r) => [r.id, { name: r.full_name, unit: r.unit }]));
      return { passes: passes.data ?? [], cards: cards.data ?? [], tags: tags.data ?? [], nameMap };
    },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Access passes</h1>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Resident passes" value={q.data.passes.length} />
        <StatCard label="Access cards" value={q.data.cards.filter((c) => c.active).length} />
        <StatCard label="Vehicle tags" value={q.data.tags.filter((t) => t.active).length} />
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1">
        {(["passes", "cards", "vehicles"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-2 py-2 text-xs font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "passes" && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Recent resident passes</h2>
          {q.data.passes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resident passes yet.</p>
          ) : (
            <ul className="space-y-2">
              {q.data.passes.map((p) => {
                const host = q.data.nameMap.get(p.resident_id);
                return (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono font-semibold tracking-widest">{p.code}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.kind}{p.guest_name ? ` · ${p.guest_name}` : ""} · {host?.name ?? "Resident"}
                        {host?.unit ? ` · ${host.unit}` : ""} · exp {format(new Date(p.expires_at), "MMM d, HH:mm")}
                      </div>
                    </div>
                    <StatusBadge tone={p.used_at ? "success" : new Date(p.expires_at) < new Date() ? "warning" : "primary"}>
                      {p.used_at ? "Used" : new Date(p.expires_at) < new Date() ? "Expired" : "Active"}
                    </StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "cards" && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Access cards</h2>
          {q.data.cards.length === 0 ? <p className="text-sm text-muted-foreground">No cards issued yet.</p> : (
            <ul className="space-y-2">
              {q.data.cards.map((c) => {
                const host = q.data.nameMap.get(c.resident_id);
                return (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{c.card_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {host?.name ?? "—"}{host?.unit ? ` · ${host.unit}` : ""}
                        {c.notes ? ` · ${c.notes}` : ""}
                      </div>
                    </div>
                    <StatusBadge tone={c.active ? "success" : "neutral"}>{c.active ? "Active" : "Revoked"}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "vehicles" && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Vehicle tags</h2>
          {q.data.tags.length === 0 ? <p className="text-sm text-muted-foreground">No vehicles registered.</p> : (
            <ul className="space-y-2">
              {q.data.tags.map((t) => {
                const host = q.data.nameMap.get(t.resident_id);
                return (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{t.plate}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.make_model ?? "—"}{t.color ? ` · ${t.color}` : ""} · {host?.name ?? "—"}
                        {t.tag_number ? ` · tag ${t.tag_number}` : ""}
                      </div>
                    </div>
                    <StatusBadge tone={t.active ? "success" : "neutral"}>{t.active ? "Active" : "Revoked"}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
