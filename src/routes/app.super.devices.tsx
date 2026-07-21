import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Plus, ShieldCheck, WifiOff, Wifi, Wrench, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SearchInput,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";

export const Route = createFileRoute("/app/super/devices")({
  component: SuperDevices,
  head: () => ({
    meta: [
      { title: "Access devices — Estate Guard" },
      {
        name: "description",
        content:
          "Manage every biometric and access-control terminal across all estates on the platform.",
      },
    ],
  }),
});

type DeviceType =
  | "fingerprint"
  | "face"
  | "gate_scanner"
  | "qr_validator"
  | "rfid_reader";
type DeviceStatus = "online" | "offline" | "maintenance" | "disabled";

type Device = {
  id: string;
  estate_id: string;
  name: string;
  device_type: DeviceType;
  location: string | null;
  status: DeviceStatus;
  last_seen_at: string | null;
  last_sync_at: string | null;
  created_at: string;
};

type Estate = { id: string; name: string; code: string };

const TYPE_LABEL: Record<DeviceType, string> = {
  fingerprint: "Fingerprint",
  face: "Face recognition",
  gate_scanner: "Gate scanner",
  qr_validator: "QR validator",
  rfid_reader: "RFID / access card",
};

const STATUS_TONE: Record<
  DeviceStatus,
  "success" | "warning" | "error" | "neutral"
> = {
  online: "success",
  offline: "neutral",
  maintenance: "warning",
  disabled: "error",
};

