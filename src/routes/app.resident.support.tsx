import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { LifeBuoy, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/support")({
  component: Support,
});

function Support() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });

  const list = useQuery({
    queryKey: ["support-tickets", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("resident_id", session!.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.subject.trim() || !form.body.trim()) throw new Error("Subject and message required");
      const { error } = await supabase.from("support_tickets").insert({
        estate_id: session!.estate!.id,
        resident_id: session!.userId!,
        subject: form.subject.trim(),
        body: form.body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket sent");
      setOpen(false);
      setForm({ subject: "", body: "" });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <FadeIn>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" /> {open ? "Close" : "New ticket"}
        </button>
      </FadeIn>

      {open && (
        <FadeIn>
          <Card className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Subject
              </span>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                How can we help?
              </span>
              <textarea
                rows={5}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send
            </button>
          </Card>
        </FadeIn>
      )}

      {!list.data || list.data.length === 0 ? (
        <EmptyState title="No support tickets yet" icon={<LifeBuoy className="h-6 w-6" />} />
      ) : (
        <Stagger className="space-y-2">
          {list.data.map((t) => (
            <StaggerItem key={t.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {t.subject}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {t.body}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {format(new Date(t.created_at), "MMM d, yyyy · HH:mm")}
                    </div>
                  </div>
                  <StatusBadge
                    tone={
                      t.status === "resolved"
                        ? "success"
                        : t.status === "closed"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {t.status}
                  </StatusBadge>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
