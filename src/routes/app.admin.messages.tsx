import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Megaphone, Send, User } from "lucide-react";
import { toast } from "sonner";
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
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { biometricConfirm } from "@/lib/biometric-confirm";
import { AdminChat } from "@/components/estate-chat";

export const Route = createFileRoute("/app/admin/messages")({
  component: Messages,
  head: () => ({
    meta: [
      { title: "Messages & Broadcast — Estate Guard" },
      {
        name: "description",
        content:
          "Chat with residents in real time, send estate-wide announcements or direct notices, and review delivery history.",
      },
      { property: "og:title", content: "Messages & Broadcast — Estate Guard" },
      {
        property: "og:description",
        content: "Real-time resident chat plus estate-wide broadcasts for estate administrators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Mode = "broadcast" | "direct";


const TEMPLATES: { label: string; title: string; body: string }[] = [
  {
    label: "Power outage",
    title: "Planned power outage",
    body: "Please note there will be a planned power outage in the estate today. Kindly plan ahead. Thank you.",
  },
  {
    label: "Dues reminder",
    title: "Service charge reminder",
    body: "This is a friendly reminder to settle your outstanding service charge in the Bills section of the app.",
  },
  {
    label: "Security notice",
    title: "Security advisory",
    body: "Residents are advised to always issue guest codes before visitors arrive at the gate. Do not let anyone in without a valid pass.",
  },
  {
    label: "Meeting",
    title: "Estate general meeting",
    body: "A general estate meeting has been scheduled. Details and the join link are available in your Inbox.",
  },
];

function Messages() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [view, setView] = useState<"chat" | "broadcast">("chat");
  const [mode, setMode] = useState<Mode>("broadcast");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [q, setQ] = useState("");
  const [recipient, setRecipient] = useState<string>("");

  const residentsQ = useQuery({
    queryKey: ["profiles-for-messages", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,unit,house_number,approved")
        .eq("estate_id", estateId!)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const recent = useQuery({
    queryKey: ["admin-broadcasts", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,action,metadata,created_at")
        .eq("estate_id", estateId!)
        .in("action", ["broadcast.sent", "message.direct"])
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredResidents = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = residentsQ.data ?? [];
    if (!needle) return rows.slice(0, 40);
    return rows
      .filter(
        (r) =>
          (r.full_name ?? "").toLowerCase().includes(needle) ||
          (r.house_number ?? "").toLowerCase().includes(needle) ||
          (r.unit ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [residentsQ.data, q]);

  const reset = () => {
    setTitle("");
    setBody("");
    setLink("");
    setRecipient("");
  };

  const send = useMutation({
    mutationFn: async () => {
      if (mode === "broadcast") {
        if (!(await biometricConfirm(`Send "${title}" to all residents?`)))
          throw new Error("Cancelled");
        const { data, error } = await supabase.rpc("broadcast_message" as never, {
          _title: title.trim(),
          _body: body.trim(),
          _link: link.trim() || null,
        } as never);
        if (error) throw error;
        return { count: data as unknown as number };
      }
      if (!recipient) throw new Error("Select a resident");
      const { error } = await supabase.from("notifications").insert({
        user_id: recipient,
        estate_id: estateId!,
        title: title.trim(),
        body: body.trim(),
        link_to: link.trim() || null,
      });
      if (error) throw error;
      return { count: 1 };
    },
    onSuccess: (r) => {
      toast.success(
        mode === "broadcast"
          ? `Delivered to ${r.count} residents`
          : "Message delivered to resident",
      );
      reset();
      qc.invalidateQueries({ queryKey: ["admin-broadcasts", estateId] });
    },
    onError: (e: Error) => {
      if (e.message !== "Cancelled") toast.error(e.message);
    },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;

  const residentCount = (residentsQ.data ?? []).length;
  const broadcastCount = (recent.data ?? []).filter(
    (r) => r.action === "broadcast.sent",
  ).length;
  const canSend =
    !!title.trim() &&
    !!body.trim() &&
    (mode === "broadcast" || !!recipient) &&
    !send.isPending;

  return (
    <Stagger className="space-y-4">
      <StaggerItem>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Residents reachable" value={residentCount} tone="primary" />
          <StatCard label="Recent broadcasts" value={broadcastCount} />
          <StatCard label="Templates" value={TEMPLATES.length} />
          <StatCard
            label="Channel"
            value={mode === "broadcast" ? "Estate-wide" : "Single resident"}
          />
        </div>
      </StaggerItem>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <StaggerItem>
          <Card className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="h-4 w-4 text-primary" /> Compose
            </h2>
            <ScrollTabs
              value={mode}
              onChange={(m) => {
                setMode(m);
                setRecipient("");
              }}
              tabs={[
                { key: "broadcast", label: "Broadcast to estate" },
                { key: "direct", label: "Direct to resident" },
              ]}
            />

            {mode === "direct" && (
              <div className="space-y-2">
                <SearchInput
                  value={q}
                  onChange={setQ}
                  placeholder="Search resident by name or house…"
                />
                {residentsQ.isLoading ? (
                  <ListSkeleton rows={3} />
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border/60">
                    {filteredResidents.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">
                        No resident matches that search.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/60">
                        {filteredResidents.map((r) => (
                          <li key={r.id}>
                            <button
                              onClick={() => setRecipient(r.id)}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted ${
                                recipient === r.id ? "bg-primary/10 text-primary" : ""
                              }`}
                            >
                              <User className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{r.full_name}</span>
                              {(r.house_number || r.unit) && (
                                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                  {r.house_number ?? r.unit}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message body"
                rows={5}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Optional deep link (e.g. /app/resident/bills)"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => send.mutate()}
                disabled={!canSend}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {send.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {mode === "broadcast" ? "Verify & broadcast" : "Send message"}
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Clear
              </button>
              <span className="text-[11px] text-muted-foreground">
                {body.trim().length} characters
              </span>
            </div>
            {mode === "broadcast" && (
              <p className="text-[11px] text-muted-foreground">
                Broadcasts ask for your device confirmation before delivery.
              </p>
            )}
          </Card>
        </StaggerItem>

        <StaggerItem className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Quick templates</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => {
                    setTitle(t.title);
                    setBody(t.body);
                  }}
                  className="block w-full min-w-0 rounded-lg border border-border/60 bg-card px-3 py-2 text-left hover:border-primary/60 hover:bg-muted"
                >
                  <div className="truncate text-sm font-medium">{t.label}</div>
                  <div className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-muted-foreground">
                    {t.body}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Delivery history</h2>
            {recent.isLoading ? (
              <ListSkeleton rows={3} />
            ) : recent.isError ? (
              <ErrorState onRetry={() => recent.refetch()} />
            ) : (recent.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
            ) : (
              <ul className="space-y-2">
                {(recent.data ?? []).map((r) => {
                  const meta = (r.metadata ?? {}) as Record<string, unknown>;
                  return (
                    <li
                      key={r.id}
                      className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-medium">
                          {(meta.title as string) ?? "Broadcast"}
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Number(meta.recipients ?? 0)} recipients
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </StaggerItem>
      </div>
    </Stagger>
  );
}
