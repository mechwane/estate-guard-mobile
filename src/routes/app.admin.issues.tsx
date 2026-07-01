import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/admin/issues")({
  component: AdminIssues,
});

function AdminIssues() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const estateId = session?.estate?.id;

  const { data } = useQuery({
    queryKey: ["admin-issues", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("issues").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 20_000,
  });

  if (!data || data.length === 0) return <EmptyState title="No issues" icon={<MessageSquare className="h-6 w-6" />} />;

  return (
    <div className="space-y-2">
      {data.map((i) => <IssueRow key={i.id} issue={i} onDone={() => qc.invalidateQueries({ queryKey: ["admin-issues"] })} />)}
    </div>
  );
}

function IssueRow({ issue, onDone }: { issue: any; onDone: () => void }) {
  const { data: session } = useSession();
  const [reply, setReply] = useState(issue.response ?? "");
  const [status, setStatus] = useState(issue.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!session?.userId || !session.estate?.id) return;
    setSaving(true);
    const { error } = await supabase.from("issues").update({ response: reply, status, responded_by: session.userId, responded_at: new Date().toISOString() }).eq("id", issue.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({ estate_id: session.estate.id, actor_id: session.userId, action: "issue.updated", entity: "issues", entity_id: issue.id, metadata: { status } });
    toast.success("Updated");
    onDone();
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{issue.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{issue.category} · {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</div>
        </div>
        <StatusBadge tone={status === "resolved" ? "success" : status === "in_progress" ? "warning" : "neutral"}>{status.replace("_", " ")}</StatusBadge>
      </div>
      <p className="mt-2 text-sm text-foreground">{issue.description}</p>
      <div className="mt-3 space-y-2">
        <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Response…" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none">
            {["open", "in_progress", "resolved"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button disabled={saving} onClick={save} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      </div>
    </Card>
  );
}
