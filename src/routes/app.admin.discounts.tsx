import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgePercent, Loader2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  ConfirmActionDialog,
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

export const Route = createFileRoute("/app/admin/discounts")({
  component: Discounts,
  head: () => ({
    meta: [
      { title: "Discounts — Estate Guard" },
      {
        name: "description",
        content:
          "Create estate discount codes with fixed or percentage values, usage scope, validity dates and usage limits.",
      },
      { property: "og:title", content: "Discounts — Estate Guard" },
      {
        property: "og:description",
        content: "Estate discount codes for dues and products.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Discount = {
  id: string;
  name: string;
  code: string | null;
  code_type: string;
  value: number;
  percent: number;
  usage_type: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  min_purchase_amount: number | null;
  min_payment_count: number | null;
  created_at: string;
};

type Tab = "all" | "active" | "inactive";

const USAGE_TYPES = [
  { value: "all", label: "All" },
  { value: "dues", label: "Dues" },
  { value: "products", label: "Products" },
] as const;

type Form = {
  code: string;
  code_type: "fixed" | "percent";
  value: string;
  usage_type: string;
  starts_at: string;
  hasEndDate: boolean;
  ends_at: string;
  hasUsageLimit: boolean;
  usage_limit: string;
  hasMinPurchase: boolean;
  min_purchase_amount: string;
  hasMinPayments: boolean;
  min_payment_count: string;
};

const EMPTY: Form = {
  code: "",
  code_type: "percent",
  value: "",
  usage_type: "all",
  starts_at: "",
  hasEndDate: false,
  ends_at: "",
  hasUsageLimit: false,
  usage_limit: "",
  hasMinPurchase: false,
  min_purchase_amount: "",
  hasMinPayments: false,
  min_payment_count: "",
};

function Discounts() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<Discount | null>(null);

  const rowsQ = useQuery({
    queryKey: ["admin-discounts", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discounts")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Discount[];
    },
  });

  const rows = rowsQ.data ?? [];
  const counts = {
    total: rows.length,
    active: rows.filter((d) => d.active).length,
    inactive: rows.filter((d) => !d.active).length,
    redemptions: rows.reduce((s, d) => s + (d.used_count ?? 0), 0),
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((d) => {
      if (tab === "active" && !d.active) return false;
      if (tab === "inactive" && d.active) return false;
      if (!needle) return true;
      return (d.code ?? "").toLowerCase().includes(needle) || d.name.toLowerCase().includes(needle);
    });
  }, [rows, q, tab]);

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const code = f.code.trim().toUpperCase();
      if (!code) throw new Error("Discount code is required");
      const value = Number(f.value);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid discount value");
      if (f.code_type === "percent" && value > 100) throw new Error("Percent cannot exceed 100");
      if (f.hasEndDate && f.ends_at && f.starts_at && f.ends_at <= f.starts_at)
        throw new Error("End date must be after the start date");

      const { error } = await supabase.from("discounts").insert({
        estate_id: estateId!,
        created_by: session?.userId,
        name: code,
        code,
        code_type: f.code_type,
        value,
        percent: f.code_type === "percent" ? value : 0,
        usage_type: f.usage_type,
        starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : new Date().toISOString(),
        ends_at: f.hasEndDate && f.ends_at ? new Date(f.ends_at).toISOString() : null,
        usage_limit: f.hasUsageLimit && f.usage_limit ? Number(f.usage_limit) : null,
        min_purchase_amount:
          f.hasMinPurchase && f.min_purchase_amount ? Number(f.min_purchase_amount) : null,
        min_payment_count:
          f.hasMinPayments && f.min_payment_count ? Number(f.min_payment_count) : null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discount created");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["admin-discounts", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (d: Discount) => {
      const { error } = await supabase
        .from("discounts")
        .update({ active: !d.active })
        .eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discount updated");
      qc.invalidateQueries({ queryKey: ["admin-discounts", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (d: Discount) => {
      const { error } = await supabase.from("discounts").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discount removed");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["admin-discounts", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;

  const valueLabel = (d: Discount) =>
    d.code_type === "fixed"
      ? `₦${Number(d.value).toLocaleString()} off`
      : `${Number(d.value)}% off`;

  return (
    <Stagger className="mx-auto w-full max-w-6xl space-y-4">
      <StaggerItem>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
            <BadgePercent className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">Discounts</span>
          </h1>
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> New discount
          </button>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Discounts" value={counts.total} />
          <StatCard label="Active" value={counts.active} tone="success" />
          <StatCard
            label="Disabled"
            value={counts.inactive}
            tone={counts.inactive ? "warning" : "default"}
          />
          <StatCard label="Redemptions" value={counts.redemptions} tone="primary" />
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ScrollTabs
            value={tab}
            onChange={setTab}
            className="sm:flex-1"
            tabs={[
              { key: "all", label: `All (${counts.total})` },
              { key: "active", label: `Active (${counts.active})` },
              { key: "inactive", label: `Disabled (${counts.inactive})` },
            ]}
          />
          <div className="sm:w-64">
            <SearchInput value={q} onChange={setQ} placeholder="Search discount code" />
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        {rowsQ.isLoading ? (
          <ListSkeleton rows={3} />
        ) : rowsQ.isError ? (
          <ErrorState onRetry={() => rowsQ.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No discounts yet"
            description="Create a discount code residents can apply to dues or products."
            icon={<BadgePercent className="h-6 w-6" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((d) => (
              <Card key={d.id} className="space-y-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-semibold uppercase text-foreground">
                      {d.code ?? d.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {valueLabel(d)} ·{" "}
                      {USAGE_TYPES.find((u) => u.value === d.usage_type)?.label ?? d.usage_type}
                    </div>
                  </div>
                  <StatusBadge tone={d.active ? "success" : "neutral"}>
                    {d.active ? "Active" : "Disabled"}
                  </StatusBadge>
                </div>
                <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide">Starts</dt>
                    <dd>{d.starts_at ? format(new Date(d.starts_at), "d MMM yyyy") : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide">Ends</dt>
                    <dd>{d.ends_at ? format(new Date(d.ends_at), "d MMM yyyy") : "No end date"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide">Usage</dt>
                    <dd>
                      {d.used_count ?? 0}
                      {d.usage_limit ? ` / ${d.usage_limit}` : " / ∞"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide">Minimum</dt>
                    <dd>
                      {d.min_purchase_amount
                        ? `₦${Number(d.min_purchase_amount).toLocaleString()}`
                        : d.min_payment_count
                          ? `${d.min_payment_count} payments`
                          : "None"}
                    </dd>
                  </div>
                </dl>
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    onClick={() => toggle.mutate(d)}
                    className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {d.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => setToDelete(d)}
                    aria-label={`Delete ${d.code ?? d.name}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </StaggerItem>

      <SheetModal
        open={!!form}
        title="Add discount"
        onClose={() => setForm(null)}
        footer={
          <button
            type="submit"
            form="discount-form"
            disabled={save.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        }
      >
        {form && (
          <form
            id="discount-form"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
            className="space-y-3"
          >
            <Field label="Discount code">
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="eg. 1THG10"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <Field label="Discount code type">
              <div className="space-y-1.5">
                {(["fixed", "percent"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm capitalize">
                    <input
                      type="radio"
                      name="code_type"
                      checked={form.code_type === t}
                      onChange={() => setForm({ ...form, code_type: t })}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </Field>

            <Field label={form.code_type === "fixed" ? "Discount value (₦)" : "Discount value (%)"}>
              <input
                required
                type="number"
                min="0"
                step="any"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.code_type === "fixed" ? "eg. 5000" : "eg. 10"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <Field label="Usage type">
              <div className="space-y-1.5">
                {USAGE_TYPES.map((u) => (
                  <label key={u.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="usage_type"
                      checked={form.usage_type === u.value}
                      onChange={() => setForm({ ...form, usage_type: u.value })}
                    />
                    {u.label}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Start date">
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </Field>

            <Toggle
              label="Add end date"
              checked={form.hasEndDate}
              onChange={(v) => setForm({ ...form, hasEndDate: v })}
            >
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Toggle>

            <Toggle
              label="Set usage limit"
              checked={form.hasUsageLimit}
              onChange={(v) => setForm({ ...form, hasUsageLimit: v })}
            >
              <input
                type="number"
                min="1"
                value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                placeholder="eg. 5"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Toggle>

            <Toggle
              label="Set minimum purchase amount"
              checked={form.hasMinPurchase}
              onChange={(v) => setForm({ ...form, hasMinPurchase: v })}
            >
              <input
                type="number"
                min="0"
                value={form.min_purchase_amount}
                onChange={(e) => setForm({ ...form, min_purchase_amount: e.target.value })}
                placeholder="eg. 20000"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Toggle>

            <Toggle
              label="Set minimum payments or purchase count"
              checked={form.hasMinPayments}
              onChange={(v) => setForm({ ...form, hasMinPayments: v })}
            >
              <input
                type="number"
                min="1"
                value={form.min_payment_count}
                onChange={(e) => setForm({ ...form, min_payment_count: e.target.value })}
                placeholder="eg. 3"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </Toggle>
          </form>
        )}
      </SheetModal>

      <ConfirmActionDialog
        open={!!toDelete}
        title="Remove discount?"
        description={
          toDelete ? `${toDelete.code ?? toDelete.name} will no longer be redeemable.` : undefined
        }
        confirmLabel="Remove"
        tone="destructive"
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </Stagger>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-2.5">
      <label className="flex items-center justify-between gap-2 text-sm text-foreground">
        <span className="min-w-0">{label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="shrink-0"
        />
      </label>
      {checked && <div className="mt-2">{children}</div>}
    </div>
  );
}
