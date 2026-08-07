import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { ngn } from "@/lib/format";

export const Route = createFileRoute("/app/admin/payments")({
  component: PaymentsAdmin,
  head: () => ({ meta: [{ title: "Payments — Estate Guard" }] }),
});

type Tab = "overview" | "collections" | "discounts" | "orders";

function PaymentsAdmin() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const data = useQuery({
    queryKey: ["admin-payments", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [bills, payments, orders, discounts] = await Promise.all([
        supabase
          .from("bills")
          .select("id,title,amount,status,due_date,created_at,resident_id")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("id,amount,method,paid_at,bill_id,resident_id")
          .eq("estate_id", estateId!)
          .order("paid_at", { ascending: false })
          .limit(100),
        supabase
          .from("shop_orders")
          .select("id,item_name,amount_ngn,quantity,status,created_at,resident_id")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("discounts")
          .select("*")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false }),
      ]);
      if (bills.error) throw bills.error;
      if (payments.error) throw payments.error;
      if (orders.error) throw orders.error;
      if (discounts.error) throw discounts.error;
      return {
        bills: bills.data ?? [],
        payments: payments.data ?? [],
        orders: orders.data ?? [],
        discounts: discounts.data ?? [],
      };
    },
  });

  const totals = useMemo(() => {
    const rows = data.data;
    if (!rows) return null;
    const billed = rows.bills.reduce((s, b) => s + Number(b.amount ?? 0), 0);
    const collected = rows.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const outstanding = rows.bills
      .filter((b) => b.status !== "paid")
      .reduce((s, b) => s + Number(b.amount ?? 0), 0);
    const orderRevenue = rows.orders
      .filter((o) => ["completed", "ready", "processing", "confirmed"].includes(String(o.status)))
      .reduce((s, o) => s + Number(o.amount_ngn ?? 0), 0);
    return { billed, collected, outstanding, orderRevenue };
  }, [data.data]);

  const [form, setForm] = useState({ name: "", percent: 10, active: true });
  const createDiscount = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("discounts").insert({
        estate_id: estateId!,
        name: form.name.trim(),
        percent: form.percent,
        active: form.active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discount created");
      setForm({ name: "", percent: 10, active: true });
      qc.invalidateQueries({ queryKey: ["admin-payments", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin-payments", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (data.isLoading) return <ListSkeleton rows={5} />;
  if (data.isError || !data.data || !totals) return <ErrorState onRetry={() => data.refetch()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Payments</h1>
      <ScrollTabs
        value={tab}
        onChange={setTab}
        tabs={
          [
            { key: "overview", label: "Overview" },
            { key: "collections", label: "Collections" },
            { key: "discounts", label: "Discounts" },
            { key: "orders", label: "Orders" },
          ] as const
        }
      />

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Billed" value={ngn(totals.billed)} />
          <StatCard label="Collected" value={ngn(totals.collected)} tone="success" />
          <StatCard
            label="Outstanding"
            value={ngn(totals.outstanding)}
            tone={totals.outstanding ? "warning" : "default"}
          />
          <StatCard label="Shop revenue" value={ngn(totals.orderRevenue)} />
        </div>
      )}

      {tab === "collections" && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Recent payments</h2>
          {data.data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.data.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{ngn(Number(p.amount))}</div>
                    <div className="text-xs text-muted-foreground">{p.method}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(p.paid_at), "MMM d, HH:mm")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "discounts" && (
        <>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">New discount</h2>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Name"
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })}
                placeholder="% off"
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => createDiscount.mutate()}
              disabled={createDiscount.isPending}
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> Create
            </button>
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Active discounts</h2>
            {data.data.discounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No discounts yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.data.discounts.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.percent}% off</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={d.active ? "success" : "neutral"}>
                        {d.active ? "Active" : "Inactive"}
                      </StatusBadge>
                      <button
                        onClick={() => deleteDiscount.mutate(d.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "orders" && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Shop orders</h2>
          {data.data.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.data.orders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {o.item_name}{" "}
                      <span className="text-xs text-muted-foreground">×{o.quantity}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(o.created_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{ngn(Number(o.amount_ngn))}</div>
                    <StatusBadge
                      tone={
                        o.status === "completed"
                          ? "success"
                          : o.status === "cancelled"
                            ? "error"
                            : "primary"
                      }
                    >
                      {o.status}
                    </StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
