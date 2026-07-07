import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { Plus, Loader2, Pencil, Trash2, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/community")({
  component: AdminCommunity,
});

const TYPES = ["blog", "announcement"];

type Form = { id?: string; post_type: string; title: string; body: string; cover_url: string };
const EMPTY: Form = { post_type: "announcement", title: "", body: "", cover_url: "" };

function AdminCommunity() {
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
