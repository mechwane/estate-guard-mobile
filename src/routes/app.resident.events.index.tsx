import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  EmptyState,
  ListSkeleton,
  ErrorState,
  SearchInput,
  StatusBadge,
} from "@/components/ui-kit";
import { ngn } from "@/lib/format";
import { format } from "date-fns";
import { CalendarDays, MapPin, Plus, Ticket } from "lucide-react";

export const Route = createFileRoute("/app/resident/events/")({
  component: EventsList,
});

type EventRow = {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  price: number;
  visibility: string;
  status: string;
  cover_url: string | null;
  estate_id: string | null;
  category_id: string | null;
};

function EventsList() {
  const { data: session } = useSession();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "estate" | "public">("all");

  const eventsQ = useQuery({
    enabled: !!session?.userId,
    queryKey: ["events", session?.estate?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,venue,starts_at,price,visibility,status,cover_url,estate_id,category_id")
        .eq("status", "published")
        .order("starts_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const filtered = useMemo(() => {
    let list = eventsQ.data ?? [];
    if (tab === "estate") list = list.filter((e) => e.estate_id === session?.estate?.id);
    if (tab === "public") list = list.filter((e) => e.visibility === "public");
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (e) => e.title.toLowerCase().includes(s) || e.venue.toLowerCase().includes(s),
      );
    }
    return list;
  }, [eventsQ.data, tab, q, session?.estate?.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Search events" />
        </div>
        <Link
          to="/app/resident/events/new"
          className="btn-primary inline-flex items-center gap-1 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Create
        </Link>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
        {(["all", "estate", "public"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filtered.length} event{filtered.length === 1 ? "" : "s"}
        </span>
        <Link
          to="/app/resident/events/mine"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          <Ticket className="h-3.5 w-3.5" /> My tickets & events
        </Link>
      </div>

      {eventsQ.isLoading ? (
        <ListSkeleton rows={3} />
      ) : eventsQ.error ? (
        <ErrorState onRetry={() => eventsQ.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title="No events yet"
          description="Check back soon or create your own."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <Link
              key={e.id}
              to="/app/resident/events/$id"
              params={{ id: e.id }}
              className="card-surface block p-4 hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">{e.title}</h3>
                    <StatusBadge tone={e.visibility === "public" ? "accent" : "primary"}>
                      {e.visibility}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {format(new Date(e.starts_at), "EEE MMM d · p")}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {e.venue}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {Number(e.price) > 0 ? ngn(e.price) : "Free"}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
