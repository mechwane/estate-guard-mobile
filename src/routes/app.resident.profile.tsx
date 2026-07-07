import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { toast } from "sonner";
import { Loader2, Upload, Mail, User, Home, Shield } from "lucide-react";

export const Route = createFileRoute("/app/resident/profile")({
  component: Profile,
});

function Profile() {
  const { data: session, refetch } = useSession();
  const qc = useQueryClient();
  const profile = session?.profile;
  const [personal, setPersonal] = useState({ full_name: "", phone: "" });
  const [address, setAddress] = useState({
    house_number: "",
    block: "",
    street: "",
    unit: "",
    occupant_type: "resident" as "resident" | "commercial",
  });
  const [newEmail, setNewEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPersonal({
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
    });
    setAddress({
      house_number: profile?.house_number ?? "",
      block: profile?.block ?? "",
      street: profile?.street ?? "",
      unit: profile?.unit ?? "",
      occupant_type: (profile?.occupant_type as "resident" | "commercial") ?? "resident",
    });
  }, [profile?.id]);

  useEffect(() => {
    const path = profile?.avatar_url;
    if (!path) return setAvatarUrl(null);
    supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => setAvatarUrl(data?.signedUrl ?? null));
  }, [profile?.avatar_url]);

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
          occupant_type: address.occupant_type,
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
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: false });
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

  return (
    <Stagger className="space-y-4">
      <StaggerItem>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-primary/70 to-primary text-lg font-semibold text-primary-foreground">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {personal.full_name.slice(0, 1).toUpperCase() || "U"}
                </div>
              )}
            </div>
            <div className="flex-1">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                {upload.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Change avatar
              </button>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                PNG / JPG / WEBP · max 2MB
              </p>
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

      <StaggerItem>
        <Section icon={<User className="h-4 w-4" />} title="Personal info">
          <Field label="Full name">
            <input
              value={personal.full_name}
              onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              value={personal.phone}
              onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
              className={inputClass}
            />
          </Field>
          <SaveBtn pending={savePersonal.isPending} onClick={() => savePersonal.mutate()} />
        </Section>
      </StaggerItem>

      <StaggerItem>
        <Section icon={<Home className="h-4 w-4" />} title="Address info">
          <div className="grid grid-cols-2 gap-3">
            <Field label="House no.">
              <input
                value={address.house_number}
                onChange={(e) => setAddress({ ...address, house_number: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Block">
              <input
                value={address.block}
                onChange={(e) => setAddress({ ...address, block: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Street">
            <input
              value={address.street}
              onChange={(e) => setAddress({ ...address, street: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Unit / apartment">
            <input
              value={address.unit}
              onChange={(e) => setAddress({ ...address, unit: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Occupant type">
            <select
              value={address.occupant_type}
              onChange={(e) =>
                setAddress({
                  ...address,
                  occupant_type: e.target.value as "resident" | "commercial",
                })
              }
              className={inputClass}
            >
              <option value="resident">Resident</option>
              <option value="commercial">Commercial</option>
            </select>
          </Field>
          <SaveBtn pending={saveAddress.isPending} onClick={() => saveAddress.mutate()} />
        </Section>
      </StaggerItem>

      <StaggerItem>
        <Section icon={<Shield className="h-4 w-4" />} title="Account">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Sign-in email</div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-foreground">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {session?.email}
            </div>
          </div>
          <Field label="Change email">
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@email.com"
              className={inputClass}
            />
          </Field>
          <button
            onClick={() => changeEmail.mutate()}
            disabled={changeEmail.isPending || !newEmail}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {changeEmail.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send confirmation
          </button>
          <p className="text-[11px] text-muted-foreground">
            You'll get a confirmation email at both your current and new address.
          </p>
        </Section>
      </StaggerItem>
    </Stagger>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <FadeIn>
      <Card className="space-y-3 p-4">
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
