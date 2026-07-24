import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, EmptyState, ErrorState, ListSkeleton, StatCard, StatusBadge } from "@/components/ui-kit";
import { ngn } from "@/lib/format";

export const Route = createFileRoute("/app/super/plans")({
  component: PlansAndRevenue,
  head: () => ({ meta: [{ title: "Plans & Revenue — Estate Guard" }] }),
});

function PlansAndRevenue() {
  const qc = useQueryClient();

  const rollup = useQuery({
    queryKey: ["platform-rollup"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("platform_rollup" as never);
      if (error) throw error;
      return data as any;
    },
  });

  const plans = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_plans").select("*").order("monthly_ngn");
      if (error) throw error;
      return data ?? [];
    },
  });

  const estates = useQuery({
    queryKey: ["estates-for-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("id,name,code,status").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [assign, setAssign] = useState<{ estate_id: string; plan_id: string; status: string }>({ estate_id: "", plan_id: "", status: "active" });

  const setPlan = useMutation({
    mutationFn: async () => {
      if (!assign.estate_id || !assign.plan_id) throw new Error("Pick estate and plan");
      const { error } = await supabase.rpc("set_estate_plan" as never, {
        _estate_id: assign.estate_id,
        _plan_id: assign.plan_id,
        _status: assign.status,
        _expires_at: null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["platform-rollup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subs = (rollup.data?.subscriptions ?? []) as Array<any>;
  const monthlyRevenue = useMemo(
    () => subs.filter((s) => s.status === "active").reduce((sum, s) => sum + Number(s.monthly_ngn ?? 0), 0),
    [subs],
  );

  if (rollup.isLoading || plans.isLoading || estates.isLoading) return <ListSkeleton rows={5} />;
  if (rollup.isError || plans.isError || estates.isError) return <ErrorState onRetry={() => rollup.refetch()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Plans & revenue</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active subs" value={subs.filter((s) => s.status === "active").length} tone="primary" />
        <StatCard label="Monthly revenue" value={ngn(monthlyRevenue)} tone="success" />
        <StatCard label="Estates" value={rollup.data?.estates?.total ?? 0} />
        <StatCard label="Users" value={rollup.data?.users?.total ?? 0} />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Assign / change plan</h2>
        <div className="grid grid-cols-3 gap-2">
          <select value={assign.estate_id} onChange={(e) => setAssign({ ...assign, estate_id: e.target.value })} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <option value="">Estate…</option>
            {(estates.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={assign.plan_id} onChange={(e) => setAssign({ ...assign, plan_id: e.target.value })} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <option value="">Plan…</option>
            {(plans.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name} · {ngn(Number(p.monthly_ngn))}</option>)}
          </select>
          <select value={assign.status} onChange={(e) => setAssign({ ...assign, status: e.target.value })} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="past_due">Past due</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button onClick={() => setPlan.mutate()} disabled={setPlan.isPending} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">Save plan</button>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Plans</h2>
        {(plans.data ?? []).length === 0 ? (
          <EmptyState title="No plans yet" description="Insert rows into platform_plans to define pricing tiers." />
        ) : (
          <ul className="space-y-2">
            {(plans.data ?? []).map((p: any) => {
              const limits = (p.limits ?? {}) as Record<string, unknown>;
              const entries = Object.entries(limits);
              return (
                <li key={p.id} className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.active ? "Available" : "Hidden"}</div>
                    </div>
                    <div className="text-sm font-semibold">{ngn(Number(p.monthly_ngn))}/mo</div>
                  </div>
                  {entries.length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                      {entries.map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <dt className="capitalize">{k.replace(/_/g, " ")}</dt>
                          <dd className="font-medium text-foreground">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Subscriptions</h2>
        {subs.length === 0 ? (
          <EmptyState title="No subscriptions yet" description="Assign an estate to a plan above." />
        ) : (
          <ul className="space-y-2">
            {subs.map((s) => (
              <li key={s.estate_id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{s.estate_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.plan_name ?? "No plan"} · {ngn(Number(s.monthly_ngn ?? 0))}/mo
                    {s.expires_at ? ` · until ${format(new Date(s.expires_at), "MMM d, yyyy")}` : ""}
                  </div>
                </div>
                <StatusBadge tone={s.status === "active" ? "success" : s.status === "past_due" ? "warning" : "neutral"}>{s.status}</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
