import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Users, LogOut, Ban, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";

export const Route = createFileRoute("/app/admin/guests")({
  component: AdminGuestLogs,
  head: () => ({
    meta: [
      { title: "Visitor Log — Estate Guard" },
      {
        name: "description",
        content:
          "Full estate visitor log: who is inside, expected arrivals, exits and revoked guest passes.",
      },
    ],
  }),
});

type Tab = "all" | "inside" | "expected" | "completed" | "revoked";

const TABS: readonly { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inside", label: "Inside now" },
  { key: "expected", label: "Expected" },
  { key: "completed", label: "Completed" },
  { key: "revoked", label: "Revoked" },
];

type Invite = {
  id: string;
  guest_name: string;
  code: string;
  purpose: string | null;
  phone: string | null;
  visit_time: string;
  expires_at: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  num_guests: number | null;
  vehicle_number: string | null;
  resident_id: string;
  created_at: string;
};

function AdminGuestLogs() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<
    { kind: "exit" | "revoke"; invite: Invite } | null
  >(null);

  const invitesQ = useQuery({
    queryKey: ["admin-guests", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_invites")
        .select(
          "id,guest_name,code,purpose,phone,visit_time,expires_at,status,checked_in_at,checked_out_at,num_guests,vehicle_number,resident_id,created_at",
        )
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
    refetchInterval: 20_000,
  });

  const residentsQ = useQuery({
    queryKey: ["profiles-for-guests", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,unit,house_number")
        .eq("estate_id", estateId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const residentMap = useMemo(
    () => new Map((residentsQ.data ?? []).map((r) => [r.id, r])),
    [residentsQ.data],
  );

  const rows = invitesQ.data ?? [];
  const now = Date.now();

  const counts = useMemo(
    () => ({
      total: rows.length,
      inside: rows.filter((r) => r.checked_in_at && !r.checked_out_at).length,
      expected: rows.filter(
        (r) =>
          !r.checked_in_at &&
          r.status === "active" &&
          new Date(r.expires_at).getTime() > now,
      ).length,
      completed: rows.filter((r) => !!r.checked_out_at).length,
      revoked: rows.filter((r) => r.status === "revoked").length,
    }),
    [rows, now],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "inside" && !(r.checked_in_at && !r.checked_out_at)) return false;
      if (
        tab === "expected" &&
        !(
          !r.checked_in_at &&
          r.status === "active" &&
          new Date(r.expires_at).getTime() > now
        )
      )
        return false;
      if (tab === "completed" && !r.checked_out_at) return false;
      if (tab === "revoked" && r.status !== "revoked") return false;
      if (!needle) return true;
      const host = residentMap.get(r.resident_id);
      return (
        r.guest_name.toLowerCase().includes(needle) ||
        r.code.toLowerCase().includes(needle) ||
        (r.vehicle_number ?? "").toLowerCase().includes(needle) ||
        (r.phone ?? "").toLowerCase().includes(needle) ||
        (host?.full_name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, tab, q, now, residentMap]);

  const act = useMutation({
    mutationFn: async ({ kind, invite }: { kind: "exit" | "revoke"; invite: Invite }) => {
      const patch =
        kind === "exit"
          ? { checked_out_at: new Date().toISOString(), status: "used" as const }
          : { status: "revoked" as const };
      const { error } = await supabase
        .from("guest_invites")
        .update(patch)
        .eq("id", invite.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.kind === "exit" ? "Guest checked out" : "Pass revoked");
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin-guests", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const head = "guest,code,host,purpose,visit_time,checked_in,checked_out,status\n";
    const body = filtered
      .map((r) =>
        [
          r.guest_name,
          r.code,
          residentMap.get(r.resident_id)?.full_name ?? "",
          r.purpose ?? "",
          r.visit_time,
          r.checked_in_at ?? "",
          r.checked_out_at ?? "",
          r.status,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `visitor-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <Stagger className="space-y-4">
      <StaggerItem>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard label="Total passes" value={counts.total} />
          <StatCard
            label="Inside now"
            value={counts.inside}
            tone={counts.inside ? "primary" : "default"}
          />
          <StatCard label="Expected" value={counts.expected} />
          <StatCard label="Completed" value={counts.completed} tone="success" />
          <StatCard
            label="Revoked"
            value={counts.revoked}
            tone={counts.revoked ? "error" : "default"}
          />
        </div>
      </StaggerItem>

      <StaggerItem>
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchInput
                value={q}
                onChange={setQ}
                placeholder="Search guest, code, plate, host…"
              />
            </div>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <ScrollTabs value={tab} onChange={setTab} tabs={TABS} />

          {invitesQ.isLoading ? (
            <ListSkeleton rows={5} />
          ) : invitesQ.isError ? (
            <ErrorState onRetry={() => invitesQ.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No guest activity"
              description="Passes created by residents appear here in real time."
              icon={<Users className="h-6 w-6" />}
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((g) => {
                const host = residentMap.get(g.resident_id);
                const inside = !!g.checked_in_at && !g.checked_out_at;
                const expired = new Date(g.expires_at).getTime() < now;
                return (
                  <li
                    key={g.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {g.guest_name}
                        {g.num_guests && g.num_guests > 1 ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            +{g.num_guests - 1}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        <span className="font-mono uppercase">{g.code}</span>
                        {g.purpose ? ` · ${g.purpose}` : ""}
                        {g.vehicle_number ? ` · ${g.vehicle_number}` : ""}
                      </div>
                    </div>
                    <div className="hidden min-w-0 md:block">
                      <div className="text-xs text-muted-foreground">Host</div>
                      <div className="truncate text-sm">
                        {host?.full_name ?? "—"}
                        {host?.house_number || host?.unit ? (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            · {host.house_number ?? host.unit}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="hidden min-w-0 md:block">
                      <div className="text-xs text-muted-foreground">Movement</div>
                      <div className="truncate text-xs">
                        {g.checked_in_at
                          ? `In ${format(new Date(g.checked_in_at), "MMM d, p")}`
                          : `Due ${format(new Date(g.visit_time), "MMM d, p")}`}
                        {g.checked_out_at
                          ? ` · Out ${format(new Date(g.checked_out_at), "p")}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge
                        tone={
                          g.status === "revoked"
                            ? "error"
                            : inside
                              ? "primary"
                              : g.checked_out_at
                                ? "success"
                                : expired
                                  ? "warning"
                                  : "neutral"
                        }
                      >
                        {g.status === "revoked"
                          ? "Revoked"
                          : inside
                            ? "Inside"
                            : g.checked_out_at
                              ? "Exited"
                              : expired
                                ? "Expired"
                                : "Expected"}
                      </StatusBadge>
                      {inside && (
                        <button
                          title="Force check-out"
                          aria-label="Force check-out"
                          onClick={() => setConfirm({ kind: "exit", invite: g })}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {g.status === "active" && (
                        <button
                          title="Revoke pass"
                          aria-label="Revoke pass"
                          onClick={() => setConfirm({ kind: "revoke", invite: g })}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {invitesQ.dataUpdatedAt > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Live · refreshed{" "}
              {formatDistanceToNow(new Date(invitesQ.dataUpdatedAt), { addSuffix: true })}
            </p>
          )}
        </Card>
      </StaggerItem>

      <ConfirmActionDialog
        open={!!confirm}
        title={confirm?.kind === "exit" ? "Force check-out?" : "Revoke this pass?"}
        description={
          confirm
            ? confirm.kind === "exit"
              ? `${confirm.invite.guest_name} will be marked as exited now.`
              : `${confirm.invite.guest_name} will no longer be able to enter with code ${confirm.invite.code}.`
            : undefined
        }
        confirmLabel={confirm?.kind === "exit" ? "Check out" : "Revoke"}
        tone={confirm?.kind === "revoke" ? "destructive" : "default"}
        busy={act.isPending}
        onConfirm={() => confirm && act.mutate(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </Stagger>
  );
}
