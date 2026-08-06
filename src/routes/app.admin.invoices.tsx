import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isBefore } from "date-fns";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { ngn } from "@/lib/format";

export const Route = createFileRoute("/app/admin/invoices")({
  component: AdminInvoices,
  head: () => ({
    meta: [
      { title: "Invoices — Estate Guard" },
      {
        name: "description",
        content:
          "Every resident invoice in your estate: filter by paid, unpaid or overdue, record offline payments and export records.",
      },
      { property: "og:title", content: "Invoices — Estate Guard" },
      {
        property: "og:description",
        content: "Filter resident invoices, record offline payments and export records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "all" | "unpaid" | "overdue" | "paid";

function AdminInvoices() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const data = useQuery({
    queryKey: ["admin-invoices", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [bills, residents, payments] = await Promise.all([
        supabase
          .from("bills")
          .select("id,title,description,amount,status,due_date,created_at,resident_id")
          .eq("estate_id", estateId!)
          .order("due_date", { ascending: false })
          .limit(500),
        supabase
          .from("profiles")
          .select("id,full_name,unit,house_number,street")
          .eq("estate_id", estateId!),
        supabase
          .from("payments")
          .select("id,bill_id,amount,method,paid_at")
          .eq("estate_id", estateId!)
          .limit(1000),
      ]);
      if (bills.error) throw bills.error;
      if (residents.error) throw residents.error;
      if (payments.error) throw payments.error;
      return {
        bills: bills.data ?? [],
        residents: residents.data ?? [],
        payments: payments.data ?? [],
      };
    },
  });

  const residentMap = useMemo(() => {
    const m = new Map<string, { name: string; unit: string }>();
    (data.data?.residents ?? []).forEach((r: any) =>
      m.set(r.id, {
        name: r.full_name ?? "Resident",
        unit: r.unit || [r.house_number, r.street].filter(Boolean).join(" ") || "—",
      }),
    );
    return m;
  }, [data.data]);

  const paymentMap = useMemo(() => {
    const m = new Map<string, { method: string; paid_at: string }>();
    (data.data?.payments ?? []).forEach((p) => m.set(p.bill_id, { method: p.method, paid_at: p.paid_at }));
    return m;
  }, [data.data]);

  const settled = (st: string) => st === "paid" || st === "waived";

  const rows = useMemo(() => {
    const list = (data.data?.bills ?? []).map((b) => {
      const overdue = !settled(b.status) && isBefore(new Date(b.due_date), new Date());
      const r = residentMap.get(b.resident_id);
      return {
        ...b,
        overdue,
        residentName: r?.name ?? b.resident_id.slice(0, 8),
        residentUnit: r?.unit ?? "—",
        payment: paymentMap.get(b.id) ?? null,
      };
    });
    const q = query.trim().toLowerCase();
    return list
      .filter((b) =>
        tab === "all"
          ? true
          : tab === "paid"
            ? settled(b.status)
            : tab === "overdue"
              ? b.overdue
              : !settled(b.status),
      )
      .filter(
        (b) =>
          !q ||
          b.title.toLowerCase().includes(q) ||
          b.residentName.toLowerCase().includes(q) ||
          b.residentUnit.toLowerCase().includes(q),
      );
  }, [data.data, residentMap, paymentMap, tab, query]);

  const totals = useMemo(() => {
    const all = data.data?.bills ?? [];
    const billed = all.reduce((s, b) => s + Number(b.amount ?? 0), 0);
    const paid = all.filter((b) => settled(b.status)).reduce((s, b) => s + Number(b.amount ?? 0), 0);
    const overdue = all
      .filter((b) => !settled(b.status) && isBefore(new Date(b.due_date), new Date()))
      .reduce((s, b) => s + Number(b.amount ?? 0), 0);
    return { count: all.length, billed, paid, outstanding: billed - paid, overdue };
  }, [data.data]);

  const markPaid = useMutation({
    mutationFn: async ({ id, method }: { id: string; method: string }) => {
      const { error } = await supabase.rpc("admin_record_bill_payment" as never, {
        _bill_id: id,
        _method: method,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["admin-invoices", estateId] });
      qc.invalidateQueries({ queryKey: ["admin-collections", estateId] });
      qc.invalidateQueries({ queryKey: ["admin-payments", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const header = ["Invoice", "Resident", "Unit", "Amount", "Status", "Due date", "Paid via"];
    const body = rows.map((r) => [
      r.title,
      r.residentName,
      r.residentUnit,
      String(r.amount),
      settled(r.status) ? r.status : r.overdue ? "overdue" : "unpaid",
      r.due_date,
      r.payment?.method ?? "",
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (data.isLoading) return <ListSkeleton rows={5} />;
  if (data.isError || !data.data) return <ErrorState onRetry={() => data.refetch()} />;

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Invoices</h1>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Invoices" value={totals.count} />
        <StatCard label="Paid" value={ngn(totals.paid)} tone="success" />
        <StatCard
          label="Outstanding"
          value={ngn(totals.outstanding)}
          tone={totals.outstanding ? "warning" : "default"}
        />
        <StatCard label="Overdue" value={ngn(totals.overdue)} tone={totals.overdue ? "error" : "default"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ScrollTabs
          value={tab}
          onChange={setTab}
          tabs={
            [
              { key: "all", label: "All" },
              { key: "unpaid", label: "Unpaid" },
              { key: "overdue", label: "Overdue" },
              { key: "paid", label: "Paid" },
            ] as const
          }
        />
        <div className="min-w-[180px] flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder="Search resident, unit or invoice…" />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No invoices found" />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Invoice</th>
                  <th className="pb-2 pr-3 font-medium">Resident</th>
                  <th className="pb-2 pr-3 font-medium">Unit</th>
                  <th className="pb-2 pr-3 font-medium">Due</th>
                  <th className="pb-2 pr-3 text-right font-medium">Amount</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{r.title}</div>
                      {r.description && (
                        <div className="text-xs text-muted-foreground">{r.description}</div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">{r.residentName}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{r.residentUnit}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {format(new Date(r.due_date), "MMM d, yyyy")}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                      {ngn(Number(r.amount))}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge
                        tone={settled(r.status) ? "success" : r.overdue ? "error" : "warning"}
                      >
                        {settled(r.status) ? r.status : r.overdue ? "overdue" : "unpaid"}
                      </StatusBadge>
                    </td>
                    <td className="py-2.5 text-right">
                      {settled(r.status) ? (
                        <span className="text-xs text-muted-foreground">
                          {r.payment ? `via ${r.payment.method}` : "settled"}
                        </span>
                      ) : (
                        <button
                          onClick={() => markPaid.mutate({ id: r.id, method: "cash" })}
                          disabled={markPaid.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                        >
                          {markPaid.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Record
                          payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.title}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.residentName} · {r.residentUnit}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Due {format(new Date(r.due_date), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">{ngn(Number(r.amount))}</div>
                    <StatusBadge
                      tone={settled(r.status) ? "success" : r.overdue ? "error" : "warning"}
                    >
                      {settled(r.status) ? r.status : r.overdue ? "overdue" : "unpaid"}
                    </StatusBadge>
                  </div>
                </div>
                {!settled(r.status) && (
                  <button
                    onClick={() => markPaid.mutate({ id: r.id, method: "cash" })}
                    disabled={markPaid.isPending}
                    className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                  >
                    Record payment
                  </button>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
