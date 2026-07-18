import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/dependents")({
  component: Dependents,
  head: () => ({ meta: [{ title: "Dependants — Estate Guard" }] }),
});

function Dependents() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const rows = useQuery({
    queryKey: ["admin-dependents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("dependents").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const residents = useQuery({
    queryKey: ["profiles-for-deps", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,unit").eq("estate_id", estateId!);
      if (error) throw error; return data ?? [];
    },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  const nameOf = (id: string) => residents.data?.find((r) => r.id === id)?.full_name ?? id.slice(0, 8);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Dependants</h1>
      <Card>
        {rows.isLoading ? <ListSkeleton rows={3} /> : rows.isError ? <ErrorState onRetry={() => rows.refetch()} /> : (rows.data ?? []).length === 0 ? (
          <EmptyState title="No dependants" description="Residents can add household members from their profile." />
        ) : (
          <ul className="space-y-2">
            {(rows.data ?? []).map((d: any) => (
              <li key={d.id} className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{d.full_name}</div>
                  <div className="text-xs text-muted-foreground">{d.relationship ?? ""}{d.age ? ` · ${d.age}y` : ""}</div>
                </div>
                <div className="text-xs text-muted-foreground truncate">Household of {nameOf(d.resident_id)}{d.phone ? ` · ${d.phone}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
