import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, StatusBadge } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/discounts")({
  component: Discounts,
  head: () => ({ meta: [{ title: "Discounts — Estate Guard" }] }),
});

function Discounts() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [percent, setPercent] = useState(10);

  const rows = useQuery({
    queryKey: ["admin-discounts", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("discounts").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim() || percent <= 0 || percent > 100) throw new Error("Name and percent (1-100) required");
      const { error } = await supabase.from("discounts").insert({ estate_id: estateId!, name: name.trim(), percent, created_by: session?.userId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Discount added"); setName(""); setPercent(10); qc.invalidateQueries({ queryKey: ["admin-discounts", estateId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("discounts").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-discounts", estateId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["admin-discounts", estateId] }); },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Discounts</h1>
      <Card>
        <h2 className="mb-3 text-sm font-semibold">New discount</h2>
        <div className="grid grid-cols-3 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Early bird)" className="col-span-2 rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <input type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <button onClick={() => add.mutate()} disabled={add.isPending} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
          {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
        </button>
      </Card>

      <Card>
        {rows.isLoading ? <ListSkeleton rows={3} /> : rows.isError ? <ErrorState onRetry={() => rows.refetch()} /> : (rows.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No discounts yet.</p>
        ) : (
          <ul className="space-y-2">
            {(rows.data ?? []).map((d: any) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.percent}% off</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={d.active ? "success" : "neutral"}>{d.active ? "Active" : "Off"}</StatusBadge>
                  <button onClick={() => toggle.mutate({ id: d.id, active: !d.active })} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">{d.active ? "Disable" : "Enable"}</button>
                  <button onClick={() => remove.mutate(d.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
