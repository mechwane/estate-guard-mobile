import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/resident/issues")({
  component: Issues,
});

function Issues() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "General" });

  const { data } = useQuery({
    queryKey: ["my-issues", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .eq("resident_id", session!.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!session?.userId || !session.estate?.id) throw new Error("Missing context");
      const { error, data } = await supabase
        .from("issues")
        .insert({
          estate_id: session.estate.id,
          resident_id: session.userId,
          title: form.title,
          description: form.description,
          category: form.category,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        estate_id: session.estate.id,
        actor_id: session.userId,
        action: "issue.created",
        entity: "issues",
        entity_id: data.id,
      });
    },
    onSuccess: () => {
      toast.success("Issue submitted");
      setOpen(false);
      setForm({ title: "", description: "", category: "General" });
      qc.invalidateQueries({ queryKey: ["my-issues"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="card-surface flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-muted/40"
        >
          <Plus className="h-4 w-4" /> Report an issue
        </button>
      ) : (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-3"
          >
            <input
              placeholder="Title (e.g. Leaking pipe)"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none"
            >
              {["General", "Plumbing", "Electrical", "Security", "Waste", "Other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <textarea
              placeholder="Describe the issue"
              required
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={create.isPending}
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit
              </button>
            </div>
          </form>
        </Card>
      )}

      {(data ?? []).length === 0 ? (
        <EmptyState title="No issues yet" icon={<MessageSquare className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {data!.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{i.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {i.category} ·{" "}
                    {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                  </div>
                </div>
                <StatusBadge
                  tone={
                    i.status === "resolved"
                      ? "success"
                      : i.status === "in_progress"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {i.status.replace("_", " ")}
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm text-foreground">{i.description}</p>
              {i.response && (
                <div className="mt-3 rounded-lg bg-muted p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Admin response
                  </div>
                  <p className="mt-0.5 text-sm text-foreground">{i.response}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
