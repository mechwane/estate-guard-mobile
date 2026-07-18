import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, StatCard } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/troubleshoot")({
  component: Troubleshoot,
  head: () => ({ meta: [{ title: "Troubleshoot — Estate Guard" }] }),
});

function Troubleshoot() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const health = useQuery({
    queryKey: ["admin-troubleshoot", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [orphanInvites, unassignedGuards, staleRequests, staleIssues] = await Promise.all([
        supabase.from("guest_invites").select("id", { count: "exact", head: true }).eq("estate_id", estateId!).not("checked_in_at", "is", null).is("checked_out_at", null).lt("expires_at", new Date().toISOString()),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("estate_id", estateId!).eq("approved", false),
        supabase.from("resident_requests").select("id", { count: "exact", head: true }).eq("estate_id", estateId!).in("status", ["pending", "under_review"]).lt("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
        supabase.from("issues").select("id", { count: "exact", head: true }).eq("estate_id", estateId!).in("status", ["open", "in_progress"]).lt("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
      ]);
      return {
        orphanInvites: orphanInvites.count ?? 0,
        unassignedGuards: unassignedGuards.count ?? 0,
        staleRequests: staleRequests.count ?? 0,
        staleIssues: staleIssues.count ?? 0,
      };
    },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (health.isLoading) return <ListSkeleton rows={3} />;
  if (health.isError) return <ErrorState onRetry={() => health.refetch()} />;
  const h = health.data!;
  const items: [string, string, string][] = [
    ["Missing exits", h.orphanInvites > 0 ? `${h.orphanInvites} guests checked in but never exited before their pass expired. Ask guards to check them out or revoke.` : "All good — every check-in has a matching exit.", "/app/admin/realtime"],
    ["Pending approvals", h.unassignedGuards > 0 ? `${h.unassignedGuards} profiles are waiting for approval.` : "No pending approvals.", "/app/admin/verifications"],
    ["Stale requests", h.staleRequests > 0 ? `${h.staleRequests} resident requests older than 7 days need review.` : "Requests are on track.", "/app/admin/requests"],
    ["Stale incidents", h.staleIssues > 0 ? `${h.staleIssues} incidents open for more than 7 days.` : "No stale incidents.", "/app/admin/issues"],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Troubleshoot</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Missing exits" value={h.orphanInvites} tone={h.orphanInvites ? "warning" : "default"} />
        <StatCard label="Pending" value={h.unassignedGuards} tone={h.unassignedGuards ? "primary" : "default"} />
        <StatCard label="Stale requests" value={h.staleRequests} tone={h.staleRequests ? "warning" : "default"} />
        <StatCard label="Stale incidents" value={h.staleIssues} tone={h.staleIssues ? "warning" : "default"} />
      </div>
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><LifeBuoy className="h-4 w-4 text-primary" /> Health checks</h2>
        <ul className="space-y-2">
          {items.map(([label, desc, href]) => (
            <li key={label} className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">{label}</div>
                <a href={`#${href}`} className="text-xs text-primary hover:underline">Open</a>
              </div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
