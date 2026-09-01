import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton, SectionTitle, StatusBadge } from "@/components/ui-kit";
import { addressOf, houseTypeOf, matchesAddressKey, type HouseholdProfile } from "@/lib/households";
import { ResidentProfilePanel } from "@/components/resident-profile-panel";
import { ArrowLeft, Home } from "lucide-react";

export const Route = createFileRoute("/app/admin/household/$key")({
  component: HouseholdDetail,
  head: () => ({
    meta: [
      { title: "Household — Estate Guard" },
      { name: "description", content: "Household details, occupants and status for one estate address." },
      { property: "og:title", content: "Household — Estate Guard" },
      {
        property: "og:description",
        content: "Household details, occupants and status for one estate address.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function HouseholdDetail() {
  const { key } = Route.useParams();
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const rows = useQuery({
    queryKey: ["household-detail", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,full_name,approved,verification_status,occupant_type,block,street,house_number,unit",
        )
        .eq("estate_id", estateId!);
      if (error) throw error;
      return (data ?? []) as HouseholdProfile[];
    },
  });

  const household = useMemo(() => {
    const members = (rows.data ?? []).filter((p) => matchesAddressKey(addressOf(p), key));
    if (members.length === 0) return null;
    const address = addressOf(members[0]);
    return {
      address,
      members,
      status: members.some((m) => m.approved)
        ? "active"
        : members.some((m) => m.verification_status === "rejected")
          ? "disapproved"
          : "disabled",
    };
  }, [rows.data, key]);

  if (!estateId) return <EmptyState title="No estate assigned" />;
  if (rows.isLoading) return <ListSkeleton rows={6} />;
  if (rows.isError) return <ErrorState onRetry={() => rows.refetch()} />;
  if (!household) return <EmptyState title="Household not found" icon={<Home className="h-6 w-6" />} />;

  return (
    <div className="space-y-4">
      <Link
        to="/app/admin/households"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Households
      </Link>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{household.address}</h1>
          <StatusBadge
            tone={
              household.status === "active"
                ? "success"
                : household.status === "disapproved"
                  ? "error"
                  : "neutral"
            }
          >
            {household.status}
          </StatusBadge>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["House type", houseTypeOf(household.address)],
            ["Street", household.members[0].street ?? "—"],
            ["House number", household.members[0].house_number ?? "—"],
            ["Block", household.members[0].block ?? "—"],
            ["Unit", household.members[0].unit ?? "—"],
            ["Occupants", String(household.members.length)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {household.members.length === 1 ? (
        <div className="space-y-2">
          <SectionTitle>Occupant profile</SectionTitle>
          <ResidentProfilePanel id={household.members[0].id} />
        </div>
      ) : null}

      <div className="space-y-2">
        <SectionTitle>Occupants</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {household.members.map((m) => (
            <Link key={m.id} to="/app/admin/resident/$id" params={{ id: m.id }} className="block">
              <Card className="flex items-center gap-3 p-3 transition hover:border-primary/40 hover:bg-muted/40">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {m.full_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.occupant_type === "commercial" ? "Commercial" : "Resident"} ·{" "}
                    {m.approved ? "Active" : "Inactive"}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
