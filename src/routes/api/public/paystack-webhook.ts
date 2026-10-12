import { createFileRoute } from "@tanstack/react-router";

// Paystack calls this after a payment. Signature is verified before anything is trusted,
// and the amount is re-checked against Paystack's own verify endpoint.
export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { hmacSha512Hex, paystackVerify } = await import("@/lib/paystack.server");
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("not configured", { status: 503 });
        const body = await request.text();
        const sig = request.headers.get("x-paystack-signature") ?? "";
        const expected = await hmacSha512Hex(secret, body);
        if (sig.length !== expected.length || sig !== expected) return new Response("bad signature", { status: 401 });

        let event: { event?: string; data?: { reference?: string } };
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("bad json", { status: 400 });
        }
        if (event.event !== "charge.success" || !event.data?.reference) return new Response("ignored");

        const v = await paystackVerify(event.data.reference);
        if (v.status !== "success") return new Response("not successful");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("apply_provider_payment", {
          _reference: v.reference,
          _amount: v.amount / 100,
          _channel: v.channel,
        });
        if (error) return new Response("error", { status: 500 });
        return new Response("ok");
      },
    },
  },
});
