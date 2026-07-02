import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import { Card } from "@/components/ui-kit";
import { Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/resident/events/new")({
  component: NewEvent,
});

function NewEvent() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [f, setF] = useState({
    title: "",
    description: "",
    venue: "",
    starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    ends_at: "",
    price: "0",
    capacity: "",
    visibility: "estate" as "estate" | "public",
    status: "published" as "draft" | "published",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.userId) return;
    if (f.title.trim().length < 3) return toast.error("Enter an event title");
    if (f.venue.trim().length < 2) return toast.error("Enter a venue");
    const starts = new Date(f.starts_at);
    if (isNaN(starts.getTime())) return toast.error("Choose a valid start time");
    setLoading(true);
    const { data, error } = await supabase.from("events").insert({
      organizer_id: session.userId,
      estate_id: session.estate?.id ?? null,
      title: f.title.trim(),
      description: f.description.trim() || null,
      venue: f.venue.trim(),
      starts_at: starts.toISOString(),
      ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      price: Number(f.price) || 0,
      capacity: f.capacity ? Number(f.capacity) : null,
      visibility: f.visibility,
      status: f.status,
    }).select("id").single();
    setLoading(false);
    if (error || !data) return toast.error(error?.message ?? "Could not create event");
    await supabase.from("event_logs").insert({ event_id: data.id, actor_id: session.userId, action: "event.created" });
    toast.success("Event created");
    navigate({ to: "/app/resident/events/$id", params: { id: data.id } });
  };

  return (
    <div className="space-y-4">
      <Link to="/app/resident/events" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <Card>
        <p className="text-sm text-muted-foreground">Publish an event to your estate community or make it public for anyone to discover.</p>
      </Card>

      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required className="input" /></Field>
        <Field label="Venue"><input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} required className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts"><input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} required className="input" /></Field>
          <Field label="Ends (optional)"><input type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} className="input" /></Field>
        </div>
        <Field label="Description"><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (NGN)"><input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" className="input" /></Field>
          <Field label="Capacity"><input value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value.replace(/[^\d]/g, "") })} inputMode="numeric" className="input" placeholder="Unlimited" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Visibility">
            <select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value as "estate" | "public" })} className="input">
              <option value="estate">Estate only</option>
              <option value="public">Public</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as "draft" | "published" })} className="input">
              <option value="published">Publish now</option>
              <option value="draft">Save as draft</option>
            </select>
          </Field>
        </div>
        <button type="submit" disabled={loading} className="btn-primary inline-flex w-full items-center justify-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}Create event
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
