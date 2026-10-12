// Server-only Paystack helpers. Never import from client components.
export const PAYSTACK_API = "https://api.paystack.co";

export function paystackKey(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("Online payments are not connected yet. Please contact your estate admin.");
  return k;
}

export async function paystackVerify(reference: string) {
  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackKey()}` },
  });
  const json = (await res.json()) as {
    status: boolean;
    data?: { status: string; amount: number; channel: string; reference: string };
  };
  if (!res.ok || !json.status || !json.data) throw new Error("Could not verify payment with Paystack");
  return json.data;
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
