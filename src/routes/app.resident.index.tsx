import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, SectionTitle, StatCard, EmptyState, StatusBadge } from "@/components/ui-kit";
import {
  UserPlus,
  MessageSquarePlus,
  Receipt,
  ChevronRight,
  Users,
  Smartphone,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/resident/")({
  component: ResidentHome,
});

function ResidentHome() {
  const { data: session } = useSession();
  const uid = session?.userId;

  const { data: stats } = useQuery({
    queryKey: ["resident-stats", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [inv, bills, issues] = await Promise.all([
        supabase
          .from("guest_invites")
          .select("id,status,guest_name,visit_time,code", { count: "exact" })
          .eq("resident_id", uid!)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("bills")
          .select("id,status,amount,title,due_date")
          .eq("resident_id", uid!)
          .neq("status", "paid"),
        supabase
          .from("issues")
          .select("id,status,title")
          .eq("resident_id", uid!)
          .neq("status", "resolved"),
      ]);
      const activeInvites = (inv.data ?? []).filter((i) => i.status === "active").length;
      const unpaid = (bills.data ?? []).reduce((s, b) => s + Number(b.amount), 0);
      return {
        activeInvites,
        unpaid,
        openIssues: (issues.data ?? []).length,
        recentInvites: inv.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-br from-[color:var(--color-primary-dark)] to-[color:var(--color-primary)] text-primary-foreground">
        <div className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
          Welcome
        </div>
        <div className="mt-1 text-lg font-semibold">
          {session?.profile?.full_name || "Resident"}
        </div>
        <p className="mt-1 text-sm text-primary-foreground/80">
          {session?.estate?.name}
          {session?.profile?.unit ? ` · Unit ${session.profile.unit}` : ""}
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active invites" value={stats?.activeInvites ?? 0} tone="primary" />
        <StatCard
          label="Unpaid"
          value={`₦${(stats?.unpaid ?? 0).toLocaleString()}`}
          tone="warning"
        />
        <StatCard label="Open issues" value={stats?.openIssues ?? 0} tone="default" />
      </div>

      <SectionTitle>Quick actions</SectionTitle>
      <div className="grid grid-cols-1 gap-2">
        <ActionLink
          to="/app/resident/invite"
          icon={<UserPlus className="h-5 w-5" />}
          title="Invite a guest"
          desc="Generate a one-time entry code"
        />
        <ActionLink
          to="/app/resident/vtu"
          icon={<Smartphone className="h-5 w-5" />}
          title="Airtime, data & bills"
          desc="Top up in seconds"
        />
        <ActionLink
          to="/app/resident/events"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Discover events"
          desc="Estate and public happenings"
        />
        <ActionLink
          to="/app/resident/issues"
          icon={<MessageSquarePlus className="h-5 w-5" />}
          title="Report an issue"
          desc="Send it to estate admin"
        />
        <ActionLink
          to="/app/resident/bills"
          icon={<Receipt className="h-5 w-5" />}
          title="View bills"
          desc="See what's due"
        />
      </div>

      <SectionTitle
        action={
          <Link to="/app/resident/guests" className="text-xs font-medium text-primary">
            See all
          </Link>
        }
      >
        Recent invites
      </SectionTitle>
      {(stats?.recentInvites ?? []).length === 0 ? (
        <EmptyState
          title="No guest invites yet"
          description="Create one to share with your visitor."
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-2">
          {stats!.recentInvites.map((i) => (
            <Card key={i.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{i.guest_name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(i.visit_time), "MMM d, p")} · Code {i.code}
                </div>
              </div>
              <StatusBadge
                tone={
                  i.status === "active" ? "primary" : i.status === "used" ? "success" : "neutral"
                }
              >
                {i.status}
              </StatusBadge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="card-surface flex items-center gap-3 p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
