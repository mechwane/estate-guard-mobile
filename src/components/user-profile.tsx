import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { toast } from "sonner";
import { Fingerprint, Loader2, Mail, ScanFace, Shield, Upload, User, Home } from "lucide-react";

const FACE_TAG = "[face]";
const FINGER_TAG = "[finger]";

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
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "preferred",
        authenticatorAttachment: "platform",
      },
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

export function UserProfile({
  roleLabel,
  showBiometric = false,
}: {
  roleLabel: string;
  /**
   * Show Face Recognition / Fingerprint tiles.
   *
   * NOTE: The in-app WebAuthn toggle is intentionally NOT exposed for
   * staff profiles (admin, guard, super admin). For residents, biometric
   * access is managed as an external-device access mode via the
   * `biometric_access` table — not through phone-fingerprint WebAuthn on
   * the account profile page. Left `false` by default and unused; kept
   * for backwards compatibility with any existing callers.
   */
  showBiometric?: boolean;
}) {
  const { data: session, refetch } = useSession();
  const qc = useQueryClient();
  const profile = session?.profile;
  const [personal, setPersonal] = useState({ full_name: "", phone: "" });
  const [address, setAddress] = useState({
    house_number: "",
    block: "",
    street: "",
    unit: "",
  });
  const [newEmail, setNewEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPersonal({ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "" });
    setAddress({
      house_number: profile?.house_number ?? "",
      block: profile?.block ?? "",
      street: profile?.street ?? "",
      unit: profile?.unit ?? "",
    });
  }, [profile?.id]);

  useEffect(() => {
    const path = profile?.avatar_url;
    if (!path) return setAvatarUrl(null);
    supabase.storage
      .from("avatars")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setAvatarUrl(data?.signedUrl ?? null));
  }, [profile?.avatar_url]);

  const creds = useQuery({
    queryKey: ["my-biometric-credentials", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resident_biometric_credentials")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const hasTag = (tag: string) =>
    (creds.data ?? []).some((c: { device_name: string | null }) =>
      (c.device_name ?? "").includes(tag),
    );

  const toggleBiometric = useMutation({
    mutationFn: async ({ tag, label }: { tag: string; label: string }) => {
      const matches = (creds.data ?? []).filter((c: { id: string; device_name: string | null }) =>
        (c.device_name ?? "").includes(tag),
      );
      if (matches.length > 0) {
        const { error } = await supabase
          .from("resident_biometric_credentials")
          .delete()
          .in(
            "id",
            matches.map((m) => m.id),
          );
        if (error) throw error;
        return "disabled" as const;
      }
      const deviceName = `${tag} ${label}`;
      const cred = await enrollWebAuthn(deviceName);
      const { error } = await supabase.rpc("enroll_biometric_credential" as never, {
        _credential_id: cred.credential_id,
        _public_key: cred.public_key,
        _device_name: deviceName,
        _transports: cred.transports,
      } as never);
      if (error) throw error;
      return "enabled" as const;
    },
    onSuccess: (result, vars) => {
      toast.success(`${vars.label} ${result}`);
      qc.invalidateQueries({ queryKey: ["my-biometric-credentials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePersonal = useMutation({
    mutationFn: async () => {
      if (!session?.userId) throw new Error("Not signed in");
      if (!personal.full_name.trim()) throw new Error("Name is required");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: personal.full_name.trim(),
          phone: personal.phone.trim() || null,
        })
        .eq("id", session.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Personal info updated");
      qc.invalidateQueries({ queryKey: ["session"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAddress = useMutation({
    mutationFn: async () => {
      if (!session?.userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          house_number: address.house_number.trim() || null,
          block: address.block.trim() || null,
          street: address.street.trim() || null,
          unit: address.unit.trim() || null,
        })
        .eq("id", session.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Address updated");
      qc.invalidateQueries({ queryKey: ["session"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.userId) throw new Error("Not signed in");
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("PNG, JPG or WEBP only");
      if (file.size > 2 * 1024 * 1024) throw new Error("Max 2MB");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${session.userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", session.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avatar updated");
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeEmail = useMutation({
    mutationFn: async () => {
      const email = newEmail.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check both mailboxes to confirm the change");
      setNewEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  const faceOn = hasTag(FACE_TAG);
  const fingerOn = hasTag(FINGER_TAG);

  return (
    <Stagger className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
      <StaggerItem className="lg:col-span-2">
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/70 to-primary text-2xl font-semibold text-primary-foreground">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {personal.full_name.slice(0, 1).toUpperCase() || "U"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold">{personal.full_name || "Unnamed user"}</div>
              <div className="text-xs text-muted-foreground">{roleLabel}{session?.estate?.name ? ` · ${session.estate.name}` : ""}</div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Change avatar
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.mutate(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </Card>
      </StaggerItem>

      {showBiometric && (
        <StaggerItem className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BiometricTile
              icon={<ScanFace className="h-5 w-5" />}
              label="Face Recognition"
              enabled={faceOn}
              pending={toggleBiometric.isPending}
              onToggle={() => toggleBiometric.mutate({ tag: FACE_TAG, label: personal.full_name || "user" })}
            />
            <BiometricTile
              icon={<Fingerprint className="h-5 w-5" />}
              label="Fingerprint"
              enabled={fingerOn}
              pending={toggleBiometric.isPending}
              onToggle={() => toggleBiometric.mutate({ tag: FINGER_TAG, label: personal.full_name || "user" })}
            />
          </div>
        </StaggerItem>
      )}

      <StaggerItem>
        <Section icon={<User className="h-4 w-4" />} title="Personal info">
          <Field label="Full name">
            <input value={personal.full_name} onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} className={inputClass} />
          </Field>
          <SaveBtn pending={savePersonal.isPending} onClick={() => savePersonal.mutate()} />
        </Section>
      </StaggerItem>

      <StaggerItem>
        <Section icon={<Home className="h-4 w-4" />} title="Address / office">
          <div className="grid grid-cols-2 gap-3">
            <Field label="House / Office no.">
              <input value={address.house_number} onChange={(e) => setAddress({ ...address, house_number: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Block">
              <input value={address.block} onChange={(e) => setAddress({ ...address, block: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field label="Street">
            <input value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Unit">
            <input value={address.unit} onChange={(e) => setAddress({ ...address, unit: e.target.value })} className={inputClass} />
          </Field>
          <SaveBtn pending={saveAddress.isPending} onClick={() => saveAddress.mutate()} />
        </Section>
      </StaggerItem>

      <StaggerItem className="lg:col-span-2">
        <Section icon={<Shield className="h-4 w-4" />} title="Account">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Sign-in email</div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-foreground">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {session?.email}
            </div>
          </div>
          <Field label="Change email">
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" className={inputClass} />
          </Field>
          <button
            onClick={() => changeEmail.mutate()}
            disabled={changeEmail.isPending || !newEmail}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {changeEmail.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send confirmation
          </button>
        </Section>
      </StaggerItem>
    </Stagger>
  );
}

function BiometricTile({
  icon,
  label,
  enabled,
  pending,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${enabled ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{label}</div>
          <div className={`text-[11px] font-medium uppercase tracking-wider ${enabled ? "text-primary" : "text-muted-foreground"}`}>
            {enabled ? "Active" : "Disabled"}
          </div>
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={pending}
        aria-label={`Toggle ${label}`}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"} disabled:opacity-60`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <FadeIn>
      <Card className="h-full space-y-3 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="text-primary">{icon}</span> {title}
        </div>
        {children}
      </Card>
    </FadeIn>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SaveBtn({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
    </button>
  );
}
