import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SearchInput,
  StatusBadge,
} from "@/components/ui-kit";

export const Route = createFileRoute("/app/super/support")({
  component: SuperSupport,
});

const STATUSES = ["open", "in_progress", "resolved", "closed"];

function SuperSupport() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const estates = useQuery({
    queryKey: ["super-support-estates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("id,name,code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const tickets = useQuery({
    queryKey: ["super-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const estateMap = useMemo(
    () => new Map((estates.data ?? []).map((e) => [e.id, e])),
    [estates.data],
  );

  const update = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: string }) => {
      const patch: { status: string; body?: string } = { status: nextStatus };
      if (reply.trim())
        patch.body = `${reply.trim()}\n\n---\n${tickets.data?.find((t) => t.id === id)?.body ?? ""}`;
      const { error } = await supabase.from("support_tickets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket updated");
      setReply("");
      qc.invalidateQueries({ queryKey: ["super-support-tickets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = (tickets.data ?? []).filter((t) => {
    const needle = q.trim().toLowerCase();
    if (status && t.status !== status) return false;
    if (!needle) return true;
    return (
      t.subject.toLowerCase().includes(needle) ||
      t.body.toLowerCase().includes(needle) ||
      (estateMap.get(t.estate_id)?.name ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} placeholder="Search support tickets" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={!status} onClick={() => setStatus("")}>
          All
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {s.replace("_", " ")}
          </Chip>
        ))}
      </div>
      {tickets.isLoading ? (
        <ListSkeleton rows={5} />
      ) : tickets.isError ? (
        <ErrorState onRetry={() => tickets.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No support tickets" icon={<LifeBuoy className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {rows.map((t) => {
            const open = openId === t.id;
            return (
              <Card key={t.id} className="p-3">
                <button
                  onClick={() => setOpenId(open ? null : t.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{t.subject}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {estateMap.get(t.estate_id)?.name ?? "Estate"} ·{" "}
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <StatusBadge
                    tone={t.status === "closed" || t.status === "resolved" ? "success" : "warning"}
                  >
                    {t.status.replace("_", " ")}
                  </StatusBadge>
                </button>
                {open && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{t.body}</p>
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={3}
                      placeholder="Reply / internal note"
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          disabled={update.isPending}
                          onClick={() => update.mutate({ id: t.id, nextStatus: s })}
                          className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium capitalize text-foreground hover:bg-muted disabled:opacity-60"
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

function Chip({
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
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium capitalize ${active ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}
