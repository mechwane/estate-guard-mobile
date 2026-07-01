import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { AppRole } from "@/lib/session";

interface NavItem { to: string; label: string; icon: ReactNode }

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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              {roleLabel}
              {estateName && <span className="text-muted-foreground/70">· {estateName}</span>}
            </div>
            <h1 className="mt-0.5 truncate text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-28 pt-5 fade-in">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2 py-1.5">
          {navItems.map((it) => {
            const active =
              location.pathname === it.to ||
              (it.to !== "/" && location.pathname.startsWith(it.to));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("[&>svg]:h-5 [&>svg]:w-5")}>{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
