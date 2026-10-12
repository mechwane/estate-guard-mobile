import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Starts a Paystack checkout (card or temporary bank transfer account) for one bill. */
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
      .select("id,estate_id,resident_id,amount,amount_paid,status,title")
      .eq("id", data.bill_id)
      .maybeSingle();
    if (error || !bill) throw new Error("Bill not found");
    if (bill.resident_id !== context.userId) throw new Error("Not your bill");
    if (!["unpaid", "overdue", "partially_paid"].includes(bill.status)) throw new Error("This bill is not payable");
    const balance = Number(bill.amount) - Number(bill.amount_paid ?? 0);
    if (balance <= 0) throw new Error("Nothing to pay");

    const { data: cfgRow } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "payment_provider")
      .maybeSingle();
    const cfg = (cfgRow?.value ?? {}) as { enabled?: boolean; virtual_account_ttl_minutes?: number };
    if (!cfg.enabled) throw new Error("Online payments are not enabled yet");

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
        metadata: { bill_id: bill.id, estate_id: bill.estate_id, title: bill.title },
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
    const { paystackVerify } = await import("./paystack.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx } = await context.supabase
      .from("payment_transactions")
      .select("id,resident_id")
      .eq("provider_reference", data.reference)
      .maybeSingle();
    if (!tx || tx.resident_id !== context.userId) throw new Error("Payment not found");
    const v = await paystackVerify(data.reference);
    if (v.status !== "success") {
      if (["failed", "abandoned"].includes(v.status))
        await supabaseAdmin.from("payment_transactions").update({ status: "failed" }).eq("id", tx.id);
      return { result: v.status };
    }
    const { data: result, error } = await supabaseAdmin.rpc("apply_provider_payment", {
      _reference: data.reference,
      _amount: v.amount / 100,
      _channel: v.channel,
    });
    if (error) throw new Error(error.message);
    return { result: result as string };
  });
