import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, SheetModal, StatusBadge } from "@/components/ui-kit";
import { maskAcct, useSettlementAccounts } from "@/components/settlement-account-select";
import { createSettlementAccount, listBanks, resolveBankAccount } from "@/lib/paystack.functions";

const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm";
const GATEWAYS = [
  { value: "paystack", label: "Paystack", ready: true },
  { value: "flutterwave", label: "Flutterwave (not connected)", ready: false },
  { value: "monnify", label: "Monnify (not connected)", ready: false },
];

/** Super admin: per-estate payment gateway + the bank accounts each estate's money settles into. */
export function SuperSettlementAccounts({ estates }: { estates: { id: string; name: string; code: string }[] }) {
  const qc = useQueryClient();
  const [estateId, setEstateId] = useState(estates[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const accts = useSettlementAccounts(estateId || null);

  const cfg = useQuery({
    queryKey: ["estate-payment-config", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("estate_payment_config").select("*").eq("estate_id", estateId).maybeSingle();
      if (error) throw error;
      return data ?? { estate_id: estateId, provider: "paystack", enabled: true, default_settlement_account_id: null };
    },
  });
  const [draft, setDraft] = useState<{ provider: string; enabled: boolean; default_settlement_account_id: string | null } | null>(
    null,
  );
  useEffect(() => {
    if (cfg.data) setDraft(cfg.data);
  }, [cfg.data]);

  const saveCfg = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      if (!GATEWAYS.find((g) => g.value === draft.provider)?.ready)
        throw new Error("That gateway isn't connected yet — only Paystack can take payments today");
      const { error } = await supabase
        .from("estate_payment_config")
        .upsert({ estate_id: estateId, ...draft, updated_at: new Date().toISOString() }, { onConflict: "estate_id" });
      if (error) throw error;
      await supabase.rpc("log_activity", {
        _action: "estate_payment_config.updated",
        _entity: "estate",
        _entity_id: estateId,
        _metadata: draft as never,
      });
    },
    onSuccess: () => (toast.success("Estate payment settings saved"), qc.invalidateQueries({ queryKey: ["estate-payment-config"] })),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (a: { id: string; active: boolean }) => {
      const { error } = await supabase.from("settlement_accounts").update({ active: !a.active }).eq("id", a.id);
      if (error) throw error;
      await supabase.rpc("log_activity", {
        _action: a.active ? "settlement_account.disabled" : "settlement_account.enabled",
        _entity: "settlement_account",
        _entity_id: a.id,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settlement-accounts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium">
            Estate
            <select className={inputCls} value={estateId} onChange={(e) => setEstateId(e.target.value)}>
              {estates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.code})
                </option>
              ))}
            </select>
          </label>
          {draft && (
            <>
              <label className="text-xs font-medium">
                Payment gateway for this estate
                <select className={inputCls} value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })}>
                  {GATEWAYS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium">
                Default settlement account
                <select
                  className={inputCls}
                  value={draft.default_settlement_account_id ?? ""}
                  onChange={(e) => setDraft({ ...draft, default_settlement_account_id: e.target.value || null })}
                >
                  <option value="">Platform main account</option>
                  {(accts.data ?? [])
                    .filter((a) => a.active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} · {a.bank_name} {maskAcct(a.account_number)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                Residents of this estate can pay online
              </label>
            </>
          )}
        </div>
        <button
          onClick={() => saveCfg.mutate()}
          disabled={saveCfg.isPending || !draft}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          Save estate settings
        </button>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Settlement accounts</h2>
            <p className="text-xs text-muted-foreground">
              Estate admins pick one of these when they create a payment. They can't add their own.
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            disabled={!estateId}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            Add account
          </button>
        </div>
        {(accts.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No settlement accounts for this estate yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {(accts.data ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    {a.label} {a.purpose && <span className="text-xs text-muted-foreground">— {a.purpose}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.bank_name} · {a.account_number} · {a.account_name ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={a.active ? "success" : "neutral"}>{a.active ? "Active" : "Off"}</StatusBadge>
                  <button onClick={() => toggle.mutate(a)} className="rounded-lg border border-border px-2.5 py-1 text-xs">
                    {a.active ? "Turn off" : "Turn on"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddAccountSheet open={adding} estateId={estateId} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddAccountSheet({ open, estateId, onClose }: { open: boolean; estateId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const banks = useQuery({ queryKey: ["paystack-banks"], enabled: open, staleTime: 36e5, queryFn: () => listBanks() });
  const empty = { label: "", purpose: "", bank_code: "", account_number: "", percentage_charge: "0", account_name: "" };
  const [f, setF] = useState(empty);

  const resolve = useMutation({
    mutationFn: () => resolveBankAccount({ data: { account_number: f.account_number, bank_code: f.bank_code } }),
    onSuccess: (r) => setF((p) => ({ ...p, account_name: r.account_name })),
    onError: (e: Error) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: () =>
      createSettlementAccount({
        data: {
          estate_id: estateId,
          label: f.label,
          purpose: f.purpose || undefined,
          bank_code: f.bank_code,
          bank_name: banks.data?.find((b) => b.code === f.bank_code)?.name ?? "",
          account_number: f.account_number,
          percentage_charge: Number(f.percentage_charge) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Settlement account added");
      qc.invalidateQueries({ queryKey: ["settlement-accounts"] });
      setF(empty);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SheetModal
      open={open}
      title="Add settlement account"
      onClose={onClose}
      footer={
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !f.account_name}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save account"}
        </button>
      }
    >
      <div className="grid gap-3">
        <label className="text-xs font-medium">
          Name shown to estate admin
          <input className={inputCls} placeholder="e.g. Service charge" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        </label>
        <label className="text-xs font-medium">
          What it's for (optional)
          <input
            className={inputCls}
            placeholder="e.g. Levies, fines and shop items"
            value={f.purpose}
            onChange={(e) => setF({ ...f, purpose: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium">
          Bank
          <select
            className={inputCls}
            value={f.bank_code}
            onChange={(e) => setF({ ...f, bank_code: e.target.value, account_name: "" })}
          >
            <option value="">{banks.isLoading ? "Loading banks…" : "Choose bank"}</option>
            {(banks.data ?? []).map((b) => (
              <option key={b.code + b.name} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Account number
          <div className="flex gap-2">
            <input
              className={inputCls}
              inputMode="numeric"
              maxLength={10}
              value={f.account_number}
              onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, ""), account_name: "" })}
            />
            <button
              type="button"
              onClick={() => resolve.mutate()}
              disabled={resolve.isPending || f.account_number.length !== 10 || !f.bank_code}
              className="shrink-0 rounded-lg border border-border px-3 text-xs disabled:opacity-60"
            >
              {resolve.isPending ? "Checking…" : "Check name"}
            </button>
          </div>
        </label>
        {f.account_name && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            Account name: <span className="font-medium">{f.account_name}</span>
          </p>
        )}
        <label className="text-xs font-medium">
          Platform share of each payment (%)
          <input
            type="number"
            min={0}
            max={100}
            className={inputCls}
            value={f.percentage_charge}
            onChange={(e) => setF({ ...f, percentage_charge: e.target.value })}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          The rest of every payment is paid out by Paystack into this account.
        </p>
      </div>
    </SheetModal>
  );
}
