import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge, SearchInput } from "@/components/ui-kit";
import { Loader2, Inbox as InboxIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/requests")({
  component: AdminRequests,
});

const STATUSES = [
  "pending",
  "under_review",
  "more_info",
  "approved",
  "rejected",
  "completed",
  "cancelled",
];

function AdminRequests() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const list = useQuery({
    queryKey: ["admin-requests", session?.estate?.id],
    enabled: !!session?.estate?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resident_requests")
        .select("*")
        .eq("estate_id", session!.estate!.id)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
    }: {
      id: string;
      status?: string;
      admin_notes?: string;
    }) => {
      const patch: Record<string, unknown> = {};
      if (status !== undefined) patch.status = status;
      if (admin_notes !== undefined) patch.admin_notes = admin_notes;
      const { error } = await supabase.from("resident_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      setReply("");
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? [])
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q.toLowerCase()) ||
        (r.details ?? "").toLowerCase().includes(q.toLowerCase()),
    );

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} placeholder="Search requests" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip active={!statusFilter} onClick={() => setStatusFilter("")}>
          All
        </FilterChip>
        {STATUSES.map((s) => (
          <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {s.replace("_", " ")}
          </FilterChip>
        ))}
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No requests match" icon={<InboxIcon className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const open = openId === r.id;
            return (
              <Card key={r.id} className="p-3">
                <button
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{r.title}</div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {r.category.replace("_", " ")} ·{" "}
                      {format(new Date(r.created_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <StatusBadge
                    tone={
                      r.status === "approved" || r.status === "completed"
                        ? "success"
                        : r.status === "rejected" || r.status === "cancelled"
                          ? "error"
                          : "warning"
                    }
                  >
                    {r.status.replace("_", " ")}
                  </StatusBadge>
                </button>
                {open && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    {r.details && (
                      <p className="whitespace-pre-wrap text-sm text-foreground">{r.details}</p>
                    )}
                    {r.admin_notes && (
                      <div className="rounded-md bg-muted p-2 text-xs text-foreground">
                        <strong>Admin reply:</strong> {r.admin_notes}
                      </div>
                    )}
                    <textarea
                      rows={2}
                      placeholder="Reply to resident (visible)"
                      value={openId === r.id ? reply : ""}
                      onChange={(e) => setReply(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex flex-wrap gap-1">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({
                              id: r.id,
                              status: s,
                              admin_notes: reply.trim() || undefined,
                            })
                          }
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${
                            s === r.status
                              ? "bg-muted text-muted-foreground"
                              : "border border-border bg-card text-foreground hover:bg-muted"
                          }`}
                        >
                          {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium capitalize ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}
