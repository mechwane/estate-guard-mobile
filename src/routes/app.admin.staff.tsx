import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/app/admin/staff")({
  component: AdminStaff,
});

function AdminStaff() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const { data } = useQuery({
    queryKey: ["admin-staff", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      // Guards in this estate: profiles joined with user_roles=guard
      const { data: roles, error: e1 } = await supabase.from("user_roles").select("user_id,role").eq("role", "guard");
      if (e1) throw e1;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs, error: e2 } = await supabase.from("profiles").select("*").in("id", ids).eq("estate_id", estateId!);
      if (e2) throw e2;
      return profs;
    },
  });

  if (!data || data.length === 0) return <EmptyState title="No guards assigned yet" description="Guards sign up with the estate code and role 'guard'. Approve them here." icon={<Shield className="h-6 w-6" />} />;

  return (
    <div className="space-y-2">
      {data.map((g) => (
        <Card key={g.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{g.full_name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Guard · {g.phone ?? "no phone"}</div>
            </div>
            <StatusBadge tone={g.approved ? "success" : "warning"}>{g.approved ? "active" : "pending"}</StatusBadge>
          </div>
        </Card>
      ))}
    </div>
  );
}
