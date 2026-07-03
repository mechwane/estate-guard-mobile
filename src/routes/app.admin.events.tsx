import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ListSkeleton, ErrorState, StatusBadge } from "@/components/ui-kit";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/app/admin/events")({
  component: AdminEvents,
});

function AdminEvents() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  const q = useQuery({
    enabled: !!session?.estate?.id,
    queryKey: ["admin-events", session?.estate?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,venue,starts_at,status,visibility,organizer_id,estate_id")
        .eq("estate_id", session!.estate!.id)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = async (id: string, status: "published" | "suspended" | "cancelled") => {
    const { error } = await supabase.from("events").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase
      .from("event_logs")
      .insert({ event_id: id, actor_id: session?.userId ?? null, action: `event.${status}` });
    toast.success(`Event ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-events"] });
  };

  if (q.isLoading) return <ListSkeleton rows={3} />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  if ((q.data ?? []).length === 0)
    return (
      <EmptyState
        icon={<CalendarDays className="h-8 w-8" />}
        title="No events in your estate yet"
      />
    );

  return (
    <div className="space-y-2">
      {q.data!.map((e) => (
        <Card key={e.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold">{e.title}</h3>
                <StatusBadge
                  tone={
                    e.status === "published"
                      ? "success"
                      : e.status === "suspended"
                        ? "error"
                        : "neutral"
                  }
                >
                  {e.status}
                </StatusBadge>
                <StatusBadge tone={e.visibility === "public" ? "accent" : "primary"}>
                  {e.visibility}
                </StatusBadge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {format(new Date(e.starts_at), "MMM d · p")} · {e.venue}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {e.status !== "published" && (
              <button
                onClick={() => setStatus(e.id, "published")}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Publish
              </button>
            )}
            {e.status !== "suspended" && (
              <button
                onClick={() => setStatus(e.id, "suspended")}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Suspend
              </button>
            )}
            {e.status !== "cancelled" && (
              <button
                onClick={() => setStatus(e.id, "cancelled")}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-muted"
              >
                Cancel
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
