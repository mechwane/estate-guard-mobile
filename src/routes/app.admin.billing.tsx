import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Send, XCircle, Banknote, Undo2, BadgeCheck, Download, Link2, RotateCcw, Paperclip, Lock } from "lucide-react";

function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SettlementAccountSelect } from "@/components/settlement-account-select";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
  SheetModal,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { ngn } from "@/lib/format";

export const Route = createFileRoute("/app/admin/billing")({
  component: BillingAdmin,
  head: () => ({
    meta: [
      { title: "Bills & ledger — Estate Guard" },
      { name: "description", content: "Create, publish and reconcile estate bills and payments." },
    ],
  }),
});

type Tab = "batches" | "bills" | "transactions";
const BILL_TYPES = [
  ["service_charge", "Service charge"],
  ["security_levy", "Security levy"],
  ["utility", "Utility"],
  ["fine", "Fine"],
  ["development_levy", "Development levy"],
  ["custom", "Custom"],
] as const;

function statusTone(s: string) {
  if (s === "paid" || s === "successful" || s === "published") return "success" as const;
  if (s === "partially_paid" || s === "pending" || s === "draft") return "warning" as const;
  if (s === "overdue" || s === "failed" || s === "cancelled" || s === "reversed") return "error" as const;
  if (s === "unmatched" || s === "refunded" || s === "partially_refunded") return "warning" as const;
  if (s === "waived") return "primary" as const;
  return "neutral" as const;
}
const label = (s: string) => s.replace(/_/g, " ");
const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm";

