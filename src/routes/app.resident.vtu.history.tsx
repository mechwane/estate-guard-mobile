import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { EmptyState, ListSkeleton, StatusBadge, ErrorState } from "@/components/ui-kit";
import { ngn } from "@/lib/format";
import { format } from "date-fns";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/app/resident/vtu/history")({
  component: History,
});

function History() {
  const { data: session } = useSession();
  const q = useQuery({
    enabled: !!session?.userId,
    queryKey: ["vtu-history", session?.userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vtu_transactions")
        .select("id,service_type,provider_name,recipient,amount,status,reference,created_at,package_label")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (q.isLoading) return <ListSkeleton rows={4} />;
  if (q.error) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data || q.data.length === 0) {
    return <EmptyState icon={<Receipt className="h-8 w-8" />} title="No transactions yet" description="Your VTU purchases will appear here." action={<Link to="/app/resident/vtu" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Buy now</Link>} />;
  }

  return (
    <div className="space-y-2">
      {q.data.map((t) => (
        <div key={t.id} className="card-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold capitalize text-foreground">{t.service_type} · {t.provider_name}</h3>
                <StatusBadge tone={t.status === "success" ? "success" : t.status === "failed" ? "error" : "warning"}>{t.status}</StatusBadge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.recipient}{t.package_label ? ` · ${t.package_label}` : ""}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">{t.reference}</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums">{ngn(t.amount)}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{format(new Date(t.created_at), "MMM d, p")}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
