import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ListSkeleton, ErrorState, StatusBadge } from "@/components/ui-kit";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/guard/incidents")({
  component: GuardIncidents,
});

const CATEGORIES = [
  "Security",
  "Trespass",
  "Suspicious activity",
  "Vandalism",
  "Emergency",
  "Other",
];
const SEVERITIES: Array<{ v: "low" | "medium" | "high" | "critical"; label: string; tone: any }> = [
  { v: "low", label: "Low", tone: "neutral" },
  { v: "medium", label: "Medium", tone: "primary" },
  { v: "high", label: "High", tone: "warning" },
  { v: "critical", label: "Critical", tone: "error" },
];

function GuardIncidents() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Security",
    severity: "medium" as const,
    location: "",
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["guard-incidents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.description.trim())
        throw new Error("Title and description required");
      const { error } = await supabase.from("issues").insert({
        estate_id: estateId!,
        reporter_id: session!.userId!,
        reporter_role: "guard",
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        severity: form.severity,
        location: form.location.trim() || null,
        status: "open",
      } as any);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        estate_id: estateId!,
        actor_id: session!.userId!,
        action: "incident.reported",
        entity: "issues",
        entity_id: null,
        metadata: { severity: form.severity, category: form.category },
      });
    },
    onSuccess: () => {
      toast.success("Incident reported");
      setOpen(false);
      setForm({
        title: "",
        description: "",
        category: "Security",
        severity: "medium",
        location: "",
      });
      qc.invalidateQueries({ queryKey: ["guard-incidents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
      >
        <Plus className="h-4 w-4" /> {open ? "Cancel" : "Report new incident"}
      </button>

      {open && (
        <Card className="space-y-3">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Severity">
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as any })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Location (block, gate, unit…)">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit report
          </button>
        </Card>
      )}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={3} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No incidents reported" icon={<AlertTriangle className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((i: any) => {
            const sev = SEVERITIES.find((s) => s.v === i.severity) ?? SEVERITIES[1];
            return (
              <Card key={i.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{i.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {i.category}
                      {i.location ? ` · ${i.location}` : ""} ·{" "}
                      {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                      {i.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge tone={sev.tone}>{sev.label}</StatusBadge>
                    <StatusBadge
                      tone={
                        i.status === "resolved"
                          ? "success"
                          : i.status === "in_progress"
                            ? "primary"
                            : "warning"
                      }
                    >
                      {i.status}
                    </StatusBadge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
