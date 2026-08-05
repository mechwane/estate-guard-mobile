import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Receipt, Users } from "lucide-react";
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

type Tab = "active" | "completed" | "all";

type Campaign = {
  title: string;
  amount: number;
  billed: number;
  collected: number;
  outstanding: number;
  residents: number;
  paid: number;
  dueDate: string;
  createdAt: string;
};

function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{pct}% collected</div>
    </div>
  );
}

function EstateCollections() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    due_date: "",
    scope: "all" as "all" | "approved",
  });

  const data = useQuery({
    queryKey: ["admin-collections", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [bills, payments, residents] = await Promise.all([
        supabase
          .from("bills")
          .select("id,title,amount,status,due_date,created_at,resident_id")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("id,amount,bill_id,paid_at")
          .eq("estate_id", estateId!)
          .order("paid_at", { ascending: false })
          .limit(1000),
        supabase
          .from("profiles")
          .select("id,full_name,unit,approved")
          .eq("estate_id", estateId!)
          .order("full_name"),
      ]);
      if (bills.error) throw bills.error;
      if (payments.error) throw payments.error;
      if (residents.error) throw residents.error;
      return {
        bills: bills.data ?? [],
        payments: payments.data ?? [],
        residents: residents.data ?? [],
      };
    },
  });

  const campaigns = useMemo<Campaign[]>(() => {
    if (!data.data) return [];
    const paidByBill = new Map<string, number>();
    data.data.payments.forEach((p) => {
      paidByBill.set(p.bill_id, (paidByBill.get(p.bill_id) ?? 0) + Number(p.amount ?? 0));
    });
    const map = new Map<string, Campaign>();
    for (const b of data.data.bills) {
      const key = b.title;
      const prev =
        map.get(key) ??
        ({
          title: key,
          amount: Number(b.amount ?? 0),
          billed: 0,
          collected: 0,
          outstanding: 0,
          residents: 0,
          paid: 0,
          dueDate: b.due_date,
          createdAt: b.created_at,
        } as Campaign);
      prev.billed += Number(b.amount ?? 0);
      prev.collected += paidByBill.get(b.id) ?? 0;
      if (b.status !== "paid") prev.outstanding += Number(b.amount ?? 0);
      else prev.paid += 1;
      prev.residents += 1;
      if (new Date(b.due_date) > new Date(prev.dueDate)) prev.dueDate = b.due_date;
      map.set(key, prev);
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [data.data]);

  const filtered = campaigns
    .filter((c) =>
      tab === "all"
        ? true
        : tab === "completed"
          ? c.outstanding === 0
          : c.outstanding > 0,
    )
    .filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()));

  const totals = useMemo(() => {
    const billed = campaigns.reduce((s, c) => s + c.billed, 0);
    const collected = campaigns.reduce((s, c) => s + c.collected, 0);
    const outstanding = campaigns.reduce((s, c) => s + c.outstanding, 0);
    return { billed, collected, outstanding, rate: billed ? (collected / billed) * 100 : 0 };
  }, [campaigns]);

  const create = useMutation({
    mutationFn: async () => {
      if (!estateId || !session?.userId) throw new Error("Missing estate context");
      if (!form.title.trim()) throw new Error("Title is required");
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      if (!form.due_date) throw new Error("Pick a due date");
      const targets = (data.data?.residents ?? []).filter((r) =>
        form.scope === "approved" ? r.approved : true,
      );
      if (targets.length === 0) throw new Error("No residents to bill");
      const rows = targets.map((r) => ({
        estate_id: estateId,
        resident_id: r.id,
        created_by: session.userId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        amount,
        due_date: form.due_date,
      }));
      const { error } = await supabase.from("bills").insert(rows);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        estate_id: estateId,
        actor_id: session.userId,
        action: "collection.created",
        entity: "bills",
        metadata: { title: form.title.trim(), amount, residents: targets.length },
      });
      return targets.length;
    },
    onSuccess: (count) => {
      toast.success(`Collection created for ${count} resident${count === 1 ? "" : "s"}`);
      setOpen(false);
      setForm({ title: "", description: "", amount: "", due_date: "", scope: "all" });
      qc.invalidateQueries({ queryKey: ["admin-collections", estateId] });
      qc.invalidateQueries({ queryKey: ["admin-invoices", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (data.isLoading) return <ListSkeleton rows={5} />;
  if (data.isError || !data.data) return <ErrorState onRetry={() => data.refetch()} />;

  return (
    <div className="page-enter space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Estate collection</h1>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-3.5 w-3.5" /> New collection
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

      {open && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">New estate-wide collection</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                required
                placeholder="Title (e.g. Q3 Service charge)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <input
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
              />
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
              <select
                value={form.scope}
                onChange={(e) =>
                  setForm({ ...form, scope: e.target.value as "all" | "approved" })
                }
                className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
              >
                <option value="all">All residents ({data.data.residents.length})</option>
                <option value="approved">
                  Approved residents only (
                  {data.data.residents.filter((r) => r.approved).length})
                </option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted sm:flex-none sm:px-6"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60 sm:flex-none sm:px-6"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create collection
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ScrollTabs
          value={tab}
          onChange={setTab}
          tabs={
            [
              { key: "active", label: "Active" },
              { key: "completed", label: "Completed" },
              { key: "all", label: "All" },
            ] as const
          }
        />
        <div className="min-w-[180px] flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder="Search collections…" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="No collections here"
          description="Create a collection to bill every resident at once."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const rate = c.billed ? (c.collected / c.billed) * 100 : 0;
            return (
              <Card key={c.title} className="page-enter">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{c.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ngn(c.amount)} per resident · due {format(new Date(c.dueDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  <StatusBadge tone={c.outstanding === 0 ? "success" : "warning"}>
                    {c.outstanding === 0 ? "Completed" : "Active"}
                  </StatusBadge>
                </div>
                <Progress value={rate} />
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
