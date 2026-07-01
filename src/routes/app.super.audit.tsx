import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, EmptyState } from "@/components/ui-kit";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/app/super/audit")({
  component: AuditLogs,
});

function AuditLogs() {
  const { data } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
  });

  if (!data || data.length === 0) return <EmptyState title="No activity yet" icon={<ScrollText className="h-6 w-6" />} />;

  return (
    <div className="space-y-2">
      {data.map((l) => (
        <Card key={l.id} className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{l.action}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {l.entity}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">{format(new Date(l.created_at), "MMM d, HH:mm")}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
