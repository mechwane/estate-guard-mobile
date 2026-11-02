import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SettlementAccount = {
  id: string;
  label: string;
  purpose: string | null;
  bank_name: string;
  account_number: string;
  account_name: string | null;
  active: boolean;
};

export function useSettlementAccounts(estateId?: string | null) {
  return useQuery({
    queryKey: ["settlement-accounts", estateId ?? "mine"],
    queryFn: async () => {
      let q = supabase
        .from("settlement_accounts")
        .select("id,label,purpose,bank_name,account_number,account_name,active")
        .order("label");
      if (estateId) q = q.eq("estate_id", estateId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SettlementAccount[];
    },
  });
}

export const maskAcct = (n: string) => `•••• ${n.slice(-4)}`;

/**
 * Lets an estate admin pick where money for a payment is settled. Accounts are set up by the
 * platform (super) admin only, so admins can never type in their own bank details.
 */
export function SettlementAccountSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string, label: string) => void;
  className?: string;
}) {
  const accts = useSettlementAccounts();
  const list = (accts.data ?? []).filter((a) => a.active);
  return (
    <div className="space-y-1">
      <select
        className={className}
        value={value}
        onChange={(e) => {
          const a = list.find((x) => x.id === e.target.value);
          onChange(e.target.value, a?.label ?? "");
        }}
      >
        <option value="">Select settlement account — estate default</option>
        {list.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label} · {a.bank_name} {maskAcct(a.account_number)}
          </option>
        ))}
      </select>
      {!accts.isLoading && list.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No settlement accounts yet. Ask the platform admin to add your estate's bank accounts.
        </p>
      )}
    </div>
  );
}
