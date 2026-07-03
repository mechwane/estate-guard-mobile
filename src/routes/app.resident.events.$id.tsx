import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, ListSkeleton, ErrorState, StatusBadge, EmptyState } from "@/components/ui-kit";
import { toast } from "sonner";
import { format } from "date-fns";
import { ngn, genValidationCode } from "@/lib/format";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Loader2,
  CheckCircle2,
  Users,
  Ticket as TicketIcon,
} from "lucide-react";

export const Route = createFileRoute("/app/resident/events/$id")({
  component: EventDetail,
});

function EventDetail() {
  const { id } = Route.useParams();
  const { data: session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const eventQ = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id,title,description,venue,starts_at,ends_at,price,capacity,cover_url,visibility,status,faqs,schedule,organizer_id,estate_id",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ticketsQ = useQuery({
    queryKey: ["event-tickets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id,name,price,quantity")
        .eq("event_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const regQ = useQuery({
    enabled: !!session?.userId,
    queryKey: ["event-my-reg", id, session?.userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("registrations")
        .select("id,validation_code,status,ticket_id,checked_in_at")
        .eq("event_id", id)
        .eq("user_id", session!.userId!)
        .maybeSingle();
      return data;
    },
  });

  const attendeesQ = useQuery({
    queryKey: ["event-att-count", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id);
      return count ?? 0;
    },
  });

  const [busy, setBusy] = useState(false);
  const [selTicket, setSelTicket] = useState<string>("");

  if (eventQ.isLoading) return <ListSkeleton rows={3} />;
  if (eventQ.error) return <ErrorState onRetry={() => eventQ.refetch()} />;
  const ev = eventQ.data;
  if (!ev) return <EmptyState title="Event not found" />;

  const isOrganizer = ev.organizer_id === session?.userId;
  const tickets = ticketsQ.data ?? [];
  const faqs = Array.isArray(ev.faqs) ? (ev.faqs as { q: string; a: string }[]) : [];
  const schedule = Array.isArray(ev.schedule)
    ? (ev.schedule as { time: string; item: string }[])
    : [];

  const register = async () => {
    if (!session?.userId) return;
    setBusy(true);
    const code = genValidationCode();
    const { data, error } = await supabase
      .from("registrations")
      .insert({
        event_id: id,
        user_id: session.userId,
        ticket_id: selTicket || null,
        attendee_name: session.profile?.full_name ?? "Attendee",
        attendee_phone: session.profile?.phone ?? null,
        validation_code: code,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Could not register");
    await supabase.from("event_logs").insert({
      event_id: id,
      actor_id: session.userId,
      action: "registration.created",
      meta: { code },
    });
    toast.success("You're registered");
    qc.invalidateQueries({ queryKey: ["event-my-reg", id] });
    qc.invalidateQueries({ queryKey: ["event-att-count", id] });
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate({ to: "/app/resident/events" })}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusBadge tone={ev.visibility === "public" ? "accent" : "primary"}>
                {ev.visibility}
              </StatusBadge>
              <StatusBadge tone={ev.status === "published" ? "success" : "neutral"}>
                {ev.status}
              </StatusBadge>
            </div>
            <h1 className="mt-2 text-lg font-semibold leading-tight">{ev.title}</h1>
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(ev.starts_at), "EEE MMM d · p")}
              {ev.ends_at ? ` – ${format(new Date(ev.ends_at), "p")}` : ""}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {ev.venue}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">
              {Number(ev.price) > 0 ? ngn(ev.price) : "Free"}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" />
              {attendeesQ.data ?? 0}
              {ev.capacity ? ` / ${ev.capacity}` : ""}
            </div>
          </div>
        </div>
      </Card>

      {ev.description && (
        <Card>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            About
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{ev.description}</p>
        </Card>
      )}

      {schedule.length > 0 && (
        <Card>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Schedule
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {schedule.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-16 font-mono text-xs text-muted-foreground">{s.time}</span>
                <span>{s.item}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {faqs.length > 0 && (
        <Card>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            FAQs
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {faqs.map((f, i) => (
              <li key={i}>
                <p className="font-medium">{f.q}</p>
                <p className="text-muted-foreground">{f.a}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tickets.length > 0 && (
        <Card>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ticket types
          </h2>
          <div className="mt-2 space-y-2">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelTicket(t.id)}
                className={`w-full rounded-lg border p-3 text-left ${selTicket === t.id ? "border-primary ring-1 ring-primary/30" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-sm">{Number(t.price) > 0 ? ngn(t.price) : "Free"}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {regQ.data ? (
        <Card className="bg-gradient-to-br from-[color:var(--color-primary-dark)] to-[color:var(--color-primary)] text-primary-foreground">
          <div className="flex items-center gap-2 text-primary-foreground/85">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">You're in</span>
          </div>
          <div className="mt-2 font-mono text-3xl font-semibold tracking-[0.35em]">
            {regQ.data.validation_code}
          </div>
          <p className="mt-1 text-xs text-primary-foreground/80">
            Show this code at check-in{regQ.data.checked_in_at ? " · already checked in" : ""}.
          </p>
        </Card>
      ) : (
        <button
          onClick={register}
          disabled={busy || !session?.userId}
          className="btn-primary inline-flex w-full items-center justify-center gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Register for this event
        </button>
      )}

      {isOrganizer && (
        <Link
          to="/app/resident/events/mine"
          className="card-surface flex items-center justify-between p-4 text-sm font-medium hover:border-primary/50"
        >
          <span className="inline-flex items-center gap-2">
            <TicketIcon className="h-4 w-4 text-primary" /> Manage this event
          </span>
          <span className="text-xs text-muted-foreground">Organizer</span>
        </Link>
      )}
    </div>
  );
}
