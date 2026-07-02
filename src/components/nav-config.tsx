import { Home, Users, Receipt, MessageSquare, Shield, ScrollText, Building2, Smartphone, CalendarDays } from "lucide-react";
import type { AppRole } from "@/lib/session";
import type { ReactNode } from "react";

export const navByRole: Record<AppRole, { to: string; label: string; icon: ReactNode }[]> = {
  resident: [
    { to: "/app/resident", label: "Home", icon: <Home /> },
    { to: "/app/resident/vtu", label: "VTU", icon: <Smartphone /> },
    { to: "/app/resident/events", label: "Events", icon: <CalendarDays /> },
    { to: "/app/resident/guests", label: "Guests", icon: <Users /> },
    { to: "/app/resident/bills", label: "Bills", icon: <Receipt /> },
    { to: "/app/resident/issues", label: "Issues", icon: <MessageSquare /> },
  ],
  guard: [
    { to: "/app/guard", label: "Validate", icon: <Shield /> },
    { to: "/app/guard/history", label: "History", icon: <ScrollText /> },
  ],
  estate_admin: [
    { to: "/app/admin", label: "Overview", icon: <Home /> },
    { to: "/app/admin/residents", label: "Residents", icon: <Users /> },
    { to: "/app/admin/bills", label: "Bills", icon: <Receipt /> },
    { to: "/app/admin/events", label: "Events", icon: <CalendarDays /> },
    { to: "/app/admin/issues", label: "Issues", icon: <MessageSquare /> },
    { to: "/app/admin/staff", label: "Staff", icon: <Shield /> },
  ],
  super_admin: [
    { to: "/app/super", label: "Estates", icon: <Building2 /> },
    { to: "/app/super/audit", label: "Audit", icon: <ScrollText /> },
  ],
};
