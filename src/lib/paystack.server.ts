// Server-only Paystack helpers. Never import from client components.
export const PAYSTACK_API = "https://api.paystack.co";

export function paystackKey(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("Online payments are not connected yet. Please contact your estate admin.");
  return k;
}

export async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${paystackKey()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || !json.status || json.data === undefined) throw new Error(json.message ?? "Paystack request failed");
  return json.data;
}

export type PaystackVerified = {
  status: string;
  amount: number; // kobo, what the customer was charged (can include fees passed to the customer)
  requested_amount?: number; // kobo, the amount we asked for (before customer-borne fees)
  fees?: number | null;
  currency: string;
  channel: string;
  reference: string;
  paid_at?: string | null;
  gateway_response?: string;
  customer?: { email?: string };
  authorization?: { last4?: string; bank?: string; card_type?: string; brand?: string; channel?: string };
  subaccount?: { subaccount_code?: string; account_number?: string; settlement_bank?: string } | null;
};

export async function paystackVerify(reference: string) {
  return paystackFetch<PaystackVerified>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Applies a Paystack-verified payment to its bill. The bill is cleared with the amount we asked
 * Paystack to collect (requested_amount) — fees Paystack adds on top for the customer do not
 * count as an over/under payment. Every verification is stored for disputes (super admin only).
 */
export async function applyVerifiedPayment(reference: string, source: "callback" | "webhook" | "sync") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const v = await paystackVerify(reference);
  const { data: tx } = await supabaseAdmin
    .from("payment_transactions")
    .select("id,estate_id,status")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (tx) {
    await supabaseAdmin.from("payment_provider_events").insert({
      transaction_id: tx.id,
      estate_id: tx.estate_id,
      reference,
      source,
      payload: v as never,
    });
  }
  if (v.status !== "success") {
    if (tx && ["failed", "abandoned", "reversed"].includes(v.status) && tx.status !== "successful")
      await supabaseAdmin.from("payment_transactions").update({ status: "failed", note: v.gateway_response ?? v.status }).eq("id", tx.id);
    return v.status;
  }
  if (v.currency && v.currency !== "NGN") return "wrong_currency";
  const kobo = typeof v.requested_amount === "number" && v.requested_amount > 0 ? v.requested_amount : v.amount;
  if (tx) {
    await supabaseAdmin
      .from("payment_transactions")
      .update({ fees: (v.fees ?? 0) / 100, paid_at: v.paid_at ?? new Date().toISOString() })
      .eq("id", tx.id);
  }
  const { data: result, error } = await supabaseAdmin.rpc("apply_provider_payment", {
    _reference: reference,
    _amount: kobo / 100,
    _channel: v.channel,
  });
  if (error) throw new Error(error.message);
  return result as string;
}

export async function hmacSha512Hex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
