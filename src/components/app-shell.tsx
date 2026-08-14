import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Search, Settings, UserCircle2, X } from "lucide-react";
import { useSession, type AppRole } from "@/lib/session";
import type { NavGroup, NavLink } from "@/components/nav-config";
import { claimDeviceSession, releaseDeviceSession, type DeviceClaim } from "@/lib/device-session";

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

  // One active device per account: claim this browser on mount and block the
  // console until the other device signs out (or is taken over deliberately).
  const [deviceBlock, setDeviceBlock] = useState<Extract<DeviceClaim, { ok: false }> | null>(null);
  const [claiming, setClaiming] = useState(false);
  useEffect(() => {
    if (!session?.userId) return;
    let alive = true;
    claimDeviceSession().then((res) => {
      if (alive) setDeviceBlock(res.ok ? null : res);
    });
    return () => {
      alive = false;
    };
  }, [session?.userId]);

  const takeOverDevice = async () => {
    setClaiming(true);
    const res = await claimDeviceSession(true);
    setClaiming(false);
    setDeviceBlock(res.ok ? null : res);
  };

  const signOut = async () => {
    await releaseDeviceSession();
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
    return flatLinks.filter((l) => l.label.toLowerCase().includes(needle)).slice(0, 5);
  }, [query, flatLinks]);

  // Admin console search also looks up people, addresses and access codes.
  const estateId = session?.estate?.id ?? null;
  const canSearchEstate = role === "estate_admin" && !!estateId;
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const estateHits = useQuery({
    queryKey: ["shell-search", estateId, debounced],
    enabled: canSearchEstate && debounced.length >= 2,
    queryFn: async () => {
      const like = `%${debounced}%`;
      const [people, invites] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,address_code,house_number,street,unit,approved")
          .eq("estate_id", estateId!)
          .or(
            `full_name.ilike.${like},address_code.ilike.${like},house_number.ilike.${like},street.ilike.${like},phone.ilike.${like},email.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("guest_invites")
          .select("id,code,guest_name,resident_id,status")
          .eq("estate_id", estateId!)
          .or(`code.ilike.${like},guest_name.ilike.${like}`)
          .limit(4),
      ]);
      return {
        people: people.data ?? [],
        invites: invites.data ?? [],
      };
    },
  });


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
  // Resident / Guard are phone apps: never a sidebar, always the bottom tab bar.
  const sidebarVisible = desktopFirst ? "lg:flex" : "hidden";
  const shellFlex = desktopFirst ? "lg:flex" : "";
  const hideOnDesktop = desktopFirst ? "lg:hidden" : "";


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
            {desktopFirst && (
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
            )}

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
                  placeholder={
                    canSearchEstate ? "Search resident, address, access code…" : "Search pages…"
                  }
                  aria-label="Search"
                  className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
                />
                {(results.length > 0 ||
                  (estateHits.data?.people.length ?? 0) > 0 ||
                  (estateHits.data?.invites.length ?? 0) > 0) && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover shadow-lg slide-up">
                    {(estateHits.data?.people.length ?? 0) > 0 && (
                      <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Residents & addresses
                      </div>
                    )}
                    {(estateHits.data?.people ?? []).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setQuery("");
                          navigate({ to: "/app/admin/resident/$id", params: { id: r.id } });
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{r.full_name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {[r.address_code, r.street, r.house_number && `No ${r.house_number}`]
                              .filter(Boolean)
                              .join(" · ") || "No address"}
                          </span>
                        </span>
                        {!r.approved && (
                          <span className="shrink-0 text-[10px] text-destructive">disapproved</span>
                        )}
                      </button>
                    ))}
                    {(estateHits.data?.invites.length ?? 0) > 0 && (
                      <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Access codes
                      </div>
                    )}
                    {(estateHits.data?.invites ?? []).map((g) => (
                      <Link
                        key={g.id}
                        to="/app/admin/guests"
                        className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted"
                      >
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {g.code} — {g.guest_name}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {g.status}
                        </span>
                      </Link>
                    ))}
                    {results.length > 0 && (
                      <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Pages
                      </div>
                    )}
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
              {desktopFirst && session?.estate && (
                <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold sm:inline-flex">
                  <span className="truncate">{session.estate.code}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                      session.estate.status === "active"
                        ? "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]"
                        : "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
                    )}
                  >
                    {session.estate.status === "active" ? "Live" : "Demo"}
                  </span>
                </span>
              )}
              {role === "estate_admin" && (
                <Link
                  to="/app/admin/settings"
                  aria-label="Settings"
                  title="Settings"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              )}
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
              : "max-w-2xl pb-28",
          )}
        >

          <h1 className="sr-only">
            {title}
            {subtitle ? ` — ${subtitle}` : ""}
          </h1>
          <div key={location.pathname} className="page-enter">
            {deviceBlock ? (
              <DeviceBlocked
                deviceLabel={deviceBlock.deviceLabel}
                lastSeenAt={deviceBlock.lastSeenAt}
                onTakeOver={takeOverDevice}
                onSignOut={signOut}
                busy={claiming}
              />
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* Mobile slide-over menu with the full sectioned navigation */}
      {desktopFirst && menuOpen && (
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
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
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

function DeviceBlocked({
  deviceLabel,
  lastSeenAt,
  onTakeOver,
  onSignOut,
  busy,
}: {
  deviceLabel?: string | null;
  lastSeenAt?: string | null;
  onTakeOver: () => void;
  onSignOut: () => void;
  busy: boolean;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center">
      <h2 className="text-base font-semibold text-foreground">Already signed in elsewhere</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This account is active on {deviceLabel || "another device"}
        {lastSeenAt ? ` (last used ${new Date(lastSeenAt).toLocaleString()})` : ""}. Only one device
        can be signed in at a time — log out there, or continue here to end that session.
      </p>
      <div className="mt-5 space-y-2">
        <button
          onClick={onTakeOver}
          disabled={busy}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Switching…" : "Continue on this device"}
        </button>
        <button
          onClick={onSignOut}
          className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
