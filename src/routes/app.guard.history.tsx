import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { format, formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";

export const Route = createFileRoute("/app/guard/history")({
  component: GuardHistory,
});

function GuardHistory() {
  const { data: session } = useSession();
  const { data } = useQuery({
    queryKey: ["guard-history", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_invites")
        .select("*")
        .eq("validated_by", session!.userId!)
        .order("checked_in_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  if (!data || data.length === 0) return <EmptyState title="No validations yet" icon={<History className="h-6 w-6" />} />;

  return (
    <div className="space-y-2">
      {data.map((i) => (
        <Card key={i.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{i.guest_name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {i.checked_in_at ? `In ${format(new Date(i.checked_in_at), "MMM d, p")}` : "—"}
                {i.checked_out_at && ` · Out ${format(new Date(i.checked_out_at), "p")}`}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(i.checked_in_at ?? i.created_at), { addSuffix: true })}</div>
            </div>
            <StatusBadge tone="success">{i.status}</StatusBadge>
          </div>
        </Card>
      ))}
    </div>
  );
}
