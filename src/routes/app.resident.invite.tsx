import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import { Loader2, Copy, MessageCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { format } from "date-fns";

type Search = { bulk?: string };

export const Route = createFileRoute("/app/resident/invite")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    bulk: typeof s.bulk === "string" ? s.bulk : undefined,
  }),
  component: InviteRouter,
});

function InviteRouter() {
  const { bulk } = useSearch({ from: "/app/resident/invite" });
  return bulk ? <BulkInvite /> : <InviteGuest />;
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const MAX_GUESTS_BULK = 20;

type Created = {
  id: string;
  code: string;
  guest_name: string;
  visit_time: string;
  expires_at: string;
  num_guests: number;
};

/* -------------------------- Single invite -------------------------- */

function InviteGuest() {
  const { data: session } = useSession();
  const [f, setF] = useState({
    guest_name: "",
    phone: "",
    purpose: "Visit",
    visit_time: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    hours: 6,
    num_guests: 1,
    vehicle_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.userId || !session.estate?.id) return;
    const guestName = f.guest_name.trim();
    const phone = f.phone.trim();
    if (guestName.length < 2) return toast.error("Enter the guest's name");
    if (phone && !/^[+\d][\d\s\-()]{5,}$/.test(phone))
      return toast.error("Enter a valid phone number");
    const visit = new Date(f.visit_time);
    if (isNaN(visit.getTime())) return toast.error("Choose a valid visit time");
    const expires = new Date(visit.getTime() + f.hours * 60 * 60 * 1000);
    if (expires.getTime() < Date.now()) return toast.error("Expiry must be in the future");

    setLoading(true);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error, data } = await supabase
        .from("guest_invites")
        .insert({
          estate_id: session.estate.id,
          resident_id: session.userId,
          guest_name: guestName,
          phone: phone || null,
          purpose: f.purpose.trim() || null,
          visit_time: visit.toISOString(),
          expires_at: expires.toISOString(),
          num_guests: f.num_guests,
          vehicle_number: f.vehicle_number.trim() || null,
          code,
        })
        .select("id,code,guest_name,visit_time,expires_at,num_guests")
        .single();
      if (!error && data) {
        toast.success("Invite created");
        setCreated(data as Created);
        setLoading(false);
        return;
      }
    }
    toast.error("Could not create invite");
    setLoading(false);
  };

  if (created)
    return (
      <InviteSuccess
        invite={created}
        estateName={session?.estate?.name ?? ""}
        onNew={() => {
          setCreated(null);
          setF({ ...f, guest_name: "", phone: "", vehicle_number: "" });
        }}
      />
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <p className="text-sm text-muted-foreground">
          A 6-digit code will be generated. Share it with your guest — security will verify it at
          the gate.
        </p>
      </Card>
      <div className="space-y-3">
        <Field label="Guest name">
          <Input value={f.guest_name} onChange={(v) => setF({ ...f, guest_name: v })} required />
        </Field>
        <Field label="Phone (optional)">
          <Input value={f.phone} onChange={(v) => setF({ ...f, phone: v })} type="tel" />
        </Field>
        <Field label="Vehicle number (optional)">
          <Input
            value={f.vehicle_number}
            onChange={(v) => setF({ ...f, vehicle_number: v.toUpperCase() })}
          />
        </Field>
        <Field label="Purpose">
          <Input value={f.purpose} onChange={(v) => setF({ ...f, purpose: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Visit time">
            <Input
              value={f.visit_time}
              onChange={(v) => setF({ ...f, visit_time: v })}
              type="datetime-local"
              required
            />
          </Field>
          <Field label="Guests">
            <Input
              value={String(f.num_guests)}
              onChange={(v) =>
                setF({ ...f, num_guests: Math.max(1, Math.min(20, Number(v) || 1)) })
              }
              type="number"
              min={1}
              max={20}
            />
          </Field>
        </div>
        <Field label="Code valid for (hours)">
          <select
            value={f.hours}
            onChange={(e) => setF({ ...f, hours: Number(e.target.value) })}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {[2, 6, 12, 24, 48].map((h) => (
              <option key={h} value={h}>
                {h} hours
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Generate invite
      </button>
    </form>
  );
}

/* -------------------------- Bulk invite -------------------------- */

type Row = { guest_name: string; phone: string; vehicle_number: string };

function BulkInvite() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<Row[]>([
    { guest_name: "", phone: "", vehicle_number: "" },
    { guest_name: "", phone: "", vehicle_number: "" },
  ]);
  const [purpose, setPurpose] = useState("Visit");
  const [visitTime, setVisitTime] = useState(
    new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [hours, setHours] = useState(6);
  const [mode, setMode] = useState<"group" | "separate">("separate");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ name: string; code?: string; error?: string }[] | null>(
    null,
  );

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () =>
    setRows((rs) =>
      rs.length >= MAX_GUESTS_BULK
        ? rs
        : [...rs, { guest_name: "", phone: "", vehicle_number: "" }],
    );
  const remove = (i: number) =>
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((_, idx) => idx !== i)));

  const validate = (): Row[] | null => {
    const cleaned = rows
      .map((r) => ({
        guest_name: r.guest_name.trim(),
        phone: r.phone.trim(),
        vehicle_number: r.vehicle_number.trim().toUpperCase(),
      }))
      .filter((r) => r.guest_name.length > 0);
    if (cleaned.length === 0) {
      toast.error("Add at least one visitor");
      return null;
    }
    for (const r of cleaned) {
      if (r.guest_name.length < 2) {
        toast.error("Each visitor needs a name");
        return null;
      }
      if (r.phone && !/^[+\d][\d\s\-()]{5,}$/.test(r.phone)) {
        toast.error(`Invalid phone for ${r.guest_name}`);
        return null;
      }
    }
    const seen = new Set<string>();
    for (const r of cleaned) {
      const k = r.guest_name.toLowerCase() + "|" + r.phone;
      if (seen.has(k)) {
        toast.error(`Duplicate entry: ${r.guest_name}`);
        return null;
      }
      seen.add(k);
    }
    if (cleaned.length > MAX_GUESTS_BULK) {
      toast.error(`Maximum ${MAX_GUESTS_BULK} visitors per submission`);
      return null;
    }
    return cleaned;
  };

  const submit = async () => {
    if (!session?.userId || !session.estate?.id) return;
    const cleaned = validate();
    if (!cleaned) return;
    const visit = new Date(visitTime);
    if (isNaN(visit.getTime())) return toast.error("Pick a valid visit time");
    const expires = new Date(visit.getTime() + hours * 60 * 60 * 1000);
    if (expires.getTime() < Date.now()) return toast.error("Expiry must be in the future");

    setLoading(true);
    const out: { name: string; code?: string; error?: string }[] = [];

    if (mode === "group") {
      // one shared code covering all guests
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const names = cleaned.map((r) => r.guest_name).join(", ");
        const { error, data } = await supabase
          .from("guest_invites")
          .insert({
            estate_id: session.estate.id,
            resident_id: session.userId,
            guest_name: names,
            phone: cleaned[0].phone || null,
            purpose: purpose.trim() || null,
            visit_time: visit.toISOString(),
            expires_at: expires.toISOString(),
            num_guests: cleaned.length,
            vehicle_number: cleaned.find((r) => r.vehicle_number)?.vehicle_number || null,
            code,
          })
          .select("code")
          .single();
        if (!error && data) {
          out.push({ name: `Group of ${cleaned.length}`, code: data.code });
          break;
        }
        if (attempt === 4) out.push({ name: "Group invite", error: "Failed" });
      }
    } else {
      for (const r of cleaned) {
        let ok = false;
        for (let attempt = 0; attempt < 5 && !ok; attempt++) {
          const code = generateCode();
          const { error, data } = await supabase
            .from("guest_invites")
            .insert({
              estate_id: session.estate.id,
              resident_id: session.userId,
              guest_name: r.guest_name,
              phone: r.phone || null,
              purpose: purpose.trim() || null,
              visit_time: visit.toISOString(),
              expires_at: expires.toISOString(),
              num_guests: 1,
              vehicle_number: r.vehicle_number || null,
              code,
            })
            .select("code")
            .single();
          if (!error && data) {
            out.push({ name: r.guest_name, code: data.code });
            ok = true;
          }
        }
        if (!ok) out.push({ name: r.guest_name, error: "Failed" });
      }
    }
    setResults(out);
    setLoading(false);
    const failed = out.filter((r) => r.error).length;
    if (failed === 0) toast.success(`Created ${out.length} invitation${out.length > 1 ? "s" : ""}`);
    else toast.error(`${failed} of ${out.length} failed`);
  };

  if (results) return <BulkResults results={results} onDone={() => setResults(null)} />;

  return (
    <div className="space-y-4">
      <FadeIn>
        <Card>
          <p className="text-sm text-muted-foreground">
            Invite up to {MAX_GUESTS_BULK} visitors at once. Choose one shared code or a separate
            code per guest.
          </p>
        </Card>
      </FadeIn>

      <Card className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          {(["separate", "group"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize ${
                mode === m
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {m === "separate" ? "Separate codes" : "One shared code"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Visit time">
            <Input value={visitTime} onChange={setVisitTime} type="datetime-local" required />
          </Field>
          <Field label="Valid (hours)">
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {[2, 6, 12, 24, 48].map((h) => (
                <option key={h} value={h}>
                  {h} hours
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Purpose">
          <Input value={purpose} onChange={setPurpose} />
        </Field>
      </Card>

      <Stagger className="space-y-2">
        {rows.map((r, i) => (
          <StaggerItem key={i}>
            <Card className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">Visitor {i + 1}</div>
                {rows.length > 1 && (
                  <button
                    onClick={() => remove(i)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Remove visitor"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Input
                value={r.guest_name}
                onChange={(v) => update(i, { guest_name: v })}
                placeholder="Full name"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={r.phone}
                  onChange={(v) => update(i, { phone: v })}
                  placeholder="Phone"
                  type="tel"
                />
                <Input
                  value={r.vehicle_number}
                  onChange={(v) => update(i, { vehicle_number: v.toUpperCase() })}
                  placeholder="Vehicle #"
                />
              </div>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <button
        type="button"
        onClick={add}
        disabled={rows.length >= MAX_GUESTS_BULK}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> Add visitor
      </button>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Generate{" "}
        {mode === "group"
          ? "shared invite"
          : `${rows.filter((r) => r.guest_name.trim()).length} invites`}
      </button>
    </div>
  );
}

function BulkResults({
  results,
  onDone,
}: {
  results: { name: string; code?: string; error?: string }[];
  onDone: () => void;
}) {
  const summary = results
    .filter((r) => r.code)
    .map((r) => `${r.name}: ${r.code}`)
    .join("\n");
  const share = async () => {
    await navigator.clipboard.writeText(summary);
    toast.success("Copied all codes");
  };
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-[color:var(--color-primary-dark)] to-[color:var(--color-primary)] p-4 text-primary-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Invites created</span>
        </div>
        <div className="mt-1 text-sm">
          {results.filter((r) => r.code).length} succeeded · {results.filter((r) => r.error).length}{" "}
          failed
        </div>
      </Card>
      <div className="space-y-2">
        {results.map((r, i) => (
          <Card key={i} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
              {r.error && <div className="text-xs text-destructive">{r.error}</div>}
            </div>
            {r.code && (
              <div className="font-mono text-lg font-semibold tracking-widest text-primary">
                {r.code}
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={share}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          <Copy className="mr-1 inline h-4 w-4" /> Copy all
        </button>
        <button
          onClick={onDone}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          New batch
        </button>
      </div>
      <Link
        to="/app/resident/guests"
        className="block w-full rounded-lg border border-border bg-card px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted"
      >
        View all invites
      </Link>
    </div>
  );
}

/* -------------------------- Shared success (single) -------------------------- */

function InviteSuccess({
  invite,
  estateName,
  onNew,
}: {
  invite: Created;
  estateName: string;
  onNew: () => void;
}) {
  const message =
    `${estateName} — Guest access code\n` +
    `Code: ${invite.code}\n` +
    `Guest: ${invite.guest_name}${invite.num_guests > 1 ? ` (+${invite.num_guests - 1})` : ""}\n` +
    `Visit: ${format(new Date(invite.visit_time), "MMM d, p")}\n` +
    `Valid until: ${format(new Date(invite.expires_at), "MMM d, p")}`;
  const copy = async () => {
    await navigator.clipboard.writeText(invite.code);
    toast.success("Code copied");
  };
  const copyMsg = async () => {
    await navigator.clipboard.writeText(message);
    toast.success("Message copied");
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="bg-gradient-to-br from-[color:var(--color-primary-dark)] to-[color:var(--color-primary)] text-primary-foreground">
        <div className="flex items-center gap-2 text-primary-foreground/80">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Invite ready</span>
        </div>
        <div className="mt-3 font-mono text-4xl font-semibold tracking-[0.35em]">{invite.code}</div>
        <div className="mt-2 text-sm text-primary-foreground/80">
          {invite.guest_name} · {format(new Date(invite.visit_time), "MMM d, p")}
        </div>
        <div className="mt-0.5 text-xs text-primary-foreground/70">
          Valid until {format(new Date(invite.expires_at), "MMM d, p")}
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={copy}
          className="card-surface flex flex-col items-center gap-1 p-3 text-xs font-medium text-foreground hover:bg-muted/40"
        >
          <Copy className="h-4 w-4 text-primary" />
          Copy code
        </button>
        <button
          onClick={copyMsg}
          className="card-surface flex flex-col items-center gap-1 p-3 text-xs font-medium text-foreground hover:bg-muted/40"
        >
          <Copy className="h-4 w-4 text-primary" />
          Copy note
        </button>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="card-surface flex flex-col items-center gap-1 p-3 text-xs font-medium text-foreground hover:bg-muted/40"
        >
          <MessageCircle className="h-4 w-4 text-primary" />
          WhatsApp
        </a>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onNew}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          New invite
        </button>
        <Link
          to="/app/resident/guests"
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          View guests
        </Link>
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
function Input(
  props: { value: string; onChange: (v: string) => void } & Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value"
  >,
) {
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
