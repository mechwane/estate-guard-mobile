import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useAvatarUrl, initialsFor } from "@/lib/avatar";
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
  Building2,
  Check,
  Copy,
  ShieldCheck,
  X,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";

export const Route = createFileRoute("/app/resident/")({
  component: ResidentHome,
});

function ResidentHome() {
  const { data: session } = useSession();
  const name = session?.profile?.full_name || session?.email || "Resident";
  const avatarUrl = useAvatarUrl((session?.profile as any)?.avatar_url);
  const initials = initialsFor(name);
  const [estateOpen, setEstateOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

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
      <FadeIn>
        <div className="flex items-center justify-between gap-3">
          <Link to="/app/resident/more" className="flex min-w-0 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/80 to-primary shadow-sm ring-2 ring-primary/20">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary-foreground">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight text-foreground">
                {name}
              </div>
              <div className="text-xs text-muted-foreground">Estate Resident</div>
            </div>
          </Link>
          <button
            onClick={() => setEstateOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Building2 className="h-3.5 w-3.5 text-primary" />
            {session?.estate?.code ?? "Estate"}
          </button>
        </div>
      </FadeIn>

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
            to="/app/resident/invite"
            title="Multiple Invite"
            icon={<Users className="h-8 w-8" />}
            tone="muted"
          />
        </StaggerItem>
      </Stagger>

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

      <FloatingInviteBadge onOpen={() => setFabOpen(true)} />

      <AnimatePresence>
        {estateOpen && (
          <EstateSheet
            estate={session?.estate ?? null}
            onClose={() => setEstateOpen(false)}
          />
        )}
        {fabOpen && (
          <ActiveInvitesSheet
            userId={session?.userId ?? null}
            onClose={() => setFabOpen(false)}
          />
        )}
      </AnimatePresence>
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

function FloatingInviteBadge({ onOpen }: { onOpen: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <motion.button
      onClick={onOpen}
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.4 }}
      className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary-dark px-4 py-2.5 text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-accent/40"
      aria-label="Active invites"
    >
      <ShieldCheck className="h-4 w-4" />
      <span className="text-xs font-semibold tabular-nums">{time}</span>
    </motion.button>
  );
}

function EstateSheet({
  estate,
  onClose,
}: {
  estate: { id: string; name: string; code: string; status: string } | null;
  onClose: () => void;
}) {
  const copy = async () => {
    if (!estate?.code) return;
    await navigator.clipboard.writeText(estate.code);
    toast.success("Estate code copied");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-2xl ring-1 ring-border"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Select estate</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {estate ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{estate.name}</div>
                  <div className="text-xs text-muted-foreground">Code · {estate.code}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <Check className="h-3.5 w-3.5" /> Active
              </span>
            </div>
            <button
              onClick={copy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Copy className="h-3.5 w-3.5" /> Copy estate code
            </button>
            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              You are only a member of one estate. Ask an admin for another estate code to switch.
            </p>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You are not linked to any estate yet.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

function ActiveInvitesSheet({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["active-invites", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_invites")
        .select("id, guest_name, code, expires_at, status, visit_time")
        .eq("resident_id", userId!)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[75vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-2xl ring-1 ring-border"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Active invites</h3>
            <p className="text-[11px] text-muted-foreground">
              Codes your guests can present at the gate
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {q.isLoading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
          ) : !q.data || q.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <Ticket className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No active invites</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create one and your guests can use it at the gate.
              </p>
            </div>
          ) : (
            q.data.map((inv: any) => <InviteRow key={inv.id} inv={inv} />)
          )}
        </div>
        <div className="border-t border-border p-3">
          <Link
            to="/app/resident/invite"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
          >
            <UserPlus className="h-4 w-4" /> Create new invite
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InviteRow({ inv }: { inv: any }) {
  const copy = async () => {
    await navigator.clipboard.writeText(inv.code);
    toast.success(`Code ${inv.code} copied`);
  };
  return (
    <button
      onClick={copy}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-left hover:bg-muted/40"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{inv.guest_name}</div>
        <div className="text-[11px] text-muted-foreground">
          Expires{" "}
          {formatDistanceToNowStrict(new Date(inv.expires_at), { addSuffix: true })}
        </div>
      </div>
      <div className="ml-3 shrink-0 rounded-md bg-primary/10 px-2.5 py-1 font-mono text-sm font-semibold tracking-widest text-primary">
        {inv.code}
      </div>
    </button>
  );
}
