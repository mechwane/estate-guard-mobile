import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, formatDistanceToNow } from "date-fns";
import { Fingerprint, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, EmptyState, ErrorState, ListSkeleton, StatusBadge } from "@/components/ui-kit";
import { beginPassChallenge, issuePassVerified } from "@/lib/pass.functions";

export const Route = createFileRoute("/app/resident/pass")({
  component: BiometricPass,
  head: () => ({ meta: [{ title: "My Pass — Estate Guard" }] }),
});

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomChallenge() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr;
}

async function enrollWebAuthn(displayName: string) {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    throw new Error("Biometric not supported on this device");
  }
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "Estate Guard" },
      user: { id: userId, name: displayName, displayName },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Enrolment cancelled");
  const response = cred.response as AuthenticatorAttestationResponse;
  return {
    credential_id: cred.id,
    public_key: b64url(new Uint8Array(response.getPublicKey?.() ?? new ArrayBuffer(0))),
    transports: (response.getTransports?.() ?? []) as string[],
  };
}

async function verifyWebAuthn(credentialId: string) {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    throw new Error("Biometric not supported on this device");
  }
  const idBytes = Uint8Array.from(atob(credentialId.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ id: idBytes, type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  if (!cred) throw new Error("Verification cancelled");
}

function BiometricPass() {
  const qc = useQueryClient();
  const [deviceName, setDeviceName] = useState("");
  const [kind, setKind] = useState<"self" | "guest">("self");
  const [guestName, setGuestName] = useState("");
  const [ttl, setTtl] = useState(30);

  const creds = useQuery({
    queryKey: ["my-biometric-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resident_biometric_credentials").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const passes = useQuery({
    queryKey: ["my-passes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resident_passes").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const enroll = useMutation({
    mutationFn: async () => {
      const label = deviceName.trim() || (typeof navigator !== "undefined" ? navigator.userAgent.split(" ").slice(-1)[0] : "This device");
      const cred = await enrollWebAuthn(label);
      const { error } = await supabase.rpc("enroll_biometric_credential" as never, {
        _credential_id: cred.credential_id,
        _public_key: cred.public_key,
        _device_name: label,
        _transports: cred.transports,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Device enrolled");
      setDeviceName("");
      qc.invalidateQueries({ queryKey: ["my-biometric-credentials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCred = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resident_biometric_credentials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["my-biometric-credentials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issue = useMutation({
    mutationFn: async () => {
      const cred = (creds.data ?? [])[0] as any;
      if (!cred) throw new Error("Enrol a biometric device first");
      await verifyWebAuthn(cred.credential_id);
      const { data, error } = await supabase.rpc("issue_resident_pass" as never, {
        _kind: kind,
        _guest_name: kind === "guest" ? guestName : null,
        _ttl_minutes: ttl,
        _credential_id: cred.credential_id,
      } as never);
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res: any) => {
      toast.success(`Pass ready: ${res?.code}`);
      setGuestName("");
      qc.invalidateQueries({ queryKey: ["my-passes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasCred = (creds.data ?? []).length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My pass</h1>
        <p className="text-xs text-muted-foreground">Unlock a gate pass with your fingerprint or face — no typed code needed.</p>
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Fingerprint className="h-4 w-4 text-primary" /> Biometric devices
        </h2>
        {creds.isLoading ? <ListSkeleton rows={2} /> : creds.isError ? <ErrorState onRetry={() => creds.refetch()} /> : (
          <>
            {(creds.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices enrolled yet.</p>
            ) : (
              <ul className="space-y-2">
                {(creds.data ?? []).map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{c.device_name ?? "Enrolled device"}</div>
                      <div className="text-xs text-muted-foreground">Added {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</div>
                    </div>
                    <button onClick={() => removeCred.mutate(c.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="Device name (optional)" className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm" />
              <button onClick={() => enroll.mutate()} disabled={enroll.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
                {enroll.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />} Enrol
              </button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" /> Issue a pass
        </h2>
        {!hasCred ? (
          <EmptyState title="Enrol first" description="Enrol at least one biometric device before issuing passes." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <select value={kind} onChange={(e) => setKind(e.target.value as "self" | "guest")} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <option value="self">For me</option>
                <option value="guest">For a guest</option>
              </select>
              <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <option value={15}>Valid 15 min</option>
                <option value={30}>Valid 30 min</option>
                <option value={60}>Valid 1 hour</option>
                <option value={240}>Valid 4 hours</option>
                <option value={1440}>Valid 24 hours</option>
              </select>
              {kind === "guest" && (
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest name" className="col-span-2 rounded-lg border border-border bg-card px-3 py-2 text-sm" />
              )}
            </div>
            <button onClick={() => issue.mutate()} disabled={issue.isPending} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
              {issue.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />} Verify & issue
            </button>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Recent passes</h2>
        {passes.isLoading ? <ListSkeleton rows={2} /> : (passes.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No passes yet.</p>
        ) : (
          <ul className="space-y-2">
            {(passes.data ?? []).map((p: any) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div>
                  <div className="font-mono text-base font-semibold tracking-widest">{p.code}</div>
                  <div className="text-xs text-muted-foreground">{p.kind}{p.guest_name ? ` · ${p.guest_name}` : ""} · expires {format(new Date(p.expires_at), "MMM d, HH:mm")}</div>
                </div>
                <StatusBadge tone={p.used_at ? "success" : new Date(p.expires_at) < new Date() ? "warning" : "primary"}>
                  {p.used_at ? "Used" : new Date(p.expires_at) < new Date() ? "Expired" : "Active"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
