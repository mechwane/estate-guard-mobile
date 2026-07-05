import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem, Pressable } from "@/components/motion-kit";
import {
  UserPlus,
  Users,
  Store,
  CalendarClock,
  MessageSquarePlus,
  Flag,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/app/resident/")({
  component: ResidentHome,
});

function ResidentHome() {
  const { data: session } = useSession();
  const name = session?.profile?.full_name || session?.email || "Resident";
  const avatar = session?.profile?.avatar_url;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const unread = useQuery({
    queryKey: ["notif-unread", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session!.userId!)
        .is("read_at", null);
      return count ?? 0;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full bg-gradient-to-br from-primary/80 to-primary shadow-sm">
              {avatar ? (
                <img src={avatar} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary-foreground">
                  {initials}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight text-foreground">{name}</div>
              <div className="text-xs text-muted-foreground">Estate Resident</div>
            </div>
          </div>
          <Link
            to="/app/resident/more"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            {session?.estate?.code ?? "Estate"}
          </Link>
        </div>
      </FadeIn>

      {/* Circular quick actions */}
      <Stagger className="grid grid-cols-2 gap-4">
        <StaggerItem>
          <QuickCircle
            to="/app/resident/invite"
            title="Single Invite"
            icon={<UserPlus className="h-8 w-8" />}
            tone="primary"
          />
        </StaggerItem>
        <StaggerItem>
          <QuickCircle
            to="/app/resident/invite?bulk=1"
            title="Multiple Invite"
            icon={<Users className="h-8 w-8" />}
            tone="muted"
          />
        </StaggerItem>
      </Stagger>

      {/* Action rows */}
      <Stagger className="space-y-2">
        <StaggerItem>
          <ActionRow
            to="/app/resident/shop"
            icon={<Store className="h-4 w-4" />}
            label="Estate Shop"
          />
        </StaggerItem>
        <StaggerItem>
          <ActionRow
            to="/app/resident/guests"
            icon={<CalendarClock className="h-4 w-4" />}
            label="Manage Invites"
          />
        </StaggerItem>
        <StaggerItem>
          <ActionRow
            to="/app/resident/requests"
            icon={<MessageSquarePlus className="h-4 w-4" />}
            label="Submit Request"
          />
        </StaggerItem>
      </Stagger>

      <FadeIn delay={0.3}>
        <Link
          to="/app/resident/issues"
          className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Flag className="h-4 w-4" /> Report an issue
        </Link>
      </FadeIn>

      {unread.data && unread.data > 0 ? (
        <FadeIn delay={0.35}>
          <Link to="/app/resident/inbox">
            <Card className="flex items-center justify-between border-primary/30 bg-primary/5 p-4">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {unread.data} new notification{unread.data === 1 ? "" : "s"}
                </div>
                <div className="text-xs text-muted-foreground">Tap to view your inbox</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Card>
          </Link>
        </FadeIn>
      ) : null}
    </div>
  );
}

function QuickCircle({
  to,
  title,
  icon,
  tone,
}: {
  to: string;
  title: string;
  icon: React.ReactNode;
  tone: "primary" | "muted";
}) {
  const bg =
    tone === "primary"
      ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20"
      : "bg-gradient-to-br from-muted to-muted/50 text-muted-foreground";
  return (
    <Link to={to} className="flex flex-col items-center gap-3">
      <Pressable className={`flex h-28 w-28 items-center justify-center rounded-full ${bg}`}>
        {icon}
      </Pressable>
      <span className="text-sm font-medium text-foreground">{title}</span>
    </Link>
  );
}

function ActionRow({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link to={to}>
      <Card className="flex items-center justify-between p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Card>
    </Link>
  );
}
