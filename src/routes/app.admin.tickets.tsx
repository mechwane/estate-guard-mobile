import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
  SheetModal,
  StatusBadge,
} from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Ticket as TicketIcon, MessageSquare, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/app/admin/tickets")({
  component: AdminTickets,
  head: () => ({
    meta: [
      { title: "Support Tickets — Estate Guard" },
      {
        name: "description",
        content:
          "Track, assign and close resident support tickets: code requests, billing issues and complaints.",
      },
      { property: "og:title", content: "Support Tickets — Estate Guard" },
      {
        property: "og:description",
        content: "Open and closed resident tickets for your estate in one queue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  subject: string;
  body: string;
  status: string;
  resident_id: string;
  created_at: string;
  updated_at: string;
};

function AdminTickets() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  const [reply, setReply] = useState("");

  const list = useQuery({
    queryKey: ["admin-tickets", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [tickets, people] = await Promise.all([
        supabase
          .from("support_tickets")
          .select("id,subject,body,status,resident_id,created_at,updated_at")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.from("profiles").select("id,full_name,address_code").eq("estate_id", estateId!),
      ]);
      if (tickets.error) throw tickets.error;
      return {
        tickets: (tickets.data ?? []) as Row[],
        names: new Map(
          (people.data ?? []).map((p) => [p.id, { name: p.full_name, code: p.address_code }]),
        ),
      };
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.rpc("log_activity", {
        _action: `ticket.${status}`,
        _entity: "support_ticket",
        _entity_id: id,
        _metadata: reply.trim() ? { note: reply.trim() } : {},
      });
    },
    onSuccess: () => {
      toast.success("Ticket updated");
      setOpen(null);
      setReply("");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const rows = list.data?.tickets ?? [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const isClosed = r.status === "closed" || r.status === "resolved";
      if (tab === "open" ? isClosed : !isClosed) return false;
      if (!needle) return true;
      return (
        r.subject.toLowerCase().includes(needle) ||
        r.body.toLowerCase().includes(needle) ||
        (list.data?.names.get(r.resident_id)?.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [list.data, q, tab]);

  const counts = useMemo(() => {
    const rows = list.data?.tickets ?? [];
    const closed = rows.filter((r) => r.status === "closed" || r.status === "resolved").length;
    return { open: rows.length - closed, closed };
  }, [list.data]);

  if (list.isLoading) return <ListSkeleton rows={5} />;
  if (list.isError) return <ErrorState onRetry={() => list.refetch()} />;

  return (
    <div className="space-y-4">
      <FadeIn>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <TicketIcon className="h-5 w-5 text-primary" /> Support Tickets
        </h2>
        <p className="text-xs text-muted-foreground">
          Every request, complaint and billing issue raised by residents.
        </p>
      </FadeIn>

      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-xs flex-1">
          <ScrollTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "open", label: `Open ${counts.open}` },
              { key: "closed", label: `Closed ${counts.closed}` },
            ]}
          />
        </div>
        <div className="w-full max-w-sm">
          <SearchInput value={q} onChange={setQ} placeholder="Search subject, resident…" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={tab === "open" ? "No open tickets" : "No closed tickets"}
          description="Resident tickets land here the moment they are submitted."
          icon={<TicketIcon className="h-6 w-6" />}
        />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const who = list.data?.names.get(t.resident_id);
            const closed = t.status === "closed" || t.status === "resolved";
            return (
              <StaggerItem key={t.id}>
                <Card className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-semibold leading-snug text-foreground">
                      {t.subject}
                    </h3>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {who?.code ?? ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <StatusBadge tone={closed ? "neutral" : "warning"}>{t.status}</StatusBadge>
                    <span>
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </span>
                    <span>· {who?.name ?? "Resident"}</span>
                  </div>
                  <p className="line-clamp-3 text-xs text-muted-foreground">{t.body}</p>
                  <div className="mt-auto flex gap-2 pt-2">
                    <button
                      onClick={() => setOpen(t)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Open
                    </button>
                    {closed ? (
                      <button
                        onClick={() => setStatus.mutate({ id: t.id, status: "open" })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reopen
                      </button>
                    ) : (
                      <button
                        onClick={() => setStatus.mutate({ id: t.id, status: "closed" })}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-success)]/40 px-3 py-2 text-xs font-medium text-[color:var(--color-success)] hover:bg-[color:var(--color-success)]/10"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Close
                      </button>
                    )}
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <SheetModal
        open={!!open}
        title={open?.subject ?? "Ticket"}
        onClose={() => setOpen(null)}
        width="lg"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => open && setStatus.mutate({ id: open.id, status: "in_progress" })}
              className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Mark in progress
            </button>
            <button
              onClick={() => open && setStatus.mutate({ id: open.id, status: "closed" })}
              className="rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Close ticket
            </button>
          </div>
        }
      >
        {open && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {list.data?.names.get(open.resident_id)?.name ?? "Resident"} ·{" "}
              {formatDistanceToNow(new Date(open.created_at), { addSuffix: true })}
            </div>
            <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">
              {open.body}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Internal note (saved to change history)
              </span>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
        )}
      </SheetModal>
    </div>
  );
}
