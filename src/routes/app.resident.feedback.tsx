import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { FadeIn } from "@/components/motion-kit";
import { Loader2, MessageSquareHeart, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/feedback")({
  component: Feedback,
});

const TOPICS = [
  { id: "suggestion", label: "Suggestion" },
  { id: "bug", label: "Bug report" },
  { id: "praise", label: "Something you love" },
  { id: "other", label: "Other" },
];

function Feedback() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [topic, setTopic] = useState("suggestion");
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error("Please share your feedback");
      if (!session?.userId || !session?.estate?.id)
        throw new Error("You need to be signed in with an estate");
      const subject = `[Feedback · ${TOPICS.find((t) => t.id === topic)?.label}]${
        rating ? ` · ${rating}★` : ""
      }`;
      const { error } = await supabase.from("support_tickets").insert({
        estate_id: session.estate.id,
        resident_id: session.userId,
        subject,
        body: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks — your feedback was sent");
      navigate({ to: "/app/resident/more" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageSquareHeart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Feedback & Suggestions</h1>
            <p className="text-xs text-muted-foreground">Help us make Estate Guard better</p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="space-y-4 p-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              How's your experience so far?
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`h-7 w-7 ${
                      n <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Topic</div>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    topic === t.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Your feedback
            </span>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what you'd like to see, or what didn't work…"
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <button
            onClick={() => send.mutate()}
            disabled={send.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send feedback
          </button>
        </Card>
      </FadeIn>
    </div>
  );
}
