import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, StatCard, ListSkeleton, EmptyState, ErrorState, StatusBadge } from "@/components/ui-kit";
import { format, formatDistanceToNow } from "date-fns";
import { Shield, LogIn, LogOut, AlertTriangle, ScrollText, Users } from "lucide-react";

export const Route = createFileRoute("/app/guard/")({
  component: GuardDashboard,
});

function GuardDashboard() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayISO = startOfDay.toISOString();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["guard-dashboard", estateId, todayISO],
    enabled: !!estateId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const nowISO = new Date().toISOString();
      const [inside, active, checkedIn, checkedOut, openIncidents, recentValidations] = await Promise.all([
        supabase.from("guest_invites").select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!).not("checked_in_at", "is", null).is("checked_out_at", null),
        supabase.from("guest_invites").select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!).eq("status", "active").gte("expires_at", nowISO),
        supabase.from("guest_invites").select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!).gte("checked_in_at", todayISO),
        supabase.from("guest_invites").select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!).gte("checked_out_at", todayISO),
        supabase.from("issues").select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!).neq("status", "resolved"),
        supabase.from("guest_invites").select("id,guest_name,checked_in_at,checked_out_at,status")
          .eq("estate_id", estateId!).order("updated_at", { ascending: false }).limit(6),
      ]);
      return {
        inside: inside.count ?? 0,
        active: active.count ?? 0,
        checkedIn: checkedIn.count ?? 0,
        checkedOut: checkedOut.count ?? 0,
        openIncidents: openIncidents.count ?? 0,
        recent: recentValidations.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Inside now" value={isLoading ? "—" : data!.inside} tone="primary" />
        <StatCard label="Active passes" value={isLoading ? "—" : data!.active} />
        <StatCard label="Entries today" value={isLoading ? "—" : data!.checkedIn} tone="success" />
        <StatCard label="Exits today" value={isLoading ? "—" : data!.checkedOut} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/app/guard/validate" className="card-surface flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-muted/40">
          <Shield className="h-4 w-4" /> Validate code
        </Link>
        <Link to="/app/guard/active" className="card-surface flex items-center justify-center gap-2 py-3 text-sm font-medium text-foreground hover:bg-muted/40">
          <Users className="h-4 w-4" /> Active visitors
        </Link>
        <Link to="/app/guard/incidents" className="card-surface flex items-center justify-center gap-2 py-3 text-sm font-medium text-foreground hover:bg-muted/40">
          <AlertTriangle className="h-4 w-4" /> Incidents ({isLoading ? "—" : data!.openIncidents})
        </Link>
        <Link to="/app/guard/history" className="card-surface flex items-center justify-center gap-2 py-3 text-sm font-medium text-foreground hover:bg-muted/40">
          <ScrollText className="h-4 w-4" /> History
        </Link>
      </div>

      <h2 className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent gate activity</h2>
      {isError ? <ErrorState onRetry={() => refetch()} /> :
       isLoading ? <ListSkeleton rows={3} /> :
       data!.recent.length === 0 ? <EmptyState title="No recent activity" icon={<ScrollText className="h-6 w-6" />} /> :
       <div className="space-y-2">
         {data!.recent.map((r: any) => (
           <Card key={r.id} className="p-4">
             <div className="flex items-start justify-between gap-3">
               <div className="min-w-0">
                 <div className="truncate text-sm font-medium text-foreground">{r.guest_name}</div>
                 <div className="mt-0.5 text-xs text-muted-foreground">
                   {r.checked_out_at ? <><LogOut className="inline h-3 w-3" /> Out {format(new Date(r.checked_out_at), "p")}</>
                    : r.checked_in_at ? <><LogIn className="inline h-3 w-3" /> In {format(new Date(r.checked_in_at), "p")}</>
                    : "Awaiting arrival"}
                   {" · "}
                   {formatDistanceToNow(new Date(r.checked_out_at ?? r.checked_in_at ?? Date.now()), { addSuffix: true })}
                 </div>
               </div>
               <StatusBadge tone={r.status === "active" ? "primary" : r.status === "used" ? "success" : "neutral"}>{r.status}</StatusBadge>
             </div>
           </Card>
         ))}
       </div>}
    </div>
  );
}
