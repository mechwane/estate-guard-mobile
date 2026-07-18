// Lightweight biometric step-up: if the current browser has a WebAuthn
// credential enrolled locally we ask the platform authenticator to verify;
// otherwise we fall back to a native confirm() dialog. Result is a boolean.

import { supabase } from "@/integrations/supabase/client";

function randomChallenge() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr;
}

function fromB64Url(s: string) {
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

export async function biometricConfirm(message: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (window.PublicKeyCredential) {
      const { data } = await supabase
        .from("resident_biometric_credentials")
        .select("credential_id")
        .limit(5);
      const ids = (data ?? []).map((r: { credential_id: string }) => r.credential_id).filter(Boolean);
      if (ids.length) {
        const cred = await navigator.credentials.get({
          publicKey: {
            challenge: randomChallenge(),
            allowCredentials: ids.map((id) => ({ id: fromB64Url(id), type: "public-key" as const })),
            userVerification: "required",
            timeout: 60_000,
          },
        });
        return !!cred;
      }
    }
  } catch {
    return false;
  }
  return typeof window !== "undefined" ? window.confirm(message) : false;
}
