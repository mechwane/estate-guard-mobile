import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { Heart, MessageCircle, Megaphone, Vote, Newspaper } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/community")({
  component: Community,
});

type Tab = "blog" | "polls" | "announcement";

function Community() {
  const [tab, setTab] = useState<Tab>("blog");
  const { data: session } = useSession();

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="card-surface flex items-center p-1">
          {(["blog", "polls", "announcement"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "polls" ? "Polls & Election" : t}
            </button>
          ))}
        </div>
      </FadeIn>

      {tab === "blog" && <PostsList estateId={session?.estate?.id} type="blog" />}
      {tab === "announcement" && (
        <PostsList estateId={session?.estate?.id} type="announcement" />
      )}
      {tab === "polls" && <PollsList estateId={session?.estate?.id} userId={session?.userId} />}
    </div>
  );
}

function PostsList({ estateId, type }: { estateId?: string; type: "blog" | "announcement" }) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["posts", estateId, type],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .eq("estate_id", estateId!)
        .eq("post_type", type)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const likes = useQuery({
    queryKey: ["post-likes", session?.userId, estateId, type],
    enabled: !!q.data && !!session?.userId,
    queryFn: async () => {
      const ids = (q.data ?? []).map((p) => p.id);
      if (ids.length === 0) return { counts: {}, mine: new Set<string>() };
      const [{ data: all }, { data: mine }] = await Promise.all([
        supabase.from("post_likes").select("post_id").in("post_id", ids),
        supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", ids)
          .eq("user_id", session!.userId!),
      ]);
      const counts: Record<string, number> = {};
      (all ?? []).forEach((r: any) => (counts[r.post_id] = (counts[r.post_id] ?? 0) + 1));
      return { counts, mine: new Set((mine ?? []).map((r: any) => r.post_id)) };
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      if (!session?.userId) throw new Error("Sign in");
      const isLiked = likes.data?.mine.has(postId);
      if (isLiked) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", session.userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: session.userId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-likes"] }),
  });

  if (!q.data || q.data.length === 0) {
    return (
      <EmptyState
        title={type === "blog" ? "No posts yet" : "No announcements"}
        icon={type === "blog" ? <Newspaper className="h-6 w-6" /> : <Megaphone className="h-6 w-6" />}
      />
    );
  }

  return (
    <Stagger className="space-y-2.5">
      {q.data.map((p) => {
        const liked = likes.data?.mine.has(p.id);
        const count = likes.data?.counts[p.id] ?? 0;
        return (
          <StaggerItem key={p.id}>
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Estate Manager</span>
                <span>·</span>
                <span>{format(new Date(p.created_at), "MMM d, yyyy")}</span>
              </div>
              <div className="text-sm font-semibold text-foreground">{p.title}</div>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{p.body}</p>
              <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                <button
                  onClick={() => toggleLike.mutate(p.id)}
                  className={`inline-flex items-center gap-1 transition-colors ${liked ? "text-primary" : "hover:text-foreground"}`}
                >
                  <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} /> {count}
                </button>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" /> Comment
                </span>
              </div>
            </Card>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

function PollsList({ estateId, userId }: { estateId?: string; userId?: string | null }) {
  const qc = useQueryClient();
  const polls = useQuery({
    queryKey: ["polls", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const votes = useQuery({
    queryKey: ["poll-votes", userId, estateId],
    enabled: !!polls.data && !!userId,
    queryFn: async () => {
      const ids = (polls.data ?? []).map((p) => p.id);
      if (ids.length === 0) return { totals: {}, mine: {} } as any;
      const [{ data: all }, { data: mine }] = await Promise.all([
        supabase.from("poll_votes").select("poll_id, option_key").in("poll_id", ids),
        supabase
          .from("poll_votes")
          .select("poll_id, option_key")
          .in("poll_id", ids)
          .eq("user_id", userId!),
      ]);
      const totals: Record<string, Record<string, number>> = {};
      (all ?? []).forEach((v: any) => {
        totals[v.poll_id] = totals[v.poll_id] ?? {};
        totals[v.poll_id][v.option_key] = (totals[v.poll_id][v.option_key] ?? 0) + 1;
      });
      const mineMap: Record<string, string> = {};
      (mine ?? []).forEach((v: any) => (mineMap[v.poll_id] = v.option_key));
      return { totals, mine: mineMap };
    },
  });

  const cast = useMutation({
    mutationFn: async ({ poll_id, option_key }: { poll_id: string; option_key: string }) => {
      const { error } = await supabase
        .from("poll_votes")
        .upsert({ poll_id, user_id: userId!, option_key }, { onConflict: "poll_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vote recorded");
      qc.invalidateQueries({ queryKey: ["poll-votes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!polls.data || polls.data.length === 0) {
    return <EmptyState title="No polls yet" icon={<Vote className="h-6 w-6" />} />;
  }

  return (
    <Stagger className="space-y-3">
      {polls.data.map((p) => {
        const options = ((p.options as any[]) ?? []) as { key: string; label: string }[];
        const totals = votes.data?.totals[p.id] ?? {};
        const my = votes.data?.mine[p.id];
        const totalVotes = Object.values(totals).reduce((s: number, n: any) => s + Number(n), 0);
        return (
          <StaggerItem key={p.id}>
            <Card className="space-y-3 p-4">
              <div>
                <div className="text-sm font-semibold text-foreground">{p.title}</div>
                {p.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                )}
              </div>
              <div className="space-y-2">
                {options.map((o) => {
                  const c = totals[o.key] ?? 0;
                  const pct = totalVotes ? Math.round((c / totalVotes) * 100) : 0;
                  const isMine = my === o.key;
                  return (
                    <button
                      key={o.key}
                      onClick={() => cast.mutate({ poll_id: p.id, option_key: o.key })}
                      className={`relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        isMine
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between">
                        <span>{o.label}</span>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {totalVotes} vote{totalVotes === 1 ? "" : "s"}
              </div>
            </Card>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
