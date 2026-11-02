import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Starts a Paystack checkout for one bill, routed to the estate's chosen settlement account. */
export const startBillPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bill_id: string; return_url: string }) => {
    if (!d?.bill_id || typeof d.bill_id !== "string") throw new Error("bill_id required");
    const u = new URL(d.return_url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("Invalid return url");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { PAYSTACK_API, paystackKey } = await import("./paystack.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Read bill as the user (RLS: residents see only their own bills).
    const { data: bill, error } = await context.supabase
      .from("bills")
      .select("id,estate_id,resident_id,amount,amount_paid,status,title,collection_id,batch_id")
      .eq("id", data.bill_id)
      .maybeSingle();
    if (error || !bill) throw new Error("Bill not found");
    if (bill.resident_id !== context.userId) throw new Error("Not your bill");
    if (!["unpaid", "overdue", "partially_paid"].includes(bill.status)) throw new Error("This bill is not payable");
    const balance = Number(bill.amount) - Number(bill.amount_paid ?? 0);
    if (balance <= 0) throw new Error("Nothing to pay");

    const [{ data: cfgRow }, { data: estCfg }] = await Promise.all([
      supabaseAdmin.from("platform_settings").select("value").eq("key", "payment_provider").maybeSingle(),
      supabaseAdmin.from("estate_payment_config").select("*").eq("estate_id", bill.estate_id).maybeSingle(),
    ]);
    const cfg = (cfgRow?.value ?? {}) as { enabled?: boolean; fee_bearer?: string };
    if (!cfg.enabled) throw new Error("Online payments are not enabled yet");
    if (estCfg && !estCfg.enabled) throw new Error("Online payments are turned off for your estate");
    if (estCfg && estCfg.provider !== "paystack") throw new Error("Your estate's payment method is not available yet");

    // Settlement account: the bill's collection/bill run first, then the estate default.
    let accountId: string | null = null;
    if (bill.collection_id) {
      const { data: c } = await supabaseAdmin.from("collections").select("settlement_account_id").eq("id", bill.collection_id).maybeSingle();
      accountId = c?.settlement_account_id ?? null;
    }
    if (!accountId && bill.batch_id) {
      const { data: b } = await supabaseAdmin.from("bill_batches").select("settlement_account_id").eq("id", bill.batch_id).maybeSingle();
      accountId = b?.settlement_account_id ?? null;
    }
    accountId = accountId ?? estCfg?.default_settlement_account_id ?? null;
    let subaccount: string | null = null;
    if (accountId) {
      const { data: acct } = await supabaseAdmin
        .from("settlement_accounts")
        .select("id,estate_id,active,subaccount_code")
        .eq("id", accountId)
        .maybeSingle();
      if (acct && acct.estate_id === bill.estate_id && acct.active && acct.subaccount_code) subaccount = acct.subaccount_code;
      else accountId = null;
    }

    const { data: userRes } = await context.supabase.auth.getUser();
    const email = userRes.user?.email;
    if (!email) throw new Error("Your account needs an email to pay online");

    const reference = `EG-${bill.id.slice(0, 8)}-${Date.now().toString(36)}`.toUpperCase();
    const { error: txErr } = await supabaseAdmin.from("payment_transactions").insert({
      estate_id: bill.estate_id,
      bill_id: bill.id,
      resident_id: bill.resident_id,
      amount: balance,
      provider: "paystack",
      provider_reference: reference,
      idempotency_key: `paystack:${reference}`,
      settlement_account_id: accountId,
      status: "initiated",
    });
    if (txErr) throw new Error(txErr.message);

    const callback = new URL(data.return_url);
    callback.searchParams.set("ref", reference);
    const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${paystackKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: Math.round(balance * 100),
        currency: "NGN",
        reference,
        callback_url: callback.toString(),
        channels: ["card", "bank_transfer", "bank", "ussd"],
        ...(subaccount ? { subaccount, bearer: cfg.fee_bearer === "estate" ? "subaccount" : "account" } : {}),
        metadata: { bill_id: bill.id, estate_id: bill.estate_id, title: bill.title, settlement_account_id: accountId },
      }),
    });
    const json = (await res.json()) as { status: boolean; message?: string; data?: { authorization_url: string } };
    if (!res.ok || !json.status || !json.data) {
      await supabaseAdmin
        .from("payment_transactions")
        .update({ status: "failed", note: json.message ?? "init failed" })
        .eq("provider_reference", reference);
      throw new Error(json.message ?? "Could not start payment");
    }
    await supabaseAdmin.from("payment_transactions").update({ status: "pending" }).eq("provider_reference", reference);
    return { url: json.data.authorization_url, reference };
  });

