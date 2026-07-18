import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, StatusBadge } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/vehicles")({
  component: VehicleTags,
  head: () => ({ meta: [{ title: "Vehicle Tags — Estate Guard" }] }),
});

function VehicleTags() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const tags = useQuery({
    queryKey: ["admin-vehicle-tags", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_tags").select("*").eq("estate_id", estateId!).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const residents = useQuery({
    queryKey: ["profiles-for-vehicles", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,unit").eq("estate_id", estateId!);
      if (error) throw error; return data ?? [];
    },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  const name = (id: string) => residents.data?.find((r) => r.id === id)?.full_name ?? id.slice(0, 8);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Vehicle tags</h1>
      <Card>
        {tags.isLoading ? <ListSkeleton rows={3} /> : tags.isError ? <ErrorState onRetry={() => tags.refetch()} /> : (tags.data ?? []).length === 0 ? (
          <EmptyState title="No vehicles registered" description="Residents can register their vehicles from the app." />
        ) : (
          <ul className="space-y-2">
            {(tags.data ?? []).map((v: any) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-mono font-semibold uppercase">{v.plate}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {name(v.resident_id)}{v.make_model ? ` · ${v.make_model}` : ""}{v.color ? ` · ${v.color}` : ""}{v.tag_number ? ` · Tag ${v.tag_number}` : ""}
                  </div>
                </div>
                <StatusBadge tone={v.active ? "success" : "neutral"}>{v.active ? "Active" : "Inactive"}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
