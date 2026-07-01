import { Home, Users, Receipt, MessageSquare } from "lucide-react";
import type { AppRole } from "@/lib/session";
import type { ReactNode } from "react";

export const navByRole: Record<AppRole, { to: string; label: string; icon: ReactNode }[]> = {
  resident: [
    { to: "/app/resident", label: "Home", icon: <Home /> },
    { to: "/app/resident/guests", label: "Guests", icon: <Users /> },
    { to: "/app/resident/bills", label: "Bills", icon: <Receipt /> },
    { to: "/app/resident/issues", label: "Issues", icon: <MessageSquare /> },
  ],
  guard: [
    { to: "/app/guard", label: "Validate", icon: <Home /> },
    { to: "/app/guard/history", label: "History", icon: <Users /> },
  ],
  estate_admin: [
    { to: "/app/admin", label: "Overview", icon: <Home /> },
    { to: "/app/admin/residents", label: "Residents", icon: <Users /> },
    { to: "/app/admin/bills", label: "Bills", icon: <Receipt /> },
    { to: "/app/admin/issues", label: "Issues", icon: <MessageSquare /> },
  ],
  super_admin: [
    { to: "/app/super", label: "Overview", icon: <Home /> },
    { to: "/app/super/estates", label: "Estates", icon: <Users /> },
    { to: "/app/super/audit", label: "Audit", icon: <Receipt /> },
  ],
};
