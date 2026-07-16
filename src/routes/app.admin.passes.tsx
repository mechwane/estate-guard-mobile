import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("passes");

  const q = useQuery({
    queryKey: ["admin-passes", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [passes, cards, tags] = await Promise.all([
        supabase.from("resident_passes").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false }).limit(60),
        supabase.from("access_cards").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false }),
        supabase.from("vehicle_tags").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false }),
      ]);
      if (passes.error) throw passes.error;
      if (cards.error) throw cards.error;
      if (tags.error) throw tags.error;
      return { passes: passes.data ?? [], cards: cards.data ?? [], tags: tags.data ?? [] };
    },
  });

  const [card, setCard] = useState({ card_number: "", holder_name: "", unit: "" });
  const [tag, setTag] = useState({ plate_number: "", make_model: "", holder_name: "" });

  const addCard = useMutation({
    mutationFn: async () => {
      if (!card.card_number.trim()) throw new Error("Card number required");
      const { error } = await supabase.from("access_cards").insert({
        estate_id: estateId!,
        card_number: card.card_number.trim(),
        holder_name: card.holder_name || null,
        unit: card.unit || null,
        active: true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Card added");
      setCard({ card_number: "", holder_name: "", unit: "" });
      qc.invalidateQueries({ queryKey: ["admin-passes", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTag = useMutation({
    mutationFn: async () => {
      if (!tag.plate_number.trim()) throw new Error("Plate required");
      const { error } = await supabase.from("vehicle_tags").insert({
        estate_id: estateId!,
        plate_number: tag.plate_number.trim().toUpperCase(),
        make_model: tag.make_model || null,
        holder_name: tag.holder_name || null,
        active: true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vehicle tag added");
      setTag({ plate_number: "", make_model: "", holder_name: "" });
      qc.invalidateQueries({ queryKey: ["admin-passes", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async ({ table, id }: { table: "access_cards" | "vehicle_tags"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-passes", estateId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Access passes</h1>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Resident passes" value={q.data.passes.length} />
        <StatCard label="Access cards" value={q.data.cards.length} />
        <StatCard label="Vehicle tags" value={q.data.tags.length} />
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
              {q.data.passes.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{p.code} <span className="text-xs text-muted-foreground">· {p.kind}</span></div>
                    <div className="text-xs text-muted-foreground">
                      {p.guest_name ? `${p.guest_name} · ` : ""}
                      Expires {format(new Date(p.expires_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <StatusBadge tone={p.used_at ? "success" : new Date(p.expires_at) < new Date() ? "warning" : "primary"}>
                    {p.used_at ? "Used" : new Date(p.expires_at) < new Date() ? "Expired" : "Active"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "cards" && (
        <>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Issue access card</h2>
            <div className="grid grid-cols-2 gap-2">
              <input value={card.card_number} onChange={(e) => setCard({ ...card, card_number: e.target.value })} placeholder="Card #" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
              <input value={card.holder_name} onChange={(e) => setCard({ ...card, holder_name: e.target.value })} placeholder="Holder" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
              <input value={card.unit} onChange={(e) => setCard({ ...card, unit: e.target.value })} placeholder="Unit" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
            </div>
            <button onClick={() => addCard.mutate()} disabled={addCard.isPending} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
              <Plus className="h-3.5 w-3.5" /> Issue card
            </button>
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Active cards</h2>
            {q.data.cards.length === 0 ? <p className="text-sm text-muted-foreground">No cards yet.</p> : (
              <ul className="space-y-2">
                {q.data.cards.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{c.card_number}</div>
                      <div className="text-xs text-muted-foreground">{c.holder_name ?? "—"}{c.unit ? ` · ${c.unit}` : ""}</div>
                    </div>
                    <button onClick={() => del.mutate({ table: "access_cards", id: c.id })} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "vehicles" && (
        <>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Register vehicle tag</h2>
            <div className="grid grid-cols-2 gap-2">
              <input value={tag.plate_number} onChange={(e) => setTag({ ...tag, plate_number: e.target.value })} placeholder="Plate #" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
              <input value={tag.make_model} onChange={(e) => setTag({ ...tag, make_model: e.target.value })} placeholder="Make & model" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
              <input value={tag.holder_name} onChange={(e) => setTag({ ...tag, holder_name: e.target.value })} placeholder="Owner" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
            </div>
            <button onClick={() => addTag.mutate()} disabled={addTag.isPending} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
              <Plus className="h-3.5 w-3.5" /> Register tag
            </button>
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Registered vehicles</h2>
            {q.data.tags.length === 0 ? <p className="text-sm text-muted-foreground">No vehicles yet.</p> : (
              <ul className="space-y-2">
                {q.data.tags.map((t: any) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{t.plate_number}</div>
                      <div className="text-xs text-muted-foreground">{t.make_model ?? "—"}{t.holder_name ? ` · ${t.holder_name}` : ""}</div>
                    </div>
                    <button onClick={() => del.mutate({ table: "vehicle_tags", id: t.id })} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
