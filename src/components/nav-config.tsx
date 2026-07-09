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
} from "lucide-react";
import type { AppRole } from "@/lib/session";
import type { ReactNode } from "react";

export const navByRole: Record<AppRole, { to: string; label: string; icon: ReactNode }[]> = {
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
    { to: "/app/super/invites", label: "Invites", icon: <Inbox /> },
    { to: "/app/super/support", label: "Support", icon: <LifeBuoy /> },
    { to: "/app/super/audit", label: "Audit", icon: <ScrollText /> },
  ],
};

