import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SearchInput,
  StatusBadge,
} from "@/components/ui-kit";

export const Route = createFileRoute("/app/admin/staff")({
  component: AdminStaff,
  head: () => ({
    meta: [
      { title: "Security Staff — Estate Guard" },
      {
        name: "description",
        content: "Manage estate guards and security staff: assignments, access and duty status.",
      },
      { property: "og:title", content: "Security Staff — Estate Guard" },
      {
        property: "og:description",
        content: "Manage estate guards, assignments and duty status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminStaff() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const guards = useQuery({
    queryKey: ["admin-guards", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (profiles ?? []).map((p) => p.id);
      const { data: roles, error: roleError } = ids.length
        ? await supabase.from("user_roles").select("user_id,role").in("user_id", ids)
        : { data: [], error: null };
      if (roleError) throw roleError;
      const guardIds = new Set(
        (roles ?? []).filter((r) => r.role === "guard").map((r) => r.user_id),
      );
      return (profiles ?? []).filter((p) => guardIds.has(p.id));
    },
  });

  const candidates = useQuery({
    queryKey: ["admin-guard-candidates", searchUser],
    enabled: searchUser.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,phone,estate_id,approved")
        .or(
          `full_name.ilike.%${searchUser}%,email.ilike.%${searchUser}%,phone.ilike.%${searchUser}%`,
        )
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setAccess = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.rpc("set_estate_access", {
        _user_id: id,
        _approved: approved,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guard access updated");
      qc.invalidateQueries({ queryKey: ["admin-guards"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignGuard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("assign_guard_to_current_estate", { _user_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guard assigned to estate");
      setSearchUser("");
      qc.invalidateQueries({ queryKey: ["admin-guards"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (guards.data ?? []).filter(
      (g) =>
        !needle ||
        (g.full_name ?? "").toLowerCase().includes(needle) ||
        (g.phone ?? "").toLowerCase().includes(needle) ||
        (g.email ?? "").toLowerCase().includes(needle),
    );
  }, [guards.data, q]);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <SearchInput
          value={searchUser}
          onChange={setSearchUser}
          placeholder="Search user to assign as guard"
        />
        {searchUser.trim().length >= 2 && (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
            {candidates.isLoading && (
              <div className="p-3 text-xs text-muted-foreground">Searching…</div>
            )}
            {(candidates.data ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => assignGuard.mutate(u.id)}
                disabled={assignGuard.isPending}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {u.full_name || u.email || u.id}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {u.phone ?? "no phone"}
                  </span>
                </span>
                {assignGuard.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs text-primary">Assign</span>
                )}
              </button>
            ))}
            {!candidates.isLoading && (candidates.data ?? []).length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">No matching users</div>
            )}
          </div>
        )}
      </Card>

      <SearchInput value={q} onChange={setQ} placeholder="Search guards" />
      {guards.isLoading ? (
        <ListSkeleton rows={4} />
      ) : guards.isError ? (
        <ErrorState onRetry={() => guards.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No guards assigned yet"
          description="Assign an existing user above or ask guards to sign up with your estate code."
          icon={<Shield className="h-6 w-6" />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((g) => {
            const open = openId === g.id;
            return (
              <Card key={g.id} className={`p-3 ${open ? "sm:col-span-2 xl:col-span-3" : ""}`}>
                <button
                  onClick={() => setOpenId(open ? null : g.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {g.full_name || "Unnamed guard"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Guard · {g.phone ?? g.email ?? "no contact"}
                    </div>
                  </div>
                  <StatusBadge tone={g.approved ? "success" : "warning"}>
                    {g.approved ? "active" : "disabled"}
                  </StatusBadge>
                </button>
                {open && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <div>
                      Joined {formatDistanceToNow(new Date(g.created_at), { addSuffix: true })}
                    </div>
                    <button
                      disabled={setAccess.isPending}
                      onClick={() => setAccess.mutate({ id: g.id, approved: !g.approved })}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
                    >
                      {g.approved ? "Disable guard access" : "Reactivate guard access"}
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
