import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Fingerprint,
  ScanFace,
  IdCard,
  Car,
  KeyRound,
  Ticket,
  ExternalLink,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  StatusBadge,
} from "@/components/ui-kit";
import { FadeIn } from "@/components/motion-kit";

export const Route = createFileRoute("/app/resident/access")({
  component: MyAccessMethods,
  head: () => ({
    meta: [
      { title: "My Access Methods — Estate Guard" },
      {
        name: "description",
        content:
          "See the status of your fingerprint, face, access card, vehicle tag, and guest invites at the estate.",
      },
    ],
  }),
});

type BiometricRow = {
  id: string;
  biometric_type: string;
  enrollment_status: string;
  access_status: string;
  device_id: string | null;
  last_used_at: string | null;
  updated_at: string | null;
};

type CardRow = {
  id: string;
  card_number: string | null;
  active: boolean;
  issued_at: string | null;
  revoked_at: string | null;
};

type VehicleRow = {
  id: string;
  plate: string;
  tag_number: string | null;
  make_model: string | null;
  color: string | null;
  active: boolean;
};

type DeviceRow = { id: string; name: string; location: string | null };

function MyAccessMethods() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const q = useQuery({
    queryKey: ["resident-access-methods", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [bio, cards, tags, devs] = await Promise.all([
        supabase
          .from("biometric_access")
          .select("id,biometric_type,enrollment_status,access_status,device_id,last_used_at,updated_at")
          .eq("resident_id", userId!),
        supabase
          .from("access_cards")
          .select("id,card_number,active,issued_at,revoked_at")
          .eq("resident_id", userId!)
          .order("issued_at", { ascending: false }),
        supabase
          .from("vehicle_tags")
          .select("id,plate,tag_number,make_model,color,active")
          .eq("resident_id", userId!),
        supabase.from("access_devices").select("id,name,location"),
      ]);
      const err = [bio.error, cards.error, tags.error, devs.error].find(Boolean);
      if (err) throw err;
      const deviceMap = new Map<string, DeviceRow>(
        ((devs.data ?? []) as DeviceRow[]).map((d) => [d.id, d]),
      );
      return {
        biometrics: (bio.data ?? []) as BiometricRow[],
        cards: (cards.data ?? []) as CardRow[],
        vehicles: (tags.data ?? []) as VehicleRow[],
        deviceMap,
      };
    },
  });

  const requestAccess = useMutation({
    mutationFn: async ({ category, title }: { category: string; title: string }) => {
      const { error } = await supabase.from("resident_requests").insert({
        resident_id: userId!,
        estate_id: session!.estate!.id,
        category,
        title,
        details: `Resident-initiated request via My Access Methods for: ${title}`,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request submitted to your estate admin");
      qc.invalidateQueries({ queryKey: ["resident-access-methods", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <ListSkeleton rows={4} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  const fingerprint = q.data.biometrics.find((b) => b.biometric_type === "fingerprint");
  const face = q.data.biometrics.find((b) => b.biometric_type === "face");
  const activeCard = q.data.cards.find((c) => c.active);
  const activeVehicles = q.data.vehicles.filter((v) => v.active);

  return (
    <FadeIn>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">My access methods</h1>
          <p className="text-xs text-muted-foreground">
            Status of your credentials at the estate gate. Fingerprint and face
            recognition are enrolled at estate access devices, not your phone.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <BiometricCard
            icon={<Fingerprint className="h-5 w-5" />}
            title="Fingerprint"
            row={fingerprint}
            deviceMap={q.data.deviceMap}
            onRequest={() =>
              requestAccess.mutate({
                category: "biometric_enrollment",
                title: "Fingerprint enrollment",
              })
            }
            pending={requestAccess.isPending}
          />
          <BiometricCard
            icon={<ScanFace className="h-5 w-5" />}
            title="Face recognition"
            row={face}
            deviceMap={q.data.deviceMap}
            onRequest={() =>
              requestAccess.mutate({
                category: "biometric_enrollment",
                title: "Face recognition enrollment",
              })
            }
            pending={requestAccess.isPending}
          />
          <MethodCard
            icon={<IdCard className="h-5 w-5" />}
            title="Access card"
            status={
              activeCard
                ? { tone: "success", label: "Active" }
                : q.data.cards.length > 0
                  ? { tone: "warning", label: "Revoked" }
                  : { tone: "neutral", label: "Not issued" }
            }
            body={
              activeCard ? (
                <div className="text-xs text-muted-foreground">
                  Card {activeCard.card_number ?? "—"} · issued{" "}
                  {activeCard.issued_at
                    ? formatDistanceToNow(new Date(activeCard.issued_at), { addSuffix: true })
                    : "—"}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Request an access card from your estate admin.
                </div>
              )
            }
            actionLabel={activeCard ? undefined : "Request card"}
            onAction={() =>
              requestAccess.mutate({ category: "access_card", title: "Access card request" })
            }
            pending={requestAccess.isPending}
          />
          <MethodCard
            icon={<Car className="h-5 w-5" />}
            title="Vehicle tag"
            status={
              activeVehicles.length
                ? { tone: "success", label: `${activeVehicles.length} active` }
                : { tone: "neutral", label: "None registered" }
            }
            body={
              activeVehicles.length ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {activeVehicles.slice(0, 3).map((v) => (
                    <li key={v.id} className="truncate">
                      <span className="font-medium text-foreground">{v.plate}</span>
                      {v.make_model ? ` · ${v.make_model}` : ""}
                      {v.tag_number ? ` · tag ${v.tag_number}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Register a vehicle to use tag-based gate access.
                </div>
              )
            }
            actionLabel="Request vehicle tag"
            onAction={() =>
              requestAccess.mutate({ category: "vehicle_tag", title: "Vehicle tag request" })
            }
            pending={requestAccess.isPending}
          />
          <MethodCard
            icon={<Ticket className="h-5 w-5" />}
            title="Guest / visitor code"
            status={{ tone: "success", label: "Available" }}
            body={
              <div className="text-xs text-muted-foreground">
                Generate one-time codes for visitors from the invite screen.
              </div>
            }
            actionLabel="Invite a guest"
            actionHref="/app/resident/invite"
          />
          <MethodCard
            icon={<KeyRound className="h-5 w-5" />}
            title="Resident pass"
            status={{ tone: "success", label: "Available" }}
            body={
              <div className="text-xs text-muted-foreground">
                Issue a personal pass code for yourself or a household guest.
              </div>
            }
            actionLabel="Open my pass"
            actionHref="/app/resident/pass"
          />
        </div>

        <Card className="border-dashed">
          <div className="flex items-start gap-3">
            <ExternalLink className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Fingerprint and face recognition require enrollment at an estate access
              device. Your admin will schedule you once you submit a request; no
              biometric images or templates are stored in the app.
            </p>
          </div>
        </Card>
      </div>
    </FadeIn>
  );
}

function BiometricCard({
  icon,
  title,
  row,
  deviceMap,
  onRequest,
  pending,
}: {
  icon: ReactNode;
  title: string;
  row?: BiometricRow;
  deviceMap: Map<string, DeviceRow>;
  onRequest: () => void;
  pending: boolean;
}) {
  const enrollment = row?.enrollment_status ?? "not_enrolled";
  const access = row?.access_status ?? "disabled";
  const enrollTone = mapEnrollTone(enrollment);
  const accessTone = access === "enabled" ? "success" : "neutral";
  const device = row?.device_id ? deviceMap.get(row.device_id) : null;
  const canRequest = enrollment === "not_enrolled" || enrollment === "rejected";

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground">
            {device ? `Device: ${device.name}` : "External device enrollment required"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge tone={enrollTone}>{labelFor(enrollment)}</StatusBadge>
        <StatusBadge tone={accessTone}>
          Access {access === "enabled" ? "enabled" : "disabled"}
        </StatusBadge>
      </div>
      <div className="text-xs text-muted-foreground">
        {row?.last_used_at
          ? `Last used ${formatDistanceToNow(new Date(row.last_used_at), { addSuffix: true })}`
          : "No recorded use yet."}
      </div>
      {canRequest ? (
        <button
          type="button"
          onClick={onRequest}
          disabled={pending}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          Request enrollment
        </button>
      ) : enrollment === "pending" ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground">
          Waiting for admin to schedule enrollment
        </div>
      ) : null}
    </Card>
  );
}

function MethodCard({
  icon,
  title,
  status,
  body,
  actionLabel,
  actionHref,
  onAction,
  pending,
}: {
  icon: ReactNode;
  title: string;
  status: { tone: "success" | "warning" | "neutral" | "error"; label: string };
  body: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  pending?: boolean;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      {body}
      {actionLabel &&
        (actionHref ? (
          <a
            href={actionHref}
            className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-center text-xs font-medium hover:bg-muted"
          >
            {actionLabel}
          </a>
        ) : (
          <button
            type="button"
            onClick={onAction}
            disabled={pending}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            {actionLabel}
          </button>
        ))}
    </Card>
  );
}

function mapEnrollTone(status: string): "success" | "warning" | "neutral" | "error" {
  switch (status) {
    case "enrolled":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
      return "error";
    default:
      return "neutral";
  }
}

function labelFor(status: string) {
  const map: Record<string, string> = {
    enrolled: "Enrolled",
    pending: "Pending",
    rejected: "Rejected",
    not_enrolled: "Not enrolled",
    disabled: "Disabled",
  };
  return map[status] ?? status;
}
