import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, ErrorState, ListSkeleton, ScrollTabs, StatCard, StatusBadge } from "@/components/ui-kit";
import { ngn } from "@/lib/format";

export const Route = createFileRoute("/app/super/payments")({
  component: SuperPayments,
  head: () => ({
    meta: [
      { title: "Payments across estates — Estate Guard" },
      { name: "description", content: "Platform-wide billing, collections and payment provider settings." },
    ],
  }),
});

type Tab = "estates" | "transactions" | "provider";
type ProviderCfg = {
  provider: string;
  enabled: boolean;
  mode: "test" | "live";
  public_key: string;
  fee_bearer: "estate" | "resident";
  virtual_account_ttl_minutes: number;
};
const DEFAULT_CFG: ProviderCfg = {
  provider: "paystack",
  enabled: false,
  mode: "test",
  public_key: "",
  fee_bearer: "estate",
  virtual_account_ttl_minutes: 60,
};
const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm";

function SuperPayments() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("estates");

  const data = useQuery({
    queryKey: ["super-payments"],
    queryFn: async () => {
      const [estates, bills, txs, cfg] = await Promise.all([
        supabase.from("estates").select("id,name,code,status"),
        supabase.from("bills").select("estate_id,amount,amount_paid,status").limit(10000),
        supabase
          .from("payment_transactions")
          .select("id,estate_id,amount,refunded_amount,provider,channel,provider_reference,status,created_at")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("platform_settings").select("value").eq("key", "payment_provider").maybeSingle(),
      ]);
      for (const r of [estates, bills, txs, cfg]) if (r.error) throw r.error;
      return {
        estates: estates.data ?? [],
        bills: bills.data ?? [],
        txs: txs.data ?? [],
        cfg: { ...DEFAULT_CFG, ...((cfg.data?.value as Partial<ProviderCfg>) ?? {}) },
      };
    },
  });

  const rows = useMemo(() => {
    if (!data.data) return [];
    return data.data.estates
      .map((e) => {
        const b = data.data.bills.filter((x) => x.estate_id === e.id && !["draft", "cancelled"].includes(x.status));
        const billed = b.reduce((s, x) => s + Number(x.amount), 0);
        const collected = b.reduce((s, x) => s + Number(x.amount_paid ?? 0), 0);
        const outstanding = b
          .filter((x) => ["unpaid", "overdue", "partially_paid"].includes(x.status))
          .reduce((s, x) => s + Number(x.amount) - Number(x.amount_paid ?? 0), 0);
        const overdue = b.filter((x) => x.status === "overdue").length;
        return { ...e, billed, collected, outstanding, overdue, rate: billed ? Math.round((collected / billed) * 100) : 0 };
      })
      .sort((a, b) => b.billed - a.billed);
  }, [data.data]);

  const [cfg, setCfg] = useState<ProviderCfg>(DEFAULT_CFG);
  useEffect(() => {
    if (data.data) setCfg(data.data.cfg);
  }, [data.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (cfg.public_key && !/^pk_(test|live)_/.test(cfg.public_key))
        throw new Error("Public key should start with pk_test_ or pk_live_");
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ key: "payment_provider", value: cfg }, { onConflict: "key" });
      if (error) throw error;
      await supabase.rpc("log_activity", {
        _action: "payment_provider.updated",
        _entity: "platform_settings",
        _metadata: { provider: cfg.provider, enabled: cfg.enabled, mode: cfg.mode },
      });
    },
    onSuccess: () => (toast.success("Provider settings saved"), qc.invalidateQueries({ queryKey: ["super-payments"] })),
    onError: (e: Error) => toast.error(e.message),
  });

  if (data.isLoading) return <ListSkeleton rows={6} />;
  if (data.isError || !data.data) return <ErrorState onRetry={() => data.refetch()} />;

  const names = new Map(data.data.estates.map((e) => [e.id, e.name]));
  const tot = rows.reduce(
    (s, r) => ({ billed: s.billed + r.billed, collected: s.collected + r.collected, outstanding: s.outstanding + r.outstanding }),
    { billed: 0, collected: 0, outstanding: 0 },
  );
  const review = data.data.txs.filter((t) => ["unmatched", "under_review"].includes(t.status)).length;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Payments across estates</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total billed" value={ngn(tot.billed)} />
        <StatCard label="Collected" value={ngn(tot.collected)} tone="success" />
        <StatCard label="Outstanding" value={ngn(tot.outstanding)} tone={tot.outstanding ? "warning" : "default"} />
        <StatCard label="Needs review" value={String(review)} tone={review ? "warning" : "default"} />
      </div>
      <ScrollTabs
        value={tab}
        onChange={setTab}
        tabs={
          [
            { key: "estates", label: "By estate" },
            { key: "transactions", label: "Transactions" },
            { key: "provider", label: "Payment provider" },
          ] as const
        }
      />

      {tab === "estates" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Estate</th>
                  <th>Billed</th>
                  <th>Collected</th>
                  <th>Outstanding</th>
                  <th>Overdue</th>
                  <th>Collection rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 font-medium">
                      {r.name} <span className="text-xs text-muted-foreground">{r.code}</span>
                    </td>
                    <td>{ngn(r.billed)}</td>
                    <td>{ngn(r.collected)}</td>
                    <td>{ngn(r.outstanding)}</td>
                    <td>{r.overdue}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${r.rate}%` }} />
                        </div>
                        <span className="text-xs">{r.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "transactions" && (
        <Card>
          {data.data.txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.data.txs.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {ngn(Number(t.amount))} · {names.get(t.estate_id) ?? "Estate"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.provider}/{t.channel ?? "—"} · ref {t.provider_reference ?? "—"} ·{" "}
                      {format(new Date(t.created_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <StatusBadge
                    tone={
                      t.status === "successful"
                        ? "success"
                        : ["failed", "reversed"].includes(t.status)
                          ? "error"
                          : "warning"
                    }
                  >
                    {t.status.replace(/_/g, " ")}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "provider" && (
        <Card>
          <div className="grid max-w-xl gap-3">
            <label className="text-xs font-medium">
              Provider
              <select className={inputCls} value={cfg.provider} onChange={(e) => setCfg({ ...cfg, provider: e.target.value })}>
                <option value="paystack">Paystack</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Mode
              <select
                className={inputCls}
                value={cfg.mode}
                onChange={(e) => setCfg({ ...cfg, mode: e.target.value as ProviderCfg["mode"] })}
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Public key
              <input
                className={inputCls}
                value={cfg.public_key}
                placeholder="pk_test_…"
                onChange={(e) => setCfg({ ...cfg, public_key: e.target.value.trim() })}
              />
            </label>
            <label className="text-xs font-medium">
              Who pays the transaction fee
              <select
                className={inputCls}
                value={cfg.fee_bearer}
                onChange={(e) => setCfg({ ...cfg, fee_bearer: e.target.value as ProviderCfg["fee_bearer"] })}
              >
                <option value="estate">Estate</option>
                <option value="resident">Resident</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Temporary bank account valid for (minutes)
              <input
                type="number"
                min={15}
                max={1440}
                className={inputCls}
                value={cfg.virtual_account_ttl_minutes}
                onChange={(e) => setCfg({ ...cfg, virtual_account_ttl_minutes: Number(e.target.value) })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
              Enable online payments for residents
            </label>
            <p className="text-xs text-muted-foreground">
              The secret key is never stored here — it is kept securely on the server and is added when online payments
              are connected.
            </p>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="w-fit rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              Save settings
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
