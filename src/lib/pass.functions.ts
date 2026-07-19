import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function fromB64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

type IssueInput = {
  credential_id: string;
  challenge_id: string;
  client_data_json: string; // base64url
  authenticator_data: string; // base64url
  signature: string; // base64url
  kind: "self" | "guest";
  guest_name?: string | null;
  ttl_minutes: number;
};

export const beginPassChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { credential_id: string }) => {
    if (!data?.credential_id || typeof data.credential_id !== "string") {
      throw new Error("credential_id required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc(
      "begin_pass_challenge" as never,
      { _credential_id: data.credential_id } as never,
    );
    if (error) throw new Error(error.message);
    return res as { id: string; challenge: string };
  });

export const issuePassVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: IssueInput) => {
    if (!data?.credential_id || !data?.challenge_id) throw new Error("missing credential/challenge");
    if (!data?.client_data_json || !data?.authenticator_data || !data?.signature) {
      throw new Error("missing assertion fields");
    }
    if (data.kind !== "self" && data.kind !== "guest") throw new Error("invalid kind");
    if (typeof data.ttl_minutes !== "number") throw new Error("ttl_minutes required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { createHash, createVerify, createPublicKey } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load stored public key + verify challenge belongs to user & is fresh
    const { data: cred, error: credErr } = await context.supabase
      .from("resident_biometric_credentials")
      .select("public_key, credential_id, user_id")
      .eq("credential_id", data.credential_id)
      .maybeSingle();
    if (credErr || !cred) throw new Error("Credential not found");
    if (cred.user_id !== context.userId) throw new Error("Credential does not belong to caller");

    const { data: chalRow, error: chalErr } = await supabaseAdmin
      .from("webauthn_challenges" as never)
      .select("id, user_id, credential_id, challenge, consumed_at, expires_at, purpose")
      .eq("id", data.challenge_id)
      .maybeSingle();
    if (chalErr || !chalRow) throw new Error("Challenge not found");
    const chal = chalRow as {
      id: string;
      user_id: string;
      credential_id: string;
      challenge: string;
      consumed_at: string | null;
      expires_at: string;
      purpose: string;
    };
    if (chal.user_id !== context.userId) throw new Error("Challenge does not belong to caller");
    if (chal.consumed_at) throw new Error("Challenge already used");
    if (new Date(chal.expires_at) < new Date()) throw new Error("Challenge expired");
    if (chal.purpose !== "issue_pass" || chal.credential_id !== data.credential_id) {
      throw new Error("Challenge purpose mismatch");
    }

    // Validate clientDataJSON contents
    const clientDataBuf = fromB64Url(data.client_data_json);
    let clientData: { type?: string; challenge?: string; origin?: string };
    try {
      clientData = JSON.parse(clientDataBuf.toString("utf8"));
    } catch {
      throw new Error("Invalid clientDataJSON");
    }
    if (clientData.type !== "webauthn.get") throw new Error("Wrong assertion type");
    if (clientData.challenge !== chal.challenge) throw new Error("Challenge mismatch");

    // Compute signed data: authenticatorData || SHA256(clientDataJSON)
    const authData = fromB64Url(data.authenticator_data);
    const clientDataHash = createHash("sha256").update(clientDataBuf).digest();
    const signedData = Buffer.concat([authData, clientDataHash]);
    const signature = fromB64Url(data.signature);

    // Load stored SPKI public key
    let pubKey;
    try {
      pubKey = createPublicKey({
        key: fromB64Url(cred.public_key),
        format: "der",
        type: "spki",
      });
    } catch {
      throw new Error("Stored public key invalid");
    }

    const alg = pubKey.asymmetricKeyType;
    const verifier = createVerify("sha256");
    verifier.update(signedData);
    verifier.end();

    let ok = false;
    if (alg === "ec") {
      ok = verifier.verify({ key: pubKey, dsaEncoding: "der" }, signature);
    } else if (alg === "rsa") {
      ok = verifier.verify(pubKey, signature);
    } else {
      throw new Error(`Unsupported key type: ${alg}`);
    }
    if (!ok) throw new Error("Biometric signature invalid");

    // Signature verified — issue pass via service-role RPC
    const { data: issued, error: issueErr } = await supabaseAdmin.rpc(
      "issue_resident_pass_verified" as never,
      {
        _user_id: context.userId,
        _kind: data.kind,
        _guest_name: data.guest_name ?? null,
        _ttl_minutes: data.ttl_minutes,
        _credential_id: data.credential_id,
        _challenge_id: data.challenge_id,
      } as never,
    );
    if (issueErr) throw new Error(issueErr.message);
    return issued as { id: string; code: string; expires_at: string; kind: string };
  });
