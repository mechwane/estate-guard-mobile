import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton } from "@/components/ui-kit";
import { biometricConfirm } from "@/lib/biometric-confirm";

export const Route = createFileRoute("/app/admin/messages")({
  component: Messages,
  head: () => ({ meta: [{ title: "Broadcast — Estate Guard" }] }),
});

function Messages() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");

  const recent = useQuery({
    queryKey: ["admin-broadcasts", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs").select("*")
        .eq("estate_id", estateId!).eq("action", "broadcast.sent")
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error; return data ?? [];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!(await biometricConfirm(`Send "${title}" to all residents?`))) throw new Error("Cancelled");
      const { data, error } = await supabase.rpc("broadcast_message" as never, {
        _title: title, _body: body, _link: link || null,
      } as never);
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: (n) => { toast.success(`Delivered to ${n} recipients`); setTitle(""); setBody(""); setLink(""); qc.invalidateQueries({ queryKey: ["admin-broadcasts", estateId] }); },
    onError: (e: Error) => { if (e.message !== "Cancelled") toast.error(e.message); },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Broadcast messages</h1>
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Compose</h2>
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body" rows={4} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Optional link (e.g. /app/resident/community)" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <button onClick={() => send.mutate()} disabled={send.isPending || !title.trim() || !body.trim()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
          {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Verify & send
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">Uses your biometric device when enrolled.</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Recent broadcasts</h2>
        {recent.isLoading ? <ListSkeleton rows={2} /> : recent.isError ? <ErrorState onRetry={() => recent.refetch()} /> : (recent.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
        ) : (
          <ul className="space-y-2">
            {(recent.data ?? []).map((r: any) => (
              <li key={r.id} className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">{r.metadata?.title ?? "Broadcast"}</div>
                  <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                </div>
                <div className="text-xs text-muted-foreground">{r.metadata?.recipients ?? 0} recipients</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
