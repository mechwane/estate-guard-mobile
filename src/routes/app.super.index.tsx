import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, StatCard, StatusBadge } from "@/components/ui-kit";
import { format } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/super/")({
  component: SuperDashboard,
});

function SuperDashboard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "" });

  const { data: estates } = useQuery({
    queryKey: ["all-estates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: platform } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [users, invites, issues] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("guest_invites").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString()),
        supabase.from("issues").select("id", { count: "exact", head: true }).neq("status", "resolved"),
      ]);
      return { users: users.count ?? 0, invites: invites.count ?? 0, openIssues: issues.count ?? 0 };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      let code = form.code.trim().toUpperCase();
      if (!code) {
        const { data, error } = await supabase.rpc("generate_unique_estate_code");
        if (error) throw error;
        code = data as string;
      }
      const { data, error } = await supabase.from("estates").insert({
        name: form.name.trim(), code, address: form.address.trim() || null, status: "active",
      }).select("id,code").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        estate_id: data.id, action: "estate.created", entity: "estates", entity_id: data.id, metadata: { code: data.code },
      });
      return data;
    },
    onSuccess: (data) => { toast.success(`Estate created · code ${data.code}`); setOpen(false); setForm({ name: "", code: "", address: "" }); qc.invalidateQueries({ queryKey: ["all-estates"] }); qc.invalidateQueries({ queryKey: ["platform-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const next = status === "active" ? "suspended" : "active";
      const { error } = await supabase.from("estates").update({ status: next }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({ estate_id: id, action: `estate.${next}`, entity: "estates", entity_id: id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-estates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Estates" value={estates?.length ?? "—"} />
        <StatCard label="Users" value={platform?.users ?? "—"} />
        <StatCard label="Open issues" value={platform?.openIssues ?? "—"} tone={platform?.openIssues ? "warning" : "default"} />
      </div>

      <Link to="/app/super/audit" className="card-surface flex items-center justify-center py-3 text-sm font-medium text-primary hover:bg-muted/40">
        View audit logs
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estates</h2>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark">
          <Plus className="h-3.5 w-3.5" /> {open ? "Close" : "New estate"}
        </button>
      </div>

      {open && (
        <Card className="space-y-3">
          <Field label="Estate name"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Estate code (leave blank to auto-generate)"><Input value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} /></Field>
          <Field label="Address"><Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></Field>
          <button onClick={() => create.mutate()} disabled={create.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create estate
          </button>
        </Card>
      )}

      <div className="space-y-2">
        {(estates ?? []).map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{e.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Code {e.code} · Created {format(new Date(e.created_at), "MMM d, yyyy")}</div>
              </div>
              <StatusBadge tone={e.status === "active" ? "success" : "warning"}>{e.status}</StatusBadge>
            </div>
            <button onClick={() => toggle.mutate({ id: e.id, status: e.status })} className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
              {e.status === "active" ? "Suspend estate" : "Reactivate estate"}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />;
}
