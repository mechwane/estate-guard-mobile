import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/admin/issues")({
  component: AdminIssues,
  head: () => ({
    meta: [
      { title: "Incidents — Estate Guard" },
      {
        name: "description",
        content:
          "Review, triage and resolve incidents reported by residents and guards across your estate.",
      },
      { property: "og:title", content: "Incidents — Estate Guard" },
      {
        property: "og:description",
        content: "Triage and resolve estate incidents reported by residents and guards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type IssueRowData = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  location: string | null;
  status: "open" | "in_progress" | "resolved";
  severity: "low" | "medium" | "high" | "critical";
  response: string | null;
  reporter_role: string | null;
  resident_id: string | null;
  created_at: string;
  responded_at: string | null;
};

const sevTone: Record<string, "primary" | "warning" | "error"> = {
  low: "primary",
  medium: "warning",
  high: "error",
  critical: "error",
};

const statusTone: Record<string, "warning" | "primary" | "success"> = {
  open: "warning",
  in_progress: "primary",
  resolved: "success",
};

type Tab = "all" | "open" | "in_progress" | "resolved";

function AdminIssues() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const estateId = session?.estate?.id;
  const [tab, setTab] = useState<Tab>("open");
  const [severity, setSeverity] = useState<string>("all");
  const [search, setSearch] = useState("");

  const issues = useQuery({
    queryKey: ["admin-issues", estateId],
    enabled: !!estateId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select(
          "id,title,description,category,location,status,severity,response,reporter_role,resident_id,created_at,responded_at",
        )
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IssueRowData[];
    },
  });

  const residents = useQuery({
    queryKey: ["admin-issue-reporters", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,unit,house_number")
        .eq("estate_id", estateId!);
      if (error) throw error;
      return new Map(
        (data ?? []).map((r) => [
          r.id,
          `${r.full_name}${r.unit || r.house_number ? ` · ${r.unit ?? r.house_number}` : ""}`,
        ]),
      );
    },
  });

  const rows = issues.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((i) => {
      if (tab !== "all" && i.status !== tab) return false;
      if (severity !== "all" && i.severity !== severity) return false;
      if (!term) return true;
      return [i.title, i.description, i.category, i.location].some((v) =>
        (v ?? "").toLowerCase().includes(term),
      );
    });
  }, [rows, tab, severity, search]);

  const counts = useMemo(
    () => ({
      open: rows.filter((i) => i.status === "open").length,
      progress: rows.filter((i) => i.status === "in_progress").length,
      resolved: rows.filter((i) => i.status === "resolved").length,
      critical: rows.filter(
        (i) => (i.severity === "critical" || i.severity === "high") && i.status !== "resolved",
      ).length,
    }),
    [rows],
  );

  const exportCsv = () => {
    const header = ["Title", "Severity", "Status", "Category", "Location", "Reported", "Response"];
    const lines = filtered.map((i) =>
      [
        i.title,
        i.severity,
        i.status,
        i.category ?? "",
        i.location ?? "",
        new Date(i.created_at).toISOString(),
        i.response ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (issues.isLoading) return <ListSkeleton rows={5} />;
  if (issues.isError) return <ErrorState onRetry={() => issues.refetch()} />;

  return (
    <Stagger className="space-y-4">
      <StaggerItem>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldAlert className="h-5 w-5 text-primary" /> Incidents
          </h1>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Open" value={counts.open} tone={counts.open ? "warning" : "default"} />
          <StatCard label="In progress" value={counts.progress} tone="primary" />
          <StatCard label="Resolved" value={counts.resolved} tone="success" />
          <StatCard
            label="High / critical"
            value={counts.critical}
            tone={counts.critical ? "error" : "default"}
          />
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ScrollTabs
            value={tab}
            onChange={setTab}
            className="sm:flex-1"
            tabs={
              [
                { key: "open", label: `Open (${counts.open})` },
                { key: "in_progress", label: `In progress (${counts.progress})` },
                { key: "resolved", label: `Resolved (${counts.resolved})` },
                { key: "all", label: `All (${rows.length})` },
              ] as const
            }
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </StaggerItem>

      <StaggerItem>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search title, description, category or location"
        />
      </StaggerItem>

      {filtered.length === 0 ? (
        <StaggerItem>
          <EmptyState
            title="No incidents match this view"
            description="Try another status, severity or search term."
            icon={<ShieldAlert className="h-6 w-6" />}
          />
        </StaggerItem>
      ) : (
        filtered.map((issue) => (
          <StaggerItem key={issue.id}>
            <IssueCard
              issue={issue}
              reporter={
                issue.resident_id ? residents.data?.get(issue.resident_id) ?? null : null
              }
              onDone={() => qc.invalidateQueries({ queryKey: ["admin-issues", estateId] })}
            />
          </StaggerItem>
        ))
      )}
    </Stagger>
  );
}

function IssueCard({
  issue,
  reporter,
  onDone,
}: {
  issue: IssueRowData;
  reporter: string | null;
  onDone: () => void;
}) {
  const { data: session } = useSession();
  const [reply, setReply] = useState(issue.response ?? "");
  const [status, setStatus] = useState<IssueRowData["status"]>(issue.status);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const save = async (nextStatus?: IssueRowData["status"]) => {
    if (!session?.userId || !session.estate?.id) return;
    const finalStatus = nextStatus ?? status;
    setSaving(true);
    const { error } = await supabase
      .from("issues")
      .update({
        response: reply.trim() || null,
        status: finalStatus,
        responded_by: session.userId,
        responded_at: new Date().toISOString(),
      })
      .eq("id", issue.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStatus(finalStatus);
    await supabase.from("audit_logs").insert({
      estate_id: session.estate.id,
      actor_id: session.userId,
      action: "issue.updated",
      entity: "issues",
      entity_id: issue.id,
      metadata: { status: finalStatus },
    });
    if (issue.resident_id) {
      await supabase.from("notifications").insert({
        user_id: issue.resident_id,
        estate_id: session.estate.id,
        title:
          finalStatus === "resolved" ? "Your incident was resolved" : "Update on your incident",
        body: reply.trim() || `Status changed to ${finalStatus.replace("_", " ")}.`,
        link_to: "/app/resident/issues",
      });
    }
    toast.success("Incident updated");
    onDone();
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 text-left">
          <div className="truncate text-sm font-medium text-foreground">{issue.title}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {issue.category ?? "General"} ·{" "}
            {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
            {reporter ? ` · ${reporter}` : issue.reporter_role ? ` · ${issue.reporter_role}` : ""}
            {issue.location ? ` · ${issue.location}` : ""}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge tone={sevTone[issue.severity] ?? "neutral"}>{issue.severity}</StatusBadge>
          <StatusBadge tone={statusTone[status] ?? "neutral"}>
            {status.replace("_", " ")}
          </StatusBadge>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{issue.description}</p>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Write a response to the reporter…"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueRowData["status"])}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <button
              onClick={() => save()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save update
            </button>
            {status !== "resolved" && (
              <button
                onClick={() => save("resolved")}
                disabled={saving}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                Mark resolved
              </button>
            )}
          </div>
          {issue.responded_at && (
            <p className="text-xs text-muted-foreground">
              Last responded {formatDistanceToNow(new Date(issue.responded_at), { addSuffix: true })}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
