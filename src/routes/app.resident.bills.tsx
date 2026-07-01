import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { Receipt } from "lucide-react";
import { format, isBefore } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/bills")({
  component: Bills,
});

type Tab = "unpaid" | "paid" | "overdue";

function Bills() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("unpaid");

  const { data } = useQuery({
    queryKey: ["bills", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("resident_id", session!.userId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const pay = useMutation({
    mutationFn: async (billId: string) => {
      const bill = (data ?? []).find((b) => b.id === billId);
      if (!bill || !session?.userId || !session.estate?.id) throw new Error("Missing context");
      const { error } = await supabase.from("bills").update({ status: "paid" }).eq("id", billId);
      if (error) throw error;
      await supabase.from("payments").insert({
        bill_id: billId,
        estate_id: session.estate.id,
        resident_id: session.userId,
        amount: bill.amount,
        method: "manual",
      });
      await supabase.from("audit_logs").insert({
        estate_id: session.estate.id,
        actor_id: session.userId,
        action: "bill.paid",
        entity: "bills",
        entity_id: billId,
        metadata: { amount: bill.amount },
      });
    },
    onSuccess: () => { toast.success("Marked paid"); qc.invalidateQueries({ queryKey: ["bills"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const list = data ?? [];
    const now = new Date();
    return {
      unpaid: list.filter((b) => b.status === "unpaid" && !isBefore(new Date(b.due_date), now)),
      paid: list.filter((b) => b.status === "paid"),
      overdue: list.filter((b) => b.status === "unpaid" && isBefore(new Date(b.due_date), now)),
    };
  }, [data]);

  const current = grouped[tab];

  return (
    <div className="space-y-4">
      <div className="card-surface flex items-center justify-between p-1.5">
        {(["unpaid", "overdue", "paid"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t} ({grouped[t].length})
          </button>
        ))}
      </div>

      {current.length === 0 ? (
        <EmptyState title={`No ${tab} bills`} icon={<Receipt className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {current.map((b) => {
            const overdue = tab === "overdue";
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{b.title}</div>
                    {b.description && <div className="mt-0.5 text-xs text-muted-foreground">{b.description}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">Due {format(new Date(b.due_date), "MMM d, yyyy")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold tabular-nums text-foreground">₦{Number(b.amount).toLocaleString()}</div>
                    <StatusBadge tone={b.status === "paid" ? "success" : overdue ? "error" : "warning"}>
                      {overdue ? "overdue" : b.status}
                    </StatusBadge>
                  </div>
                </div>
                {b.status !== "paid" && (
                  <button
                    disabled={pay.isPending}
                    onClick={() => pay.mutate(b.id)}
                    className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                  >
                    Mark as paid
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
