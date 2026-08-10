import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Image as ImageIcon, Megaphone } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, MediaImage } from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { CommentButton, CommentThread, useCommentCounts } from "@/components/post-comments";

export const Route = createFileRoute("/app/guard/notices")({
  component: GuardNotices,
  head: () => ({
    meta: [
      { title: "Estate Notices — Guard" },
      {
        name: "description",
        content: "Read estate announcements from management and join the conversation from the gate.",
      },
      { property: "og:title", content: "Estate Notices — Guard" },
      { property: "og:description", content: "Announcements and broadcasts for gate staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function GuardNotices() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [comments, setComments] = useState<{ id: string; title: string } | null>(null);
  const counts = useCommentCounts(!!estateId);

  const list = useQuery({
    queryKey: ["guard-notices", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select("id, title, body, cover_url, created_at, post_type")
        .eq("estate_id", estateId!)
        .in("post_type", ["announcement", "blog"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3 p-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Estate notices</div>
          <p className="text-xs text-muted-foreground">
            Announcements from management. Tap a notice to read and reply to comments.
          </p>
        </div>
      </Card>

      {list.isLoading ? (
        <ListSkeleton rows={3} />
      ) : list.error ? (
        <ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} />
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState
          title="No notices yet"
          description="Estate management has not published any announcements."
          icon={<Megaphone className="h-6 w-6" />}
        />
      ) : (
        <Stagger className="space-y-3">
          {list.data.map((row) => (
            <StaggerItem key={row.id}>
              <Card className="overflow-hidden p-0">
                {row.cover_url && (
                  <div className="h-32 w-full bg-muted">
                    <MediaImage
                      value={row.cover_url}
                      alt={`${row.title} cover`}
                      className="h-full w-full object-cover"
                      fallback={<ImageIcon className="h-6 w-6" />}
                    />
                  </div>
                )}
                <div className="space-y-1.5 p-3">
                  <div className="text-sm font-semibold text-foreground">{row.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(row.created_at), "MMM d, yyyy · HH:mm")}
                  </div>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">{row.body}</p>
                  <div className="pt-1">
                    <CommentButton
                      count={counts.data?.[row.id] ?? 0}
                      onClick={() => setComments({ id: row.id, title: row.title })}
                    />
                  </div>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <CommentThread
        postId={comments?.id ?? null}
        postTitle={comments?.title}
        onClose={() => setComments(null)}
      />
    </div>
  );
}
