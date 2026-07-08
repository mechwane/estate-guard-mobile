import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  StatCard,
  StatusBadge,
  ListSkeleton,
  ErrorState,
  ConfirmActionDialog,
} from "@/components/ui-kit";
import { format } from "date-fns";
import { ArrowLeft, Pencil, UserCog, Power, PowerOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/super/estates/$estateId")({
  component: EstateDetail,
});

type Overview = {
  estate: any;
  admin: any | null;
  users: Record<string, number>;
  guests: Record<string, number>;
  incidents: {
    open: number;
    in_progress: number;
    resolved: number;
    by_severity: Record<string, number> | null;
  };
  billing: Record<string, number>;
  recent_activity: Array<{
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    actor_id: string | null;
    metadata: any;
    created_at: string;
  }>;
};

function EstateDetail() {
  const { estateId } = Route.useParams();
  const qc = useQueryClient();
  const [toggling, setToggling] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["super-estate-overview", estateId] });
    qc.invalidateQueries({ queryKey: ["all-estates"] });
    qc.invalidateQueries({ queryKey: ["platform-stats"] });
  };

  const overview = useQuery({
    queryKey: ["super-estate-overview", estateId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "super_estate_overview" as any,
        { _estate_id: estateId } as any,
      );
      if (error) throw error;
      return data as unknown as Overview;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ isActive, reason }: { isActive: boolean; reason: string | null }) => {
      const fn = isActive ? "suspend_estate" : "activate_estate";
      const args = isActive ? { _estate_id: estateId, _reason: reason } : { _estate_id: estateId };
      const { error } = await supabase.rpc(fn as any, args as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeAdmin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("remove_estate_admin" as never, { _estate_id: estateId } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate admin removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (overview.isError) return <ErrorState onRetry={() => overview.refetch()} />;
  if (overview.isLoading || !overview.data) return <ListSkeleton rows={6} />;

  const d = overview.data;
  const e = d.estate;
  const active = e?.status === "active";
  const money = (n: number) => `₦${Number(n ?? 0).toLocaleString()}`;
  const suspensionReason = e?.metadata?.suspension_reason ?? null;

  return (
    <div className="space-y-5">
      <Link
        to="/app/super"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All estates
      </Link>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">{e.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Code {e.code} · Created {format(new Date(e.created_at), "MMM d, yyyy")}
            </p>
            {(e.address || e.city || e.state) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {[e.address, e.city, e.state].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {e.contact_email && (
                <div>
                  Email: <span className="text-foreground">{e.contact_email}</span>
                </div>
              )}
              {e.contact_phone && (
                <div>
                  Phone: <span className="text-foreground">{e.contact_phone}</span>
                </div>
              )}
              <div>
                Admin: <span className="text-foreground">{d.admin?.full_name ?? "Unassigned"}</span>
              </div>
              <div>
                Admin phone: <span className="text-foreground">{d.admin?.phone ?? "—"}</span>
              </div>
            </div>
            {!active && suspensionReason && (
              <p className="mt-2 text-xs text-[color:var(--color-warning)]">
                Suspension reason: {suspensionReason}
              </p>
            )}
          </div>
          <StatusBadge tone={active ? "success" : "warning"}>{e.status}</StatusBadge>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={() => setAssigning(true)}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <UserCog className="h-3.5 w-3.5" /> {e.admin_user_id ? "Reassign" : "Assign"}
          </button>
          <button
            onClick={() => {
              setSuspendReason("");
              setToggling(true);
            }}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            {active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}{" "}
            {active ? "Suspend" : "Activate"}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => setInviting(true)}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-card px-2 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <UserCog className="h-3.5 w-3.5" /> Invite admin by email
          </button>
          <button
            disabled={!e.admin_user_id || removeAdmin.isPending}
            onClick={() => setRemoving(true)}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            <PowerOff className="h-3.5 w-3.5" /> Remove admin
          </button>
        </div>
      </Card>

      <Section title="People">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Total users" value={d.users.total} />
          <StatCard label="Residents" value={d.users.residents} />
          <StatCard label="Guards" value={d.users.guards} />
          <StatCard label="Admins" value={d.users.admins} />
          <StatCard label="Approved" value={d.users.approved} tone="success" />
          <StatCard
            label="Pending verif."
            value={d.users.verif_pending}
            tone={d.users.verif_pending ? "warning" : "default"}
          />
          <StatCard label="Approved verif." value={d.users.verif_approved} />
          <StatCard
            label="Rejected verif."
            value={d.users.verif_rejected}
            tone={d.users.verif_rejected ? "error" : "default"}
          />
        </div>
      </Section>

      <Section title="Guest passes">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Total" value={d.guests.total} />
          <StatCard label="Active" value={d.guests.active} tone="primary" />
          <StatCard
            label="Inside now"
            value={d.guests.inside}
            tone={d.guests.inside ? "primary" : "default"}
          />
          <StatCard label="Used" value={d.guests.used} />
          <StatCard label="Expired" value={d.guests.expired} />
          <StatCard label="Revoked" value={d.guests.revoked} />
          <StatCard label="Entries" value={d.guests.entries} />
          <StatCard
            label="Missing exit"
            value={d.guests.missing_exit}
            tone={d.guests.missing_exit ? "warning" : "default"}
          />
        </div>
      </Section>

      <Section title="Incidents">
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Open"
            value={d.incidents.open}
            tone={d.incidents.open ? "warning" : "default"}
          />
          <StatCard label="In progress" value={d.incidents.in_progress} />
          <StatCard label="Resolved" value={d.incidents.resolved} tone="success" />
        </div>
        {d.incidents.by_severity && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(d.incidents.by_severity).map(([k, v]) => (
              <StatusBadge
                key={k}
                tone={k === "critical" ? "error" : k === "high" ? "warning" : "neutral"}
              >
                {k}: {v}
              </StatusBadge>
            ))}
          </div>
        )}
      </Section>

      <Section title="Billing (NGN)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Billed" value={money(d.billing.billed)} />
          <StatCard label="Collected" value={money(d.billing.collected)} tone="success" />
          <StatCard
            label="Outstanding"
            value={money((d.billing.billed ?? 0) - (d.billing.collected ?? 0))}
            tone="warning"
          />
          <StatCard label="Payments" value={d.billing.payments} />
        </div>
      </Section>


      <Section title="Recent activity">
        {d.recent_activity.length === 0 ? (
          <Card>
            <p className="text-xs text-muted-foreground">No recorded activity yet.</p>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {d.recent_activity.map((a) => (
              <Card key={a.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{a.action}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.entity}
                      {a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {format(new Date(a.created_at), "MMM d, p")}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <ConfirmActionDialog
        open={toggling}
        title={active ? `Suspend ${e.name}?` : `Activate ${e.name}?`}
        description={
          active ? (
            <div className="space-y-2">
              <p>
                Residents and guards in <strong>{e.name}</strong> will lose access until
                reactivated. Ongoing sessions will be blocked from performing gate actions.
              </p>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Suspension reason (required)
                </span>
                <textarea
                  value={suspendReason}
                  onChange={(ev) => setSuspendReason(ev.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Non-payment of platform fees"
                />
              </label>
            </div>
          ) : (
            <>
              Residents and guards in <strong>{e.name}</strong> will regain access immediately.
            </>
          )
        }
        confirmLabel={active ? "Suspend estate" : "Activate estate"}
        tone={active ? "destructive" : "default"}
        busy={toggle.isPending || (active && !suspendReason.trim())}
        onCancel={() => setToggling(false)}
        onConfirm={() => {
          if (active && !suspendReason.trim()) {
            toast.error("Suspension reason is required");
            return;
          }
          toggle.mutate(
            { isActive: active, reason: active ? suspendReason.trim() : null },
            { onSettled: () => setToggling(false) },
          );
        }}
      />

      {editing && (
        <EditEstateSheet
          estate={e}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            invalidate();
          }}
        />
      )}
      {assigning && (
        <AssignAdminSheet
          estate={e}
          onClose={() => setAssigning(false)}
          onDone={() => {
            setAssigning(false);
            invalidate();
          }}
        />
      )}
      {inviting && (
        <InviteAdminSheet
          estate={e}
          onClose={() => setInviting(false)}
        />
      )}
      <ConfirmActionDialog
        open={removing}
        title={`Remove admin from ${e.name}?`}
        description={
          <>
            The current admin will lose their <strong>Estate Admin</strong> role and access to this
            estate. They keep their user account.
          </>
        }
        confirmLabel="Remove admin"
        tone="destructive"
        busy={removeAdmin.isPending}
        onCancel={() => setRemoving(false)}
        onConfirm={() =>
          removeAdmin.mutate(undefined, { onSettled: () => setRemoving(false) })
        }
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-background p-5 shadow-xl sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}

function EditEstateSheet({
  estate,
  onClose,
  onDone,
}: {
  estate: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: estate.name ?? "",
    address: estate.address ?? "",
    city: estate.city ?? "",
    state: estate.state ?? "",
    contact_email: estate.contact_email ?? "",
    contact_phone: estate.contact_phone ?? "",
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      const { error } = await supabase.rpc(
        "update_estate" as any,
        {
          _estate_id: estate.id,
          _name: form.name.trim(),
          _address: form.address.trim() || null,
          _city: form.city.trim() || null,
          _state: form.state.trim() || null,
          _contact_email: form.contact_email.trim() || null,
          _contact_phone: form.contact_phone.trim() || null,
        } as any,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Sheet title={`Edit ${estate.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Estate name">
          <TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        </Field>
        <Field label="Address">
          <TextInput value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City">
            <TextInput value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          </Field>
          <Field label="State">
            <TextInput value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
          </Field>
        </div>
        <Field label="Contact email">
          <TextInput
            type="email"
            value={form.contact_email}
            onChange={(v) => setForm({ ...form, contact_email: v })}
          />
        </Field>
        <Field label="Contact phone">
          <TextInput
            type="tel"
            value={form.contact_phone}
            onChange={(v) => setForm({ ...form, contact_phone: v })}
          />
        </Field>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </div>
    </Sheet>
  );
}

function AssignAdminSheet({
  estate,
  onClose,
  onDone,
}: {
  estate: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const search = useQuery({
    queryKey: ["super-assign-search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,estate_id")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      if (error) throw error;
      const ids = (data ?? []).map((p: any) => p.id);
      const { data: roles } = ids.length
        ? await supabase.from("user_roles").select("user_id,role").in("user_id", ids)
        : { data: [] as any[] };
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const cur = rolesByUser.get(r.user_id) ?? [];
        cur.push(r.role);
        rolesByUser.set(r.user_id, cur);
      });
      return (data ?? []).map((p: any) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Choose a user");
      const rpc = estate.admin_user_id ? "reassign_estate_admin" : "assign_estate_admin";
      const args = estate.admin_user_id
        ? { _estate_id: estate.id, _new_admin_user_id: userId }
        : { _estate_id: estate.id, _user_id: userId };
      const { error } = await supabase.rpc(rpc as any, args as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate admin assigned");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = (search.data ?? []).find((u: any) => u.id === userId);

  return (
    <Sheet
      title={
        estate.admin_user_id ? `Reassign admin of ${estate.name}` : `Assign admin to ${estate.name}`
      }
      onClose={onClose}
    >
      <div className="space-y-3">
        {estate.admin_user_id && (
          <p className="rounded-lg border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/10 p-2.5 text-xs text-[color:var(--color-warning)]">
            The current admin will lose access to this estate. Confirm before saving.
          </p>
        )}
        <Field label="Search users by name or email">
          <TextInput value={q} onChange={setQ} />
        </Field>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {q.trim().length < 2 && (
            <div className="p-3 text-xs text-muted-foreground">Type at least 2 characters…</div>
          )}
          {q.trim().length >= 2 && search.isLoading && (
            <div className="p-3 text-xs text-muted-foreground">Searching…</div>
          )}
          {(search.data ?? []).map((u: any) => (
            <button
              key={u.id}
              onClick={() => setUserId(u.id)}
              className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted ${userId === u.id ? "bg-primary/10 text-primary" : ""}`}
            >
              <span className="truncate font-medium">{u.full_name || "(no name)"}</span>
              <span className="truncate text-[11px] text-muted-foreground">{u.email || u.id}</span>
              {u.roles.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Current roles: {u.roles.join(", ")}
                </span>
              )}
            </button>
          ))}
          {q.trim().length >= 2 && !search.isLoading && (search.data ?? []).length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No matches</div>
          )}
        </div>
        <button
          onClick={() => {
            if (!userId) {
              toast.error("Choose a user");
              return;
            }
            if (estate.admin_user_id) setConfirm(true);
            else assign.mutate();
          }}
          disabled={assign.isPending || !userId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
          {estate.admin_user_id ? "Reassign admin" : "Assign admin"}
        </button>
      </div>

      <ConfirmActionDialog
        open={confirm}
        title="Replace current estate admin?"
        description={
          <>
            You are replacing the current admin of <strong>{estate.name}</strong> with{" "}
            <strong>{selected?.full_name || selected?.email || "the selected user"}</strong>. This
            immediately grants and revokes access.
          </>
        }
        confirmLabel="Replace admin"
        tone="destructive"
        busy={assign.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => assign.mutate(undefined, { onSettled: () => setConfirm(false) })}
      />
    </Sheet>
  );
}
