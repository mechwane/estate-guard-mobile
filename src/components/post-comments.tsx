import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, Send, ShieldCheck, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { ModalPortal } from "@/components/ui-kit";

export type CommentRow = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  author_is_admin: boolean;
};

/** Estate-wide comment counts keyed by post id (privacy-safe aggregate RPC). */
export function useCommentCounts(enabled = true) {
  return useQuery({
    queryKey: ["post-comment-counts"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("post_comment_counts" as never);
      if (error) throw error;
      const map: Record<string, number> = {};
      ((data ?? []) as unknown as { post_id: string; comments: number }[]).forEach((r) => {
        map[r.post_id] = Number(r.comments);
      });
      return map;
    },
  });
}

/** Small inline trigger showing the comment count. */
export function CommentButton({
  count,
  onClick,
  label = "Comments",
}: {
  count: number;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      <span className="tabular-nums">{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/**
 * Shared comment thread used by residents, guards and estate admins so a
 * broadcast/notice conversation is the same thread for everyone in the estate.
 */
export function CommentThread({
  postId,
  postTitle,
  onClose,
}: {
  postId: string | null;
  postTitle?: string;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const comments = useQuery({
    queryKey: ["post-comment-thread", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("post_comment_thread" as never, {
        _post_id: postId,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!session?.userId || !postId || !text.trim()) return;
      const { error } = await supabase.from("post_comments").insert({
        post_id: postId,
        author_id: session.userId,
        body: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["post-comment-thread", postId] });
      qc.invalidateQueries({ queryKey: ["post-comment-counts"] });
      qc.invalidateQueries({ queryKey: ["post-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("post_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-comment-thread", postId] });
      qc.invalidateQueries({ queryKey: ["post-comment-counts"] });
      qc.invalidateQueries({ queryKey: ["post-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ModalPortal>
      <AnimatePresence>
        {postId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: 40, opacity: 0.6, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-2xl ring-1 ring-border sm:rounded-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">Comments</h4>
                  {postTitle && (
                    <p className="truncate text-[11px] text-muted-foreground">{postTitle}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Close comments"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {comments.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : comments.error ? (
                  <p className="py-8 text-center text-xs text-destructive">
                    {(comments.error as Error).message}
                  </p>
                ) : !comments.data || comments.data.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No comments yet — be the first.
                  </p>
                ) : (
                  comments.data.map((c) => (
                    <div key={c.id} className="group flex items-start gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
                        {(c.author_name || "?").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1 rounded-2xl bg-muted/50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">{c.author_name}</span>
                          {c.author_is_admin && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <ShieldCheck className="h-2.5 w-2.5" /> Management
                            </span>
                          )}
                          <span>·</span>
                          <span>
                            {formatDistanceToNowStrict(new Date(c.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-foreground">
                          {c.body}
                        </p>
                      </div>
                      {c.author_id === session?.userId && (
                        <button
                          onClick={() => remove.mutate(c.id)}
                          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          aria-label="Delete comment"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  add.mutate();
                }}
                className="flex items-center gap-2 border-t border-border px-3 py-2"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a comment…"
                  aria-label="Write a comment"
                  className="min-w-0 flex-1 rounded-full border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  disabled={add.isPending || !text.trim()}
                  type="submit"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
                  aria-label="Send comment"
                >
                  {add.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
