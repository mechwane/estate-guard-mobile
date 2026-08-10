import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { EmptyState, MediaImage } from "@/components/ui-kit";
import { CommentThread } from "@/components/post-comments";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import {
  Heart,
  MessageCircle,
  Megaphone,
  Vote,
  Newspaper,
  Loader2,
  CalendarDays,
  MapPin,
  Link as LinkIcon,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/community")({
  component: Community,
});

type Tab = "blog" | "polls" | "announcement" | "meetings";

function Community() {
  const [tab, setTab] = useState<Tab>("blog");
  const { data: session } = useSession();

  return (
    <div className="space-y-4 pb-4">
      <FadeIn>
        <div className="relative flex items-center justify-around border-b border-border">
          {(["blog", "polls", "announcement", "meetings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 px-2 py-2.5 text-xs font-medium capitalize transition-colors sm:text-sm ${
                tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "polls" ? "Polls" : t === "announcement" ? "News" : t}
              {tab === t && (
                <motion.span
                  layoutId="communityTab"
                  className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </FadeIn>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "blog" && <PostsList estateId={session?.estate?.id} type="blog" />}
          {tab === "announcement" && (
            <PostsList estateId={session?.estate?.id} type="announcement" />
          )}
          {tab === "polls" && <PollsList estateId={session?.estate?.id} userId={session?.userId} />}
          {tab === "meetings" && <MeetingsList estateId={session?.estate?.id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MeetingsList({ estateId }: { estateId?: string }) {
  const q = useQuery({
    queryKey: ["meetings", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings" as any)
        .select("*")
        .eq("estate_id", estateId!)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!q.data || q.data.length === 0) {
    return (
      <EmptyState
        title="No meetings scheduled"
        description="Estate meetings announced by admin will show up here."
        icon={<CalendarDays className="h-6 w-6" />}
      />
    );
  }

  const now = Date.now();
  const upcoming = q.data.filter((m) => new Date(m.starts_at).getTime() >= now);
  const past = q.data.filter((m) => new Date(m.starts_at).getTime() < now);

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upcoming
          </h3>
          <Stagger className="space-y-2">
            {upcoming.map((m) => (
              <StaggerItem key={m.id}>
                <MeetingCard m={m} highlight />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
      {past.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Past
          </h3>
          <Stagger className="space-y-2">
            {past.slice(0, 10).map((m) => (
              <StaggerItem key={m.id}>
                <MeetingCard m={m} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}

function MeetingCard({ m, highlight }: { m: any; highlight?: boolean }) {
  const dt = new Date(m.starts_at);
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={`card-surface p-4 ${highlight ? "border-primary/30 bg-primary/5" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-[10px] font-medium uppercase leading-none">
            {format(dt, "MMM")}
          </span>
          <span className="text-lg font-bold leading-tight">{format(dt, "d")}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{m.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{format(dt, "EEEE, p")}</div>
          {m.description && (
            <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
              {m.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
            {m.location && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" /> {m.location}
              </span>
            )}
            {m.join_url && (
              <a
                href={m.join_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <LinkIcon className="h-3 w-3" /> Join link
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PostsList({ estateId, type }: { estateId?: string; type: "blog" | "announcement" }) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [openComments, setOpenComments] = useState<string | null>(null);

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
      return data as any[];
    },
  });

  const stats = useQuery({
    queryKey: ["post-stats", session?.userId, estateId, type],
    enabled: !!q.data && !!session?.userId,
    queryFn: async () => {
      const ids = (q.data ?? []).map((p) => p.id);
      if (ids.length === 0)
        return {
          likes: {} as Record<string, number>,
          mine: new Set<string>(),
          comments: {} as Record<string, number>,
        };
      const [{ data: likeCounts }, { data: myLikes }, { data: allComments }] = await Promise.all([
        supabase.rpc("post_like_counts" as never),
        supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", ids)
          .eq("user_id", session!.userId!),
        supabase.from("post_comments").select("post_id").in("post_id", ids),
      ]);
      const idSet = new Set(ids);
      const likes: Record<string, number> = {};
      ((likeCounts ?? []) as unknown as { post_id: string; likes: number }[]).forEach((r) => {
        if (idSet.has(r.post_id)) likes[r.post_id] = Number(r.likes);
      });
      const comments: Record<string, number> = {};
      (allComments ?? []).forEach(
        (r: any) => (comments[r.post_id] = (comments[r.post_id] ?? 0) + 1),
      );

      return {
        likes,
        comments,
        mine: new Set((myLikes ?? []).map((r: any) => r.post_id)),
      };
    },
  });

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      if (!session?.userId) throw new Error("Sign in");
      const isLiked = stats.data?.mine.has(postId);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-stats"] }),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!q.data || q.data.length === 0) {
    return (
      <EmptyState
        title={type === "blog" ? "No posts yet" : "No announcements"}
        icon={
          type === "blog" ? <Newspaper className="h-6 w-6" /> : <Megaphone className="h-6 w-6" />
        }
      />
    );
  }

  return (
    <>
      <Stagger className="space-y-3">
        {q.data.map((p) => (
          <StaggerItem key={p.id}>
            <PostCard
              post={p}
              liked={!!stats.data?.mine.has(p.id)}
              likeCount={stats.data?.likes[p.id] ?? 0}
              commentCount={stats.data?.comments[p.id] ?? 0}
              onLike={() => toggleLike.mutate(p.id)}
              onOpenComments={() => setOpenComments(p.id)}
            />
          </StaggerItem>
        ))}
      </Stagger>

      <CommentThread postId={openComments} onClose={() => setOpenComments(null)} />
    </>
  );
}

function PostCard({
  post,
  liked,
  likeCount,
  commentCount,
  onLike,
  onOpenComments,
}: {
  post: any;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onOpenComments: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = post.body ?? "";
  const long = body.length > 220;
  const shown = !long || expanded ? body : body.slice(0, 220).trimEnd() + "…";
  const when = formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: false })
    .replace(" years", "y")
    .replace(" year", "y")
    .replace(" months", "mo")
    .replace(" month", "mo")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" seconds", "s")
    .replace(" second", "s");

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="card-surface overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold uppercase text-primary ring-1 ring-primary/25">
          EM
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Estate Manager</div>
          <div className="text-[11px] text-muted-foreground">{when} ago</div>
        </div>
      </div>

      <div className="space-y-2 px-4 pt-3">
        {post.title && <h3 className="text-sm font-semibold text-foreground">{post.title}</h3>}
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {shown}
          {long && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="ml-1 font-medium text-primary hover:underline"
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </p>
      </div>

      {post.cover_url && (
        <div className="mt-3 aspect-[16/9] w-full overflow-hidden bg-muted">
          <MediaImage value={post.cover_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex items-center gap-5 border-t border-border/60 px-4 py-2.5 text-xs">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onLike}
          className={`inline-flex items-center gap-1.5 transition-colors ${
            liked ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <motion.span
            key={liked ? "on" : "off"}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          </motion.span>
          <span className="tabular-nums">{likeCount}</span>
        </motion.button>
        <button
          onClick={onOpenComments}
          className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="tabular-nums">{commentCount}</span>
        </button>
      </div>
    </motion.article>
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
      const [{ data: tallies }, { data: mine }] = await Promise.all([
        supabase.rpc("poll_vote_tallies" as never),
        supabase
          .from("poll_votes")
          .select("poll_id, option_key")
          .in("poll_id", ids)
          .eq("user_id", userId!),
      ]);
      const idSet = new Set(ids);
      const totals: Record<string, Record<string, number>> = {};
      (
        (tallies ?? []) as unknown as { poll_id: string; option_key: string; votes: number }[]
      ).forEach((v) => {
        if (!idSet.has(v.poll_id)) return;
        totals[v.poll_id] = totals[v.poll_id] ?? {};
        totals[v.poll_id][v.option_key] = (totals[v.poll_id][v.option_key] ?? 0) + Number(v.votes);
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

  if (polls.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            <div className="card-surface space-y-3 p-4">
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
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      key={o.key}
                      onClick={() => cast.mutate({ poll_id: p.id, option_key: o.key })}
                      className={`relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        isMine
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-y-0 left-0 bg-primary/10"
                      />
                      <div className="relative flex items-center justify-between">
                        <span>{o.label}</span>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {totalVotes} vote{totalVotes === 1 ? "" : "s"}
              </div>
            </div>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
