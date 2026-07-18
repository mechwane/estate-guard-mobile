import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, StatusBadge } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/cards")({
  component: AccessCards,
  head: () => ({ meta: [{ title: "Access Cards — Estate Guard" }] }),
});

function AccessCards() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [residentId, setResidentId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [notes, setNotes] = useState("");

  const residents = useQuery({
    queryKey: ["admin-residents-for-cards", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id,full_name,unit")
        .eq("estate_id", estateId!).order("full_name");
      if (error) throw error; return data ?? [];
    },
  });

  const cards = useQuery({
    queryKey: ["admin-access-cards", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_cards").select("*").eq("estate_id", estateId!).order("issued_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const issue = useMutation({
    mutationFn: async () => {
      if (!residentId || !cardNumber.trim()) throw new Error("Resident and card number required");
      const { error } = await supabase.from("access_cards").insert({
        estate_id: estateId!, resident_id: residentId, card_number: cardNumber.trim(), notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Card issued"); setCardNumber(""); setNotes(""); qc.invalidateQueries({ queryKey: ["admin-access-cards", estateId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("access_cards").update({ active, revoked_at: active ? null : new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-access-cards", estateId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("access_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["admin-access-cards", estateId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  const residentName = (id: string) => residents.data?.find((r) => r.id === id)?.full_name ?? id.slice(0, 8);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Access cards</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Issue a card</h2>
        <div className="grid grid-cols-2 gap-2">
          <select value={residentId} onChange={(e) => setResidentId(e.target.value)} className="col-span-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <option value="">Select resident…</option>
            {(residents.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.full_name} {r.unit ? `· ${r.unit}` : ""}</option>)}
          </select>
          <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="Card number" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <button onClick={() => issue.mutate()} disabled={issue.isPending} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
          {issue.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Issue card
        </button>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Cards ({cards.data?.length ?? 0})</h2>
        {cards.isLoading ? <ListSkeleton rows={3} /> : cards.isError ? <ErrorState onRetry={() => cards.refetch()} /> : (cards.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No cards issued.</p>
        ) : (
          <ul className="space-y-2">
            {(cards.data ?? []).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-mono font-medium">{c.card_number}</div>
                  <div className="text-xs text-muted-foreground truncate">{residentName(c.resident_id)} · {formatDistanceToNow(new Date(c.issued_at), { addSuffix: true })}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={c.active ? "success" : "warning"}>{c.active ? "Active" : "Revoked"}</StatusBadge>
                  <button onClick={() => toggle.mutate({ id: c.id, active: !c.active })} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">{c.active ? "Revoke" : "Restore"}</button>
                  <button onClick={() => remove.mutate(c.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
