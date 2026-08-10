import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/audit")({
  component: AdminAudit,
  head: () => ({
    meta: [
      { title: "Change History — Estate Guard" },
      {
        name: "description",
        content:
          "Full audit trail of estate admin actions: approvals, revocations, notices, comments and edits.",
      },
      { property: "og:title", content: "Change History — Estate Guard" },
      {
        property: "og:description",
        content: "Full audit trail of every estate admin action in your estate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Group = "all" | "access" | "content" | "billing" | "security";

const TABS = [
  { key: "all", label: "All" },
  { key: "access", label: "Access" },
  { key: "content", label: "Content" },
  { key: "billing", label: "Billing" },
  { key: "security", label: "Security" },
] as const;

function groupOf(action: string): Exclude<Group, "all"> {
  if (/^(access|verification|guard|estate_admin|support)\./.test(action)) return "access";
  if (/^(post|comment|meeting|broadcast|poll)/.test(action)) return "content";
  if (/^(bill|payment|shop_order|plan)/.test(action)) return "billing";
  return "security";
}

const TONE: Record<Exclude<Group, "all">, "primary" | "warning" | "error" | "neutral"> = {
  access: "primary",
  content: "neutral",
  billing: "warning",
  security: "error",
};

const LABELS: Record<string, string> = {
  "access.granted": "Access granted",
  "access.revoked": "Access revoked",
  "post.created": "Notice posted",
  "post.edited": "Notice edited",
  "post.deleted": "Notice deleted",
  "comment.posted": "Comment reply",
  "comment.edited": "Comment edited",
  "comment.deleted": "Comment deleted",
  "meeting.created": "Meeting scheduled",
  "meeting.edited": "Meeting edited",
  "meeting.cancelled": "Meeting cancelled",
  "broadcast.sent": "Broadcast sent",
  "guest.check_in": "Guest checked in",
  "guest.check_out": "Guest checked out",
  "pass.issued": "Pass issued",
  "pass.used": "Pass used",
  "bill.paid": "Bill paid",
  "bill.paid.offline": "Bill paid (offline)",
  "device.registered": "Device registered",
  "device.status_changed": "Device status changed",
  "biometric.updated": "Biometric access updated",
  "verification.approved": "Verification approved",
  "verification.rejected": "Verification rejected",
  "verification.pending": "Verification submitted",
};

function AdminAudit() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [tab, setTab] = useState<Group>("all");
  const [q, setQ] = useState("");
  const [days, setDays] = useState(30);

  const logs = useQuery({
    queryKey: ["admin-audit", estateId, days],
    enabled: !!estateId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 864e5).toISOString();
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,action,entity,entity_id,actor_id,metadata,created_at")
        .eq("estate_id", estateId!)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["audit-people", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name")
        .eq("estate_id", estateId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (id: string | null) =>
    (id && people.data?.find((p) => p.id === id)?.full_name) || (id ? "Unknown user" : "System");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (logs.data ?? [])
      .filter((l) => tab === "all" || groupOf(l.action) === tab)
      .filter((l) => {
        if (!needle) return true;
        const meta = JSON.stringify(l.metadata ?? {}).toLowerCase();
        return (
          l.action.toLowerCase().includes(needle) ||
          (l.entity ?? "").toLowerCase().includes(needle) ||
          nameOf(l.actor_id).toLowerCase().includes(needle) ||
          meta.includes(needle)
        );
      });
  }, [logs.data, tab, q, people.data]);

  const counts = useMemo(() => {
    const all = logs.data ?? [];
    return {
      total: all.length,
      access: all.filter((l) => groupOf(l.action) === "access").length,
      content: all.filter((l) => groupOf(l.action) === "content").length,
      today: all.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString())
        .length,
    };
  }, [logs.data]);

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ScrollText className="h-5 w-5 text-primary" /> Change history
        </h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
        >
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Entries" value={counts.total} />
        <StatCard label="Today" value={counts.today} tone={counts.today ? "primary" : "default"} />
        <StatCard label="Access changes" value={counts.access} />
        <StatCard label="Content changes" value={counts.content} />
      </div>

      <ScrollTabs value={tab} onChange={setTab} tabs={TABS.map((t) => ({ ...t }))} />
      <div className="sm:max-w-xl">
        <SearchInput value={q} onChange={setQ} placeholder="Search action, person or item" />
      </div>

      {logs.isLoading ? (
        <ListSkeleton rows={6} />
      ) : logs.isError ? (
        <ErrorState onRetry={() => logs.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No activity recorded"
          description="Approvals, notices, comments and edits will appear here."
          icon={<ScrollText className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((l) => {
            const g = groupOf(l.action);
            const meta = (l.metadata ?? {}) as Record<string, unknown>;
            const detail =
              (meta.title as string) ||
              (meta.full_name as string) ||
              (meta.post_title as string) ||
              (meta.name as string) ||
              (meta.excerpt as string) ||
              null;
            return (
              <Card key={l.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {LABELS[l.action] ?? l.action}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      by {nameOf(l.actor_id)}
                      {l.entity ? ` · ${l.entity}` : ""}
                      {detail ? ` · ${detail}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={TONE[g]}>{g}</StatusBadge>
                    <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                      {format(new Date(l.created_at), "MMM d, HH:mm")}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
