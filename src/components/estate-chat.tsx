import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday } from "date-fns";
import {
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { EmptyState, ListSkeleton, ModalPortal } from "@/components/ui-kit";
import { initialsFor, useAvatarUrl, useAvatarUrls } from "@/lib/avatar";
import { uploadMedia, useMediaUrl } from "@/lib/media";
import { ngn } from "@/lib/format";

export interface ChatMessage {
  id: string;
  estate_id: string;
  resident_id: string;
  sender_id: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
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

function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
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

/** Renders an uploaded chat attachment: inline image or a downloadable file chip. */
function Attachment({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const url = useMediaUrl(message.attachment_url);
  const isImage = (message.attachment_type ?? "").startsWith("image/");
  if (!message.attachment_url) return null;
  if (isImage)
    return (
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="block">
        {url ? (
          <img
            src={url}
            alt={message.attachment_name ?? "Attachment"}
            className="mb-1 max-h-56 w-full rounded-xl object-cover"
          />
        ) : (
          <div className="mb-1 grid h-32 w-40 place-items-center rounded-xl bg-black/10">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </a>
    );
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={`mb-1 flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs ${
        mine ? "bg-primary-foreground/15" : "bg-muted"
      }`}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{message.attachment_name ?? "Attachment"}</span>
    </a>
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
  onOpenProfile,
}: {
  estateId: string;
  residentId: string;
  meId: string;
  title: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  onBack?: () => void;
  onOpenProfile?: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
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
      const file = pending;
      if (!body && !file) return;
      let attachment: {
        attachment_url: string | null;
        attachment_name: string | null;
        attachment_type: string | null;
      } = { attachment_url: null, attachment_name: null, attachment_type: null };
      if (file) {
        if (file.size > 15 * 1024 * 1024) throw new Error("File is larger than 15 MB.");
        const path = await uploadMedia(file, "chat");
        attachment = {
          attachment_url: path,
          attachment_name: file.name,
          attachment_type: file.type || "application/octet-stream",
        };
      }
      const { error } = await supabase.from("chat_messages").insert({
        estate_id: estateId,
        resident_id: residentId,
        sender_id: meId,
        body,
        ...attachment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      setPending(null);
      void thread.refetch();
      qc.invalidateQueries({ queryKey: ["chat-list", estateId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Message not sent"),
  });

  const canSend = (!!draft.trim() || !!pending) && !send.isPending;

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
        <button
          type="button"
          onClick={onOpenProfile}
          disabled={!onOpenProfile}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 text-left transition-colors enabled:hover:bg-muted/60"
        >
          <Avatar name={title} url={avatarUrl} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{title}</span>
            {subtitle && (
              <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
            )}
          </span>
        </button>
        {onOpenProfile && (
          <button
            onClick={onOpenProfile}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
          >
            View profile
          </button>
        )}
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
                  <Attachment message={m} mine={mine} />
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
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
          if (canSend) send.mutate();
        }}
        className="shrink-0 border-t border-border/60 bg-card px-3 py-3"
      >
        {pending && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs">
            {pending.type.startsWith("image/") ? (
              <img
                src={URL.createObjectURL(pending)}
                alt=""
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">{pending.name}</span>
            <button
              type="button"
              onClick={() => setPending(null)}
              aria-label="Remove attachment"
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPending(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Attach a photo or file"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) send.mutate();
              }
            }}
            rows={1}
            placeholder="Type your message…"
            className="max-h-28 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Slide-over resident profile opened from a chat thread. */
function ResidentProfilePanel({
  residentId,
  estateId,
  onClose,
}: {
  residentId: string;
  estateId: string;
  onClose: () => void;
}) {
  const profile = useQuery({
    queryKey: ["chat-profile", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,full_name,phone,email,house_number,block,street,unit,avatar_url,occupant_type,verification_status,approved,created_at",
        )
        .eq("id", residentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dependents = useQuery({
    queryKey: ["chat-profile-dependents", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dependents")
        .select("id,full_name,relationship")
        .eq("resident_id", residentId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const biometrics = useQuery({
    queryKey: ["chat-profile-biometrics", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biometric_access")
        .select("id,biometric_type,enrollment_status,access_status")
        .eq("resident_id", residentId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const bills = useQuery({
    queryKey: ["chat-profile-bills", residentId, estateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("id,amount,status")
        .eq("resident_id", residentId)
        .eq("estate_id", estateId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const avatar = useAvatarUrl(profile.data?.avatar_url);
  const outstanding = (bills.data ?? [])
    .filter((b) => b.status === "unpaid" || b.status === "overdue")
    .reduce((s, b) => s + Number(b.amount ?? 0), 0);
  const address =
    [profile.data?.house_number, profile.data?.street, profile.data?.block]
      .filter(Boolean)
      .join(", ") || "No address on file";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex justify-end bg-black/50" onClick={onClose}>
        <aside
          onClick={(e) => e.stopPropagation()}
          className="flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-border bg-card shadow-2xl animate-in slide-in-from-right"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Resident profile</h3>
            <button
              onClick={onClose}
              aria-label="Close profile"
              className="rounded-full border border-border p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {profile.isLoading ? (
              <ListSkeleton rows={5} />
            ) : (
              <>
                <div className="text-center">
                  <div className="mx-auto w-fit">
                    <Avatar name={profile.data?.full_name ?? "Resident"} url={avatar} size={72} />
                  </div>
                  <div className="mt-2 text-base font-semibold">
                    {profile.data?.full_name ?? "Resident"}
                  </div>
                  <div className="text-xs text-muted-foreground">{address}</div>
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {profile.data?.occupant_type ?? "resident"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        profile.data?.approved
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {profile.data?.approved ? "Active" : "Pending access"}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                      {(profile.data?.verification_status ?? "not_submitted").replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-xl border border-border p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{profile.data?.email ?? "No email"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{profile.data?.phone ?? "No phone"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-[11px] text-muted-foreground">Outstanding</div>
                    <div className="text-sm font-semibold">{ngn(outstanding)}</div>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-[11px] text-muted-foreground">Bills</div>
                    <div className="text-sm font-semibold">{(bills.data ?? []).length}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Access methods
                  </div>
                  {(biometrics.data ?? []).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No biometric access enrolled yet.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-[11px]">
                      {(biometrics.data ?? []).map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-2">
                          <span className="capitalize">{b.biometric_type.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">
                            {b.enrollment_status} · {b.access_status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                    <Users className="h-3.5 w-3.5 text-primary" /> Dependants (
                    {(dependents.data ?? []).length})
                  </div>
                  {(dependents.data ?? []).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No dependants recorded.</p>
                  ) : (
                    <ul className="space-y-1 text-[11px]">
                      {(dependents.data ?? []).map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">{d.full_name}</span>
                          <span className="text-muted-foreground">{d.relationship ?? "—"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </ModalPortal>
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
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `estate_id=eq.${estateId}`,
        },
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

const preview = (m: ChatMessage) =>
  m.body?.trim() ? m.body : m.attachment_type?.startsWith("image/") ? "📷 Photo" : "📎 File";

/** Admin console: WhatsApp-style conversation list beside the live thread. */
export function AdminChat() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const meId = session?.userId ?? "";
  const [active, setActive] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
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
          (r.last.body ?? "").toLowerCase().includes(needle),
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
          .map((p) => ({
            residentId: p.id,
            person: p,
            last: null as ChatMessage | null,
            unread: 0,
          }))
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
                            ? `${c.last.sender_id === meId ? "You: " : ""}${preview(c.last)}`
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
            onOpenProfile={() => setProfileOpen(true)}
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

      {profileOpen && active && (
        <ResidentProfilePanel
          residentId={active}
          estateId={estateId}
          onClose={() => setProfileOpen(false)}
        />
      )}
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
