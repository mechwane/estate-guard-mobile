import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ListSkeleton, ErrorState, StatusBadge, SectionTitle } from "@/components/ui-kit";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, Ticket as TicketIcon, Users, Check } from "lucide-react";

export const Route = createFileRoute("/app/resident/events/mine")({
  component: MineDashboard,
});

function MineDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"attending" | "organizing">("attending");

  const attendingQ = useQuery({
    enabled: !!session?.userId && tab === "attending",
    queryKey: ["my-regs", session?.userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id,validation_code,status,checked_in_at,created_at,event_id,events(id,title,venue,starts_at,status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const organizingQ = useQuery({
    enabled: !!session?.userId && tab === "organizing",
    queryKey: ["my-events", session?.userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,venue,starts_at,status,visibility,capacity")
        .eq("organizer_id", session!.userId!)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
        {(["attending", "organizing"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "attending" ? (
        attendingQ.isLoading ? <ListSkeleton rows={2} /> :
          attendingQ.error ? <ErrorState onRetry={() => attendingQ.refetch()} /> :
            (attendingQ.data ?? []).length === 0 ? <EmptyState icon={<TicketIcon className="h-8 w-8" />} title="No registrations yet" description="Register for an event to see it here." action={<Link to="/app/resident/events" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Browse events</Link>} /> :
              <div className="space-y-2">
                {attendingQ.data!.map((r: any) => (
                  <Link key={r.id} to="/app/resident/events/$id" params={{ id: r.event_id }} className="card-surface block p-4 hover:border-primary/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{r.events?.title ?? "Event"}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3" />{r.events ? format(new Date(r.events.starts_at), "MMM d · p") : ""}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.events?.venue}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge tone={r.checked_in_at ? "success" : "primary"}>{r.checked_in_at ? "checked in" : r.status}</StatusBadge>
                        <div className="mt-1 font-mono text-xs">{r.validation_code}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
      ) : (
        organizingQ.isLoading ? <ListSkeleton rows={2} /> :
          organizingQ.error ? <ErrorState onRetry={() => organizingQ.refetch()} /> :
            (organizingQ.data ?? []).length === 0 ? <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="You haven't created an event yet" action={<Link to="/app/resident/events/new" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Create event</Link>} /> :
              <div className="space-y-3">
                {organizingQ.data!.map((e) => <OrganizerRow key={e.id} event={e} />)}
              </div>
      )}
    </div>
  );
}

function OrganizerRow({ event }: { event: { id: string; title: string; venue: string; starts_at: string; status: string; visibility: string; capacity: number | null } }) {
  const [open, setOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const regsQ = useQuery({
    enabled: open,
    queryKey: ["event-regs", event.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id,attendee_name,attendee_phone,status,checked_in_at,validation_code,created_at")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = regsQ.data?.length ?? 0;
  const checkedIn = regsQ.data?.filter((r) => r.checked_in_at).length ?? 0;

  const checkIn = async (code: string) => {
    setBusy(true);
    const { data, error } = await supabase
      .from("registrations")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
      .eq("event_id", event.id)
      .eq("validation_code", code.trim().toUpperCase())
      .select("id,attendee_name")
      .maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Code not found");
    toast.success(`Checked in: ${data.attendee_name}`);
    setCodeInput("");
    qc.invalidateQueries({ queryKey: ["event-regs", event.id] });
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{event.title}</h3>
            <StatusBadge tone={event.status === "published" ? "success" : event.status === "suspended" ? "error" : "neutral"}>{event.status}</StatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{format(new Date(event.starts_at), "MMM d · p")} · {event.venue}</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-primary">{open ? "Hide" : "Manage"}</button>
      </div>
      {open && (
        <div className="mt-4 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Registered</div>
              <div className="text-lg font-semibold tabular-nums">{total}{event.capacity ? ` / ${event.capacity}` : ""}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Checked in</div>
              <div className="text-lg font-semibold tabular-nums">{checkedIn}</div>
            </div>
          </div>
          <div>
            <SectionTitle>Check-in</SectionTitle>
            <div className="flex gap-2">
              <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Attendee code" className="input flex-1 font-mono tracking-widest" />
              <button disabled={busy || codeInput.trim().length < 4} onClick={() => checkIn(codeInput)} className="btn-primary inline-flex items-center gap-1"><Check className="h-4 w-4" />Verify</button>
            </div>
          </div>
          <div>
            <SectionTitle>Attendees</SectionTitle>
            {(regsQ.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No registrations yet.</p> : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {regsQ.data!.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.attendee_name}</div>
                      <div className="text-[11px] text-muted-foreground">{r.attendee_phone ?? "—"} · <span className="font-mono">{r.validation_code}</span></div>
                    </div>
                    <StatusBadge tone={r.checked_in_at ? "success" : "primary"}>{r.checked_in_at ? "in" : r.status}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" /> Data restricted to this event via RLS.</div>
        </div>
      )}
    </Card>
  );
}
