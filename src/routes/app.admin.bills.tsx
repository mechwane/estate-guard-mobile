import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { Receipt, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore } from "date-fns";

export const Route = createFileRoute("/app/admin/bills")({
  component: AdminBills,
});

function AdminBills() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const estateId = session?.estate?.id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", amount: "", due_date: "", resident_id: "" });

  const { data: residents } = useQuery({
    queryKey: ["admin-resident-select", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,unit").eq("estate_id", estateId!).order("full_name");
      return data ?? [];
    },
  });

  const { data: bills } = useQuery({
    queryKey: ["admin-bills", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*").eq("estate_id", estateId!).order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!session?.userId || !estateId) throw new Error("Missing context");
      const { error, data } = await supabase.from("bills").insert({
        estate_id: estateId,
        resident_id: form.resident_id,
        created_by: session.userId,
        title: form.title,
        description: form.description || null,
        amount: Number(form.amount),
        due_date: form.due_date,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({ estate_id: estateId, actor_id: session.userId, action: "bill.created", entity: "bills", entity_id: data.id });
    },
    onSuccess: () => {
      toast.success("Bill created");
      setOpen(false);
      setForm({ title: "", description: "", amount: "", due_date: "", resident_id: "" });
      qc.invalidateQueries({ queryKey: ["admin-bills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!open ? (
        <button onClick={() => setOpen(true)} className="card-surface flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-muted/40">
          <Plus className="h-4 w-4" /> Create bill
        </button>
      ) : (
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
            <select required value={form.resident_id} onChange={(e) => setForm({ ...form, resident_id: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none">
              <option value="">Select resident</option>
              {(residents ?? []).map((r) => <option key={r.id} value={r.id}>{r.full_name}{r.unit ? ` · ${r.unit}` : ""}</option>)}
            </select>
            <input required placeholder="Title (e.g. Service charge)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            <input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input required type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none" />
              <input required type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
              <button disabled={create.isPending} type="submit" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </form>
        </Card>
      )}

      {(bills ?? []).length === 0 ? (
        <EmptyState title="No bills yet" icon={<Receipt className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {bills!.map((b) => {
            const overdue = b.status === "unpaid" && isBefore(new Date(b.due_date), new Date());
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{b.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Due {format(new Date(b.due_date), "MMM d, yyyy")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-foreground">₦{Number(b.amount).toLocaleString()}</div>
                    <StatusBadge tone={b.status === "paid" ? "success" : overdue ? "error" : "warning"}>{overdue ? "overdue" : b.status}</StatusBadge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
