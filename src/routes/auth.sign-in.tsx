import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roleHome, waitForSessionInfo } from "@/lib/session";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";

type Search = { admin_invite?: string };

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
  validateSearch: (s: Record<string, unknown>): Search => ({
    admin_invite: typeof s.admin_invite === "string" ? s.admin_invite : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign In — Estate Guard" },
      { name: "description", content: "Sign in to your Estate Guard account to manage your estate, guests, bills, and community." },
      { property: "og:title", content: "Sign In — Estate Guard" },
      { property: "og:description", content: "Sign in to your Estate Guard account." },
      { property: "og:url", content: "https://guard-estate-flow.lovable.app/auth/sign-in" },
    ],
    links: [{ rel: "canonical", href: "https://guard-estate-flow.lovable.app/auth/sign-in" }],
  }),
});

function SignIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { admin_invite: inviteToken } = useSearch({ from: "/auth/sign-in" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    let info = await waitForSessionInfo();
    if (inviteToken) {
      const { error: rErr } = await supabase.rpc(
        "redeem_estate_admin_invite" as never,
        { _token: inviteToken } as never,
      );
      if (rErr) {
        toast.error(`Signed in, but couldn't accept the admin invite: ${rErr.message}`);
      } else {
        toast.success("Estate admin access granted");
        info = await waitForSessionInfo();
      }
    } else {
      toast.success("Welcome back");
    }
    queryClient.setQueryData(["session"], info);
    navigate({ to: roleHome(info.role), replace: true });
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sign in to your Estate Guard account.
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <Field label="Email" icon={<Mail className="h-4 w-4" />}>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@estate.com"
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>
        <Field label="Password" icon={<Lock className="h-4 w-4" />}>
          <input
            type={showPw ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-11 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute inset-y-0 right-3 top-6 flex items-center text-muted-foreground hover:text-foreground"
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="group relative mt-2 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-dark px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/40 active:scale-[0.98] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          to="/auth/forgot-password"
          className="text-xs font-medium text-muted-foreground hover:text-primary"
        >
          Forgot password?
        </Link>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/auth/sign-up" className="font-semibold text-primary hover:text-primary-dark">
          Create one
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="pointer-events-none absolute left-3 top-[calc(1.5rem+0.75rem)] text-muted-foreground">
        {icon}
      </span>
      {children}
    </label>
  );
}
