import {
  Home,
  Users,
  Receipt,
  MessageSquare,
  Shield,
  ScrollText,
  Building2,
  Inbox,
  MoreHorizontal,
  ShieldCheck,
  AlertTriangle,
  Store,
  Megaphone,
  LifeBuoy,
  UserCog,
  Cpu,
  Activity,
  BadgeCheck,
  Calendar,
  Car,
  CreditCard,
  FileText,
  Newspaper,
  Percent,
  Sparkles,
  Settings,
  Ticket,
  UsersRound,
  Wrench,
  Wallet,
} from "lucide-react";
import type { AppRole } from "@/lib/session";
import type { ReactNode } from "react";

export type NavLink = { to: string; label: string; icon: ReactNode };
export type NavGroup = { label: string; items: NavLink[] };

/** Compact bottom-bar navigation used on phones. */
export const navByRole: Record<AppRole, NavLink[]> = {
  resident: [
    { to: "/app/resident", label: "Home", icon: <Home /> },
    { to: "/app/resident/bills", label: "Bills", icon: <Receipt /> },
    { to: "/app/resident/community", label: "Community", icon: <Users /> },
    { to: "/app/resident/inbox", label: "Inbox", icon: <Inbox /> },
    { to: "/app/resident/more", label: "More", icon: <MoreHorizontal /> },
  ],
  guard: [
    { to: "/app/guard", label: "Home", icon: <Home /> },
    { to: "/app/guard/validate", label: "Validate", icon: <Shield /> },
    { to: "/app/guard/active", label: "Inside", icon: <Users /> },
    { to: "/app/guard/incidents", label: "Incidents", icon: <AlertTriangle /> },
    { to: "/app/guard/more", label: "More", icon: <MoreHorizontal /> },
  ],
  estate_admin: [
    { to: "/app/admin", label: "Overview", icon: <Home /> },
    { to: "/app/admin/verifications", label: "Verify", icon: <ShieldCheck /> },
    { to: "/app/admin/requests", label: "Requests", icon: <Inbox /> },
    { to: "/app/admin/shop", label: "Shop", icon: <Store /> },
    { to: "/app/admin/community", label: "Community", icon: <Megaphone /> },
  ],
  super_admin: [
    { to: "/app/super", label: "Overview", icon: <Building2 /> },
    { to: "/app/super/users", label: "Users", icon: <UserCog /> },
    { to: "/app/super/devices", label: "Devices", icon: <Cpu /> },
    { to: "/app/super/invites", label: "Invites", icon: <Inbox /> },
    { to: "/app/super/support", label: "Support", icon: <LifeBuoy /> },
    { to: "/app/super/audit", label: "Audit", icon: <ScrollText /> },
  ],
};

/**
 * Full sectioned navigation. Admin and Super Admin are desktop-first consoles,
 * so every module is reachable from the sidebar (and from the mobile menu sheet)
 * instead of being hidden behind a 5-tab bottom bar.
 */
