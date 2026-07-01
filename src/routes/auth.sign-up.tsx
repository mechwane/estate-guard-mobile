import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSessionInfo, roleHome } from "@/lib/session";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
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

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((s) => ({ ...s, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Verify estate code exists (RLS allows anon SELECT on estates)
    const { data: estate, error: estErr } = await supabase
      .from("estates")
      .select("id,code,status")
      .eq("code", form.estateCode.trim().toUpperCase())
      .maybeSingle();

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

    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: form.fullName,
          phone: form.phone,
          role: form.role,
          estate_code: estate.code,
          unit: form.unit,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const info = await fetchSessionInfo();
    if (info.userId) {
      toast.success("Account created");
      navigate({ to: roleHome(info.role), replace: true });
    } else {
      toast.success("Check your email to confirm your account");
      navigate({ to: "/auth/sign-in", replace: true });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Join your estate in a moment. Try code <span className="font-medium text-foreground">DEMO01</span>.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Full name">
          <Input value={form.fullName} onChange={(v) => set("fullName", v)} required autoComplete="name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={form.phone} onChange={(v) => set("phone", v)} type="tel" autoComplete="tel" />
          </Field>
          <Field label="Unit / Apt">
            <Input value={form.unit} onChange={(v) => set("unit", v)} placeholder="A12" />
          </Field>
        </div>
        <Field label="Email">
          <Input value={form.email} onChange={(v) => set("email", v)} type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input value={form.password} onChange={(v) => set("password", v)} type="password" required autoComplete="new-password" />
        </Field>

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
            <Input value={form.estateCode} onChange={(v) => set("estateCode", v.toUpperCase())} required placeholder="DEMO01" />
          </Field>
        </div>

        <button
          type="submit" disabled={loading}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth/sign-in" className="font-medium text-primary hover:text-primary-dark">Sign in</Link>
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
