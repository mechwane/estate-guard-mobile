import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, StatCard, StatusBadge, SearchInput, ListSkeleton, EmptyState, ErrorState, ConfirmActionDialog } from "@/components/ui-kit";
import { format } from "date-fns";
import { Loader2, Plus, Pencil, UserCog, Power, PowerOff, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/super/")({
  component: SuperDashboard,
});

type Estate = {
  id: string; name: string; code: string; status: string; address: string | null;
  city: string | null; state: string | null; contact_email: string | null;
  contact_phone: string | null; admin_user_id: string | null; created_at: string;
};

function SuperDashboard() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"list" | "new">("list");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Estate | null>(null);
  const [assigning, setAssigning] = useState<Estate | null>(null);
  const [toggling, setToggling] = useState<Estate | null>(null);

  const estatesQ = useQuery({
    queryKey: ["all-estates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Estate[];
    },
  });

  const stats = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [users, estatesTotal, active, suspended, admins, guards, residents, txTotals] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("estates").select("id", { count: "exact", head: true }),
        supabase.from("estates").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("estates").select("id", { count: "exact", head: true }).eq("status", "suspended"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "estate_admin"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "guard"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "resident"),
        supabase.from("vtu_transactions").select("amount").eq("status", "success"),
      ]);
      const vtuSum = (txTotals.data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      return {
        users: users.count ?? 0,
        estatesTotal: estatesTotal.count ?? 0,
        active: active.count ?? 0,
        suspended: suspended.count ?? 0,
        admins: admins.count ?? 0,
        guards: guards.count ?? 0,
        residents: residents.count ?? 0,
        vtuSum,
      };
    },
  });

  const filtered = (estatesQ.data ?? []).filter((e) =>
    !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.code.toLowerCase().includes(q.toLowerCase()));

  const toggle = useMutation({
    mutationFn: async (e: Estate) => {
      const fn = e.status === "active" ? "suspend_estate" : "activate_estate";
      const args = e.status === "active" ? { _estate_id: e.id, _reason: null } : { _estate_id: e.id };
      const { error } = await supabase.rpc(fn as any, args as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estate updated"); qc.invalidateQueries({ queryKey: ["all-estates"] }); qc.invalidateQueries({ queryKey: ["platform-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Estates" value={stats.data?.estatesTotal ?? "—"} />
        <StatCard label="Active" value={stats.data?.active ?? "—"} tone="success" />
        <StatCard label="Suspended" value={stats.data?.suspended ?? "—"} tone={stats.data?.suspended ? "warning" : "default"} />
        <StatCard label="Users" value={stats.data?.users ?? "—"} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Admins" value={stats.data?.admins ?? "—"} />
        <StatCard label="Guards" value={stats.data?.guards ?? "—"} />
        <StatCard label="Residents" value={stats.data?.residents ?? "—"} />
        <StatCard label="VTU volume" value={stats.data ? `₦${stats.data.vtuSum.toLocaleString()}` : "—"} tone="primary" />
      </div>

      <Link to="/app/super/audit" className="card-surface flex items-center justify-center py-3 text-sm font-medium text-primary hover:bg-muted/40">
        View audit logs
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Estates</h2>
        <button onClick={() => setTab(tab === "new" ? "list" : "new")} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark">
          <Plus className="h-3.5 w-3.5" /> {tab === "new" ? "Close" : "New estate"}
        </button>
      </div>

      {tab === "new" && <NewEstateForm onDone={() => { setTab("list"); qc.invalidateQueries({ queryKey: ["all-estates"] }); qc.invalidateQueries({ queryKey: ["platform-stats"] }); }} />}

      <SearchInput value={q} onChange={setQ} placeholder="Search by name or code" />

      {estatesQ.isError ? <ErrorState onRetry={() => estatesQ.refetch()} /> :
       estatesQ.isLoading ? <ListSkeleton rows={4} /> :
       filtered.length === 0 ? <EmptyState title="No estates" icon={<Building2 className="h-6 w-6" />} /> :
       <div className="space-y-2">
         {filtered.map((e) => (
           <Card key={e.id} className="p-4">
             <div className="flex items-start justify-between gap-3">
               <Link to="/app/super/estates/$estateId" params={{ estateId: e.id }} className="min-w-0 flex-1 text-left">
                 <div className="truncate text-sm font-medium text-foreground hover:text-primary">{e.name}</div>
                 <div className="mt-0.5 text-xs text-muted-foreground">Code {e.code} · {format(new Date(e.created_at), "MMM d, yyyy")}</div>
                 {(e.city || e.state) && <div className="mt-0.5 text-xs text-muted-foreground">{[e.city, e.state].filter(Boolean).join(", ")}</div>}
               </Link>
               <StatusBadge tone={e.status === "active" ? "success" : "warning"}>{e.status}</StatusBadge>
             </div>
             <div className="mt-3 grid grid-cols-3 gap-2">
               <ActionBtn onClick={() => setEditing(e)} icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" />
               <ActionBtn onClick={() => setAssigning(e)} icon={<UserCog className="h-3.5 w-3.5" />} label={e.admin_user_id ? "Reassign" : "Assign"} />
                <ActionBtn onClick={() => setToggling(e)} icon={e.status === "active" ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />} label={e.status === "active" ? "Suspend" : "Activate"} />
             </div>
           </Card>
         ))}
        </div>}

      <ConfirmActionDialog
        open={!!toggling}
        title={toggling?.status === "active" ? `Suspend ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={toggling?.status === "active"
          ? "Residents and guards in this estate will lose access until it is reactivated."
          : "Residents and guards will regain access to this estate immediately."}
        confirmLabel={toggling?.status === "active" ? "Suspend estate" : "Activate estate"}
        tone={toggling?.status === "active" ? "destructive" : "default"}
        busy={toggle.isPending}
        onCancel={() => setToggling(null)}
        onConfirm={() => { if (toggling) toggle.mutate(toggling, { onSettled: () => setToggling(null) }); }}
      />


      {editing && <EditEstateModal estate={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["all-estates"] }); }} />}
      {assigning && <AssignAdminModal estate={assigning} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); qc.invalidateQueries({ queryKey: ["all-estates"] }); qc.invalidateQueries({ queryKey: ["platform-stats"] }); }} />}
    </div>
  );
}

function ActionBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted">
      {icon} {label}
    </button>
  );
}

function NewEstateForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: "", code: "", address: "", city: "", state: "", contact_email: "", contact_phone: "" });
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
        name: form.name.trim(), code, status: "active",
        address: form.address.trim() || null, city: form.city.trim() || null, state: form.state.trim() || null,
        contact_email: form.contact_email.trim() || null, contact_phone: form.contact_phone.trim() || null,
      } as any).select("id,code").single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        estate_id: data.id, action: "estate.created", entity: "estates", entity_id: data.id, metadata: { code: data.code },
      });
      return data;
    },
    onSuccess: (d) => { toast.success(`Estate created · code ${(d as any).code}`); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="space-y-3">
      <Field label="Estate name"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
      <Field label="Code (blank = auto-generate)"><Input value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} /></Field>
      <Field label="Address"><Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="City"><Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} /></Field>
        <Field label="State"><Input value={form.state} onChange={(v) => setForm({ ...form, state: v })} /></Field>
      </div>
      <Field label="Contact email"><Input value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} /></Field>
      <Field label="Contact phone"><Input value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} /></Field>
      <button onClick={() => create.mutate()} disabled={create.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
        {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create estate
      </button>
    </Card>
  );
}

function EditEstateModal({ estate, onClose, onDone }: { estate: Estate; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    name: estate.name, address: estate.address ?? "", city: estate.city ?? "",
    state: estate.state ?? "", contact_email: estate.contact_email ?? "", contact_phone: estate.contact_phone ?? "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_estate" as any, {
        _estate_id: estate.id, _name: form.name, _address: form.address || null,
        _city: form.city || null, _state: form.state || null,
        _contact_email: form.contact_email || null, _contact_phone: form.contact_phone || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estate updated"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Overlay onClose={onClose} title={`Edit ${estate.name}`}>
      <div className="space-y-3">
        <Field label="Estate name"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
        <Field label="Address"><Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City"><Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} /></Field>
          <Field label="State"><Input value={form.state} onChange={(v) => setForm({ ...form, state: v })} /></Field>
        </div>
        <Field label="Contact email"><Input value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} /></Field>
        <Field label="Contact phone"><Input value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} /></Field>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </div>
    </Overlay>
  );
}

function AssignAdminModal({ estate, onClose, onDone }: { estate: Estate; onClose: () => void; onDone: () => void }) {
  const [userId, setUserId] = useState("");
  const [q, setQ] = useState("");
  const search = useQuery({
    queryKey: ["assign-admin-search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email").or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  const assign = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Choose a user");
      const rpc = estate.admin_user_id ? "reassign_estate_admin" : "assign_estate_admin";
      const { error } = await supabase.rpc(rpc as any, { _estate_id: estate.id, [estate.admin_user_id ? "_new_admin_user_id" : "_user_id"]: userId } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Admin assigned"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Overlay onClose={onClose} title={estate.admin_user_id ? "Reassign estate admin" : "Assign estate admin"}>
      <div className="space-y-3">
        {estate.admin_user_id && <p className="text-xs text-muted-foreground">Reassigning will revoke the current admin's access to this estate and grant it to the new user. Confirm before saving.</p>}
        <Field label="Search users by name or email"><Input value={q} onChange={setQ} /></Field>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {(search.data ?? []).map((u: any) => (
            <button key={u.id} onClick={() => setUserId(u.id)} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${userId === u.id ? "bg-primary/10 text-primary" : ""}`}>
              <span className="truncate">{u.full_name || u.email || u.id}</span>
              {userId === u.id && <span className="text-xs">Selected</span>}
            </button>
          ))}
          {q.length >= 2 && (search.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">No matches</div>}
        </div>
        <button onClick={() => assign.mutate()} disabled={assign.isPending || !userId} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
          {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 shadow-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
        </div>
        {children}
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
