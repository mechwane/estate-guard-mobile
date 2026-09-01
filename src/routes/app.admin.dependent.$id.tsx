import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SectionTitle,
  StatusBadge,
} from "@/components/ui-kit";
import { ArrowLeft, Fingerprint, Phone, ScanFace, UsersRound } from "lucide-react";
import { ResidentProfilePanel } from "@/components/resident-profile-panel";

export const Route = createFileRoute("/app/admin/dependent/$id")({
  component: DependentDetail,
  head: () => ({
    meta: [
      { title: "Dependant — Estate Guard" },
      {
        name: "description",
        content: "Dependant details, host resident, access methods and contact actions.",
      },
      { property: "og:title", content: "Dependant — Estate Guard" },
      {
        property: "og:description",
        content: "Dependant details, host resident, access methods and contact actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const isStaff = (rel?: string | null) =>
  /staff|maid|driver|help|cleaner|nanny|cook|security/i.test(rel ?? "");

function DependentDetail() {
  const { id } = Route.useParams();
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const row = useQuery({
    queryKey: ["admin-dependent", id],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dependents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const host = useQuery({
    queryKey: ["admin-dependent-host", row.data?.resident_id],
    enabled: !!row.data?.resident_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,full_name,phone,approved,verification_status,house_number,street,block,unit,occupant_type",
        )
        .eq("id", row.data!.resident_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const bio = useQuery({
    queryKey: ["admin-dependent-bio", id],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biometric_access")
        .select("biometric_type,enrollment_status,access_status")
        .eq("dependent_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (row.isLoading) return <ListSkeleton rows={5} />;
  if (row.isError) return <ErrorState onRetry={() => row.refetch()} />;
  if (!row.data)
    return <EmptyState title="Dependant not found" icon={<UsersRound className="h-6 w-6" />} />;

  const d = row.data;
  const h = host.data;
  const status = h?.approved
    ? "active"
    : h?.verification_status === "rejected"
      ? "disapproved"
      : h?.verification_status === "pending"
        ? "pending"
        : "disabled";
  const address =
    [h?.house_number, h?.street, h?.block].filter(Boolean).join(" ") || h?.unit || "—";

  const method = (type: "face" | "fingerprint") => {
    const found = bio.data?.find((b) => b.biometric_type === type);
    return {
      enrolled: found?.enrollment_status === "enrolled",
      enabled: found?.access_status === "enabled",
    };
  };

  return (
    <div className="space-y-4">
      <Link
        to="/app/admin/dependents"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Dependants
      </Link>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {d.full_name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h1 className="text-lg font-semibold">{d.full_name}</h1>
              <p className="text-xs text-muted-foreground">
                {isStaff(d.relationship) ? "Domestic staff" : "Relative"}
                {d.relationship ? ` (${d.relationship})` : ""}
              </p>
            </div>
          </div>
          <StatusBadge
            tone={status === "active" ? "success" : status === "disapproved" ? "error" : "neutral"}
          >
            {status}
          </StatusBadge>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["face", "Face Recognition", <ScanFace key="f" className="h-4 w-4" />],
              ["fingerprint", "Fingerprint", <Fingerprint key="p" className="h-4 w-4" />],
            ] as const
          ).map(([key, label, icon]) => {
            const m = method(key);
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {icon} {label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    m.enabled
                      ? "bg-emerald-500/15 text-emerald-600"
                      : m.enrolled
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.enabled ? "Enabled" : m.enrolled ? "Enrolled" : "Not enrolled"}
                </span>
              </div>
            );
          })}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Type", isStaff(d.relationship) ? "Domestic staff" : "Relative"],
            ["Type info", d.relationship ?? "—"],
            ["Age", d.age ? `${d.age} yrs` : "—"],
            ["Phone", d.phone ?? "—"],
            ["Address", address],
            ["Occupant type", h?.occupant_type === "commercial" ? "Commercial" : "Resident"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {d.phone && (
          <a
            href={`tel:${d.phone}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
          >
            <Phone className="h-3.5 w-3.5" /> Place call
          </a>
        )}
      </Card>

      <div className="space-y-2">
        <SectionTitle>Host resident profile</SectionTitle>
        {d.resident_id ? (
          <ResidentProfilePanel id={d.resident_id} />
        ) : (
          <EmptyState title="Host not found" />
        )}
      </div>
    </div>
  );
}
