import { Home, Users, Receipt, MessageSquare, Shield, ScrollText, Building2, Smartphone, CalendarDays, MoreHorizontal, ShieldCheck, AlertTriangle } from "lucide-react";
import type { AppRole } from "@/lib/session";
import type { ReactNode } from "react";

export const navByRole: Record<AppRole, { to: string; label: string; icon: ReactNode }[]> = {
  resident: [
    { to: "/app/resident", label: "Home", icon: <Home /> },
    { to: "/app/resident/guests", label: "Guests", icon: <Users /> },
    { to: "/app/resident/vtu", label: "VTU", icon: <Smartphone /> },
    { to: "/app/resident/events", label: "Events", icon: <CalendarDays /> },
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
    { to: "/app/admin/residents", label: "Residents", icon: <Users /> },
    { to: "/app/admin/bills", label: "Bills", icon: <Receipt /> },
    { to: "/app/admin/issues", label: "Issues", icon: <MessageSquare /> },
  ],
  super_admin: [
    { to: "/app/super", label: "Estates", icon: <Building2 /> },
    { to: "/app/super/audit", label: "Audit", icon: <ScrollText /> },
  ],
};
