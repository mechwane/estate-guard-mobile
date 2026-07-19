import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, UserCircle2 } from "lucide-react";
import { useSession, type AppRole } from "@/lib/session";

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
  const { data: session } = useSession();

  const roleLabel = {
    resident: "Resident",
    guard: "Guard",
    estate_admin: "Estate Admin",
    super_admin: "Super Admin",
  }[role];

  const profileHref = {
    resident: "/app/resident/profile",
    guard: "/app/guard/profile",
    estate_admin: "/app/admin/profile",
    super_admin: "/app/super/profile",
  }[role];

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    const path = session?.profile?.avatar_url;
    if (!path) return setAvatarUrl(null);
    supabase.storage
      .from("avatars")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setAvatarUrl(data?.signedUrl ?? null));
  }, [session?.profile?.avatar_url]);

  const initial = (session?.profile?.full_name ?? session?.email ?? "U").slice(0, 1).toUpperCase();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  };

  const isActive = (to: string) =>
    location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  const AvatarBtn = ({ large = false }: { large?: boolean }) => (
    <Link
      to={profileHref}
      aria-label="My profile"
      title="My profile"
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/70 to-primary text-xs font-semibold text-primary-foreground ring-2 ring-transparent transition hover:ring-primary/40",
        large ? "h-10 w-10 text-sm" : "h-8 w-8",
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </Link>
  );

  // Desktop breakpoint: use md (768px) so tablets get the sidebar layout too.
  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border/60 md:bg-card/40">
        <div className="flex h-16 items-center gap-3 border-b border-border/60 px-4">
          <AvatarBtn size={10} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{session?.profile?.full_name ?? session?.email}</div>
            <div className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {roleLabel}
              {estateName && <span className="text-muted-foreground/70"> · {estateName}</span>}
            </div>
          </div>
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
          <Link
            to={profileHref}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(profileHref)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <UserCircle2 className="h-5 w-5" />
            <span>Profile</span>
          </Link>
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
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="truncate">
                {roleLabel}
                {estateName && <span className="text-muted-foreground/70"> · {estateName}</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AvatarBtn size={8} />
              <button
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl px-5 pb-28 pt-4 fade-in md:max-w-7xl md:px-8 md:pb-10 md:pt-8">
          <h1 className="sr-only">
            {title}
            {subtitle ? ` — ${subtitle}` : ""}
          </h1>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
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
