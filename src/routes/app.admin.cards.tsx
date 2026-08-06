import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { CreditCard, Download, Loader2, Plus, Trash2 } from "lucide-react";
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
import { initialsFor } from "@/lib/avatar";

export const Route = createFileRoute("/app/admin/cards")({
  component: AccessCards,
  head: () => ({
    meta: [
      { title: "Access Cards — Estate Guard" },
      {
        name: "description",
        content:
          "Issue, revoke and audit resident access cards used at your estate gates and doors.",
      },
      { property: "og:title", content: "Access Cards — Estate Guard" },
      {
        property: "og:description",
        content: "Issue, revoke and audit resident gate access cards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "all" | "active" | "revoked";

function mask(value: string) {
  const v = value.trim();
  if (v.length <= 4) return v;
  return `${"•".repeat(Math.min(8, v.length - 4))}${v.slice(-4)}`;
}

function AccessCards() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [issuing, setIssuing] = useState(false);
  const [residentId, setResidentId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const residents = useQuery({
    queryKey: ["admin-residents-for-cards", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,unit,house_number")
        .eq("estate_id", estateId!)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const cards = useQuery({
    queryKey: ["admin-access-cards", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_cards")
        .select("id,card_number,resident_id,active,issued_at,revoked_at,notes")
        .eq("estate_id", estateId!)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const issue = useMutation({
    mutationFn: async () => {
      if (!residentId || !cardNumber.trim()) throw new Error("Resident and card number required");
      const { error } = await supabase.from("access_cards").insert({
        estate_id: estateId!,
        resident_id: residentId,
        card_number: cardNumber.trim(),
        notes: notes.trim() || null,
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: residentId,
        estate_id: estateId!,
        title: "Access card issued",
        body: `Card ${cardNumber.trim()} is now linked to your account.`,
        link_to: "/app/resident/access",
      });
    },
    onSuccess: () => {
      toast.success("Card issued");
      setCardNumber("");
      setNotes("");
      setIssuing(false);
      qc.invalidateQueries({ queryKey: ["admin-access-cards", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("access_cards")
        .update({ active, revoked_at: active ? null : new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.active ? "Card restored" : "Card revoked");
      qc.invalidateQueries({ queryKey: ["admin-access-cards", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("access_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Card removed");
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["admin-access-cards", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = cards.data ?? [];
  const residentName = (id: string) =>
    residents.data?.find((x) => x.id === id)?.full_name ?? `Resident ${id.slice(0, 6)}`;
  const residentUnit = (id: string) => {
    const r = residents.data?.find((x) => x.id === id);
    return r?.unit ?? r?.house_number ?? null;
  };
  const residentLabel = (id: string) => {
    const unit = residentUnit(id);
    return `${residentName(id)}${unit ? ` · ${unit}` : ""}`;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (tab === "active" && !c.active) return false;
      if (tab === "revoked" && c.active) return false;
      if (!term) return true;
      return (
        c.card_number.toLowerCase().includes(term) ||
        residentLabel(c.resident_id).toLowerCase().includes(term)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tab, search, residents.data]);

  const activeCount = rows.filter((c) => c.active).length;
  const covered = new Set(rows.filter((c) => c.active).map((c) => c.resident_id)).size;

  const exportCsv = () => {
    const header = ["Card number", "Resident", "Status", "Issued", "Revoked", "Notes"];
    const lines = filtered.map((c) =>
      [
        c.card_number,
        residentLabel(c.resident_id),
        c.active ? "active" : "revoked",
        new Date(c.issued_at).toISOString(),
        c.revoked_at ? new Date(c.revoked_at).toISOString() : "",
        c.notes ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-cards-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <Stagger className="mx-auto w-full max-w-6xl space-y-4">
      <StaggerItem>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
            <CreditCard className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">Access cards</span>
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={() => setIssuing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4" /> New card
            </button>
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Total cards" value={rows.length} />
          <StatCard label="Active" value={activeCount} tone="success" />
          <StatCard
            label="Revoked"
            value={rows.length - activeCount}
            tone={rows.length - activeCount ? "warning" : "default"}
          />
          <StatCard label="Residents covered" value={covered} tone="primary" />
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ScrollTabs
            value={tab}
            onChange={setTab}
            className="sm:flex-1"
            tabs={
              [
                { key: "all", label: `All (${rows.length})` },
                { key: "active", label: `Active (${activeCount})` },
                { key: "revoked", label: `Revoked (${rows.length - activeCount})` },
              ] as const
            }
          />
          <div className="sm:w-64">
            <SearchInput value={search} onChange={setSearch} placeholder="Card or resident" />
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        {cards.isLoading ? (
          <ListSkeleton rows={3} />
        ) : cards.isError ? (
          <ErrorState onRetry={() => cards.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No cards match this view"
            description="Issue a card to link it to a resident account."
            icon={<CreditCard className="h-6 w-6" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <Card key={c.id} className="space-y-2.5 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initialsFor(residentName(c.resident_id))}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {residentName(c.resident_id)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {residentUnit(c.resident_id) ?? "No unit on file"}
                      </div>
                    </div>
                  </div>
                  <StatusBadge tone={c.active ? "success" : "warning"}>
                    {c.active ? "Active" : "Revoked"}
                  </StatusBadge>
                </div>

                <button
                  type="button"
                  onClick={() => setReveal((r) => ({ ...r, [c.id]: !r[c.id] }))}
                  className="w-full rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-left"
                >
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                    Card number · tap to {reveal[c.id] ? "hide" : "reveal"}
                  </span>
                  <span className="block font-mono text-sm font-semibold text-foreground">
                    {reveal[c.id] ? c.card_number : mask(c.card_number)}
                  </span>
                </button>

                <div className="text-xs text-muted-foreground">
                  {c.active
                    ? `Issued ${format(new Date(c.issued_at), "d MMM yyyy")} · ${formatDistanceToNow(
                        new Date(c.issued_at),
                        { addSuffix: true },
                      )}`
                    : c.revoked_at
                      ? `Revoked ${format(new Date(c.revoked_at), "d MMM yyyy")}`
                      : "Revoked"}
                  {c.notes ? ` · ${c.notes}` : ""}
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                    className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {c.active ? "Revoke" : "Restore"}
                  </button>
                  <button
                    onClick={() => setPendingDelete(c.id)}
                    aria-label="Delete card"
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
        open={issuing}
        title="Issue access card"
        onClose={() => setIssuing(false)}
        footer={
          <button
            type="submit"
            form="card-form"
            disabled={issue.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {issue.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}{" "}
            Issue card
          </button>
        }
      >
        <form
          id="card-form"
          onSubmit={(e) => {
            e.preventDefault();
            issue.mutate();
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Resident</span>
            <select
              required
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="">Select resident…</option>
              {(residents.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                  {r.unit || r.house_number ? ` · ${r.unit ?? r.house_number}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Card number
            </span>
            <input
              required
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="eg. EG-004821"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Notes <span className="italic">optional</span>
            </span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Replacement card, gate 2 only…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
        </form>
      </SheetModal>

      <ConfirmActionDialog
        open={!!pendingDelete}
        title="Delete this access card?"
        description="The card record is removed permanently. Revoke instead if you want to keep the history."
        confirmLabel="Delete"
        tone="destructive"
        busy={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </Stagger>
  );
}
