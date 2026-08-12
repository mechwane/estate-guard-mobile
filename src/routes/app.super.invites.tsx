import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isAfter } from "date-fns";
import { Inbox } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SearchInput,
  StatusBadge,
} from "@/components/ui-kit";

export const Route = createFileRoute("/app/super/invites")({
  component: SuperInvites,
});

function SuperInvites() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [estateId, setEstateId] = useState("");
  const [email, setEmail] = useState("");
  const [latestLink, setLatestLink] = useState<string | null>(null);

  const estates = useQuery({
    queryKey: ["super-invite-estates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("id,name,code").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invites = useQuery({
    queryKey: ["super-admin-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estate_admin_invites")
        .select("id,estate_id,email,created_at,expires_at,accepted_at,accepted_by,created_by")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const estateMap = new Map((estates.data ?? []).map((e) => [e.id, e]));

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!estateId) throw new Error("Choose an estate");
      const trimmed = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(trimmed)) throw new Error("Enter a valid email");
      const { data, error } = await supabase.rpc("create_estate_admin_invite", {
        _estate_id: estateId,
        _email: trimmed,
      });
      if (error) throw error;
      return `${window.location.origin}/auth/sign-up?admin_invite=${data as string}`;
    },
    onSuccess: (link) => {
      setLatestLink(link);
      setEmail("");
      toast.success("Invite link generated");
      qc.invalidateQueries({ queryKey: ["super-admin-invites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("estate_admin_invites")
        .update({ expires_at: new Date().toISOString() })
        .eq("id", id)
        .is("accepted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invite cancelled");
      qc.invalidateQueries({ queryKey: ["super-admin-invites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copy = async (inviteId: string) => {
    const { data, error } = await supabase.rpc("super_admin_invite_link", {
      _invite_id: inviteId,
    });
    if (error || !data) return toast.error("Could not fetch invite link");
    const link = `${window.location.origin}/auth/sign-up?admin_invite=${data}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  const rows = (invites.data ?? []).filter((i) => {
    const estate = estateMap.get(i.estate_id);
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      i.email.toLowerCase().includes(needle) || (estate?.name ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={estateId}
            onChange={(e) => setEstateId(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
          >
            <option value="">Choose estate</option>
            {(estates.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.code})
              </option>
            ))}
          </select>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="admin@email.com"
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
          />
        </div>
        <button
          disabled={createInvite.isPending}
          onClick={() => createInvite.mutate()}
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          Generate estate admin invite
        </button>
        {latestLink && (
          <code className="block break-all rounded-lg bg-muted p-2 text-[11px] text-foreground">
            {latestLink}
          </code>
        )}
      </Card>

      <SearchInput value={q} onChange={setQ} placeholder="Search invites" />

      {invites.isLoading ? (
        <ListSkeleton rows={5} />
      ) : invites.isError ? (
        <ErrorState onRetry={() => invites.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No admin invites" icon={<Inbox className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {rows.map((i) => {
            const accepted = !!i.accepted_at;
            const expired = !accepted && !isAfter(new Date(i.expires_at), new Date());
            return (
              <Card key={i.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{i.email}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {estateMap.get(i.estate_id)?.name ?? "Estate"} · Expires{" "}
                      {format(new Date(i.expires_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <StatusBadge tone={accepted ? "success" : expired ? "error" : "warning"}>
                    {accepted ? "accepted" : expired ? "expired" : "pending"}
                  </StatusBadge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => copy(i.id)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Copy link
                  </button>
                  <button
                    disabled={accepted || expired || cancelInvite.isPending}
                    onClick={() => cancelInvite.mutate(i.id)}
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
