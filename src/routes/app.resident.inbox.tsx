import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState } from "@/components/ui-kit";
import { FadeIn, StaggerItem, Stagger } from "@/components/motion-kit";
import { Bell, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/inbox")({
  component: Inbox,
});

function Inbox() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["notifications", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", session!.userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", session!.userId!)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked all as read");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
    },
  });

  const items = list.data ?? [];
  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {items.length === 0
              ? "You have no notifications yet"
              : `${unreadCount} unread of ${items.length}`}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
      </FadeIn>

      {items.length === 0 ? (
        <EmptyState
          title="No inbox yet"
          description="Notifications from your estate will show up here."
          icon={<Bell className="h-6 w-6" />}
        />
      ) : (
        <Stagger className="space-y-2">
          {items.map((n) => (
            <StaggerItem key={n.id}>
              <Card className={`p-4 ${!n.read_at ? "border-primary/30 bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{n.title}</div>
                    {n.body && (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {format(new Date(n.created_at), "MMM d, yyyy · HH:mm")}
                    </div>
                  </div>
                  {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