export const sidebarGroupsByRole: Record<AppRole, NavGroup[]> = {
  resident: [
    {
      label: "Main",
      items: [
        { to: "/app/resident", label: "Home", icon: <Home /> },
        { to: "/app/resident/inbox", label: "Inbox", icon: <Inbox /> },
        { to: "/app/resident/community", label: "Community", icon: <Users /> },
      ],
    },
    {
      label: "Access",
      items: [
        { to: "/app/resident/invite", label: "Invite guest", icon: <UsersRound /> },
        { to: "/app/resident/guests", label: "My invites", icon: <Ticket /> },
        { to: "/app/resident/access", label: "Access methods", icon: <Sparkles /> },
        { to: "/app/resident/pass", label: "My pass", icon: <BadgeCheck /> },
      ],
    },
    {
      label: "Estate",
      items: [
        { to: "/app/resident/bills", label: "Bills", icon: <Receipt /> },
        { to: "/app/resident/shop", label: "Shop", icon: <Store /> },
        { to: "/app/resident/issues", label: "Issues", icon: <AlertTriangle /> },
        { to: "/app/resident/requests", label: "Requests", icon: <FileText /> },
        { to: "/app/resident/more", label: "More", icon: <MoreHorizontal /> },
      ],
    },
  ],
  guard: [
    {
      label: "Gate",
      items: [
        { to: "/app/guard", label: "Home", icon: <Home /> },
        { to: "/app/guard/validate", label: "Validate", icon: <Shield /> },
        { to: "/app/guard/active", label: "Visitors inside", icon: <Users /> },
        { to: "/app/guard/history", label: "Entry & exit", icon: <ScrollText /> },
      ],
    },
    {
      label: "Reports",
      items: [
        { to: "/app/guard/incidents", label: "Incidents", icon: <AlertTriangle /> },
        { to: "/app/guard/more", label: "More", icon: <MoreHorizontal /> },
      ],
    },
  ],
  estate_admin: [
    {
      label: "Main",
      items: [
        { to: "/app/admin", label: "Home", icon: <Home /> },
        { to: "/app/admin/messages", label: "Messages", icon: <MessageSquare /> },
        { to: "/app/admin/requests", label: "Tickets", icon: <Ticket /> },
        { to: "/app/admin/troubleshoot", label: "Troubleshoot", icon: <Wrench /> },
      ],
    },
    {
      label: "People",
      items: [
        { to: "/app/admin/residents", label: "Residents", icon: <Users /> },
        { to: "/app/admin/dependents", label: "Dependants", icon: <UsersRound /> },
        { to: "/app/admin/staff", label: "Staff & guards", icon: <Shield /> },
        { to: "/app/admin/verifications", label: "Verifications", icon: <ShieldCheck /> },
      ],
    },
    {
      label: "Entry & exit",
      items: [
        { to: "/app/admin/realtime", label: "Realtime access", icon: <Activity /> },
        { to: "/app/admin/alerts", label: "Security alerts", icon: <AlertTriangle /> },
        { to: "/app/admin/guests", label: "Guest logs", icon: <ScrollText /> },
        { to: "/app/admin/passes", label: "Passes", icon: <BadgeCheck /> },
        { to: "/app/admin/cards", label: "Access cards", icon: <CreditCard /> },
        { to: "/app/admin/vehicles", label: "Vehicles", icon: <Car /> },
      ],
    },
    {
      label: "Payments",
      items: [
        { to: "/app/admin/payments", label: "Overview", icon: <Wallet /> },
        { to: "/app/admin/bills", label: "Collections", icon: <Receipt /> },
        { to: "/app/admin/discounts", label: "Discounts", icon: <Percent /> },
      ],
    },
    {
      label: "Community",
      items: [
        { to: "/app/admin/blog", label: "Blog", icon: <Newspaper /> },
        { to: "/app/admin/community", label: "Polls & announcements", icon: <Megaphone /> },
        { to: "/app/admin/events", label: "Events", icon: <Calendar /> },
        { to: "/app/admin/issues", label: "Issues", icon: <AlertTriangle /> },
      ],
    },
    {
      label: "Shop",
      items: [{ to: "/app/admin/shop", label: "Products & orders", icon: <Store /> }],
    },
  ],
  super_admin: [
    {
      label: "Main",
      items: [
        { to: "/app/super", label: "Overview", icon: <Building2 /> },
        { to: "/app/super/users", label: "Users", icon: <UserCog /> },
        { to: "/app/super/invites", label: "Admin invites", icon: <Inbox /> },
      ],
    },
    {
      label: "Platform",
      items: [
        { to: "/app/super/devices", label: "Access devices", icon: <Cpu /> },
        { to: "/app/super/features", label: "Feature flags", icon: <Sparkles /> },
        { to: "/app/super/plans", label: "Plans", icon: <Wallet /> },
      ],
    },
    {
      label: "Operations",
      items: [
        { to: "/app/super/support", label: "Support", icon: <LifeBuoy /> },
        { to: "/app/super/audit", label: "Audit logs", icon: <ScrollText /> },
        { to: "/app/super/settings", label: "Settings", icon: <Settings /> },
      ],
    },
  ],
};

/** Roles whose primary experience is a desktop console with a persistent sidebar. */
export const desktopFirstRoles: AppRole[] = ["estate_admin", "super_admin"];
