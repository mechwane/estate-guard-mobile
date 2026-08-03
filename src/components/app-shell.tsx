import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Search, UserCircle2, X } from "lucide-react";
import { useSession, type AppRole } from "@/lib/session";
import type { NavGroup, NavLink } from "@/components/nav-config";

export function AppShell({
  title,
  subtitle,
  role,
  navItems,
  navGroups,
  desktopFirst = false,
  estateName,
  children,
}: {
  title: string;
  subtitle?: string;
  role: AppRole;
  navItems: NavLink[];
  navGroups: NavGroup[];
  desktopFirst?: boolean;
  estateName?: string | null;
  children: ReactNode;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  useEffect(() => {
    setMenuOpen(false);
    setQuery("");
  }, [location.pathname]);

  const initial = (session?.profile?.full_name ?? session?.email ?? "U").slice(0, 1).toUpperCase();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  };

  const isActive = (to: string) => {
    if (location.pathname === to) return true;
    // Only treat as active prefix when the next char is a path separator,
    // so /app/admin does not light up for /app/admin/bills.
    const isIndex = to === "/app/admin" || to === "/app/super" || to.split("/").length === 3;
    if (isIndex) return false;
    return location.pathname.startsWith(to + "/");
  };

  const flatLinks = useMemo(() => navGroups.flatMap((g) => g.items), [navGroups]);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return flatLinks.filter((l) => l.label.toLowerCase().includes(needle)).slice(0, 8);
  }, [query, flatLinks]);

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

  const NavRow = ({ item, onClick }: { item: NavLink; onClick?: () => void }) => (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive(item.to)
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="[&>svg]:h-[18px] [&>svg]:w-[18px] shrink-0">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </Link>
  );

  const GroupedNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navGroups.map((group) => (
        <div key={group.label} className="mb-4">
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavRow key={item.to} item={item} onClick={onNavigate} />
            ))}
          </div>
        </div>
      ))}
      <div className="mb-2">
        <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          Account
        </div>
        <NavRow
          item={{ to: profileHref, label: "My profile", icon: <UserCircle2 /> }}
          onClick={onNavigate}
        />
      </div>
    </>
  );

  // Admin / Super Admin are desktop consoles: sidebar from `lg`, and no bottom bar.
  const sidebarVisible = desktopFirst ? "lg:flex" : "md:flex";
  const shellFlex = desktopFirst ? "lg:flex" : "md:flex";
  const hideOnDesktop = desktopFirst ? "lg:hidden" : "md:hidden";

  return (
    <div className={cn("min-h-screen bg-background", shellFlex)}>
      {/* Persistent desktop sidebar */}
      <aside
        className={cn(
          "hidden flex-col border-r border-border/60 bg-card/40",
          sidebarVisible,
          desktopFirst ? "lg:w-64" : "md:w-64",
          "sticky top-0 h-screen",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 px-4">
          <AvatarBtn large />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {session?.profile?.full_name ?? session?.email}
            </div>
            <div className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {roleLabel}
              {estateName && <span className="text-muted-foreground/70"> · {estateName}</span>}
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <GroupedNav />
        </nav>
        <button
          onClick={signOut}
          className="m-3 inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive/90 transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: search + quick actions (desktop), menu + avatar (mobile) */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-2.5",
              desktopFirst ? "lg:h-16 lg:px-8" : "md:h-16 md:px-8",
            )}
          >
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                hideOnDesktop,
              )}
            >
              <Menu className="h-4.5 w-4.5" />
            </button>

            <div className="min-w-0 flex-1">
              <div className={cn("relative", desktopFirst ? "lg:max-w-md" : "md:max-w-md")}>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && results[0]) navigate({ to: results[0].to });
                    if (e.key === "Escape") setQuery("");
                  }}
                  placeholder="Search pages…"
                  aria-label="Search pages"
                  className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
                />
                {results.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-lg slide-up">
                    {results.map((r) => (
                      <Link
                        key={r.to}
                        to={r.to}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted"
                      >
                        <span className="[&>svg]:h-4 [&>svg]:w-4 text-muted-foreground">
                          {r.icon}
                        </span>
                        <span className="truncate">{r.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-sm font-semibold text-muted-foreground xl:inline">
                {title}
              </span>
              <AvatarBtn />
              <button
                onClick={signOut}
                aria-label="Log out"
                title="Log out"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full px-4 pt-4 page-enter sm:px-5",
            desktopFirst
              ? "max-w-3xl pb-10 lg:max-w-[1600px] lg:px-8 lg:pt-6"
              : "max-w-2xl pb-28 md:max-w-7xl md:px-8 md:pb-10 md:pt-8",
          )}
        >
          <h1 className="sr-only">
            {title}
            {subtitle ? ` — ${subtitle}` : ""}
          </h1>
          <div key={location.pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile slide-over menu with the full sectioned navigation */}
      {menuOpen && (
        <div className={cn("fixed inset-0 z-50", hideOnDesktop)}>
          <button
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/50 fade-in"
          />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-border bg-card slide-up">
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 px-4">
              <AvatarBtn large />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {session?.profile?.full_name ?? session?.email}
                </div>
                <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                  {roleLabel}
                </div>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3">
              <GroupedNav onNavigate={() => setMenuOpen(false)} />
            </nav>
            <button
              onClick={signOut}
              className="m-3 inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive/90 hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}

      {/* Bottom tab bar — phone-first roles only */}
      {!desktopFirst && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
          <div className="scroll-x mx-auto flex max-w-2xl items-stretch gap-1 px-2 pt-1.5 safe-bottom">
            {navItems.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors",
                  isActive(it.to) || location.pathname === it.to
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="[&>svg]:h-5 [&>svg]:w-5">{it.icon}</span>
                <span className="max-w-full truncate">{it.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
