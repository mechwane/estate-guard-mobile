import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { Loader2, MessageSquare, Search, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { EmptyState, ListSkeleton } from "@/components/ui-kit";
import { initialsFor, useAvatarUrls } from "@/lib/avatar";

export interface ChatMessage {
  id: string;
  estate_id: string;
  resident_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

interface Person {
  id: string;
  full_name: string;
  house_number: string | null;
  unit: string | null;
  avatar_url: string | null;
}

const stamp = (iso: string) => {
  const d = new Date(iso);
  return isToday(d) ? format(d, "h:mm a") : format(d, "d MMM, h:mm a");
};

function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  return url ? (
    <img
      src={url}
      alt={name}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
    >
      {initialsFor(name)}
    </span>
  );
}

/** Live message thread + composer shared by admin and resident views. */
function Thread({
  estateId,
  residentId,
  meId,
  title,
  subtitle,
  avatarUrl,
  onBack,
}: {
  estateId: string;
  residentId: string;
  meId: string;
  title: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  onBack?: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement | null>(null);

  const thread = useQuery({
    queryKey: ["chat-thread", estateId, residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("estate_id", estateId)
        .eq("resident_id", residentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

  // Mark inbound messages read once the thread is open.
  useEffect(() => {
    const unread = (thread.data ?? []).filter((m) => m.sender_id !== meId && !m.read_at);
    if (unread.length === 0) return;
    void supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .in(
        "id",
        unread.map((m) => m.id),
      )
      .then(() => qc.invalidateQueries({ queryKey: ["chat-list", estateId] }));
  }, [thread.data, meId, estateId, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const body = draft.trim();
      if (!body) return;
      const { error } = await supabase.from("chat_messages").insert({
        estate_id: estateId,
        resident_id: residentId,
        sender_id: meId,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      void thread.refetch();
      qc.invalidateQueries({ queryKey: ["chat-list", estateId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Message not sent"),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground lg:hidden"
          >
            Back
          </button>
        )}
        <Avatar name={title} url={avatarUrl} size={34} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/20 px-3 py-4">
        {thread.isLoading ? (
          <ListSkeleton rows={4} />
        ) : (thread.data ?? []).length === 0 ? (
          <p className="pt-8 text-center text-xs text-muted-foreground">
            No messages yet — say hello.
          </p>
        ) : (
          (thread.data ?? []).map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-1`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border/60 bg-card text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <div
                    className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {stamp(m.created_at)}
                    {mine && m.read_at ? " · Read" : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) send.mutate();
        }}
        className="flex shrink-0 items-end gap-2 border-t border-border/60 bg-card px-3 py-3"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (draft.trim()) send.mutate();
            }
          }}
          rows={1}
          placeholder="Type your message…"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          aria-label="Send message"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50"
        >
          {send.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}

/** Subscribes the whole estate thread set to realtime updates. */
function useChatRealtime(estateId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!estateId) return;
    const channel = supabase
      .channel(`chat-${estateId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `estate_id=eq.${estateId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat-list", estateId] });
          qc.invalidateQueries({ queryKey: ["chat-thread", estateId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [estateId, qc]);
}

/** Admin console: WhatsApp-style conversation list beside the live thread. */
export function AdminChat() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const meId = session?.userId ?? "";
  const [active, setActive] = useState<string | null>(null);
  const [q, setQ] = useState("");
  useChatRealtime(estateId);

  const residents = useQuery({
    queryKey: ["chat-residents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,house_number,unit,avatar_url")
        .eq("estate_id", estateId!)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });

  const messages = useQuery({
    queryKey: ["chat-list", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false })
        .limit(600);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

  const avatarMap = useAvatarUrls((residents.data ?? []).map((r) => r.avatar_url));

  const conversations = useMemo(() => {
    const byResident = new Map<string, { last: ChatMessage; unread: number }>();
    for (const m of messages.data ?? []) {
      const entry = byResident.get(m.resident_id);
      const unread = m.sender_id !== meId && !m.read_at ? 1 : 0;
      if (!entry) byResident.set(m.resident_id, { last: m, unread });
      else entry.unread += unread;
    }
    const people = new Map((residents.data ?? []).map((r) => [r.id, r]));
    const needle = q.trim().toLowerCase();
    const rows = [...byResident.entries()].map(([residentId, v]) => ({
      residentId,
      person: people.get(residentId),
      ...v,
    }));
    const withMessages = rows.filter((r) =>
      !needle
        ? true
        : (r.person?.full_name ?? "").toLowerCase().includes(needle) ||
          r.last.body.toLowerCase().includes(needle),
    );
    // When searching, also surface residents with no history yet.
    const extra = needle
      ? (residents.data ?? [])
          .filter(
            (p) =>
              !byResident.has(p.id) &&
              ((p.full_name ?? "").toLowerCase().includes(needle) ||
                (p.house_number ?? "").toLowerCase().includes(needle)),
          )
          .slice(0, 15)
          .map((p) => ({ residentId: p.id, person: p, last: null as ChatMessage | null, unread: 0 }))
      : [];
    return [...withMessages, ...extra];
  }, [messages.data, residents.data, meId, q]);

  const activePerson = (residents.data ?? []).find((r) => r.id === active);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="grid h-[calc(100dvh-11rem)] min-h-[26rem] overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <aside
        className={`flex min-h-0 flex-col border-border/60 lg:border-r ${active ? "hidden lg:flex" : "flex"}`}
      >
        <div className="shrink-0 space-y-2 border-b border-border/60 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages"
                className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            {totalUnread > 0 && (
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                {totalUnread}
              </span>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.isLoading ? (
            <div className="p-3">
              <ListSkeleton rows={5} />
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">
              No conversations yet. Search a resident name to start one.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {conversations.map((c) => (
                <li key={c.residentId}>
                  <button
                    onClick={() => setActive(c.residentId)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 ${
                      active === c.residentId ? "bg-primary/10" : ""
                    }`}
                  >
                    <Avatar
                      name={c.person?.full_name ?? "Resident"}
                      url={c.person?.avatar_url ? avatarMap[c.person.avatar_url] : null}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {c.person?.full_name ?? "Resident"}
                        </span>
                        {c.last && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.last.created_at), { addSuffix: true })}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {c.last
                            ? `${c.last.sender_id === meId ? "You: " : ""}${c.last.body}`
                            : (c.person?.house_number ?? "Start a conversation")}
                        </span>
                        {c.unread > 0 && (
                          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                            {c.unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className={`min-h-0 ${active ? "block" : "hidden lg:block"}`}>
        {active ? (
          <Thread
            estateId={estateId}
            residentId={active}
            meId={meId}
            title={activePerson?.full_name ?? "Resident"}
            subtitle={activePerson?.house_number ?? activePerson?.unit ?? null}
            avatarUrl={activePerson?.avatar_url ? avatarMap[activePerson.avatar_url] : null}
            onBack={() => setActive(null)}
          />
        ) : (
          <div className="grid h-full place-items-center bg-muted/20 px-6 text-center">
            <div>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold">Your chat shows here</p>
              <p className="text-xs text-muted-foreground">Please select a conversation.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/** Resident side: a single live thread with the estate management team. */
export function ResidentChat() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const meId = session?.userId ?? "";
  useChatRealtime(estateId);

  if (!estateId || !meId)
    return (
      <EmptyState
        title="No estate linked"
        description="Join an estate to chat with the management team."
      />
    );

  return (
    <div className="h-[calc(100dvh-12rem)] min-h-[24rem] overflow-hidden rounded-2xl border border-border bg-card">
      <Thread
        estateId={estateId}
        residentId={meId}
        meId={meId}
        title="Estate management"
        subtitle={session?.estate?.name ?? null}
        avatarUrl={null}
      />
    </div>
  );
}

export { UserRound as ChatPersonIcon };
