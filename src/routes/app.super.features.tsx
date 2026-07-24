import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, EmptyState, ErrorState, ListSkeleton } from "@/components/ui-kit";

export const Route = createFileRoute("/app/super/features")({
  component: FeatureFlags,
  head: () => ({ meta: [{ title: "Feature Flags — Estate Guard" }] }),
});

const FEATURES: { key: string; label: string; description: string }[] = [
  { key: "guest_code_access", label: "Guest code access", description: "Residents can generate guest codes for one-time visitors." },
  { key: "multiple_invite", label: "Multiple invites", description: "Residents can issue several invites at once." },
  { key: "fingerprint_access", label: "Fingerprint access", description: "Fingerprint credentials at estate access devices." },
  { key: "face_recognition_access", label: "Face recognition access", description: "Face credentials at estate access devices." },
  { key: "access_cards", label: "Access cards", description: "RFID / proximity access cards for residents." },
  { key: "vehicle_tags", label: "Vehicle tags", description: "Vehicle plate / RFID tags for gate access." },
  { key: "shop", label: "Estate shop", description: "Residents can order items from the estate shop." },
  { key: "bills", label: "Bills", description: "Estate can bill residents and collect payments." },
  { key: "meetings", label: "Meetings", description: "Estate meetings with notifications." },
  { key: "polls", label: "Polls", description: "Community polls and voting." },
  { key: "events", label: "Events", description: "Community events and registrations." },
  { key: "premium", label: "Premium", description: "Premium tier features for eligible residents." },
];

function FeatureFlags() {
  const qc = useQueryClient();
  const [estateId, setEstateId] = useState<string>("");

  const estates = useQuery({
    queryKey: ["estates-for-flags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("id,name,code").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const flags = useQuery({
    queryKey: ["estate-flags", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("estate_feature_flags").select("*").eq("estate_id", estateId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const flagMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (flags.data ?? []).forEach((f: any) => map.set(f.key, !!f.enabled));
    return map;
  }, [flags.data]);

  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase.rpc("set_estate_feature_flag" as never, {
        _estate_id: estateId,
        _key: key,
        _enabled: enabled,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flag updated");
      qc.invalidateQueries({ queryKey: ["estate-flags", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (estates.isLoading) return <ListSkeleton rows={3} />;
  if (estates.isError) return <ErrorState onRetry={() => estates.refetch()} />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Feature flags</h1>
      <Card>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Estate</label>
        <select value={estateId} onChange={(e) => setEstateId(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <option value="">Select an estate…</option>
          {(estates.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
        </select>
      </Card>

      {!estateId ? (
        <EmptyState title="Pick an estate" description="Choose an estate to configure its feature flags." />
      ) : flags.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Features</h2>
          <ul className="space-y-2">
            {FEATURES.map((f) => {
              const enabled = flagMap.get(f.key) ?? true;
              return (
                <li key={f.key} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2">
                  <div className="min-w-0 pr-3">
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.description}</div>
                  </div>
                  <button
                    onClick={() => toggle.mutate({ key: f.key, enabled: !enabled })}
                    disabled={toggle.isPending}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"} disabled:opacity-60`}
                    aria-label={`Toggle ${f.label}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
