import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton } from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/blog")({
  component: BlogAdmin,
  head: () => ({ meta: [{ title: "Blog — Estate Guard" }] }),
});

function BlogAdmin() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const posts = useQuery({
    queryKey: ["admin-blog", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts").select("*")
        .eq("estate_id", estateId!).eq("post_type", "blog")
        .order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !body.trim()) throw new Error("Title and body required");
      const { error } = await supabase.from("community_posts").insert({
        estate_id: estateId!, author_id: session?.user.id, post_type: "blog",
        title: title.trim(), body: body.trim(), cover_url: coverUrl.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Published"); setTitle(""); setBody(""); setCoverUrl(""); qc.invalidateQueries({ queryKey: ["admin-blog", estateId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("community_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-blog", estateId] }); },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Blog</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">New post</h2>
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="Cover image URL (optional)" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your post…" rows={6} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
        </div>
        <button onClick={() => publish.mutate()} disabled={publish.isPending} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">
          {publish.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Publish
        </button>
      </Card>

      <Card>
        {posts.isLoading ? <ListSkeleton rows={3} /> : posts.isError ? <ErrorState onRetry={() => posts.refetch()} /> : (posts.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <ul className="space-y-2">
            {(posts.data ?? []).map((p: any) => (
              <li key={p.id} className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.body}</p>
                  </div>
                  <button onClick={() => remove.mutate(p.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
