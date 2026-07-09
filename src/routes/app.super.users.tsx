import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { UserCog } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SearchInput,
  StatusBadge,
} from "@/components/ui-kit";

export const Route = createFileRoute("/app/super/users")({
  component: SuperUsers,
});

type RoleFilter = "all" | "resident" | "guard" | "estate_admin" | "super_admin";

function SuperUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [estateId, setEstateId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const estates = useQuery({
    queryKey: ["super-users-estates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("id,name,code").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const users = useQuery({
    queryKey: ["super-users"],
    queryFn: async () => {
      const [{ data: profiles, error: pError }, { data: roles, error: rError }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (pError) throw pError;
      if (rError) throw rError;
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r) => rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]));
      return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  const estateMap = useMemo(
    () => new Map((estates.data ?? []).map((e) => [e.id, e])),
    [estates.data],
  );

  const setAccess = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.rpc("set_estate_access" as any, {
        _user_id: id,
        _approved: approved,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User access updated");
      qc.invalidateQueries({ queryKey: ["super-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignEstate = useMutation({
    mutationFn: async ({ id, nextEstateId }: { id: string; nextEstateId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ estate_id: nextEstateId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate assignment updated");
      qc.invalidateQueries({ queryKey: ["super-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = (users.data ?? []).filter((u) => {
    const needle = q.trim().toLowerCase();
    if (role !== "all" && !u.roles.includes(role)) return false;
    if (estateId && u.estate_id !== estateId) return false;
    if (!needle) return true;
    return (
      (u.full_name ?? "").toLowerCase().includes(needle) ||
      (u.email ?? "").toLowerCase().includes(needle) ||
      (u.phone ?? "").toLowerCase().includes(needle) ||
      u.id.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} placeholder="Search users by name, email, phone, or ID" />
      <div className="grid grid-cols-2 gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value as RoleFilter)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
          {(["all", "resident", "guard", "estate_admin", "super_admin"] as RoleFilter[]).map((r) => (
            <option key={r} value={r}>{r.replace("_", " ")}</option>
          ))}
        </select>
        <select value={estateId} onChange={(e) => setEstateId(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
          <option value="">All estates</option>
          {(estates.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {users.isLoading ? <ListSkeleton rows={5} /> : users.isError ? <ErrorState onRetry={() => users.refetch()} /> : rows.length === 0 ? (
        <EmptyState title="No matching users" icon={<UserCog className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {rows.map((u) => {
            const open = openId === u.id;
            const estate = u.estate_id ? estateMap.get(u.estate_id) : null;
            return (
              <Card key={u.id} className="p-3">
                <button onClick={() => setOpenId(open ? null : u.id)} className="flex w-full items-start justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{u.full_name || u.email || "Unnamed user"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{estate?.name ?? "No estate"} · {format(new Date(u.created_at), "MMM d, yyyy")}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge tone={u.approved ? "success" : "warning"}>{u.approved ? "active" : "suspended"}</StatusBadge>
                    <span className="text-[11px] text-muted-foreground">{u.roles.join(", ") || "no role"}</span>
                  </div>
                </button>
                {open && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      <div>Email: <span className="text-foreground">{u.email ?? "—"}</span></div>
                      <div>Phone: <span className="text-foreground">{u.phone ?? "—"}</span></div>
                      <div>Unit: <span className="text-foreground">{u.unit ?? u.house_number ?? "—"}</span></div>
                      <div>Verification: <span className="text-foreground">{u.verification_status}</span></div>
                    </div>
                    <select
                      value={u.estate_id ?? ""}
                      onChange={(e) => assignEstate.mutate({ id: u.id, nextEstateId: e.target.value || null })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
                    >
                      <option value="">No estate assignment</option>
                      {(estates.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <button
                      disabled={setAccess.isPending}
                      onClick={() => setAccess.mutate({ id: u.id, approved: !u.approved })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
                    >
                      {u.approved ? "Suspend user access" : "Reactivate user access"}
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}