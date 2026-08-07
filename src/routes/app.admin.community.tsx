import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ImagePicker,
} from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Megaphone,
  CalendarDays,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/community")({
  component: AdminCommunity,
});

type SubTab = "posts" | "meetings";
const TYPES = ["blog", "announcement"];

type Form = { id?: string; post_type: string; title: string; body: string; cover_url: string };
const EMPTY: Form = { post_type: "announcement", title: "", body: "", cover_url: "" };

function AdminCommunity() {
  const [tab, setTab] = useState<SubTab>("posts");
  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-xl bg-muted p-1">
        {(["posts", "meetings"] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "posts" ? <PostsPanel /> : <MeetingsPanel />}
    </div>
  );
}

function PostsPanel() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Form | null>(null);

  const list = useQuery({
    queryKey: ["admin-community", session?.estate?.id],
    enabled: !!session?.estate?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .eq("estate_id", session!.estate!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.title.trim() || !f.body.trim()) throw new Error("Title and body required");
      const payload = {
        estate_id: session!.estate!.id,
        author_id: session!.userId!,
        post_type: f.post_type,
        title: f.title.trim(),
        body: f.body.trim(),
        cover_url: f.cover_url.trim() || null,
      };
      const q = f.id
        ? supabase.from("community_posts").update(payload).eq("id", f.id)
        : supabase.from("community_posts").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Published");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-community"] });
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-community"] }),
  });

  return (
    <div className="space-y-4">
      <button
        onClick={() => setEditing({ ...EMPTY })}
        className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
      >
        <Plus className="h-4 w-4" /> New post
      </button>

      {editing && (
        <FadeIn>
          <Card className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</span>
              <select
                value={editing.post_type}
                onChange={(e) => setEditing({ ...editing, post_type: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</span>
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Body</span>
              <textarea
                rows={6}
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <ImagePicker
              label="Cover image (optional)"
              folder="community"
              value={editing.cover_url || null}
              onChange={(v) => setEditing({ ...editing, cover_url: v ?? "" })}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => save.mutate(editing)}
                disabled={save.isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Publish
              </button>
            </div>
          </Card>
        </FadeIn>
      )}

      {list.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState title="No posts yet" icon={<Megaphone className="h-6 w-6" />} />
      ) : (
        <Stagger className="space-y-2">
          {list.data.map((p) => (
            <StaggerItem key={p.id}>
              <Card className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{p.title}</div>
                    <div className="text-xs capitalize text-muted-foreground">
                      {p.post_type} · {format(new Date(p.created_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setEditing({
                          id: p.id,
                          post_type: p.post_type,
                          title: p.title,
                          body: p.body,
                          cover_url: (p as any).cover_url ?? "",
                        })
                      }
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete “${p.title}”?`)) remove.mutate(p.id);
                      }}
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  {p.body}
                </p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

type MeetingForm = {
  title: string;
  description: string;
  starts_at: string;
  location: string;
  join_url: string;
};

const EMPTY_MEETING: MeetingForm = {
  title: "",
  description: "",
  starts_at: "",
  location: "",
  join_url: "",
};

function MeetingsPanel() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<MeetingForm>(EMPTY_MEETING);

  const list = useQuery({
    queryKey: ["admin-meetings", session?.estate?.id],
    enabled: !!session?.estate?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings" as any)
        .select("*")
        .eq("estate_id", session!.estate!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const broadcast = useMutation({
    mutationFn: async (f: MeetingForm) => {
      if (!f.title.trim()) throw new Error("Title is required");
      if (!f.starts_at) throw new Error("Start time is required");
      const { error } = await supabase.rpc("create_meeting_and_notify" as any, {
        _title: f.title,
        _description: f.description || null,
        _starts_at: new Date(f.starts_at).toISOString(),
        _location: f.location || null,
        _join_url: f.join_url || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting broadcast to all residents");
      setForm(EMPTY_MEETING);
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-meetings"] }),
  });

  return (
    <div className="space-y-4">
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" /> Schedule meeting
        </button>
      ) : (
        <FadeIn>
          <Card className="space-y-3 p-4">
            <Label label="Title">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Monthly residents' meeting"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Label>
            <Label label="Starts at">
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label label="Location (optional)">
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Clubhouse"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </Label>
              <Label label="Join link (optional)">
                <input
                  value={form.join_url}
                  onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                  placeholder="https://meet…"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </Label>
            </div>
            <Label label="Agenda / notes">
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCreating(false);
                  setForm(EMPTY_MEETING);
                }}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => broadcast.mutate(form)}
                disabled={broadcast.isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {broadcast.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Broadcast to residents
              </button>
            </div>
          </Card>
        </FadeIn>
      )}

      {list.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Schedule one and every resident in this estate will be notified."
          icon={<CalendarDays className="h-6 w-6" />}
        />
      ) : (
        <Stagger className="space-y-2">
          {list.data.map((m: any) => (
            <StaggerItem key={m.id}>
              <Card className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{m.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(m.starts_at), "EEE, MMM d · p")}
                    {m.location ? ` · ${m.location}` : ""}
                  </div>
                  {m.description && (
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                      {m.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${m.title}"?`)) remove.mutate(m.id);
                  }}
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
