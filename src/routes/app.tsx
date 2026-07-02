import { Outlet, createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession, roleHome, type AppRole } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { navByRole } from "@/components/nav-config";
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
    >
      <Outlet />
    </AppShell>
  );
}

function deriveHeader(path: string): { title: string; subtitle?: string } {
  const map: Record<string, { title: string; subtitle?: string }> = {
    "/app/resident": { title: "Home", subtitle: "Your estate at a glance" },
    "/app/resident/invite": { title: "New guest invite" },
    "/app/resident/guests": { title: "My guests" },
    "/app/resident/bills": { title: "Bills" },
    "/app/resident/issues": { title: "Issues" },
    "/app/resident/vtu": { title: "Bills & top-ups", subtitle: "Airtime, data, electricity, cable" },
    "/app/resident/vtu/history": { title: "VTU history" },
    "/app/resident/events": { title: "Events", subtitle: "Estate and public happenings" },
    "/app/resident/events/mine": { title: "My events" },
    "/app/resident/events/new": { title: "Create event" },
    "/app/resident/more": { title: "More" },
    "/app/resident/profile": { title: "Profile & account" },
    "/app/resident/verification": { title: "Estate verification", subtitle: "Verify your residency" },
    "/app/guard": { title: "Guest validation" },
    "/app/guard/history": { title: "Validation history" },
    "/app/admin": { title: "Overview" },
    "/app/admin/verifications": { title: "Verification queue" },
    "/app/admin/residents": { title: "Residents" },
    "/app/admin/bills": { title: "Bills" },
    "/app/admin/issues": { title: "Issues" },
    "/app/admin/guests": { title: "Guest logs" },
    "/app/admin/staff": { title: "Staff" },
    "/app/admin/events": { title: "Events moderation" },
    "/app/super": { title: "Platform overview" },
    "/app/super/audit": { title: "Audit logs" },
    "/app/denied": { title: "Access denied" },
  };

  if (path.startsWith("/app/resident/vtu/") && path !== "/app/resident/vtu/history") {
    return { title: "Purchase" };
  }
  if (path.startsWith("/app/resident/events/") && !map[path]) {
    return { title: "Event" };
  }
  return map[path] ?? { title: "Estate Guard" };
}
