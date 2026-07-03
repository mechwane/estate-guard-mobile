import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { Users } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/admin/guests")({
  component: AdminGuestLogs,
});

function AdminGuestLogs() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const { data } = useQuery({
    queryKey: ["admin-guests", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_invites")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 20_000,
  });

  if (!data || data.length === 0)
    return <EmptyState title="No guest activity" icon={<Users className="h-6 w-6" />} />;

  return (
    <div className="space-y-2">
      {data.map((g) => (
        <Card key={g.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{g.guest_name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {g.purpose || "Visit"} · {format(new Date(g.visit_time), "MMM d, p")}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {g.checked_in_at
                  ? `In ${format(new Date(g.checked_in_at), "MMM d, p")}`
                  : "not checked in"}
                {g.checked_out_at && ` · Out ${format(new Date(g.checked_out_at), "p")}`}
              </div>
            </div>
            <StatusBadge
              tone={g.status === "active" ? "primary" : g.status === "used" ? "success" : "neutral"}
            >
              {g.status}
            </StatusBadge>
          </div>
        </Card>
      ))}
    </div>
  );
}
