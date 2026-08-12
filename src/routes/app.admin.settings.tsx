import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, SheetModal, StatusBadge } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { toast } from "sonner";
import {
  ChevronRight,
  CreditCard,
  FileText,
  LifeBuoy,
  Lock,
  Percent,
  ShieldCheck,
  Ticket,
  UserCog,
} from "lucide-react";

export const Route = createFileRoute("/app/admin/settings")({
  component: AdminSettings,
  head: () => ({
    meta: [
      { title: "Admin Settings — Estate Guard" },
      {
        name: "description",
        content:
          "Estate admin settings: permissions, pricing, tickets, invoices, support and dashboard security.",
      },
      { property: "og:title", content: "Admin Settings — Estate Guard" },
      {
        property: "og:description",
        content: "Control estate permissions, billing defaults and dashboard security.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TWOFA_KEY = "eg.admin.2fa";

function AdminSettings() {
  const { data: session } = useSession();
  const [twofa, setTwofa] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ next: "", confirm: "" });

  useEffect(() => {
    if (typeof window !== "undefined") setTwofa(localStorage.getItem(TWOFA_KEY) === "true");
  }, []);

  const changePassword = useMutation({
    mutationFn: async () => {
      if (pw.next.length < 8) throw new Error("Use at least 8 characters");
      if (pw.next !== pw.confirm) throw new Error("Passwords do not match");
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password changed");
      setPwOpen(false);
      setPw({ next: "", confirm: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups: { label: string; items: { to: string; label: string; icon: React.ReactNode }[] }[] =
    [
      {
        label: "Permissions",
        items: [
          { to: "/app/admin/staff", label: "Staff & guard permissions", icon: <UserCog /> },
          { to: "/app/admin/verifications", label: "Resident verification queue", icon: <ShieldCheck /> },
        ],
      },
      {
        label: "Pricing",
        items: [
          { to: "/app/admin/collections", label: "Levies & collections", icon: <CreditCard /> },
          { to: "/app/admin/discounts", label: "Discounts & waivers", icon: <Percent /> },
        ],
      },
      {
        label: "Ticket",
        items: [{ to: "/app/admin/tickets", label: "Support tickets", icon: <Ticket /> }],
      },
      {
        label: "Invoice",
        items: [{ to: "/app/admin/invoices", label: "Invoices & receipts", icon: <FileText /> }],
      },
      {
        label: "Support",
        items: [{ to: "/app/admin/troubleshoot", label: "Troubleshoot & support tools", icon: <LifeBuoy /> }],
      },
    ];

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          {session?.estate && (
            <StatusBadge tone="primary">
              {session.estate.code} · {session.estate.status === "active" ? "Live" : "Demo"}
            </StatusBadge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Everything that controls how this estate's dashboard behaves.
        </p>
      </FadeIn>

      <Stagger className="space-y-4">
        {groups.map((g) => (
          <StaggerItem key={g.label}>
            <div className="space-y-1.5">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </div>
              <div className="card-surface divide-y divide-border overflow-hidden">
                {g.items.map((it) => (
                  <Link
                    key={it.to}
                    to={it.to}
                    className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-3 text-sm text-foreground">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-4 [&>svg]:w-4">
                        {it.icon}
                      </span>
                      {it.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          </StaggerItem>
        ))}

        <StaggerItem>
          <div className="space-y-1.5">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Security
            </div>
            <Card className="divide-y divide-border p-0">
              <button
                onClick={() => setPwOpen(true)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <span className="flex items-center gap-3 text-sm text-foreground">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  Change Password
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">2FA Login</span>
                    <span className="block text-xs text-muted-foreground">
                      Require an email OTP when signing in to the dashboard
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={twofa}
                  aria-label="2FA login"
                  onClick={() => {
                    const v = !twofa;
                    setTwofa(v);
                    localStorage.setItem(TWOFA_KEY, String(v));
                    toast.success(v ? "OTP will be required at sign-in" : "2FA turned off");
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    twofa ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      twofa ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </Card>
          </div>
        </StaggerItem>
      </Stagger>

      <SheetModal
        open={pwOpen}
        title="Change password"
        onClose={() => setPwOpen(false)}
        footer={
          <button
            onClick={() => changePassword.mutate()}
            disabled={changePassword.isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Update password
          </button>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              New password
            </span>
            <input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Confirm password
            </span>
            <input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </SheetModal>
    </div>
  );
}
