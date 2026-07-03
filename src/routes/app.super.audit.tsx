import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, EmptyState } from "@/components/ui-kit";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/app/super/audit")({
  component: AuditLogs,
});

function AuditLogs() {
  const [estateId, setEstateId] = useState<string>("");
  const [days, setDays] = useState<number>(7);

  const { data: estates } = useQuery({
    queryKey: ["audit-estates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("id,name,code").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data } = useQuery({
    queryKey: ["audit-logs", estateId, days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 864e5).toISOString();
      let q = supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(300);
      if (estateId) q = q.eq("estate_id", estateId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    refetchInterval: 20_000,
  });

  const estateMap = useMemo(() => new Map((estates ?? []).map((e) => [e.id, e])), [estates]);

  return (
    <div className="space-y-3">
      <Card className="grid grid-cols-2 gap-2 p-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Estate
          </span>
          <select
            value={estateId}
            onChange={(e) => setEstateId(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
          >
            <option value="">All estates</option>
            {(estates ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.code})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Range
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </Card>

      {!data || data.length === 0 ? (
        <EmptyState title="No activity in this range" icon={<ScrollText className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {data.map((l) => {
            const est = l.estate_id ? estateMap.get(l.estate_id) : null;
            return (
              <Card key={l.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{l.action}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {l.entity}
                      {l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}
                      {est ? ` · ${est.name}` : ""}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(l.created_at), "MMM d, HH:mm")}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
