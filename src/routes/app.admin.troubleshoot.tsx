import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, LifeBuoy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";

export const Route = createFileRoute("/app/admin/troubleshoot")({
  component: Troubleshoot,
  head: () => ({
    meta: [
      { title: "Troubleshoot — Estate Guard" },
      {
        name: "description",
        content:
          "Estate health checks: missing gate exits, pending approvals, stale requests, offline devices and unpaid bills.",
      },
    ],
  }),
});

type Check = {
  label: string;
  count: number;
  ok: string;
  problem: (n: number) => string;
  to: string;
  action: string;
};

function Troubleshoot() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

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
      problem: (n) => `${n} account${n > 1 ? "s" : ""} cannot use the app until you grant estate access.`,
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
      problem: (n) => `${n} device${n > 1 ? "s are" : " is"} offline or in maintenance — biometric entry may fail at the gate.`,
      to: "/app/admin/realtime",
      action: "Check access activity",
    },
    {
      label: "Overdue bills",
      count: h.overdueBills,
      ok: "No overdue invoices.",
      problem: (n) => `${n} invoice${n > 1 ? "s are" : " is"} past the due date and need a reminder.`,
      to: "/app/admin/invoices",
      action: "Open invoices",
    },
    {
      label: "Biometric enrolments pending",
      count: h.unenrolledBiometrics,
      ok: "No pending biometric enrolments.",
      problem: (n) => `${n} resident biometric enrolment${n > 1 ? "s" : ""} still need to be captured on a gate device.`,
      to: "/app/admin/residents",
      action: "Manage access",
    },
  ];

  const failing = checks.filter((c) => c.count > 0);

  return (
    <Stagger className="space-y-4">
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
            <RefreshCw
              className={`h-3.5 w-3.5 ${health.isFetching ? "animate-spin" : ""}`}
            />
            Re-run checks
          </button>
        </div>
      </StaggerItem>

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
          <ul className="space-y-2">
            {checks.map((c) => {
              const bad = c.count > 0;
              return (
                <li
                  key={c.label}
                  className={`rounded-lg border px-3 py-2.5 text-sm ${
                    bad ? "border-[color:var(--color-warning)]/40 bg-warning/5" : "border-border/60 bg-card"
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
                      <Link
                        to={c.to}
                        className="text-xs font-medium text-primary hover:underline"
                      >
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
    </Stagger>
  );
}
