import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { toast } from "sonner";
import { Loader2, Upload, Mail } from "lucide-react";

export const Route = createFileRoute("/app/resident/profile")({
  component: Profile,
});

function Profile() {
  const { data: session, refetch } = useSession();
  const qc = useQueryClient();
  const profile = session?.profile;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.full_name, profile?.phone]);

  // resolve signed avatar url
  useEffect(() => {
    const path = profile?.avatar_url;
    if (!path) { setAvatarUrl(null); return; }
    supabase.storage.from("avatars").createSignedUrl(path, 60 * 60).then(({ data }) => {
      setAvatarUrl(data?.signedUrl ?? null);
    });
  }, [profile?.avatar_url]);

  const save = useMutation({
    mutationFn: async () => {
      if (!session?.userId) throw new Error("Not signed in");
      if (!fullName.trim()) throw new Error("Name is required");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq("id", session.userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["session"] }); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!session?.userId) throw new Error("Not signed in");
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("PNG, JPG or WEBP only");
      if (file.size > 2 * 1024 * 1024) throw new Error("Max 2MB");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${session.userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", session.userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Avatar updated"); qc.invalidateQueries({ queryKey: ["session"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeEmail = useMutation({
    mutationFn: async () => {
      const email = newEmail.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Check both mailboxes to confirm the change"); setNewEmail(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-foreground">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (fullName.slice(0,1).toUpperCase() || "U")}
            </div>
          </div>
          <div className="flex-1">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
            >
              {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Change avatar
            </button>
            <p className="mt-1.5 text-[11px] text-muted-foreground">PNG / JPG / WEBP · max 2MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-primary w-full disabled:opacity-60"
        >
          {save.isPending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />} Save changes
        </button>
      </Card>

      <Card className="space-y-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Sign-in email</div>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-foreground"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {session?.email}</div>
        </div>
        <Field label="Change email">
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" className="input" />
        </Field>
        <button
          onClick={() => changeEmail.mutate()}
          disabled={changeEmail.isPending || !newEmail}
          className="btn-primary w-full disabled:opacity-60"
        >
          Send confirmation
        </button>
        <p className="text-[11px] text-muted-foreground">You'll get a confirmation email at both your current and new address.</p>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
