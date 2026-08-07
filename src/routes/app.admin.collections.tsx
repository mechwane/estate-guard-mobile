import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, ImageIcon, Loader2, Plus, Receipt, Users } from "lucide-react";
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
  SheetModal,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { ngn } from "@/lib/format";

export const Route = createFileRoute("/app/admin/collections")({
  component: EstateCollections,
  head: () => ({
    meta: [
      { title: "Estate Collections — Estate Guard" },
      {
        name: "description",
        content:
          "Create estate-wide collections, track how much has been paid per campaign, and follow up on outstanding balances.",
      },
      { property: "og:title", content: "Estate Collections — Estate Guard" },
      {
        property: "og:description",
        content: "Create estate-wide collections and track payment progress per campaign.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "all" | "general" | "resident" | "address" | "completed";

type CollectionRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  tag: string | null;
  payment_type: string;
  payment_cycle: string | null;
  sub_account: string | null;
  amount: number;
  due_date: string;
  scope: string;
  target_address: string | null;
  priority: number;
  is_utility: boolean;
  topup_allowed: boolean;
  is_periodic: boolean;
  is_optional: boolean;
  exclude_from_waiver: boolean;
  status: string;
  created_at: string;
};

type BillRow = {
  id: string;
  title: string;
  amount: number;
  status: string;
  due_date: string;
  resident_id: string;
  collection_id: string | null;
};

type FormState = {
  title: string;
  description: string;
  cover_image_url: string;
  tag: string;
  payment_type: string;
  payment_cycle: string;
  sub_account: string;
  amount: string;
  due_date: string;
  scope: "general" | "resident" | "address";
  target_address: string;
  resident_id: string;
  priority: string;
  is_utility: boolean;
  topup_allowed: boolean;
  is_periodic: boolean;
  is_optional: boolean;
  exclude_from_waiver: boolean;
  approved_only: boolean;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  cover_image_url: "",
  tag: "",
  payment_type: "one_time",
  payment_cycle: "",
  sub_account: "",
  amount: "",
  due_date: "",
  scope: "general",
  target_address: "",
  resident_id: "",
  priority: "0",
  is_utility: false,
  topup_allowed: false,
  is_periodic: false,
  is_optional: false,
  exclude_from_waiver: false,
  approved_only: false,
};

const paymentTypes = [
  { value: "one_time", label: "One-time payment" },
  { value: "recurring", label: "Recurring payment" },
  { value: "instalment", label: "Instalment" },
];

const paymentCycles = [
  { value: "", label: "No cycle" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "biannual", label: "Every 6 months" },
  { value: "yearly", label: "Yearly" },
];

function settled(status: string) {
  return status === "paid" || status === "waived";
}

function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{pct}% collected</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-card shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}

function EstateCollections() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"dues" | "history">("dues");
  const [form, setForm] = useState<FormState>(emptyForm);

  const data = useQuery({
    queryKey: ["admin-collections", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [collections, bills, payments, residents] = await Promise.all([
        supabase
          .from("collections")
          .select("*")
          .eq("estate_id", estateId!)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("bills")
          .select("id,title,amount,status,due_date,resident_id,collection_id")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("id,amount,bill_id,paid_at,method")
          .eq("estate_id", estateId!)
          .order("paid_at", { ascending: false })
          .limit(2000),
        supabase
          .from("profiles")
          .select("id,full_name,email,unit,house_number,block,street,approved")
          .eq("estate_id", estateId!)
          .order("full_name"),
      ]);
      if (collections.error) throw collections.error;
      if (bills.error) throw bills.error;
      if (payments.error) throw payments.error;
      if (residents.error) throw residents.error;
      return {
        collections: (collections.data ?? []) as unknown as CollectionRow[],
        bills: (bills.data ?? []) as unknown as BillRow[],
        payments: payments.data ?? [],
        residents: residents.data ?? [],
      };
    },
  });

  const residents = data.data?.residents ?? [];

  const addressOf = (r: (typeof residents)[number]) =>
    [r.house_number, r.block, r.street].filter(Boolean).join(", ") || r.unit || "";

  const addresses = useMemo(
    () => [...new Set(residents.map(addressOf).filter(Boolean))].sort(),
    [residents],
  );

  const paidByBill = useMemo(() => {
    const map = new Map<string, number>();
    (data.data?.payments ?? []).forEach((p) => {
      map.set(p.bill_id, (map.get(p.bill_id) ?? 0) + Number(p.amount ?? 0));
    });
    return map;
  }, [data.data]);

  const billsFor = (collection: CollectionRow) =>
    (data.data?.bills ?? []).filter(
      (b) => b.collection_id === collection.id || (!b.collection_id && b.title === collection.title),
    );

  const campaigns = useMemo(() => {
    return (data.data?.collections ?? []).map((collection) => {
      const rows = (data.data?.bills ?? []).filter(
        (b) =>
          b.collection_id === collection.id || (!b.collection_id && b.title === collection.title),
      );
      const billed = rows.reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
      const collected = rows.reduce((sum, b) => sum + (paidByBill.get(b.id) ?? 0), 0);
      const outstanding = rows
        .filter((b) => !settled(b.status))
        .reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
      return {
        collection,
        billed,
        collected,
        outstanding,
        residents: rows.length,
        paid: rows.filter((b) => settled(b.status)).length,
        rate: billed ? (collected / billed) * 100 : 0,
      };
    });
  }, [data.data, paidByBill]);

  const filtered = campaigns
    .filter((c) =>
      tab === "all"
        ? true
        : tab === "completed"
          ? c.outstanding === 0 && c.residents > 0
          : c.collection.scope === tab,
    )
    .filter(
      (c) =>
        c.collection.title.toLowerCase().includes(query.trim().toLowerCase()) ||
        (c.collection.tag ?? "").toLowerCase().includes(query.trim().toLowerCase()),
    );

  const totals = useMemo(() => {
    const billed = campaigns.reduce((s, c) => s + c.billed, 0);
    const collected = campaigns.reduce((s, c) => s + c.collected, 0);
    const outstanding = campaigns.reduce((s, c) => s + c.outstanding, 0);
    return {
      billed,
      collected,
      outstanding,
      rate: billed ? (collected / billed) * 100 : 0,
      active: campaigns.filter((c) => c.outstanding > 0).length,
    };
  }, [campaigns]);

  const save = useMutation({
    mutationFn: async () => {
      if (!estateId || !session?.userId) throw new Error("Missing estate context");
      if (!form.title.trim()) throw new Error("Title is required");
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      if (!form.due_date) throw new Error("Pick a due date");
      if (form.scope === "resident" && !form.resident_id)
        throw new Error("Select the resident to bill");
      if (form.scope === "address" && !form.target_address)
        throw new Error("Select the address to bill");

      const payload = {
        estate_id: estateId,
        created_by: session.userId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        cover_image_url: form.cover_image_url.trim() || null,
        tag: form.tag.trim() || null,
        payment_type: form.payment_type,
        payment_cycle: form.payment_cycle || null,
        sub_account: form.sub_account.trim() || null,
        amount,
        due_date: form.due_date,
        scope: form.scope,
        target_address: form.scope === "address" ? form.target_address : null,
        priority: Number(form.priority) || 0,
        is_utility: form.is_utility,
        topup_allowed: form.topup_allowed,
        is_periodic: form.is_periodic,
        is_optional: form.is_optional,
        exclude_from_waiver: form.exclude_from_waiver,
      };

      if (editingId) {
        const { error } = await supabase
          .from("collections")
          .update(payload as never)
          .eq("id", editingId);
        if (error) throw error;
        return { count: 0, updated: true };
      }

      const created = await supabase
        .from("collections")
        .insert(payload as never)
        .select("id")
        .single();
      if (created.error) throw created.error;
      const collectionId = (created.data as unknown as { id: string }).id;

      const targets = residents
        .filter((r) => (form.approved_only ? r.approved : true))
        .filter((r) =>
          form.scope === "resident"
            ? r.id === form.resident_id
            : form.scope === "address"
              ? addressOf(r) === form.target_address
              : true,
        );
      if (targets.length === 0) throw new Error("No residents match this collection");

      const rows = targets.map((r) => ({
        estate_id: estateId,
        resident_id: r.id,
        created_by: session.userId,
        collection_id: collectionId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        amount,
        due_date: form.due_date,
      }));
      const { error } = await supabase.from("bills").insert(rows as never);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        estate_id: estateId,
        actor_id: session.userId,
        action: "collection.created",
        entity: "collections",
        entity_id: collectionId,
        metadata: { title: form.title.trim(), amount, residents: targets.length },
      });
      return { count: targets.length, updated: false };
    },
    onSuccess: (result) => {
      toast.success(
        result.updated
          ? "Collection updated"
          : `Collection created for ${result.count} resident${result.count === 1 ? "" : "s"}`,
      );
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["admin-collections", estateId] });
      qc.invalidateQueries({ queryKey: ["admin-invoices", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("collections")
        .update({ status: "archived" } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Collection archived");
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["admin-collections", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (billId: string) => {
      const { error } = await supabase.rpc("admin_record_bill_payment" as never, {
        _bill_id: billId,
        _method: "cash",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["admin-collections", estateId] });
      qc.invalidateQueries({ queryKey: ["admin-invoices", estateId] });
      qc.invalidateQueries({ queryKey: ["admin-payments", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detail = campaigns.find((c) => c.collection.id === detailId) ?? null;
  const residentName = (id: string) => {
    const row = residents.find((r) => r.id === id);
    return row?.full_name || row?.email || id.slice(0, 8);
  };

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (data.isLoading) return <ListSkeleton rows={5} />;
  if (data.isError || !data.data) return <ErrorState onRetry={() => data.refetch()} />;

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Estate collection</h1>
          <p className="text-xs text-muted-foreground">
            {totals.active} active payment{totals.active === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            setOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-3.5 w-3.5" /> Create payment
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total billed" value={ngn(totals.billed)} />
        <StatCard label="Collected" value={ngn(totals.collected)} tone="success" />
        <StatCard
          label="Outstanding"
          value={ngn(totals.outstanding)}
          tone={totals.outstanding ? "warning" : "default"}
        />
        <StatCard label="Collection rate" value={`${Math.round(totals.rate)}%`} tone="primary" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ScrollTabs
          value={tab}
          onChange={setTab}
          tabs={
            [
              { key: "all", label: "All" },
              { key: "general", label: "General" },
              { key: "resident", label: "By resident" },
              { key: "address", label: "By address" },
              { key: "completed", label: "Completed" },
            ] as const
          }
        />
        <div className="min-w-[180px] flex-1 sm:max-w-xs">
          <SearchInput value={query} onChange={setQuery} placeholder="Search collections…" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="No collections here"
          description="Create a payment to bill residents at once."
        />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <StaggerItem key={c.collection.id}>
              <Card className="flex h-full flex-col">
                <div className="mb-3 h-28 w-full overflow-hidden rounded-xl bg-muted">
                  {c.collection.cover_image_url ? (
                    <img
                      src={c.collection.cover_image_url}
                      alt={`${c.collection.title} cover`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{c.collection.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ngn(Number(c.collection.amount))} per resident · due{" "}
                      {format(new Date(c.collection.due_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <StatusBadge tone={c.outstanding === 0 ? "success" : "warning"}>
                    {c.collection.status === "archived"
                      ? "Archived"
                      : c.outstanding === 0
                        ? "Completed"
                        : "Active"}
                  </StatusBadge>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.collection.tag && <StatusBadge>{c.collection.tag}</StatusBadge>}
                  <StatusBadge tone="neutral">
                    {c.collection.scope === "general"
                      ? "All residents"
                      : c.collection.scope === "address"
                        ? c.collection.target_address || "Address"
                        : "Single resident"}
                  </StatusBadge>
                  {c.collection.is_utility && <StatusBadge tone="primary">Utility</StatusBadge>}
                  {c.collection.is_periodic && (
                    <StatusBadge>{c.collection.payment_cycle || "Periodic"}</StatusBadge>
                  )}
                  {c.collection.is_optional && <StatusBadge>Optional</StatusBadge>}
                  {c.collection.topup_allowed && <StatusBadge>Top-up</StatusBadge>}
                </div>

                <Progress value={c.rate} />

                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 py-2">
                    <dt className="text-[10px] uppercase text-muted-foreground">Billed</dt>
                    <dd className="text-xs font-semibold tabular-nums">{ngn(c.billed)}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/40 py-2">
                    <dt className="text-[10px] uppercase text-muted-foreground">Paid</dt>
                    <dd className="text-xs font-semibold tabular-nums text-[color:var(--color-success)]">
                      {ngn(c.collected)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/40 py-2">
                    <dt className="text-[10px] uppercase text-muted-foreground">Due</dt>
                    <dd className="text-xs font-semibold tabular-nums">{ngn(c.outstanding)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {c.paid}/{c.residents} residents paid
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setDetailId(c.collection.id);
                      setDetailTab("dues");
                    }}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                  >
                    View payments
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setForm({
                        ...emptyForm,
                        title: `${c.collection.title} (copy)`,
                        description: c.collection.description ?? "",
                        cover_image_url: c.collection.cover_image_url ?? "",
                        tag: c.collection.tag ?? "",
                        payment_type: c.collection.payment_type,
                        payment_cycle: c.collection.payment_cycle ?? "",
                        sub_account: c.collection.sub_account ?? "",
                        amount: String(c.collection.amount),
                        scope: c.collection.scope as FormState["scope"],
                        target_address: c.collection.target_address ?? "",
                        priority: String(c.collection.priority),
                        is_utility: c.collection.is_utility,
                        topup_allowed: c.collection.topup_allowed,
                        is_periodic: c.collection.is_periodic,
                        is_optional: c.collection.is_optional,
                        exclude_from_waiver: c.collection.exclude_from_waiver,
                      });
                      setOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <SheetModal
        open={open}
        title={editingId ? "Edit payment" : "Create payment"}
        onClose={() => setOpen(false)}
        width="lg"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Create payment"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="h-32 w-full overflow-hidden rounded-xl bg-muted">
            {form.cover_image_url ? (
              <img
                src={form.cover_image_url}
                alt="Collection cover preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground">
                <ImageIcon className="h-7 w-7" />
              </div>
            )}
          </div>
          <input
            placeholder="Cover image URL (optional)"
            value={form.cover_image_url}
            onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          />

          <input
            required
            placeholder="Title (e.g. Q3 Service charge)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              placeholder="Tag (e.g. Service charge)"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
            />
            <select
              value={form.payment_type}
              onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
            >
              {paymentTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              min={1}
              placeholder="Amount per resident"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
            />
            <input
              required
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
            />
            <input
              placeholder="Sub account (optional)"
              value={form.sub_account}
              onChange={(e) => setForm({ ...form, sub_account: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
            />
            <select
              value={form.payment_cycle}
              onChange={(e) => setForm({ ...form, payment_cycle: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
            >
              {paymentCycles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value as FormState["scope"] })}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
              aria-label="Who to bill"
            >
              <option value="general">All residents ({residents.length})</option>
              <option value="resident">A single resident</option>
              <option value="address">A specific address</option>
            </select>
            <input
              type="number"
              min={0}
              max={9}
              placeholder="Priority (0-9)"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
            />
          </div>

          {form.scope === "resident" && (
            <select
              value={form.resident_id}
              onChange={(e) => setForm({ ...form, resident_id: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
              aria-label="Resident"
            >
              <option value="">Select resident…</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name || r.email} {addressOf(r) ? `· ${addressOf(r)}` : ""}
                </option>
              ))}
            </select>
          )}

          {form.scope === "address" && (
            <select
              value={form.target_address}
              onChange={(e) => setForm({ ...form, target_address: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
              aria-label="Address"
            >
              <option value="">Select address…</option>
              {addresses.map((address) => (
                <option key={address} value={address}>
                  {address}
                </option>
              ))}
            </select>
          )}

          <div className="space-y-2">
            <Toggle
              label="Utility bill"
              hint="Marks this as a utility charge (water, electricity, waste)."
              checked={form.is_utility}
              onChange={(v) => setForm({ ...form, is_utility: v })}
            />
            <Toggle
              label="Top-up allowed"
              hint="Residents can pay in parts until the full amount is settled."
              checked={form.topup_allowed}
              onChange={(v) => setForm({ ...form, topup_allowed: v })}
            />
            <Toggle
              label="Periodic payment"
              hint="Repeats on the selected payment cycle."
              checked={form.is_periodic}
              onChange={(v) => setForm({ ...form, is_periodic: v })}
            />
            <Toggle
              label="Optional payment"
              hint="Residents may skip this payment — it does not affect access."
              checked={form.is_optional}
              onChange={(v) => setForm({ ...form, is_optional: v })}
            />
            <Toggle
              label="Exclude from waiver"
              hint="This payment can never be waived by support."
              checked={form.exclude_from_waiver}
              onChange={(v) => setForm({ ...form, exclude_from_waiver: v })}
            />
            {!editingId && (
              <Toggle
                label="Approved residents only"
                hint="Skip residents that have not been approved yet."
                checked={form.approved_only}
                onChange={(v) => setForm({ ...form, approved_only: v })}
              />
            )}
          </div>
        </div>
      </SheetModal>

      <SheetModal
        open={!!detail}
        title={detail?.collection.title ?? "Collection"}
        onClose={() => setDetailId(null)}
        width="lg"
      >
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/40 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Billed</div>
                <div className="text-xs font-semibold tabular-nums">{ngn(detail.billed)}</div>
              </div>
              <div className="rounded-lg bg-muted/40 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Paid</div>
                <div className="text-xs font-semibold tabular-nums">{ngn(detail.collected)}</div>
              </div>
              <div className="rounded-lg bg-muted/40 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Due</div>
                <div className="text-xs font-semibold tabular-nums">{ngn(detail.outstanding)}</div>
              </div>
            </div>

            <ScrollTabs
              value={detailTab}
              onChange={setDetailTab}
              tabs={
                [
                  { key: "dues", label: "Payment" },
                  { key: "history", label: "Payment history" },
                ] as const
              }
            />

            {detailTab === "dues" ? (
              <div className="space-y-2">
                {billsFor(detail.collection).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold">
                        {residentName(bill.resident_id)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ngn(Number(bill.amount))} · due{" "}
                        {format(new Date(bill.due_date), "MMM d, yyyy")}
                      </div>
                    </div>
                    {settled(bill.status) ? (
                      <StatusBadge tone="success">{bill.status}</StatusBadge>
                    ) : (
                      <button
                        onClick={() => markPaid.mutate(bill.id)}
                        disabled={markPaid.isPending}
                        className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                      >
                        Set paid
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(data.data?.payments ?? [])
                  .filter((p) => billsFor(detail.collection).some((b) => b.id === p.bill_id))
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-xs"
                    >
                      <span className="font-semibold tabular-nums">{ngn(Number(p.amount))}</span>
                      <span className="text-muted-foreground">
                        {p.method ?? "manual"} ·{" "}
                        {p.paid_at ? format(new Date(p.paid_at), "MMM d, yyyy") : "—"}
                      </span>
                    </div>
                  ))}
                {(data.data?.payments ?? []).filter((p) =>
                  billsFor(detail.collection).some((b) => b.id === p.bill_id),
                ).length === 0 && (
                  <EmptyState title="No payments yet" description="Recorded payments appear here." />
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingId(detail.collection.id);
                  setForm({
                    ...emptyForm,
                    title: detail.collection.title,
                    description: detail.collection.description ?? "",
                    cover_image_url: detail.collection.cover_image_url ?? "",
                    tag: detail.collection.tag ?? "",
                    payment_type: detail.collection.payment_type,
                    payment_cycle: detail.collection.payment_cycle ?? "",
                    sub_account: detail.collection.sub_account ?? "",
                    amount: String(detail.collection.amount),
                    due_date: detail.collection.due_date,
                    scope: detail.collection.scope as FormState["scope"],
                    target_address: detail.collection.target_address ?? "",
                    priority: String(detail.collection.priority),
                    is_utility: detail.collection.is_utility,
                    topup_allowed: detail.collection.topup_allowed,
                    is_periodic: detail.collection.is_periodic,
                    is_optional: detail.collection.is_optional,
                    exclude_from_waiver: detail.collection.exclude_from_waiver,
                  });
                  setDetailId(null);
                  setOpen(true);
                }}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                Edit collection
              </button>
              {detail.collection.status !== "archived" && (
                <button
                  onClick={() => archive.mutate(detail.collection.id)}
                  disabled={archive.isPending}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-[color:var(--color-destructive)] hover:bg-muted disabled:opacity-60"
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        )}
      </SheetModal>
    </div>
  );
}
