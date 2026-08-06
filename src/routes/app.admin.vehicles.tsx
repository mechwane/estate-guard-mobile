import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
  SheetModal,
  StatCard,
  StatusBadge,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";

export const Route = createFileRoute("/app/admin/vehicles")({
  component: VehicleTags,
  head: () => ({
    meta: [
      { title: "Vehicle Tags — Estate Guard" },
      {
        name: "description",
        content:
          "Register, activate and revoke resident vehicle tags used at the estate gate.",
      },
    ],
  }),
});

type Tag = {
  id: string;
  resident_id: string;
  plate: string;
  tag_number: string | null;
  make_model: string | null;
  color: string | null;
  active: boolean;
  created_at: string;
};

type Tab = "all" | "active" | "inactive";

function maskValue(value: string) {
  const v = value.trim();
  if (v.length <= 3) return v;
  return `${"•".repeat(Math.min(6, v.length - 3))}${v.slice(-3)}`;
}

function VehicleTags() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [adding, setAdding] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [toDelete, setToDelete] = useState<Tag | null>(null);


  const tagsQ = useQuery({
    queryKey: ["admin-vehicle-tags", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_tags")
        .select("id,resident_id,plate,tag_number,make_model,color,active,created_at")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });

  const residentsQ = useQuery({
    queryKey: ["profiles-for-vehicles", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,unit,house_number")
        .eq("estate_id", estateId!)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const residentMap = useMemo(
    () => new Map((residentsQ.data ?? []).map((r) => [r.id, r])),
    [residentsQ.data],
  );

  const rows = tagsQ.data ?? [];
  const counts = {
    total: rows.length,
    active: rows.filter((t) => t.active).length,
    inactive: rows.filter((t) => !t.active).length,
    tagged: rows.filter((t) => !!t.tag_number).length,
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (tab === "active" && !t.active) return false;
      if (tab === "inactive" && t.active) return false;
      if (!needle) return true;
      const r = residentMap.get(t.resident_id);
      return (
        t.plate.toLowerCase().includes(needle) ||
        (t.tag_number ?? "").toLowerCase().includes(needle) ||
        (t.make_model ?? "").toLowerCase().includes(needle) ||
        (r?.full_name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, q, tab, residentMap]);

  const toggle = useMutation({
    mutationFn: async (t: Tag) => {
      const { error } = await supabase
        .from("vehicle_tags")
        .update({ active: !t.active })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vehicle updated");
      qc.invalidateQueries({ queryKey: ["admin-vehicle-tags", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (t: Tag) => {
      const { error } = await supabase.from("vehicle_tags").delete().eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vehicle removed");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["admin-vehicle-tags", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <Stagger className="mx-auto w-full max-w-6xl space-y-4">
      <StaggerItem>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <h1 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
            <Car className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">Vehicle tags</span>
          </h1>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" /> Register vehicle
          </button>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Vehicles" value={counts.total} />
          <StatCard label="Active" value={counts.active} tone="success" />
          <StatCard
            label="Deactivated"
            value={counts.inactive}
            tone={counts.inactive ? "warning" : "default"}
          />
          <StatCard label="With gate tag" value={counts.tagged} tone="primary" />
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ScrollTabs
            value={tab}
            onChange={setTab}
            className="sm:flex-1"
            tabs={[
              { key: "all", label: `All (${counts.total})` },
              { key: "active", label: `Active (${counts.active})` },
              { key: "inactive", label: `Deactivated (${counts.inactive})` },
            ]}
          />
          <div className="sm:w-64">
            <SearchInput value={q} onChange={setQ} placeholder="Plate, tag or resident" />
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        {tagsQ.isLoading ? (
          <ListSkeleton rows={4} />
        ) : tagsQ.isError ? (
          <ErrorState onRetry={() => tagsQ.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No vehicles registered"
            description="Register a resident vehicle so guards can match plates at the gate."
            icon={<Car className="h-6 w-6" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => {
              const r = residentMap.get(v.resident_id);
              return (
                <Card key={v.id} className="space-y-2.5 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-semibold uppercase text-foreground">
                        {reveal[v.id] ? v.plate : maskValue(v.plate)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {v.make_model || "Vehicle"}
                        {v.color ? ` · ${v.color}` : ""}
                      </div>
                    </div>
                    <StatusBadge tone={v.active ? "success" : "neutral"}>
                      {v.active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>

                  <dl className="grid grid-cols-2 gap-1 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Resident
                      </dt>
                      <dd className="truncate text-foreground">{r?.full_name ?? "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Unit
                      </dt>
                      <dd className="truncate text-foreground">
                        {r?.house_number ?? r?.unit ?? "—"}
                      </dd>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Gate tag
                      </dt>
                      <dd className="truncate font-mono text-foreground">
                        {v.tag_number ? (reveal[v.id] ? v.tag_number : maskValue(v.tag_number)) : "—"}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setReveal((s) => ({ ...s, [v.id]: !s[v.id] }))}
                      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {reveal[v.id] ? "Hide details" : "Reveal details"}
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        title={v.active ? "Deactivate" : "Activate"}
                        aria-label={v.active ? "Deactivate" : "Activate"}
                        onClick={() => toggle.mutate(v)}
                        disabled={toggle.isPending}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Remove"
                        aria-label="Remove"
                        onClick={() => setToDelete(v)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </StaggerItem>


      {adding && (
        <AddVehicleDialog
          estateId={estateId}
          residents={residentsQ.data ?? []}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            qc.invalidateQueries({ queryKey: ["admin-vehicle-tags", estateId] });
          }}
        />
      )}

      <ConfirmActionDialog
        open={!!toDelete}
        title="Remove vehicle?"
        description={
          toDelete
            ? `${toDelete.plate} will no longer be recognised at the gate.`
            : undefined
        }
        confirmLabel="Remove"
        tone="destructive"
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </Stagger>
  );
}

function AddVehicleDialog({
  estateId,
  residents,
  onClose,
  onCreated,
}: {
  estateId: string;
  residents: { id: string; full_name: string; unit: string | null; house_number: string | null }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [residentId, setResidentId] = useState(residents[0]?.id ?? "");
  const [plate, setPlate] = useState("");
  const [tagNumber, setTagNumber] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [color, setColor] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!residentId) throw new Error("Select a resident");
      if (plate.trim().length < 3) throw new Error("Enter a valid plate number");
      const { error } = await supabase.from("vehicle_tags").insert({
        estate_id: estateId,
        resident_id: residentId,
        plate: plate.trim().toUpperCase(),
        tag_number: tagNumber.trim() || null,
        make_model: makeModel.trim() || null,
        color: color.trim() || null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vehicle registered");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SheetModal
      open
      title="Register vehicle"
      onClose={onClose}
      footer={
        <button
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Register
        </button>
      }
    >
      <div>
        <p className="mb-3 text-xs text-muted-foreground">
          Attach a plate to a resident so guards can verify entry at the gate.
        </p>
        <div className="space-y-3">

          <Labeled label="Resident">
            <select
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                  {r.house_number || r.unit ? ` · ${r.house_number ?? r.unit}` : ""}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Plate number">
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="e.g. LAG-123-XY"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase"
            />
          </Labeled>
          <div className="grid grid-cols-2 gap-2">
            <Labeled label="Make / model">
              <input
                value={makeModel}
                onChange={(e) => setMakeModel(e.target.value)}
                placeholder="Toyota Corolla"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Labeled>
            <Labeled label="Colour">
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Black"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Labeled>
          </div>
          <Labeled label="Gate tag number (optional)">
            <input
              value={tagNumber}
              onChange={(e) => setTagNumber(e.target.value)}
              placeholder="RFID / sticker reference"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Labeled>
        </div>
      </div>
    </SheetModal>
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
