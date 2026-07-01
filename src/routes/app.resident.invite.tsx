import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import { Loader2, Copy, MessageCircle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui-kit";
import { format } from "date-fns";

export const Route = createFileRoute("/app/resident/invite")({
  component: InviteGuest,
});

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

type Created = { id: string; code: string; guest_name: string; visit_time: string; expires_at: string; num_guests: number };

function InviteGuest() {
  const { data: session } = useSession();
  const [f, setF] = useState({
    guest_name: "",
    phone: "",
    purpose: "Visit",
    visit_time: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    hours: 6,
    num_guests: 1,
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.userId || !session.estate?.id) return;
    setLoading(true);
    const visit = new Date(f.visit_time);
    const expires = new Date(visit.getTime() + f.hours * 60 * 60 * 1000);

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
          num_guests: f.num_guests,
          code,
        })
        .select("id,code,guest_name,visit_time,expires_at,num_guests")
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
        toast.success("Invite created");
        setCreated(data as Created);
        setLoading(false);
        return;
      }
      lastErr = error;
    }
    console.error(lastErr);
    toast.error("Could not create invite");
    setLoading(false);
  };

  if (created) return <InviteSuccess invite={created} estateName={session?.estate?.name ?? ""} onNew={() => { setCreated(null); setF({ ...f, guest_name: "", phone: "" }); }} />;

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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Visit time">
            <Input value={f.visit_time} onChange={(v) => setF({ ...f, visit_time: v })} type="datetime-local" required />
          </Field>
          <Field label="Guests">
            <Input value={String(f.num_guests)} onChange={(v) => setF({ ...f, num_guests: Math.max(1, Math.min(20, Number(v) || 1)) })} type="number" min={1} max={20} />
          </Field>
        </div>
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

function InviteSuccess({ invite, estateName, onNew }: { invite: Created; estateName: string; onNew: () => void }) {
  const message =
    `${estateName} — Guest access code\n` +
    `Code: ${invite.code}\n` +
    `Guest: ${invite.guest_name}${invite.num_guests > 1 ? ` (+${invite.num_guests - 1})` : ""}\n` +
    `Visit: ${format(new Date(invite.visit_time), "MMM d, p")}\n` +
    `Valid until: ${format(new Date(invite.expires_at), "MMM d, p")}`;
  const copy = async () => { await navigator.clipboard.writeText(invite.code); toast.success("Code copied"); };
  const copyMsg = async () => { await navigator.clipboard.writeText(message); toast.success("Message copied"); };
  const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="bg-gradient-to-br from-[color:var(--color-primary-dark)] to-[color:var(--color-primary)] text-primary-foreground">
        <div className="flex items-center gap-2 text-primary-foreground/80"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wider">Invite ready</span></div>
        <div className="mt-3 font-mono text-4xl font-semibold tracking-[0.35em]">{invite.code}</div>
        <div className="mt-2 text-sm text-primary-foreground/80">{invite.guest_name} · {format(new Date(invite.visit_time), "MMM d, p")}</div>
        <div className="mt-0.5 text-xs text-primary-foreground/70">Valid until {format(new Date(invite.expires_at), "MMM d, p")}</div>
      </Card>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={copy} className="card-surface flex flex-col items-center gap-1 p-3 text-xs font-medium text-foreground hover:bg-muted/40"><Copy className="h-4 w-4 text-primary" />Copy code</button>
        <button onClick={copyMsg} className="card-surface flex flex-col items-center gap-1 p-3 text-xs font-medium text-foreground hover:bg-muted/40"><Copy className="h-4 w-4 text-primary" />Copy note</button>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="card-surface flex flex-col items-center gap-1 p-3 text-xs font-medium text-foreground hover:bg-muted/40"><MessageCircle className="h-4 w-4 text-primary" />WhatsApp</a>
      </div>
      <div className="flex gap-2">
        <button onClick={onNew} className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">New invite</button>
        <Link to="/app/resident/guests" className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary-dark">View guests</Link>
      </div>
    </div>
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
