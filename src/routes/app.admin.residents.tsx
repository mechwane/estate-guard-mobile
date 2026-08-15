import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { initialsFor, useAvatarUrls } from "@/lib/avatar";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
  SheetModal,
  StatusBadge,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { ResidentProfilePanel } from "@/components/resident-profile-panel";

const VIEWS = [
  { key: "all", label: "Total residents" },
  { key: "verified", label: "Verified" },
  { key: "unverified", label: "Unverified" },
  { key: "pending", label: "Pending approval" },
  { key: "revoked", label: "Revoked" },
  { key: "guards", label: "Guards" },
] as const;

type View = (typeof VIEWS)[number]["key"];

export const Route = createFileRoute("/app/admin/residents")({
  component: PeopleDirectory,
  validateSearch: (search: Record<string, unknown>) => ({
    view: typeof search.view === "string" ? search.view : undefined,
  }),
  head: () => ({
    meta: [
      { title: "People Directory — Estate Guard" },
      {
        name: "description",
        content:
          "Estate people directory: residents, guards, verification state and approval status with full profiles.",
      },
      { property: "og:title", content: "People Directory — Estate Guard" },
      {
        property: "og:description",
        content: "Browse residents and guards by verification and approval state.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PeopleDirectory() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const navigate = useNavigate();
  const search = Route.useSearch();
  const view: View = (VIEWS.some((v) => v.key === search.view) ? search.view : "all") as View;
  const [q, setQ] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);

  const people = useQuery({
    queryKey: ["admin-directory", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,full_name,email,phone,avatar_url,approved,verification_status,house_number,block,street,unit,address_code,occupant_type,created_at,updated_at",
          )
          .eq("estate_id", estateId!)
          .order("full_name", { ascending: true }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (profiles.error) throw profiles.error;
      const roleMap = new Map<string, string[]>();
      (roles.data ?? []).forEach((r) => {
        roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), String(r.role)]);
      });
      return (profiles.data ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const rows = people.data ?? [];
  const avatarMap = useAvatarUrls(rows.map((r) => r.avatar_url));

  const counts = useMemo(
    () => ({
      all: rows.filter((r) => !r.roles.includes("guard")).length,
      verified: rows.filter((r) => r.verification_status === "approved").length,
      unverified: rows.filter((r) => r.verification_status !== "approved").length,
      pending: rows.filter((r) => r.verification_status === "pending" || !r.approved).length,
      revoked: rows.filter((r) => !r.approved).length,
      guards: rows.filter((r) => r.roles.includes("guard")).length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        const isGuard = r.roles.includes("guard");
        switch (view) {
          case "guards":
            return isGuard;
          case "verified":
            return !isGuard && r.verification_status === "approved";
          case "unverified":
            return !isGuard && r.verification_status !== "approved";
          case "pending":
            return !isGuard && (r.verification_status === "pending" || !r.approved);
          case "revoked":
            return !isGuard && !r.approved;
          default:
            return !isGuard;
        }
      })
      .filter(
        (r) =>
          !needle ||
          (r.full_name ?? "").toLowerCase().includes(needle) ||
          (r.email ?? "").toLowerCase().includes(needle) ||
          (r.phone ?? "").toLowerCase().includes(needle) ||
          (r.house_number ?? "").toLowerCase().includes(needle) ||
          (r.address_code ?? "").toLowerCase().includes(needle) ||
          (r.street ?? "").toLowerCase().includes(needle),
      );
  }, [rows, view, q]);

  if (!estateId)
    return (
      <EmptyState
        title="No estate assigned"
        description="Your admin account is not linked to an estate yet."
      />
    );

  return (
    <div className="space-y-4">
      <ScrollTabs
        value={view}
        onChange={(next) => navigate({ to: "/app/admin/residents", search: { view: next } })}
        tabs={VIEWS.map((v) => ({ key: v.key, label: `${v.label} (${counts[v.key]})` }))}
      />

      <div className="sm:max-w-sm">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, or address…" />
      </div>

      {people.isLoading ? (
        <ListSkeleton rows={4} />
      ) : people.isError ? (
        <ErrorState onRetry={() => people.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nobody here yet"
          description="People appear here as soon as they register on this estate."
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((r) => {
            const signed = r.avatar_url ? avatarMap[r.avatar_url] : null;
            const address =
              [r.house_number && `No ${r.house_number}`, r.block, r.street, r.unit && `Unit ${r.unit}`]
                .filter(Boolean)
                .join(", ") ||
              r.address_code ||
              "No address on file";
            return (
              <StaggerItem key={r.id}>
                <button
                  onClick={() => setProfileId(r.id)}
                  className="card-surface lift-3d flex w-full items-center gap-3 p-3 text-left transition hover:bg-muted/40"
                >
                  {signed ? (
                    <img
                      src={signed}
                      alt={`${r.full_name || "Member"} profile photo`}
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                    />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-2 ring-primary/20">
                      {initialsFor(r.full_name || r.email)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {r.full_name || r.email || "Unnamed"}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {address}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge tone={r.approved ? "success" : "error"}>
                        {r.approved ? "Active" : "Disabled"}
                      </StatusBadge>
                      <StatusBadge
                        tone={
                          r.verification_status === "approved"
                            ? "primary"
                            : r.verification_status === "rejected"
                              ? "error"
                              : "warning"
                        }
                      >
                        {(r.verification_status ?? "not submitted").replace(/_/g, " ")}
                      </StatusBadge>
                      {r.roles.includes("guard") && <StatusBadge tone="accent">guard</StatusBadge>}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Last seen{" "}
                      {formatDistanceToNow(new Date(r.updated_at ?? r.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                </button>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <SheetModal
        open={!!profileId}
        title="Profile"
        onClose={() => setProfileId(null)}
        width="lg"
      >
        {profileId && <ResidentProfilePanel id={profileId} />}
      </SheetModal>
    </div>
  );
}
