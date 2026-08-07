import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem, Pressable } from "@/components/motion-kit";
import {
  Hammer,
  CalendarDays,
  KeyRound,
  Receipt,
  HelpCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/requests")({
  component: Requests,
});

const CATEGORIES = [
  { key: "developmental", label: "Developmental / Renovation", icon: Hammer },
  { key: "events", label: "Events Request", icon: CalendarDays },
  { key: "code", label: "Code Request", icon: KeyRound },
  { key: "billing", label: "Billing Request", icon: Receipt },
  { key: "others", label: "Others", icon: HelpCircle },
];

function Requests() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const mine = useQuery({
    queryKey: ["my-requests", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resident_requests")
        .select("*")
        .eq("resident_id", session!.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!category) throw new Error("Choose a category");
      if (!title.trim()) throw new Error("Add a title");
      const { error } = await supabase.from("resident_requests").insert({
        estate_id: session!.estate!.id,
        resident_id: session!.userId!,
        category,
        title: title.trim(),
        details: details.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request submitted");
      setCategory(null);
      setTitle("");
      setDetails("");
      qc.invalidateQueries({ queryKey: ["my-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!category ? (
        <Stagger className="space-y-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <StaggerItem key={c.key}>
                <Pressable onClick={() => setCategory(c.key)} className="w-full text-left">
                  <Card className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{c.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Card>
                </Pressable>
              </StaggerItem>
            );
          })}
        </Stagger>
      ) : (
        <FadeIn>
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                {CATEGORIES.find((c) => c.key === category)?.label}
              </div>
              <button
                onClick={() => setCategory(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Change
              </button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Details
              </span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                placeholder="Add any relevant details..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <button
              onClick={() => submit.mutate()}
              disabled={submit.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
            >
              {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
            </button>
          </Card>
        </FadeIn>
      )}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          My requests
        </h3>
        {!mine.data || mine.data.length === 0 ? (
          <EmptyState title="You haven't submitted any requests" />
        ) : (
          <div className="space-y-2">
            {mine.data.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{r.title}</div>
                    <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                      {r.category.replace("_", " ")} ·{" "}
                      {format(new Date(r.created_at), "MMM d, yyyy")}
                    </div>
                    {r.admin_notes && (
                      <div className="mt-2 rounded-md bg-muted p-2 text-xs text-foreground">
                        <strong>Admin:</strong> {r.admin_notes}
                      </div>
                    )}
                  </div>
                  <StatusBadge
                    tone={
                      r.status === "resolved"
                        ? "success"
                        : r.status === "rejected"
                          ? "error"
                          : "warning"
                    }
                  >
                    {r.status}
                  </StatusBadge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