function BillingAdmin() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("batches");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [payBill, setPayBill] = useState<BillRow | null>(null);
  const [cancelBatch, setCancelBatch] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["admin-billing", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [batches, bills, txs, people] = await Promise.all([
        supabase.from("bill_batches").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false }),
        supabase
          .from("bills")
          .select("id,title,amount,amount_paid,status,due_date,resident_id,batch_id,reference,bill_type,invoice_path")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("payment_transactions")
          .select("*, settlement:settlement_accounts(label,bank_name,account_number)")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("id,full_name,street,house_number,block").eq("estate_id", estateId!),
      ]);
      for (const r of [batches, bills, txs, people]) if (r.error) throw r.error;
      return {
        batches: batches.data ?? [],
        bills: (bills.data ?? []) as BillRow[],
        txs: txs.data ?? [],
        people: people.data ?? [],
      };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-billing", estateId] });
  const names = useMemo(
    () => new Map((data.data?.people ?? []).map((p) => [p.id, p.full_name ?? "Resident"])),
    [data.data],
  );

  const publish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("publish_bill_batch", { _batch: id });
      if (error) throw error;
    },
    onSuccess: () => (toast.success("Bills published to residents"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: async (v: { bill: string; kind: "waiver" | "reversal"; tx?: string }) => {
      const reason = window.prompt(v.kind === "waiver" ? "Reason for waiver" : "Reason for reversal");
      if (!reason) throw new Error("Reason required");
      const { error } = await supabase.rpc("admin_adjust_bill", {
        _bill: v.bill,
        _kind: v.kind,
        _reason: reason,
        _tx: v.tx,
      });
      if (error) throw error;
    },
    onSuccess: () => (toast.success("Updated"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });

  const attach = useMutation({
    mutationFn: async (v: { bill: string; file: File }) => {
      if (v.file.size > 10 * 1024 * 1024) throw new Error("File must be under 10MB");
      const ext = (v.file.name.split(".").pop() ?? "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${estateId}/${v.bill}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("invoices").upload(path, v.file, { contentType: v.file.type });
      if (up.error) throw up.error;
      const { error } = await supabase.rpc("admin_set_bill_invoice", { _bill: v.bill, _path: path });
      if (error) throw error;
    },
    onSuccess: () => (toast.success("Invoice attached"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });

  const mode = useQuery({
    queryKey: ["payment-only-mode", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("payment_only_mode").eq("id", estateId!).single();
      if (error) throw error;
      return data.payment_only_mode;
    },
  });
  const toggleMode = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.rpc("set_payment_only_mode", { _on: on });
      if (error) throw error;
    },
    onSuccess: (_d, on) => {
      toast.success(on ? "Payment-only mode on for residents with overdue bills" : "Payment-only mode off");
      mode.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remind = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("send_bill_reminders", { _estate: estateId! });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) =>
      toast.success(n ? `Reminders sent to ${n} bill${n === 1 ? "" : "s"}` : "Everyone is already reminded"),
    onError: (e: Error) => toast.error(e.message),
  });

  const refund = useMutation({
    mutationFn: async (v: { id: string; max: number }) => {
      const amt = Number(window.prompt(`Refund amount (max ${v.max})`, String(v.max)));
      if (!amt) throw new Error("Amount required");
      const reason = window.prompt("Reason for refund");
      if (!reason) throw new Error("Reason required");
      const { error } = await supabase.rpc("admin_refund_transaction", { _tx: v.id, _amount: amt, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => (toast.success("Refund recorded"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });

  const unmatched = useMutation({
    mutationFn: async () => {
      const amt = Number(window.prompt("Amount received"));
      if (!amt) throw new Error("Amount required");
      const ref = window.prompt("Bank / transfer reference");
      if (!ref) throw new Error("Reference required");
      const note = window.prompt("Note (sender name, bank, etc.)") ?? undefined;
      const { error } = await supabase.rpc("admin_record_unmatched", {
        _amount: amt,
        _channel: "bank_transfer",
        _reference: ref,
        _note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => (toast.success("Unidentified payment saved — match it to a bill when known"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });

  const match = useMutation({
    mutationFn: async (txId: string) => {
      const ref = window.prompt("Enter the bill reference to match this payment to")?.trim();
      if (!ref) throw new Error("Bill reference required");
      const bill = data.data?.bills.find((b) => (b.reference ?? "").toLowerCase() === ref.toLowerCase());
      if (!bill) throw new Error("No bill with that reference");
      const { error } = await supabase.rpc("admin_match_transaction", { _tx: txId, _bill: bill.id });
      if (error) throw error;
    },
    onSuccess: () => (toast.success("Payment matched and receipt issued"), refresh()),
    onError: (e: Error) => toast.error(e.message),
  });

  const exportBills = () =>
    downloadCsv(`bills-${format(new Date(), "yyyyMMdd")}.csv`, [
      ["Reference", "Resident", "Title", "Type", "Amount", "Paid", "Balance", "Status", "Due date"],
      ...(data.data?.bills ?? []).map((b) => [
        b.reference,
        names.get(b.resident_id) ?? "",
        b.title,
        b.bill_type,
        b.amount,
        b.amount_paid,
        Number(b.amount) - Number(b.amount_paid ?? 0),
        b.status,
        b.due_date,
      ]),
    ]);
  const exportTxs = () =>
    downloadCsv(`transactions-${format(new Date(), "yyyyMMdd")}.csv`, [
      ["Date", "Resident", "Amount", "Refunded", "Provider", "Channel", "Reference", "Status", "Note"],
      ...(data.data?.txs ?? []).map((t) => [
        t.created_at,
        t.resident_id ? (names.get(t.resident_id) ?? "") : "Unidentified",
        t.amount,
        t.refunded_amount,
        t.provider,
        t.channel,
        t.provider_reference,
        t.status,
        t.note,
      ]),
    ]);

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (data.isLoading) return <ListSkeleton rows={6} />;
  if (data.isError || !data.data) return <ErrorState onRetry={() => data.refetch()} />;

  const { batches, bills, txs } = data.data;
  const billed = bills.filter((b) => !["draft", "cancelled"].includes(b.status)).reduce((s, b) => s + Number(b.amount), 0);
  const collected = bills.reduce((s, b) => s + Number(b.amount_paid ?? 0), 0);
  const outstanding = bills
    .filter((b) => ["unpaid", "overdue", "partially_paid"].includes(b.status))
    .reduce((s, b) => s + Number(b.amount) - Number(b.amount_paid ?? 0), 0);
  const overdue = bills.filter((b) => b.status === "overdue").length;
  const needle = q.trim().toLowerCase();
  const filteredBills = bills.filter(
    (b) =>
      !needle ||
      b.title.toLowerCase().includes(needle) ||
      (b.reference ?? "").toLowerCase().includes(needle) ||
      (names.get(b.resident_id) ?? "").toLowerCase().includes(needle),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Bills & ledger</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => toggleMode.mutate(!mode.data)}
            disabled={toggleMode.isPending || mode.isLoading}
            title="Residents with overdue bills can only use Bills, Inbox and Support"
            className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-60 ${mode.data ? "border-destructive text-destructive" : "border-border bg-card"}`}
          >
            <Lock className="h-3.5 w-3.5" /> Payment-only mode: {mode.data ? "On" : "Off"}
          </button>
          <button
            onClick={() => remind.mutate()}
            disabled={remind.isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" /> Send reminders
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> New bill
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Billed" value={ngn(billed)} />
        <StatCard label="Collected" value={ngn(collected)} tone="success" />
        <StatCard label="Outstanding" value={ngn(outstanding)} tone={outstanding ? "warning" : "default"} />
        <StatCard label="Overdue bills" value={String(overdue)} tone={overdue ? "warning" : "default"} />
      </div>

      <ScrollTabs
        value={tab}
        onChange={setTab}
        tabs={
          [
            { key: "batches", label: `Bill runs (${batches.length})` },
            { key: "bills", label: `Resident bills (${bills.length})` },
            { key: "transactions", label: `Transactions (${txs.length})` },
          ] as const
        }
      />

      {tab === "batches" &&
        (batches.length === 0 ? (
          <EmptyState title="No bills yet" description="Create a bill for the estate, a street, a property or selected residents." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {batches.map((b) => {
              const rows = bills.filter((x) => x.batch_id === b.id);
              const paid = rows.filter((x) => x.status === "paid").length;
              return (
                <Card key={b.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {label(b.bill_type)} · {label(b.target_type)} · due {format(new Date(b.due_date), "MMM d, yyyy")}
                      </div>
                    </div>
                    <StatusBadge tone={statusTone(b.status)}>{label(b.status)}</StatusBadge>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-lg font-semibold">{ngn(Number(b.amount))}</div>
                      <div className="text-xs text-muted-foreground">
                        {paid}/{b.bill_count} paid
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {b.status === "draft" && (
                        <button
                          onClick={() => publish.mutate(b.id)}
                          disabled={publish.isPending}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground"
                        >
                          <Send className="h-3 w-3" /> Publish
                        </button>
                      )}
                      {b.status !== "cancelled" && (
                        <button
                          onClick={() => setCancelBatch(b.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-destructive"
                        >
                          <XCircle className="h-3 w-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  {b.cancel_reason && <p className="mt-2 text-xs text-muted-foreground">Cancelled: {b.cancel_reason}</p>}
                </Card>
              );
            })}
          </div>
        ))}

      {tab === "bills" && (
        <Card>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchInput value={q} onChange={setQ} placeholder="Search resident, title or reference" />
            </div>
            <button
              onClick={() => exportBills()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <ul className="mt-3 divide-y divide-border/60">
            {filteredBills.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No bills.</li>}
            {filteredBills.map((b) => {
              const bal = Number(b.amount) - Number(b.amount_paid ?? 0);
              const payable = ["unpaid", "overdue", "partially_paid"].includes(b.status);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{names.get(b.resident_id) ?? "Resident"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {b.title} · {b.reference ?? "—"} · due {format(new Date(b.due_date), "MMM d")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-medium">{ngn(Number(b.amount))}</div>
                      {Number(b.amount_paid) > 0 && bal > 0 && (
                        <div className="text-xs text-muted-foreground">bal {ngn(bal)}</div>
                      )}
                    </div>
                    <StatusBadge tone={statusTone(b.status)}>{label(b.status)}</StatusBadge>
                    {payable && (
                      <>
                        <button
                          title="Record payment"
                          onClick={() => setPayBill(b)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Banknote className="h-4 w-4" />
                        </button>
                        <button
                          title="Waive"
                          onClick={() => adjust.mutate({ bill: b.id, kind: "waiver" })}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <BadgeCheck className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <label
                      title={b.invoice_path ? "Replace invoice file" : "Attach invoice file"}
                      className={`cursor-pointer rounded-md p-1.5 hover:bg-muted ${b.invoice_path ? "text-primary" : "text-muted-foreground"}`}
                    >
                      <Paperclip className="h-4 w-4" />
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) attach.mutate({ bill: b.id, file: f });
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {tab === "transactions" && (
        <Card>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => unmatched.mutate()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Record unidentified payment
            </button>
            <button
              onClick={() => exportTxs()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {txs.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {ngn(Number(t.amount))} ·{" "}
                      {t.status === "unmatched" ? "Unidentified payer" : (names.get(t.resident_id ?? "") ?? "Resident")}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.provider}/{t.channel ?? "—"} · ref {t.provider_reference ?? "—"} ·{" "}
                      {format(new Date(t.paid_at ?? t.created_at), "MMM d, HH:mm")}
                      {t.settlement && ` · settled to ${t.settlement.label} (${t.settlement.bank_name} •••• ${t.settlement.account_number.slice(-4)})`}
                      {Number(t.refunded_amount) > 0 && ` · refunded ${ngn(Number(t.refunded_amount))}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={statusTone(t.status)}>{label(t.status)}</StatusBadge>
                    {t.status === "unmatched" && (
                      <button
                        title="Match to a bill"
                        onClick={() => match.mutate(t.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>
                    )}
                    {["successful", "partially_refunded"].includes(t.status) && (
                      <button
                        title="Refund"
                        onClick={() =>
                          refund.mutate({ id: t.id, max: Number(t.amount) - Number(t.refunded_amount ?? 0) })
                        }
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                    {t.status === "successful" && t.bill_id && Number(t.refunded_amount ?? 0) === 0 && (
                      <button
                        title="Reverse"
                        onClick={() => adjust.mutate({ bill: t.bill_id!, kind: "reversal", tx: t.id })}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Undo2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <CreateBillSheet
        open={creating}
        onClose={() => setCreating(false)}
        people={data.data.people}
        onDone={refresh}
      />
      <RecordPaymentSheet bill={payBill} onClose={() => setPayBill(null)} onDone={refresh} />
      <CancelSheet id={cancelBatch} onClose={() => setCancelBatch(null)} onDone={refresh} />
    </div>
  );
}

type BillRow = {
  id: string;
  title: string;
  amount: number;
  amount_paid: number;
  status: string;
  due_date: string;
  resident_id: string;
  batch_id: string | null;
  reference: string | null;
  invoice_path: string | null;
  bill_type: string | null;
};
type Person = { id: string; full_name: string | null; street: string | null; house_number: string | null; block: string | null };

function CreateBillSheet({
  open,
  onClose,
  people,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  people: Person[];
  onDone: () => void;
}) {
  const empty = {
    title: "",
    bill_type: "service_charge",
    amount: "",
    due_date: "",
    target_type: "estate",
    street: "",
    block: "",
    house_number: "",
    resident_ids: [] as string[],
    description: "",
    billing_period: "",
    sub_account: "",
    cycle: "one_time",
    late_fee: "",
    discount: "",
    instructions: "",
  };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof empty, v: string | string[]) => setF((p) => ({ ...p, [k]: v }));
  const streets = useMemo(() => [...new Set(people.map((p) => p.street).filter(Boolean))] as string[], [people]);
  const blocks = useMemo(() => [...new Set(people.map((p) => p.block).filter(Boolean))] as string[], [people]);

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const amount = Number(f.amount);
      if (!f.title.trim()) throw new Error("Title required");
      if (!(amount > 0)) throw new Error("Enter a valid amount");
      if (!f.due_date) throw new Error("Due date required");
      const filter: Record<string, unknown> = {};
      if (f.target_type === "street") filter.street = f.street;
      if (f.target_type === "block") filter.block = f.block;
      if (f.target_type === "property") Object.assign(filter, { street: f.street, house_number: f.house_number });
      if (f.target_type === "residents") filter.resident_ids = f.resident_ids;
      const { error } = await supabase.rpc("create_bill_batch", {
        _title: f.title,
        _bill_type: f.bill_type,
        _amount: amount,
        _due_date: f.due_date,
        _target_type: f.target_type,
        _target_filter: filter as never,
        _description: f.description || undefined,
        _billing_period: f.billing_period || undefined,
        _sub_account: f.sub_account || undefined,
        _cycle: f.cycle,
        _late_fee: Number(f.late_fee) || 0,
        _discount: Number(f.discount) || 0,
        _instructions: f.instructions || undefined,
        _publish: publish,
      });
      if (error) throw error;
      return publish;
    },
    onSuccess: (pub) => {
      toast.success(pub ? "Bill published" : "Saved as draft");
      setF(empty);
      onClose();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SheetModal
      open={open}
      onClose={onClose}
      title="New bill"
      width="lg"
      footer={
        <div className="flex gap-2">
          <button
            onClick={() => save.mutate(false)}
            disabled={save.isPending}
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          >
            Save draft
          </button>
          <button
            onClick={() => save.mutate(true)}
            disabled={save.isPending}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Publish
          </button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" full>
          <input className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Bill type">
          <select className={inputCls} value={f.bill_type} onChange={(e) => set("bill_type", e.target.value)}>
            {BILL_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount (₦)">
          <input type="number" min={1} className={inputCls} value={f.amount} onChange={(e) => set("amount", e.target.value)} />
        </Field>
        <Field label="Due date">
          <input type="date" className={inputCls} value={f.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </Field>
        <Field label="Billing cycle">
          <select className={inputCls} value={f.cycle} onChange={(e) => set("cycle", e.target.value)}>
            <option value="one_time">One-time</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>
        <Field label="Billing period">
          <input className={inputCls} placeholder="e.g. Oct 2026" value={f.billing_period} onChange={(e) => set("billing_period", e.target.value)} />
        </Field>
        <Field label="Select settlement account" full>
          <SettlementAccountSelect className={inputCls} value={f.sub_account} onChange={(id) => set("sub_account", id)} />
        </Field>
        <Field label="Who pays" full>
          <select className={inputCls} value={f.target_type} onChange={(e) => set("target_type", e.target.value)}>
            <option value="estate">Whole estate</option>
            <option value="street">A street</option>
            <option value="block">A block</option>
            <option value="property">A property</option>
            <option value="residents">Selected residents</option>
          </select>
        </Field>
        {(f.target_type === "street" || f.target_type === "property") && (
          <Field label="Street">
            <select className={inputCls} value={f.street} onChange={(e) => set("street", e.target.value)}>
              <option value="">Select…</option>
              {streets.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
        {f.target_type === "property" && (
          <Field label="House number">
            <input className={inputCls} value={f.house_number} onChange={(e) => set("house_number", e.target.value)} />
          </Field>
        )}
        {f.target_type === "block" && (
          <Field label="Block">
            <select className={inputCls} value={f.block} onChange={(e) => set("block", e.target.value)}>
              <option value="">Select…</option>
              {blocks.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}
        {f.target_type === "residents" && (
          <Field label={`Residents (${f.resident_ids.length} selected)`} full>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.resident_ids.includes(p.id)}
                    onChange={(e) =>
                      set(
                        "resident_ids",
                        e.target.checked ? [...f.resident_ids, p.id] : f.resident_ids.filter((x) => x !== p.id),
                      )
                    }
                  />
                  {p.full_name ?? "Resident"}
                  <span className="text-xs text-muted-foreground">
                    {[p.house_number, p.street].filter(Boolean).join(" ")}
                  </span>
                </label>
              ))}
            </div>
          </Field>
        )}
        <Field label="Late fee (₦)">
          <input type="number" min={0} className={inputCls} value={f.late_fee} onChange={(e) => set("late_fee", e.target.value)} />
        </Field>
        <Field label="Early-payment discount (%)">
          <input type="number" min={0} max={100} className={inputCls} value={f.discount} onChange={(e) => set("discount", e.target.value)} />
        </Field>
        <Field label="Description" full>
          <textarea rows={2} className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Payment instructions" full>
          <textarea rows={2} className={inputCls} value={f.instructions} onChange={(e) => set("instructions", e.target.value)} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Once published, the amount is locked. To change it, cancel the bill and issue a new one.
      </p>
    </SheetModal>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function RecordPaymentSheet({ bill, onClose, onDone }: { bill: BillRow | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("bank_transfer");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const bal = bill ? Number(bill.amount) - Number(bill.amount_paid ?? 0) : 0;
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_record_payment", {
        _bill: bill!.id,
        _amount: Number(amount || bal),
        _channel: channel,
        _reference: ref,
        _note: note || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded and receipt issued");
      setAmount("");
      setRef("");
      setNote("");
      onClose();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <SheetModal
      open={!!bill}
      onClose={onClose}
      title="Record verified payment"
      footer={
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Confirm payment
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {bill?.title} — balance {ngn(bal)}
        </p>
        <Field label="Amount (₦)">
          <input type="number" className={inputCls} placeholder={String(bal)} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Channel">
          <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="pos">POS</option>
          </select>
        </Field>
        <Field label="Reference / teller no.">
          <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Note">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </SheetModal>
  );
}

function CancelSheet({ id, onClose, onDone }: { id: string | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_bill_batch", { _batch: id!, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill cancelled (paid bills are kept)");
      setReason("");
      onClose();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <SheetModal
      open={!!id}
      onClose={onClose}
      title="Cancel bill"
      footer={
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground"
        >
          Cancel bill
        </button>
      }
    >
      <Field label="Reason">
        <textarea rows={3} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </SheetModal>
  );
}
