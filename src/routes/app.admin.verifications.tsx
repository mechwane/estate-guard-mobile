import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  StatusBadge,
  ListSkeleton,
  ErrorState,
  SearchInput,
} from "@/components/ui-kit";
import { ShieldCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/verifications")({
  component: Verifications,
});

const STATUS = ["pending", "approved", "rejected", "not_submitted"] as const;
type S = (typeof STATUS)[number];

function Verifications() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<S>("pending");
  const [selected, setSelected] = useState<any | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["verifications", estateId, filter],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("estate_id", estateId!)
        .eq("verification_status", filter)
        .order("verification_submitted_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve, notes }: { id: string; approve: boolean; notes: string }) => {
      if (!approve && !notes.trim()) throw new Error("Rejection reason required");
      const { error } = await supabase.rpc("review_verification", {
        _user_id: id,
        _approve: approve,
        _notes: notes || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reviewed");
      setSelected(null);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["verifications"] });
      qc.invalidateQueries({ queryKey: ["admin-residents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const access = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.rpc("set_estate_access", {
        _user_id: id,
        _approved: approved,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["verifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (r: any) =>
        (r.full_name ?? "").toLowerCase().includes(needle) ||
        (r.phone ?? "").toLowerCase().includes(needle) ||
        (r.house_number ?? "").toLowerCase().includes(needle) ||
        (r.street ?? "").toLowerCase().includes(needle),
    );
  }, [data, q]);

  const openDoc = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage
      .from("verification-docs")
      .createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="sm:max-w-xl">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, address" />
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {STATUS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {k.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No requests" icon={<ShieldCheck className="h-6 w-6" />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r: any) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.full_name || "—"}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.house_number ? `#${r.house_number} ` : ""}
                    {r.street ?? ""} · {r.phone ?? "no phone"}
                  </div>
                </div>
                <StatusBadge
                  tone={
                    r.verification_status === "approved"
                      ? "success"
                      : r.verification_status === "rejected"
                        ? "error"
                        : r.verification_status === "pending"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {r.verification_status.replace("_", " ")}
                </StatusBadge>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setSelected(r);
                    setNotes(r.verification_notes ?? "");
                  }}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Review
                </button>
                {r.approved ? (
                  <button
                    onClick={() => access.mutate({ id: r.id, approved: false })}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Revoke access
                  </button>
                ) : (
                  r.verification_status === "approved" && (
                    <button
                      onClick={() => access.mutate({ id: r.id, approved: true })}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
                    >
                      Grant access
                    </button>
                  )
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-card p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Review verification</h2>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Name" value={selected.full_name} />
              <Row label="Phone" value={selected.phone ?? "—"} />
              <Row label="Occupant" value={selected.occupant_type ?? "—"} />
              <Row
                label="Address"
                value={`${selected.house_number ? "#" + selected.house_number + " " : ""}${selected.block ? "Blk " + selected.block + " " : ""}${selected.street ?? ""}`}
              />
              <Row
                label="Submitted"
                value={
                  selected.verification_submitted_at
                    ? new Date(selected.verification_submitted_at).toLocaleString()
                    : "—"
                }
              />
              {selected.verification_doc_path && (
                <button
                  onClick={() => openDoc(selected.verification_doc_path)}
                  className="mt-1 text-xs text-primary underline"
                >
                  View uploaded document
                </button>
              )}
            </div>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Notes / rejection reason
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => review.mutate({ id: selected.id, approve: false, notes })}
                disabled={review.isPending}
                className="flex-1 rounded-lg border border-destructive/40 bg-card px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60"
              >
                Reject
              </button>
              <button
                onClick={() => review.mutate({ id: selected.id, approve: true, notes })}
                disabled={review.isPending}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {review.isPending && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}{" "}
                Approve
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}
