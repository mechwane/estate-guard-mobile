import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSessionInfo, roleHome } from "@/lib/session";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Search = { admin_invite?: string };

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
  validateSearch: (s: Record<string, unknown>): Search => ({
    admin_invite: typeof s.admin_invite === "string" ? s.admin_invite : undefined,
  }),
});

function SignUp() {
  const navigate = useNavigate();
  const { admin_invite: inviteToken } = useSearch({ from: "/auth/sign-up" });
  const isInviteFlow = !!inviteToken;

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    role: "resident" as "resident" | "guard",
    estateCode: "",
    unit: "",
  });
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const unit = form.unit.trim();
    const estateCode = form.estateCode.trim().toUpperCase();

    if (fullName.length < 2) return toast.error("Enter your full name");
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    if (phone && !/^[+\d][\d\s\-()]{5,}$/.test(phone))
      return toast.error("Enter a valid phone number");

    // Invite flow doesn't need an estate code (estate is set at redemption).
    let estateCodeToSend: string | null = null;
    if (!isInviteFlow) {
      if (!estateCode) return toast.error("Estate code is required");
    }

    setLoading(true);

    if (!isInviteFlow && estateCode) {
      const { data: estateRows, error: estErr } = await supabase.rpc(
        "lookup_estate_by_code" as never,
        { _code: estateCode } as never,
      );
      const estate = Array.isArray(estateRows) ? (estateRows[0] as { code?: string; status?: string } | undefined) : undefined;

      if (estErr || !estate) {
        toast.error("Estate code not recognized");
        setLoading(false);
        return;
      }
      if (estate.status !== "active") {
        toast.error("This estate is not active");
        setLoading(false);
        return;
      }
      estateCodeToSend = estate.code ?? estateCode;
    }

    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone || null,
          // Invite flow: create as a normal resident then promote via redeem.
          role: isInviteFlow ? "resident" : form.role,
          estate_code: estateCodeToSend,
          unit: unit || null,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const info = await fetchSessionInfo();
    if (!info.userId) {
      // Email confirmation is required.
      toast.success("Check your email to confirm your account, then sign in.");
      if (isInviteFlow) {
        navigate({
          to: "/auth/sign-in",
          search: { admin_invite: inviteToken } as never,
          replace: true,
        });
      } else {
        navigate({ to: "/auth/sign-in", replace: true });
      }
      return;
    }

    if (isInviteFlow) {
      const { error: rErr } = await supabase.rpc(
        "redeem_estate_admin_invite" as never,
        { _token: inviteToken } as never,
      );
      if (rErr) {
        toast.error(`Signed up, but couldn't accept the admin invite: ${rErr.message}`);
        navigate({ to: roleHome("resident"), replace: true });
        return;
      }
      toast.success("Estate admin access granted");
      navigate({ to: roleHome("estate_admin"), replace: true });
      return;
    }

    toast.success("Account created");
    navigate({ to: roleHome(info.role), replace: true });
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {isInviteFlow ? "Accept admin invitation" : "Create account"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isInviteFlow ? (
          <>Complete your details to accept your Estate Admin invitation.</>
        ) : (
          <>
            Join your estate in a moment. Ask your estate admin for your{" "}
            <span className="font-medium text-foreground">estate code</span>.
          </>
        )}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Full name">
          <Input
            value={form.fullName}
            onChange={(v) => set("fullName", v)}
            required
            autoComplete="name"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(v) => set("phone", v)}
              type="tel"
              autoComplete="tel"
            />
          </Field>
          {!isInviteFlow && (
            <Field label="Unit / Apt">
              <Input value={form.unit} onChange={(v) => set("unit", v)} placeholder="A12" />
            </Field>
          )}
        </div>
        <Field label="Email">
          <Input
            value={form.email}
            onChange={(v) => set("email", v)}
            type="email"
            required
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <Input
            value={form.password}
            onChange={(v) => set("password", v)}
            type="password"
            required
            autoComplete="new-password"
          />
        </Field>

        {!isInviteFlow && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="I am a">
              <select
                value={form.role}
                onChange={(e) => set("role", e.target.value as "resident" | "guard")}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="resident">Resident</option>
                <option value="guard">Guard</option>
              </select>
            </Field>
            <Field label="Estate code">
              <Input
                value={form.estateCode}
                onChange={(v) => set("estateCode", v.toUpperCase())}
                required
                placeholder="e.g. ABC123"
              />
            </Field>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isInviteFlow ? "Accept invitation" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth/sign-in" className="font-medium text-primary hover:text-primary-dark">
          Sign in
        </Link>
      </p>
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
