import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/residents")({
  component: Residents,
});

function Residents() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-residents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-residents"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data || data.length === 0) return <EmptyState title="No residents yet" icon={<Users className="h-6 w-6" />} />;

  return (
    <div className="space-y-2">
      {data.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{r.full_name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{r.unit ? `Unit ${r.unit}` : "—"} · {r.phone ?? "no phone"}</div>
            </div>
            <StatusBadge tone={r.status === "active" ? "success" : r.status === "pending" ? "warning" : "neutral"}>{r.status}</StatusBadge>
          </div>
          <div className="mt-3 flex gap-2">
            {r.status !== "active" && (
              <button onClick={() => setStatus.mutate({ id: r.id, status: "active" })} className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark">Approve</button>
            )}
            {r.status !== "suspended" && (
              <button onClick={() => setStatus.mutate({ id: r.id, status: "suspended" })} className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">Suspend</button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
