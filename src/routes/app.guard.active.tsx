import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ListSkeleton, ErrorState, SearchInput, StatusBadge } from "@/components/ui-kit";
import { format } from "date-fns";
import { LogOut, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/guard/active")({
  component: ActiveVisitors,
});

function ActiveVisitors() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["guard-active", estateId],
    enabled: !!estateId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_invites")
        .select("id,guest_name,phone,purpose,checked_in_at,validated_by,resident_id,num_guests,status")
        .eq("estate_id", estateId!)
        .not("checked_in_at", "is", null)
        .is("checked_out_at", null)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const checkOut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("guard_check_out" as any, { _invite_id: id } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Exit recorded"); qc.invalidateQueries({ queryKey: ["guard-active"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((v) =>
    !q || v.guest_name.toLowerCase().includes(q.toLowerCase()) || (v.phone ?? "").includes(q));

  return (
    <div className="space-y-3">
      <SearchInput value={q} onChange={setQ} placeholder="Search name or phone" />
      {isError ? <ErrorState onRetry={() => refetch()} /> :
       isLoading ? <ListSkeleton rows={4} /> :
       filtered.length === 0 ? <EmptyState title="No visitors inside" icon={<Users className="h-6 w-6" />} /> :
       <div className="space-y-2">
         {filtered.map((v) => (
           <Card key={v.id} className="p-4">
             <div className="flex items-start justify-between gap-3">
               <div className="min-w-0">
                 <div className="truncate text-sm font-medium text-foreground">{v.guest_name}</div>
                 <div className="mt-0.5 text-xs text-muted-foreground">
                   {v.purpose ?? "Visit"}{v.num_guests > 1 ? ` · ${v.num_guests} guests` : ""} · In {v.checked_in_at ? format(new Date(v.checked_in_at), "MMM d, p") : "—"}
                 </div>
                 {v.phone && <div className="mt-0.5 text-xs text-muted-foreground">{v.phone}</div>}
               </div>
               <StatusBadge tone="primary">Inside</StatusBadge>
             </div>
             <button
               onClick={() => {
                 if (confirm(`Record exit for ${v.guest_name}?`)) checkOut.mutate(v.id);
               }}
               disabled={checkOut.isPending}
               className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
             >
               {checkOut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Record exit
             </button>
           </Card>
         ))}
       </div>}
    </div>
  );
}