function SuperDevices() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DeviceStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | DeviceType>("all");
  const [estateFilter, setEstateFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);

  const estatesQ = useQuery({
    queryKey: ["all-estates-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estates")
        .select("id,name,code")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Estate[];
    },
  });

  const devicesQ = useQuery({
    queryKey: ["all-access-devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_devices")
        .select(
          "id,estate_id,name,device_type,location,status,last_seen_at,last_sync_at,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Device[];
    },
  });

  const estateMap = useMemo(
    () => new Map((estatesQ.data ?? []).map((e) => [e.id, e])),
    [estatesQ.data],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (devicesQ.data ?? []).filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (typeFilter !== "all" && d.device_type !== typeFilter) return false;
      if (estateFilter !== "all" && d.estate_id !== estateFilter) return false;
      if (!needle) return true;
      const estate = estateMap.get(d.estate_id);
      return (
        d.name.toLowerCase().includes(needle) ||
        (d.location ?? "").toLowerCase().includes(needle) ||
        (estate?.name ?? "").toLowerCase().includes(needle) ||
        (estate?.code ?? "").toLowerCase().includes(needle)
      );
    });
  }, [devicesQ.data, q, statusFilter, typeFilter, estateFilter, estateMap]);

  const counts = useMemo(() => {
    const rows = devicesQ.data ?? [];
    return {
      total: rows.length,
      online: rows.filter((d) => d.status === "online").length,
      offline: rows.filter((d) => d.status === "offline").length,
      maintenance: rows.filter((d) => d.status === "maintenance").length,
      disabled: rows.filter((d) => d.status === "disabled").length,
    };
  }, [devicesQ.data]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeviceStatus }) => {
      const { error } = await supabase.rpc("admin_set_device_status" as never, {
        _device_id: id,
        _status: status,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Device updated");
      qc.invalidateQueries({ queryKey: ["all-access-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Stagger className="space-y-4">
      <StaggerItem>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard label="Total devices" value={counts.total} />
          <StatCard label="Online" value={counts.online} tone="success" />
          <StatCard label="Offline" value={counts.offline} />
          <StatCard
            label="Maintenance"
            value={counts.maintenance}
            tone={counts.maintenance ? "warning" : "default"}
          />
          <StatCard
            label="Disabled"
            value={counts.disabled}
            tone={counts.disabled ? "error" : "default"}
          />
        </div>
      </StaggerItem>

      <StaggerItem>
        <Card className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <SearchInput
                value={q}
                onChange={setQ}
                placeholder="Search device, gate, estate…"
              />
            </div>
            <select
              value={estateFilter}
              onChange={(e) => setEstateFilter(e.target.value)}
              className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs"
            >
              <option value="all">All estates</option>
              {(estatesQ.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs"
            >
              <option value="all">All types</option>
              {(Object.keys(TYPE_LABEL) as DeviceType[]).map((k) => (
                <option key={k} value={k}>
                  {TYPE_LABEL[k]}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-border bg-card px-2.5 py-2 text-xs"
            >
              <option value="all">Any status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
              <option value="disabled">Disabled</option>
            </select>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
            >
              <Plus className="h-3.5 w-3.5" /> Register device
            </button>
          </div>

          {devicesQ.isLoading ? (
            <ListSkeleton rows={4} />
          ) : devicesQ.isError ? (
            <ErrorState onRetry={() => devicesQ.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No access devices"
              description={
                (devicesQ.data ?? []).length === 0
                  ? "Register the first fingerprint, face, or gate device to start seeing scans."
                  : "No devices match the current filters."
              }
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((d) => {
                const estate = estateMap.get(d.estate_id);
                return (
                  <li
                    key={d.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate text-sm font-semibold">
                          {d.name}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {TYPE_LABEL[d.device_type]}
                        {d.location ? ` · ${d.location}` : ""}
                      </div>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <div className="truncate text-xs text-muted-foreground">
                        Estate
                      </div>
                      <div className="truncate text-sm">
                        {estate?.name ?? "—"}
                      </div>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <div className="truncate text-xs text-muted-foreground">
                        Last sync
                      </div>
                      <div className="truncate text-xs">
                        {d.last_sync_at
                          ? formatDistanceToNow(new Date(d.last_sync_at), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge tone={STATUS_TONE[d.status]}>
                        {d.status}
                      </StatusBadge>
                      <StatusMenu
                        current={d.status}
                        onSet={(status) =>
                          setStatus.mutate({ id: d.id, status })
                        }
                        pending={setStatus.isPending}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </StaggerItem>

      <FadeIn>
        <p className="text-[11px] text-muted-foreground">
          Physical scans, biometric templates, and secret device tokens live on
          the external hardware — never in the app. This page only manages
          registration, status, and estate assignment.
        </p>
      </FadeIn>

      {creating && (
        <RegisterDeviceDialog
          estates={estatesQ.data ?? []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["all-access-devices"] });
          }}
        />
      )}
    </Stagger>
  );
}

function StatusMenu({
  current,
  onSet,
  pending,
}: {
  current: DeviceStatus;
  onSet: (s: DeviceStatus) => void;
  pending: boolean;
}) {
  return (
    <div className="flex gap-1">
      {current !== "online" && (
        <IconBtn label="Mark online" onClick={() => onSet("online")} pending={pending}>
          <Wifi className="h-3.5 w-3.5" />
        </IconBtn>
      )}
      {current !== "offline" && current !== "disabled" && (
        <IconBtn
          label="Mark offline"
          onClick={() => onSet("offline")}
          pending={pending}
        >
          <WifiOff className="h-3.5 w-3.5" />
        </IconBtn>
      )}
      {current !== "maintenance" && (
        <IconBtn
          label="Maintenance"
          onClick={() => onSet("maintenance")}
          pending={pending}
        >
          <Wrench className="h-3.5 w-3.5" />
        </IconBtn>
      )}
      {current !== "disabled" && (
        <IconBtn label="Disable" onClick={() => onSet("disabled")} pending={pending}>
          <Ban className="h-3.5 w-3.5" />
        </IconBtn>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  pending,
  children,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

function RegisterDeviceDialog({
  estates: _estates,
  onClose,
  onCreated,
}: {
  estates: Estate[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [deviceType, setDeviceType] = useState<DeviceType>("fingerprint");
  const [location, setLocation] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (name.trim().length < 2) throw new Error("Device name required");
      const { error } = await supabase.rpc("admin_register_device" as never, {
        _name: name.trim(),
        _device_type: deviceType,
        _location: location.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Device registered");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4">
        <h3 className="text-base font-semibold">Register access device</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Devices attach to your current estate. Super admins can reassign later
          from each estate's detail page.
        </p>
        <div className="mt-3 space-y-3">
          <Labeled label="Device name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main gate fingerprint"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Labeled>
          <Labeled label="Device type">
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as DeviceType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(TYPE_LABEL) as DeviceType[]).map((k) => (
                <option key={k} value={k}>
                  {TYPE_LABEL[k]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Location / gate">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Gate 1 – Main entrance"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Labeled>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {submit.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Register
          </button>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
