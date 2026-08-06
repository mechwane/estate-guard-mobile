import { Outlet, createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession, roleHome, type AppRole } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { navByRole, sidebarGroupsByRole, desktopFirstRoles } from "@/components/nav-config";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isLoading } = useSession();

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

  return (
    <AppShell
      role={role}
      title={title}
      subtitle={subtitle}
      estateName={session.estate?.name ?? null}
      navItems={navByRole[role]}
      navGroups={sidebarGroupsByRole[role]}
      desktopFirst={desktopFirstRoles.includes(role)}
    >
      <Outlet />
    </AppShell>
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
    "/app/admin/bills": { title: "Bills" },
    "/app/admin/issues": { title: "Issues" },
    "/app/admin/guests": { title: "Visitor log", subtitle: "Guest passes, entries and exits" },
    "/app/admin/staff": { title: "Staff" },
    "/app/admin/events": { title: "Events moderation" },
    "/app/admin/shop": { title: "Estate Shop", subtitle: "Manage items and orders" },
    "/app/admin/requests": { title: "Resident requests" },
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
    "/app/admin/invoices": { title: "Invoices", subtitle: "Resident billing records" },
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
