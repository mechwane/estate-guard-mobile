import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { Card, StatusBadge } from "@/components/ui-kit";
import {
  ChevronRight,
  User,
  ShieldCheck,
  LogOut,
  Receipt,
  Smartphone,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/resident/more")({
  component: More,
});

function verificationTone(status: string | null | undefined) {
  switch (status) {
    case "approved":
      return { tone: "success" as const, label: "Verified" };
    case "pending":
      return { tone: "warning" as const, label: "Pending review" };
    case "rejected":
      return { tone: "error" as const, label: "Rejected" };
    default:
      return { tone: "neutral" as const, label: "Not submitted" };
  }
}

function More() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const v = verificationTone(session?.profile?.verification_status);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-base font-semibold">
            {(session?.profile?.full_name ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {session?.profile?.full_name || "Unnamed"}
            </div>
            <div className="truncate text-xs text-muted-foreground">{session?.email}</div>
          </div>
          <StatusBadge tone={v.tone}>{v.label}</StatusBadge>
        </div>
      </Card>

      <div className="space-y-1.5">
        <Row
          to="/app/resident/profile"
          icon={<User className="h-4 w-4" />}
          label="Profile & account"
        />
        <Row
          to="/app/resident/verification"
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Estate verification"
          hint={v.label}
        />
        <Row to="/app/resident/bills" icon={<Receipt className="h-4 w-4" />} label="Bills" />
        <Row to="/app/resident/events" icon={<CalendarDays className="h-4 w-4" />} label="Events" />
      </div>

      <button
        onClick={signOut}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function Row({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <Link to={to} className="card-surface flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
