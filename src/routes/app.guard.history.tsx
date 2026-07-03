import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ListSkeleton, ErrorState, SearchInput, StatusBadge } from "@/components/ui-kit";
import { format } from "date-fns";
import { History, Car, User, LogIn, LogOut, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/guard/history")({
  component: GuardHistory,
});

type Filter = "today" | "7d" | "30d" | "inside" | "exited" | "missing" | "custom";

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function GuardHistory() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("today");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const range = useMemo(() => {
    const now = new Date();
    if (filter === "today") return { from: startOfDay(now).toISOString(), to: null as string | null };
    if (filter === "7d") return { from: startOfDay(new Date(now.getTime() - 6 * 864e5)).toISOString(), to: null };
    if (filter === "30d") return { from: startOfDay(new Date(now.getTime() - 29 * 864e5)).toISOString(), to: null };
    if (filter === "custom") return {
      from: from ? new Date(from).toISOString() : null,
      to: to ? new Date(new Date(to).getTime() + 864e5 - 1).toISOString() : null,
    };
    return { from: null, to: null };
  }, [filter, from, to]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["guard-history", estateId, filter, range.from, range.to],
    enabled: !!estateId,
    queryFn: async () => {
      let sel = supabase
        .from("guest_invites")
        .select("id,guest_name,phone,purpose,code,visit_time,status,checked_in_at,checked_out_at,validated_by,exited_by,vehicle_number,num_guests,resident_id,created_at")
        .eq("estate_id", estateId!)
        .order("checked_in_at", { ascending: false, nullsFirst: false })
        .limit(200);

      if (filter === "inside") sel = sel.not("checked_in_at", "is", null).is("checked_out_at", null);
      else if (filter === "exited") sel = sel.not("checked_out_at", "is", null);
      else if (filter === "missing") {
        // entered but no exit and expired
        sel = sel.not("checked_in_at", "is", null).is("checked_out_at", null).lt("expires_at", new Date().toISOString());
      } else {
        if (range.from) sel = sel.gte("checked_in_at", range.from);
        if (range.to) sel = sel.lte("checked_in_at", range.to);
        // require an entry to be part of history
        sel = sel.not("checked_in_at", "is", null);
      }
      const { data, error } = await sel;
      if (error) throw error;
      const rows = data ?? [];

      // resolve host + guard names in batch
      const ids = Array.from(new Set([
        ...rows.map((r: any) => r.resident_id),
        ...rows.map((r: any) => r.validated_by).filter(Boolean),
        ...rows.map((r: any) => r.exited_by).filter(Boolean),
      ]));
      let people: Record<string, { full_name: string; unit: string | null }> = {};
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id,full_name,unit").in("id", ids as string[]);
        (ps ?? []).forEach((p: any) => { people[p.id] = { full_name: p.full_name, unit: p.unit }; });
      }
      return rows.map((r: any) => ({ ...r, host: people[r.resident_id], entryGuard: r.validated_by ? people[r.validated_by] : null, exitGuard: r.exited_by ? people[r.exited_by] : null }));
    },
  });

  const filtered = (data ?? []).filter((r: any) =>
    !q ||
    r.guest_name.toLowerCase().includes(q.toLowerCase()) ||
    (r.phone ?? "").includes(q) ||
    (r.vehicle_number ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (r.host?.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const chip = (k: Filter, label: string) => (
    <button key={k} onClick={() => setFilter(k)}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${filter === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {chip("today", "Today")}
        {chip("7d", "Last 7 days")}
        {chip("30d", "Last 30 days")}
        {chip("inside", "Currently inside")}
        {chip("exited", "Exited")}
        {chip("missing", "Missing exit")}
        {chip("custom", "Custom")}
      </div>

      {filter === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-lg border border-border bg-card px-2 py-2 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block"><span className="mb-1 block text-[11px] font-medium text-muted-foreground">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-lg border border-border bg-card px-2 py-2 text-sm outline-none focus:border-primary" />
          </label>
        </div>
      )}

      <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, vehicle, host" />

      {isError ? <ErrorState onRetry={() => refetch()} /> :
       isLoading ? <ListSkeleton rows={5} /> :
       filtered.length === 0 ? <EmptyState title="No records" description="No entry or exit activity matches these filters." icon={<History className="h-6 w-6" />} /> :
       <div className="space-y-2">
         {filtered.map((r: any) => {
           const inside = r.checked_in_at && !r.checked_out_at;
           const missing = inside && new Date(r.visit_time).getTime() < Date.now() - 24 * 3600 * 1000;
           const codeShort = `••${(r.code ?? "").slice(-2)}`;
           return (
             <Card key={r.id} className="p-4">
               <div className="flex items-start justify-between gap-3">
                 <div className="min-w-0">
                   <div className="truncate text-sm font-medium text-foreground">{r.guest_name}</div>
                   <div className="mt-0.5 text-xs text-muted-foreground">
                     Code {codeShort}{r.num_guests > 1 ? ` · ${r.num_guests} guests` : ""}
                   </div>
                   {r.host && (
                     <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                       <User className="h-3 w-3" /> Host {r.host.full_name}{r.host.unit ? ` · Unit ${r.host.unit}` : ""}
                     </div>
                   )}
                   {r.vehicle_number && (
                     <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                       <Car className="h-3 w-3" /> {r.vehicle_number}
                     </div>
                   )}
                 </div>
                 <StatusBadge tone={missing ? "warning" : inside ? "primary" : "success"}>
                   {missing ? "Missing exit" : inside ? "Inside" : "Exited"}
                 </StatusBadge>
               </div>

               <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                 <div className="rounded-lg border border-border bg-card/40 p-2">
                   <div className="flex items-center gap-1 text-muted-foreground"><LogIn className="h-3 w-3" /> Entry</div>
                   <div className="mt-0.5 text-foreground">{r.checked_in_at ? format(new Date(r.checked_in_at), "MMM d, p") : "—"}</div>
                   {r.entryGuard && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /> {r.entryGuard.full_name}</div>}
                 </div>
                 <div className="rounded-lg border border-border bg-card/40 p-2">
                   <div className="flex items-center gap-1 text-muted-foreground"><LogOut className="h-3 w-3" /> Exit</div>
                   <div className="mt-0.5 text-foreground">{r.checked_out_at ? format(new Date(r.checked_out_at), "MMM d, p") : "—"}</div>
                   {r.exitGuard && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /> {r.exitGuard.full_name}</div>}
                 </div>
               </div>
             </Card>
           );
         })}
       </div>}
    </div>
  );
}
