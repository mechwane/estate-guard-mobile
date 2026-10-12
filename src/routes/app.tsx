import { Outlet, createFileRoute, useNavigate, useLocation, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, roleHome, type AppRole } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { navByRole, sidebarGroupsByRole, desktopFirstRoles } from "@/components/nav-config";
import { Loader2, ShieldAlert } from "lucide-react";


export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isLoading } = useSession();
  const restricted = useQuery({
    queryKey: ["payment-only", session?.userId],
    enabled: session?.role === "resident" && !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resident_is_restricted", { _uid: session!.userId! });
      if (error) throw error;
      return !!data;
    },
  });

  useEffect(() => {
    if (isLoading) return;
    if (!session?.userId) {
      navigate({ to: "/auth/sign-in", replace: true });
      return;
    }
    if (location.pathname === "/app/denied") return;
    if (location.pathname === "/app" || location.pathname === "/app/") {
      navigate({ to: roleHome(session.role), replace: true });
      return;
    }
    const prefix = roleHome(session.role);
    if (!location.pathname.startsWith(prefix)) {
      navigate({ to: "/app/denied", replace: true });
    }
  }, [session, isLoading, navigate, location.pathname]);

  if (isLoading || !session?.userId || !session.role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const role = session.role as AppRole;
  const { title, subtitle } = deriveHeader(location.pathname);

  // Residents must be approved by their estate admin before they can use the app.
  const allowedWhilePending = [
    "/app/resident/verification",
    "/app/resident/profile",
    "/app/resident/support",
    "/app/resident/faqs",
    "/app/resident/privacy",
    "/app/resident/terms",
    "/app/resident/settings",
  ];
  const locked =
    role === "resident" &&
    !!session.profile &&
    !session.profile.approved &&
    !allowedWhilePending.includes(location.pathname);
  const allowedWhileRestricted = [
    "/app/resident/bills",
    "/app/resident/inbox",
    "/app/resident/support",
    "/app/resident/profile",
    "/app/resident/settings",
    "/app/resident/chat",
  ];
  const paymentOnly =
    !locked && restricted.data === true && !allowedWhileRestricted.includes(location.pathname);

  return (
    <AppShell
      role={role}
      title={locked ? "Awaiting approval" : title}
      subtitle={locked ? "Your estate admin must approve your account" : subtitle}
      estateName={session.estate?.name ?? null}
      navItems={navByRole[role]}
      navGroups={sidebarGroupsByRole[role]}
      desktopFirst={desktopFirstRoles.includes(role)}
    >
      {locked ? (
        <PendingApproval
          status={session.profile?.verification_status ?? "not_submitted"}
          notes={session.profile?.verification_notes ?? null}
          estateName={session.estate?.name ?? null}
        />
      ) : paymentOnly ? (
        <div className="mx-auto max-w-md space-y-4 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold">Payment-only mode</h2>
          <p className="text-sm text-muted-foreground">
            You have overdue bills. Guest invites, passes and the shop unlock as soon as they are settled.
          </p>
          <Link
            to="/app/resident/bills"
            className="inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Pay my bills
          </Link>
        </div>
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}

function PendingApproval({
  status,
  notes,
  estateName,
}: {
  status: string;
  notes: string | null;
  estateName: string | null;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-base font-semibold">Account awaiting approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {estateName ? `${estateName} management` : "Your estate management"} has not granted you
          access yet. Once approved, every feature unlocks automatically.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-left text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Verification</span>
          <span className="font-medium capitalize">{status.replace("_", " ")}</span>
        </div>
        {notes && <p className="mt-2 text-xs text-muted-foreground">Note: {notes}</p>}
      </div>
      <div className="flex flex-col gap-2">
        {status !== "pending" && status !== "approved" && (
          <Link
            to="/app/resident/verification"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
          >
            Submit verification
          </Link>
        )}
        <Link
          to="/app/resident/support"
          className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}


function deriveHeader(path: string): { title: string; subtitle?: string } {
  const map: Record<string, { title: string; subtitle?: string }> = {
    "/app/resident": { title: "Home", subtitle: "Your estate at a glance" },
    "/app/resident/invite": { title: "Invite a guest" },
    "/app/resident/guests": { title: "Manage invites" },
    "/app/resident/bills": { title: "Bills" },
    "/app/resident/issues": { title: "Issues" },
    "/app/resident/events": { title: "Events", subtitle: "Estate and public happenings" },
    "/app/resident/events/mine": { title: "My events" },
    "/app/resident/events/new": { title: "Create event" },
    "/app/resident/community": { title: "Community" },
    "/app/resident/inbox": { title: "Inbox" },
    "/app/resident/shop": { title: "Estate Shop" },
    "/app/resident/requests": { title: "Submit a request" },
    "/app/resident/dependents": { title: "Dependents" },
    "/app/resident/ids": { title: "Manage IDs" },
    "/app/resident/support": { title: "Support tickets" },
    "/app/resident/contacts": { title: "Estate contacts" },
    "/app/resident/more": { title: "More" },
    "/app/resident/profile": { title: "Edit profile" },
    "/app/resident/settings": { title: "App settings" },
    "/app/resident/faqs": { title: "FAQs" },
    "/app/resident/privacy": { title: "Privacy policy" },
    "/app/resident/terms": { title: "Terms & conditions" },
    "/app/resident/feedback": { title: "Feedback" },
    "/app/resident/verification": {
      title: "Estate verification",
      subtitle: "Verify your residency",
    },
    "/app/guard": { title: "Guard home", subtitle: "Gate operations at a glance" },
    "/app/guard/validate": { title: "Guest validation" },
    "/app/guard/active": { title: "Visitors inside" },
    "/app/guard/incidents": { title: "Incidents" },
    "/app/guard/history": { title: "Entry & exit history" },
    "/app/guard/more": { title: "More" },
    "/app/guard/profile": { title: "My profile" },
    "/app/admin": { title: "Overview" },
    "/app/admin/verifications": { title: "Verification queue" },
    "/app/admin/residents": { title: "Residents" },
    "/app/admin/issues": { title: "Issues" },
    "/app/admin/guests": { title: "Visitor log", subtitle: "Guest passes, entries and exits" },
    "/app/admin/staff": { title: "Staff" },
    "/app/admin/events": { title: "Events moderation" },
    "/app/admin/shop": { title: "Estate Shop", subtitle: "Manage items and orders" },
    "/app/admin/community": { title: "Community posts" },
    "/app/admin/profile": { title: "My profile" },
    "/app/admin/messages": { title: "Messages", subtitle: "Broadcasts and direct notices" },
    "/app/admin/troubleshoot": { title: "Troubleshoot", subtitle: "Estate health checks" },
    "/app/admin/dependents": { title: "Dependants" },
    "/app/admin/realtime": { title: "Realtime access" },
    "/app/admin/alerts": { title: "Security alerts" },
    "/app/admin/passes": { title: "Passes" },
    "/app/admin/cards": { title: "Access cards" },
    "/app/admin/vehicles": { title: "Vehicle tags", subtitle: "Registered resident vehicles" },
    "/app/admin/payments": { title: "Payments overview" },
    "/app/admin/discounts": { title: "Discounts" },
    "/app/admin/collections": { title: "Estate collection", subtitle: "Campaigns and payment progress" },
    "/app/admin/blog": { title: "Blog" },
    "/app/admin/households": { title: "Households", subtitle: "Addresses and occupancy" },
    "/app/admin/estate": { title: "Estate profile", subtitle: "Address, code and contacts" },
    "/app/resident/access": { title: "My access methods" },
    "/app/resident/pass": { title: "My pass" },
    "/app/super/features": { title: "Feature flags" },
    "/app/super/plans": { title: "Plans" },
    "/app/super": { title: "Platform overview" },
    "/app/super/users": { title: "Platform users" },
    "/app/super/devices": { title: "Access devices", subtitle: "Every terminal across all estates" },
    "/app/super/invites": { title: "Admin invites" },
    "/app/super/support": { title: "Support center" },
    "/app/super/audit": { title: "Audit logs" },
    "/app/super/settings": { title: "Platform settings" },
    "/app/super/profile": { title: "My profile" },
    "/app/denied": { title: "Access denied" },
  };

  if (path.startsWith("/app/resident/events/") && !map[path]) {
    return { title: "Event" };
  }
  if (path.startsWith("/app/super/estates/")) {
    return { title: "Estate detail" };
  }
  return map[path] ?? { title: "Estate Guard" };
}
