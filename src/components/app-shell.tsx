import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { AppRole } from "@/lib/session";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export function AppShell({
  title,
  subtitle,
  role,
  navItems,
  estateName,
  children,
}: {
  title: string;
  subtitle?: string;
  role: AppRole;
  navItems: NavItem[];
  estateName?: string | null;
  children: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const roleLabel = {
    resident: "Resident",
    guard: "Guard",
    estate_admin: "Estate Admin",
    super_admin: "Super Admin",
  }[role];

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  };

  const isActive = (to: string) =>
    location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border/60 lg:bg-card/40">
        <div className="flex h-14 items-center gap-2 border-b border-border/60 px-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="truncate">
            {roleLabel}
            {estateName && <span className="text-muted-foreground/70"> · {estateName}</span>}
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(it.to)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="[&>svg]:h-5 [&>svg]:w-5">{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="m-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile/tablet header */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="truncate">
                {roleLabel}
                {estateName && <span className="text-muted-foreground/70"> · {estateName}</span>}
              </span>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl px-5 pb-28 pt-4 fade-in lg:max-w-7xl lg:px-8 lg:pb-10 lg:pt-8">
          <h1 className="sr-only">
            {title}
            {subtitle ? ` — ${subtitle}` : ""}
          </h1>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2 py-1.5">
          {navItems.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors",
                isActive(it.to) ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="[&>svg]:h-5 [&>svg]:w-5">{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
