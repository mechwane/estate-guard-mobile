import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  StatusBadge,
  ListSkeleton,
  ErrorState,
  SearchInput,
  SheetModal,
} from "@/components/ui-kit";
import { Users, Fingerprint, ScanFace, SlidersHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/admin/residents")({
  component: Residents,
});

type BiometricRow = {
  id: string;
  resident_id: string | null;
  biometric_type: string;
  enrollment_status: string;
  access_status: string;
  device_id: string | null;
  last_used_at: string | null;
  updated_at: string | null;
};

type CardRow = { id: string; resident_id: string; active: boolean; card_number: string | null };
type VehicleRow = { id: string; resident_id: string; active: boolean; plate: string };
type DeviceRow = { id: string; name: string; device_type: string };

function Residents() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-residents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const access = useQuery({
    queryKey: ["admin-residents-access", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [bio, cards, vehs, devs] = await Promise.all([
        supabase
          .from("biometric_access")
          .select(
            "id,resident_id,biometric_type,enrollment_status,access_status,device_id,last_used_at,updated_at",
          )
          .eq("estate_id", estateId!),
        supabase
          .from("access_cards")
          .select("id,resident_id,active,card_number")
          .eq("estate_id", estateId!),
        supabase
          .from("vehicle_tags")
          .select("id,resident_id,active,plate")
          .eq("estate_id", estateId!),
        supabase.from("access_devices").select("id,name,device_type").eq("estate_id", estateId!),
      ]);
      const err = [bio.error, cards.error, vehs.error, devs.error].find(Boolean);
      if (err) throw err;
      return {
        bio: (bio.data ?? []) as BiometricRow[],
        cards: (cards.data ?? []) as CardRow[],
        vehicles: (vehs.data ?? []) as VehicleRow[],
        devices: (devs.data ?? []) as DeviceRow[],
      };
    },
  });

  const setApproved = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("profiles").update({ approved }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        estate_id: estateId!,
        actor_id: session?.userId ?? null,
        action: approved ? "resident.approved" : "resident.revoked",
        entity: "profiles",
        entity_id: id,
      });
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-residents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBio = useMutation({
    mutationFn: async (args: {
      residentId: string;
      biometricType: "fingerprint" | "face";
      enrollment_status: string;
      access_status: string;
      device_id: string | null;
    }) => {
      const { error } = await supabase.rpc(
        "admin_upsert_biometric_access" as never,
        {
          _resident_id: args.residentId,
          _dependent_id: null,
          _biometric_type: args.biometricType,
          _device_id: args.device_id,
          _enrollment_status: args.enrollment_status,
          _access_status: args.access_status,
          _notes: null,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access updated");
      qc.invalidateQueries({ queryKey: ["admin-residents-access", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((r) => {
      if (filter === "pending" && r.approved) return false;
      if (filter === "approved" && !r.approved) return false;
      if (!needle) return true;
      return (
        (r.full_name ?? "").toLowerCase().includes(needle) ||
        (r.phone ?? "").toLowerCase().includes(needle) ||
        (r.unit ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, q, filter]);

  const bioByResident = useMemo(() => {
    const map = new Map<string, { fingerprint?: BiometricRow; face?: BiometricRow }>();
    (access.data?.bio ?? []).forEach((row) => {
      if (!row.resident_id) return;
      const bucket = map.get(row.resident_id) ?? {};
      if (row.biometric_type === "fingerprint") bucket.fingerprint = row;
      if (row.biometric_type === "face") bucket.face = row;
      map.set(row.resident_id, bucket);
    });
    return map;
  }, [access.data]);

  const openResident = useMemo(
    () => (expanded ? (filtered.find((r) => r.id === expanded) ?? null) : null),
    [expanded, filtered],
  );
  const openBio = (openResident ? (bioByResident.get(openResident.id) ?? {}) : {}) as Record<
    string,
    any
  >;

  return (
    <div className="space-y-3">
      <div className="space-y-2 sm:max-w-xl">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, phone, or unit" />
        <div className="flex gap-2">
          {(["all", "pending", "approved"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={q || filter !== "all" ? "No matching residents" : "No residents yet"}
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const bio = bioByResident.get(r.id) ?? {};
            const hasCard = (access.data?.cards ?? []).some(
              (c) => c.resident_id === r.id && c.active,
            );
            const vehicleCount = (access.data?.vehicles ?? []).filter(
              (v) => v.resident_id === r.id && v.active,
            ).length;
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {(r.full_name || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {r.full_name || "—"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.unit ? `Unit ${r.unit}` : "—"} · {r.phone ?? "no phone"}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0">
                    <StatusBadge tone={r.approved ? "success" : "warning"}>
                      {r.approved ? "approved" : "pending"}
                    </StatusBadge>
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <MiniBadge
                    icon={<Fingerprint className="h-3 w-3" />}
                    label={bio.fingerprint?.enrollment_status ?? "not enrolled"}
                    active={bio.fingerprint?.access_status === "enabled"}
                  />
                  <MiniBadge
                    icon={<ScanFace className="h-3 w-3" />}
                    label={bio.face?.enrollment_status ?? "not enrolled"}
                    active={bio.face?.access_status === "enabled"}
                  />
                  <MiniBadge label={hasCard ? "Card active" : "No card"} active={hasCard} />
                  <MiniBadge
                    label={
                      vehicleCount
                        ? `${vehicleCount} vehicle${vehicleCount > 1 ? "s" : ""}`
                        : "No vehicle"
                    }
                    active={vehicleCount > 0}
                  />
                </div>

                <div className="mt-3 flex gap-2">
                  {!r.approved ? (
                    <button
                      onClick={() => setApproved.mutate({ id: r.id, approved: true })}
                      className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => setApproved.mutate({ id: r.id, approved: false })}
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      Revoke
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(r.id)}
                    className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <SlidersHorizontal className="h-3 w-3" /> Access
                  </button>
                </div>

              </Card>
            );
          })}
        </div>
      )}

      <SheetModal
        open={!!openResident}
        title={openResident ? `Access — ${openResident.full_name || "Resident"}` : "Access"}
        onClose={() => setExpanded(null)}
        width="lg"
      >
        {openResident && (
          <div className="space-y-2">
                    <BiometricRowEditor
                      title="Fingerprint"
                      icon={<Fingerprint className="h-4 w-4" />}
                      row={openBio.fingerprint}
                      devices={(access.data?.devices ?? []).filter(
                        (d) => d.device_type === "fingerprint" || d.device_type === "gate_scanner",
                      )}
                      onSave={(args) =>
                        updateBio.mutate({
                          residentId: openResident.id,
                          biometricType: "fingerprint",
                          ...args,
                        })
                      }
                      pending={updateBio.isPending}
                    />
                    <BiometricRowEditor
                      title="Face recognition"
                      icon={<ScanFace className="h-4 w-4" />}
                      row={openBio.face}
                      devices={(access.data?.devices ?? []).filter(
                        (d) => d.device_type === "face" || d.device_type === "gate_scanner",
                      )}
                      onSave={(args) =>
                        updateBio.mutate({ residentId: openResident.id, biometricType: "face", ...args })
                      }
                      pending={updateBio.isPending}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Biometric templates live on the estate device — no images stored here.
                    </p>
          </div>
        )}
      </SheetModal>
    </div>
  );
}

function MiniBadge({
  icon,
  label,
  active,
}: {
  icon?: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function BiometricRowEditor({
  title,
  icon,
  row,
  devices,
  onSave,
  pending,
}: {
  title: string;
  icon: React.ReactNode;
  row?: BiometricRow;
  devices: DeviceRow[];
  onSave: (args: {
    enrollment_status: string;
    access_status: string;
    device_id: string | null;
  }) => void;
  pending: boolean;
}) {
  const [enrollment, setEnrollment] = useState(row?.enrollment_status ?? "pending");
  const [accessStatus, setAccessStatus] = useState(row?.access_status ?? "disabled");
  const [deviceId, setDeviceId] = useState<string>(row?.device_id ?? "");

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="text-sm font-medium text-foreground">{title}</div>
        {row?.last_used_at && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Last used {formatDistanceToNow(new Date(row.last_used_at), { addSuffix: true })}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-[11px] text-muted-foreground">
          Enrollment
          <select
            value={enrollment}
            onChange={(e) => setEnrollment(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
          >
            <option value="not_enrolled">Not enrolled</option>
            <option value="pending">Pending</option>
            <option value="enrolled">Enrolled</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground">
          Access
          <select
            value={accessStatus}
            onChange={(e) => setAccessStatus(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground">
          Device
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
          >
            <option value="">— none —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          onClick={() =>
            onSave({
              enrollment_status: enrollment,
              access_status: accessStatus,
              device_id: deviceId || null,
            })
          }
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </div>
  );
}
