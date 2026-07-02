import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge, ListSkeleton, ErrorState, SearchInput } from "@/components/ui-kit";
import { Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/residents")({
  component: Residents,
});

function Residents() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-residents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setApproved = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("profiles").update({ approved }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        estate_id: estateId!, actor_id: session?.userId ?? null,
        action: approved ? "resident.approved" : "resident.revoked",
        entity: "profiles", entity_id: id,
      });
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-residents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((r) => {
      if (filter === "pending" && r.approved) return false;
      if (filter === "approved" && !r.approved) return false;
      if (!needle) return true;
      return (
        (r.full_name ?? "").toLowerCase().includes(needle) ||
        (r.phone ?? "").toLowerCase().includes(needle) ||
        (r.unit ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, q, filter]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, phone, or unit" />
        <div className="flex gap-2">
          {(["all", "pending", "approved"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState title={q || filter !== "all" ? "No matching residents" : "No residents yet"} icon={<Users className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{r.full_name || "—"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{r.unit ? `Unit ${r.unit}` : "—"} · {r.phone ?? "no phone"}</div>
                </div>
                <StatusBadge tone={r.approved ? "success" : "warning"}>{r.approved ? "approved" : "pending"}</StatusBadge>
              </div>
              <div className="mt-3 flex gap-2">
                {!r.approved ? (
                  <button onClick={() => setApproved.mutate({ id: r.id, approved: true })} className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark">Approve</button>
                ) : (
                  <button onClick={() => setApproved.mutate({ id: r.id, approved: false })} className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">Revoke</button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
