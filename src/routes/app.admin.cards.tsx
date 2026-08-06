import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
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
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";

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

function AccessCards() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [residentId, setResidentId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
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
  const residentLabel = (id: string) => {
    const r = residents.data?.find((x) => x.id === id);
    if (!r) return id.slice(0, 8);
    const unit = r.unit ?? r.house_number;
    return `${r.full_name}${unit ? ` · ${unit}` : ""}`;
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
    <Stagger className="space-y-4">
      <StaggerItem>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <CreditCard className="h-5 w-5 text-primary" /> Access cards
          </h1>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
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
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Issue a card</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm sm:col-span-2"
            >
              <option value="">Select resident…</option>
              {(residents.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                  {r.unit || r.house_number ? ` · ${r.unit ?? r.house_number}` : ""}
                </option>
              ))}
            </select>
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="Card number"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => issue.mutate()}
            disabled={issue.isPending}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {issue.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}{" "}
            Issue card
          </button>
        </Card>
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
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Cards ({filtered.length})</h2>
          {cards.isLoading ? (
            <ListSkeleton rows={3} />
          ) : cards.isError ? (
            <ErrorState onRetry={() => cards.refetch()} />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards match this view.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-medium">{c.card_number}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {residentLabel(c.resident_id)} ·{" "}
                      {c.active
                        ? `issued ${formatDistanceToNow(new Date(c.issued_at), { addSuffix: true })}`
                        : c.revoked_at
                          ? `revoked ${formatDistanceToNow(new Date(c.revoked_at), { addSuffix: true })}`
                          : "revoked"}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={c.active ? "success" : "warning"}>
                      {c.active ? "Active" : "Revoked"}
                    </StatusBadge>
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
                </li>
              ))}
            </ul>
          )}
        </Card>
      </StaggerItem>

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
