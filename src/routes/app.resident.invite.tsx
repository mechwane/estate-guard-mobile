import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui-kit";

export const Route = createFileRoute("/app/resident/invite")({
  component: InviteGuest,
});

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function InviteGuest() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [f, setF] = useState({
    guest_name: "",
    phone: "",
    purpose: "Visit",
    visit_time: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    hours: 6,
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.userId || !session.estate?.id) return;
    setLoading(true);
    const visit = new Date(f.visit_time);
    const expires = new Date(visit.getTime() + f.hours * 60 * 60 * 1000);

    // retry a few times in case of unique collision
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error, data } = await supabase
        .from("guest_invites")
        .insert({
          estate_id: session.estate.id,
          resident_id: session.userId,
          guest_name: f.guest_name,
          phone: f.phone || null,
          purpose: f.purpose || null,
          visit_time: visit.toISOString(),
          expires_at: expires.toISOString(),
          code,
        })
        .select("id,code")
        .single();
      if (!error && data) {
        await supabase.from("audit_logs").insert({
          estate_id: session.estate.id,
          actor_id: session.userId,
          action: "guest_invite.created",
          entity: "guest_invites",
          entity_id: data.id,
          metadata: { code },
        });
        toast.success(`Invite created · Code ${data.code}`);
        setLoading(false);
        navigate({ to: "/app/resident/guests" });
        return;
      }
      lastErr = error;
    }
    console.error(lastErr);
    toast.error("Could not create invite");
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <p className="text-sm text-muted-foreground">
          A 6-digit code will be generated. Share it with your guest — security will verify it at the gate.
        </p>
      </Card>

      <div className="space-y-3">
        <Field label="Guest name">
          <Input value={f.guest_name} onChange={(v) => setF({ ...f, guest_name: v })} required />
        </Field>
        <Field label="Phone (optional)">
          <Input value={f.phone} onChange={(v) => setF({ ...f, phone: v })} type="tel" />
        </Field>
        <Field label="Purpose">
          <Input value={f.purpose} onChange={(v) => setF({ ...f, purpose: v })} />
        </Field>
        <Field label="Visit time">
          <Input value={f.visit_time} onChange={(v) => setF({ ...f, visit_time: v })} type="datetime-local" required />
        </Field>
        <Field label="Code valid for (hours)">
          <select
            value={f.hours}
            onChange={(e) => setF({ ...f, hours: Number(e.target.value) })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {[2, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} hours</option>)}
          </select>
        </Field>
      </div>

      <button
        type="submit" disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Generate invite
      </button>
    </form>
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
function Input(props: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const { value, onChange, ...rest } = props;
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}
