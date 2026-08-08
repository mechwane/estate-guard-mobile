import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  Copy,
  KeyRound,
  LifeBuoy,
  Loader2,
  Lock,
  RefreshCw,
  ReceiptText,
  TerminalSquare,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { adminChangeUserEmail } from "@/lib/admin-support.functions";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  StatCard,
  StatusBadge,
  ModalPortal,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/app/admin/troubleshoot")({
  component: Troubleshoot,
  head: () => ({
    meta: [
      { title: "Troubleshoot — Estate Guard" },
      {
        name: "description",
        content:
          "Support tools for estate admins: one-time codes, password resets, payment waivers, multi-use access codes, email changes, data resync and estate health checks.",
      },
      { property: "og:title", content: "Troubleshoot — Estate Guard" },
      {
        property: "og:description",
        content: "Support tools and health checks for estate administrators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ToolId = "otp" | "reset" | "waive" | "multi" | "email";

type Check = {
  label: string;
  count: number;
  ok: string;
  problem: (n: number) => string;
  to: string;
  action: string;
};

const DURATIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "6 hours", minutes: 360 },
  { label: "12 hours", minutes: 720 },
  { label: "1 day", minutes: 1440 },
];

const RESYNC = [
  { label: "Residents", table: "profiles", keys: ["admin-residents", "admin-households"] },
  { label: "Addresses", table: "estate_contacts", keys: ["admin-estate"] },
  { label: "Dependants", table: "dependents", keys: ["admin-dependents"] },
  { label: "Passes", table: "resident_passes", keys: ["admin-passes"] },
  { label: "Fingerprints", table: "biometric_access", keys: ["admin-residents"] },
  { label: "Alerts", table: "biometric_access_events", keys: ["admin-alerts", "admin-realtime"] },
  { label: "Tickets", table: "support_tickets", keys: ["admin-tickets", "admin-requests"] },
] as const;

function Troubleshoot() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const estateId = session?.estate?.id;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const [tool, setTool] = useState<ToolId | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const health = useQuery({
    queryKey: ["admin-troubleshoot", estateId],
    enabled: !!estateId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [
        missingExits,
        pendingApprovals,
        pendingVerifications,
        staleRequests,
        staleIssues,
        offlineDevices,
        overdueBills,
        unenrolledBiometrics,
      ] = await Promise.all([
        supabase
          .from("guest_invites")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .not("checked_in_at", "is", null)
          .is("checked_out_at", null)
          .lt("expires_at", nowIso),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .eq("approved", false),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .eq("verification_status", "pending"),
        supabase
          .from("resident_requests")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .in("status", ["pending", "under_review"])
          .lt("created_at", weekAgo),
        supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .in("status", ["open", "in_progress"])
          .lt("created_at", weekAgo),
        supabase
          .from("access_devices")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .in("status", ["offline", "maintenance"]),
        supabase
          .from("bills")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .eq("status", "overdue"),
        supabase
          .from("biometric_access")
          .select("id", { count: "exact", head: true })
          .eq("estate_id", estateId!)
          .eq("enrollment_status", "pending"),
      ]);
      return {
        missingExits: missingExits.count ?? 0,
        pendingApprovals: pendingApprovals.count ?? 0,
        pendingVerifications: pendingVerifications.count ?? 0,
        staleRequests: staleRequests.count ?? 0,
        staleIssues: staleIssues.count ?? 0,
        offlineDevices: offlineDevices.count ?? 0,
        overdueBills: overdueBills.count ?? 0,
        unenrolledBiometrics: unenrolledBiometrics.count ?? 0,
      };
    },
  });

  const recentOtps = useQuery({
    queryKey: ["admin-support-otps", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      // Codes are never returned to admins — only delivery metadata.
      const { data, error } = await supabase.rpc("admin_recent_support_otps", { _limit: 5 });
      if (error) throw error;
      return data ?? [];
    },
  });


  async function resync(entry: (typeof RESYNC)[number]) {
    if (!estateId) return;
    setSyncing(entry.label);
    try {
      const { count, error } = await supabase
        .from(entry.table)
        .select("id", { count: "exact", head: true })
        .eq("estate_id", estateId);
      if (error) throw error;
      entry.keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries({ queryKey: ["admin-troubleshoot"] });
      toast.success(`${entry.label} resynced — ${count ?? 0} record(s) in this estate`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(null);
    }
  }

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (health.isLoading) return <ListSkeleton rows={4} />;
  if (health.isError) return <ErrorState onRetry={() => health.refetch()} />;
  const h = health.data!;

  const checks: Check[] = [
    {
      label: "Missing gate exits",
      count: h.missingExits,
      ok: "Every check-in has a matching exit.",
      problem: (n) =>
        `${n} guest${n > 1 ? "s" : ""} checked in but never exited before the pass expired. Force a check-out or revoke the pass.`,
      to: "/app/admin/guests",
      action: "Open visitor log",
    },
    {
      label: "Accounts awaiting approval",
      count: h.pendingApprovals,
      ok: "No accounts waiting for estate access.",
      problem: (n) =>
        `${n} account${n > 1 ? "s" : ""} cannot use the app until you grant estate access.`,
      to: "/app/admin/residents",
      action: "Review residents",
    },
    {
      label: "Identity verifications pending",
      count: h.pendingVerifications,
      ok: "No verification documents in the queue.",
      problem: (n) => `${n} resident${n > 1 ? "s" : ""} submitted documents that need a decision.`,
      to: "/app/admin/verifications",
      action: "Review documents",
    },
    {
      label: "Stale resident requests",
      count: h.staleRequests,
      ok: "Requests are being handled on time.",
      problem: (n) => `${n} request${n > 1 ? "s" : ""} older than 7 days are still unresolved.`,
      to: "/app/admin/requests",
      action: "Open requests",
    },
    {
      label: "Stale incidents",
      count: h.staleIssues,
      ok: "No incident older than 7 days.",
      problem: (n) => `${n} incident${n > 1 ? "s" : ""} have been open for more than a week.`,
      to: "/app/admin/issues",
      action: "Open incidents",
    },
    {
      label: "Gate devices unavailable",
      count: h.offlineDevices,
      ok: "All access devices are reporting online.",
      problem: (n) =>
        `${n} device${n > 1 ? "s are" : " is"} offline or in maintenance — biometric entry may fail at the gate.`,
      to: "/app/admin/realtime",
      action: "Check access activity",
    },
    {
      label: "Overdue bills",
      count: h.overdueBills,
      ok: "No overdue invoices.",
      problem: (n) =>
        `${n} invoice${n > 1 ? "s are" : " is"} past the due date and need a reminder.`,
      to: "/app/admin/invoices",
      action: "Open invoices",
    },
    {
      label: "Biometric enrolments pending",
      count: h.unenrolledBiometrics,
      ok: "No pending biometric enrolments.",
      problem: (n) =>
        `${n} resident biometric enrolment${n > 1 ? "s" : ""} still need to be captured on a gate device.`,
      to: "/app/admin/residents",
      action: "Manage access",
    },
  ];

  const failing = checks.filter((c) => c.count > 0);

  const tools: { id: ToolId; title: string; desc: string; icon: typeof KeyRound }[] = [
    {
      id: "otp",
      title: "OTP",
      desc: "Generate a one-time code for a resident",
      icon: TerminalSquare,
    },
    { id: "reset", title: "Reset password", desc: "Trigger a password reset email", icon: Lock },
    {
      id: "waive",
      title: "Waive payment",
      desc: "Waive outstanding charges for a resident",
      icon: ReceiptText,
    },
    {
      id: "multi",
      title: "Multiple code",
      desc: "Grant timed multi-use gate access",
      icon: KeyRound,
    },
    {
      id: "email",
      title: "Email change",
      desc: "Update the sign-in email of a user",
      icon: AtSign,
    },
  ];

  return (
    <Stagger className="mx-auto w-full max-w-6xl space-y-5">
      <StaggerItem>
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <LifeBuoy className="h-5 w-5 text-primary" /> Troubleshoot
          </h1>
          <button
            onClick={() => health.refetch()}
            disabled={health.isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${health.isFetching ? "animate-spin" : ""}`} />
            Re-run checks
          </button>
        </div>
      </StaggerItem>

      {/* FOR USERS */}
      <StaggerItem>
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            For users
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition hover:border-primary/50 hover:bg-muted/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <t.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </StaggerItem>

      {/* FOR ESTATE */}
      <StaggerItem>
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            For estate
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {RESYNC.map((r) => (
              <button
                key={r.label}
                onClick={() => resync(r)}
                disabled={syncing === r.label}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[color:var(--color-warning)]">
                  <RefreshCw className={`h-4 w-4 ${syncing === r.label ? "animate-spin" : ""}`} />
                </span>
                <span className="truncate">Resync {r.label}</span>
              </button>
            ))}
          </div>
        </div>
      </StaggerItem>

      {(recentOtps.data ?? []).length > 0 && (
        <StaggerItem>
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Recently issued codes</h2>
            <ul className="divide-y divide-border/60 text-sm">
              {recentOtps.data!.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{o.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.purpose.replace("_", " ")} · expires{" "}
                      {format(new Date(o.expires_at), "d MMM HH:mm")}
                    </div>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-widest">
                    {o.code}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </StaggerItem>
      )}

      <StaggerItem>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            label="Checks failing"
            value={failing.length}
            tone={failing.length ? "error" : "success"}
          />
          <StatCard label="Checks passing" value={checks.length - failing.length} tone="success" />
          <StatCard
            label="Missing exits"
            value={h.missingExits}
            tone={h.missingExits ? "warning" : "default"}
          />
          <StatCard
            label="Devices down"
            value={h.offlineDevices}
            tone={h.offlineDevices ? "warning" : "default"}
          />
        </div>
      </StaggerItem>

      <StaggerItem>
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Health checks</h2>
          <ul className="grid gap-2 lg:grid-cols-2">
            {checks.map((c) => {
              const bad = c.count > 0;
              return (
                <li
                  key={c.label}
                  className={`rounded-lg border px-3 py-2.5 text-sm ${
                    bad
                      ? "border-[color:var(--color-warning)]/40 bg-warning/5"
                      : "border-border/60 bg-card"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      {bad ? (
                        <AlertTriangle className="h-4 w-4 text-[color:var(--color-warning)]" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
                      )}
                      {c.label}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={bad ? "warning" : "success"}>
                        {bad ? `${c.count} to fix` : "Healthy"}
                      </StatusBadge>
                      <Link to={c.to} className="text-xs font-medium text-primary hover:underline">
                        {c.action}
                      </Link>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {bad ? c.problem(c.count) : c.ok}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </StaggerItem>

      {tool && (
        <ToolDialog
          tool={tool}
          onClose={() => setTool(null)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["admin-support-otps"] });
            qc.invalidateQueries({ queryKey: ["admin-troubleshoot"] });
          }}
        />
      )}
    </Stagger>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
        <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="flex-1 text-center text-sm font-semibold">{title}</h3>
            <span className="w-7" />
          </div>
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function ToolDialog({
  tool,
  onClose,
  onDone,
}: {
  tool: ToolId;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [purpose, setPurpose] = useState("sign_in");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [result, setResult] = useState<string | null>(null);

  const titles: Record<ToolId, string> = {
    otp: "Generate OTP",
    reset: "Reset password",
    waive: "Waive payment",
    multi: "Multi code access",
    email: "Email change",
  };

  const run = useMutation({
    mutationFn: async () => {
      const mail = email.trim().toLowerCase();
      if (!mail) throw new Error("Email address is required");
      if (tool === "otp") {
        const { data, error } = await supabase.rpc("admin_generate_support_otp", {
          _email: mail,
          _purpose: purpose,
        });
        if (error) throw error;
        const r = data as { code: string; full_name: string };
        return `Code ${r.code} issued to ${r.full_name}. Valid for 10 minutes.`;
      }
      if (tool === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, {
          redirectTo: `${window.location.origin}/#/auth/reset-password`,
        });
        if (error) throw error;
        return `Password reset email sent to ${mail}.`;
      }
      if (tool === "waive") {
        if (!end) throw new Error("An end date is required");
        const { data, error } = await supabase.rpc("admin_waive_payments", {
          _email: mail,
          _end_date: end,
          _start_date: start || undefined,
        });
        if (error) throw error;
        const r = data as { waived: number; amount: number; full_name: string };
        return r.waived
          ? `Waived ${r.waived} charge(s) worth ₦${Number(r.amount).toLocaleString()} for ${r.full_name}.`
          : `No outstanding charges matched that date range for ${r.full_name}.`;
      }
      if (tool === "multi") {
        const { data, error } = await supabase.rpc("admin_grant_multi_code", {
          _email: mail,
          _ttl_minutes: minutes,
        });
        if (error) throw error;
        const r = data as { code: string; full_name: string; expires_at: string };
        return `Code ${r.code} granted to ${r.full_name} until ${format(new Date(r.expires_at), "d MMM HH:mm")}.`;
      }
      const r = await adminChangeUserEmail({
        data: { current_email: mail, new_email: newEmail },
      });
      return `${r.full_name}'s sign-in email is now ${r.email}.`;
    },
    onSuccess: (msg) => {
      setResult(msg);
      toast.success(msg);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal title={titles[tool]} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run.mutate();
        }}
        className="space-y-3"
      >
        {tool === "multi" && (
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Duration</div>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d.minutes}
                  type="button"
                  onClick={() => setMinutes(d.minutes)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    minutes === d.minutes
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {tool === "otp" && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Purpose</span>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className={inputCls}
            >
              <option value="sign_in">Sign in</option>
              <option value="update_profile">Update profile</option>
              <option value="gate_access">Gate access</option>
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            {tool === "email" ? "Current email" : "Email address"}
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter resident email address"
            className={inputCls}
          />
        </label>

        {tool === "email" && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">New email</span>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email address"
              className={inputCls}
            />
          </label>
        )}

        {tool === "waive" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Start date (optional)
              </span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">End date</span>
              <input
                type="date"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        )}

        {result && (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-[color:var(--color-success)]/40 bg-success/5 p-3 text-xs text-foreground">
            <span>{result}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(result);
                toast.success("Copied");
              }}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Copy result"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={run.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {run.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Proceed
        </button>
      </form>
    </Modal>
  );
}