/** Confirms a payment with Paystack (server-side) after the resident returns. */
export const confirmBillPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reference: string }) => {
    if (!d?.reference || !/^[A-Z0-9-]{6,64}$/.test(d.reference)) throw new Error("Invalid reference");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { applyVerifiedPayment } = await import("./paystack.server");
    const { data: tx } = await context.supabase
      .from("payment_transactions")
      .select("id,resident_id")
      .eq("provider_reference", data.reference)
      .maybeSingle();
    if (!tx || tx.resident_id !== context.userId) throw new Error("Payment not found");
    return { result: await applyVerifiedPayment(data.reference, "callback") };
  });

/**
 * Re-checks the signed-in resident's recent unfinished payments with Paystack, so a bill still
 * clears if the resident closed the page before returning to the app.
 */
export const syncMyPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { applyVerifiedPayment } = await import("./paystack.server");
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    const { data: txs } = await context.supabase
      .from("payment_transactions")
      .select("provider_reference,status,note")
      .eq("resident_id", context.userId)
      .eq("provider", "paystack")
      .in("status", ["initiated", "pending", "under_review"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8);
    let applied = 0;
    for (const t of txs ?? []) {
      if (!t.provider_reference) continue;
      if (t.status === "under_review" && !(t.note ?? "").includes("amount mismatch")) continue;
      try {
        const r = await applyVerifiedPayment(t.provider_reference, "sync");
        if (r === "applied") applied++;
      } catch {
        // Not found at Paystack yet (checkout never completed) — leave it.
      }
    }
    return { applied };
  });

// ---------------- Super admin: settlement accounts ----------------

async function assertSuper(supabase: { rpc: (fn: "is_super_admin") => PromiseLike<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_super_admin");
  if (data !== true) throw new Error("Only the platform admin can manage settlement accounts");
}

export const listBanks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.supabase);
    const { paystackFetch } = await import("./paystack.server");
    const banks = await paystackFetch<{ name: string; code: string; active: boolean }[]>(
      "/bank?country=nigeria&perPage=200",
    );
    return banks.filter((b) => b.active !== false).map((b) => ({ name: b.name, code: b.code }));
  });

export const resolveBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { account_number: string; bank_code: string }) => {
    if (!/^\d{10}$/.test(d?.account_number ?? "")) throw new Error("Account number must be 10 digits");
    if (!/^[0-9A-Za-z]{2,10}$/.test(d?.bank_code ?? "")) throw new Error("Choose a bank");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase);
    const { paystackFetch } = await import("./paystack.server");
    const r = await paystackFetch<{ account_name: string }>(
      `/bank/resolve?account_number=${data.account_number}&bank_code=${encodeURIComponent(data.bank_code)}`,
    );
    return { account_name: r.account_name };
  });

export const createSettlementAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      estate_id: string;
      label: string;
      purpose?: string;
      bank_code: string;
      bank_name: string;
      account_number: string;
      percentage_charge: number;
    }) => {
      if (!d?.estate_id) throw new Error("Choose an estate");
      if (!d.label?.trim()) throw new Error("Give the account a name, e.g. Service charge");
      if (!/^\d{10}$/.test(d.account_number ?? "")) throw new Error("Account number must be 10 digits");
      if (!d.bank_code) throw new Error("Choose a bank");
      const pc = Number(d.percentage_charge ?? 0);
      if (!(pc >= 0 && pc <= 100)) throw new Error("Platform share must be between 0 and 100%");
      return { ...d, label: d.label.trim().slice(0, 80), purpose: d.purpose?.trim().slice(0, 120), percentage_charge: pc };
    },
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase);
    const { paystackFetch } = await import("./paystack.server");
    const { data: estate } = await context.supabase.from("estates").select("id,name").eq("id", data.estate_id).maybeSingle();
    if (!estate) throw new Error("Estate not found");
    const sub = await paystackFetch<{ subaccount_code: string; account_name?: string }>("/subaccount", {
      method: "POST",
      body: JSON.stringify({
        business_name: `${estate.name} — ${data.label}`.slice(0, 100),
        settlement_bank: data.bank_code,
        account_number: data.account_number,
        percentage_charge: data.percentage_charge,
        description: data.purpose ?? data.label,
      }),
    });
    const { data: row, error } = await context.supabase
      .from("settlement_accounts")
      .insert({
        estate_id: data.estate_id,
        label: data.label,
        purpose: data.purpose ?? null,
        bank_code: data.bank_code,
        bank_name: data.bank_name,
        account_number: data.account_number,
        account_name: sub.account_name ?? null,
        subaccount_code: sub.subaccount_code,
        percentage_charge: data.percentage_charge,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.rpc("log_activity", {
      _action: "settlement_account.created",
      _entity: "settlement_account",
      _entity_id: row.id,
      _metadata: { estate_id: data.estate_id, label: data.label, bank: data.bank_name },
    });
    return { id: row.id };
  });
