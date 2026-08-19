import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SearchInput,
} from "@/components/ui-kit";
import { UsersRound } from "lucide-react";

export const Route = createFileRoute("/app/admin/dependents")({
  component: Dependents,
  head: () => ({
    meta: [
      { title: "Dependants — Estate Guard" },
      {
        name: "description",
        content: "All dependants and household staff registered by residents.",
      },
      { property: "og:title", content: "Dependants — Estate Guard" },
      {
        property: "og:description",
        content: "All dependants and household staff registered by residents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "all" | "pending" | "active" | "disapproved" | "disabled";
const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "disapproved", label: "Disapproved" },
  { key: "disabled", label: "Disabled" },
] as const;

const isStaff = (rel?: string | null) =>
  /staff|maid|driver|help|cleaner|nanny|cook|security/i.test(rel ?? "");

type HostRow = {
  id: string;
  full_name: string;
  approved: boolean | null;
  verification_status: string | null;
};

const statusOfHost = (h?: HostRow): Exclude<Tab, "all"> =>
  h?.approved
    ? "active"
    : h?.verification_status === "rejected"
      ? "disapproved"
      : h?.verification_status === "pending"
        ? "pending"
        : "disabled";


function Dependents() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const rows = useQuery({
    queryKey: ["admin-dependents", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dependents")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const residents = useQuery({
    queryKey: ["profiles-for-deps", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,unit")
        .eq("estate_id", estateId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (id: string) =>
    residents.data?.find((r) => r.id === id)?.full_name ?? id.slice(0, 8);

  const counts = useMemo(() => {
    const all = rows.data ?? [];
    return {
      all: all.length,
      staff: all.filter((d) => isStaff(d.relationship)).length,
      relative: all.filter((d) => !isStaff(d.relationship)).length,
    };
  }, [rows.data]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows.data ?? [])
      .filter((d) =>
        tab === "all" ? true : tab === "staff" ? isStaff(d.relationship) : !isStaff(d.relationship),
      )
      .filter(
        (d) =>
          !needle ||
          d.full_name.toLowerCase().includes(needle) ||
          (d.relationship ?? "").toLowerCase().includes(needle),
      );
  }, [rows.data, tab, q]);

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="space-y-3">
      <ScrollTabs
        value={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ key: t.key, label: `${t.label} ${counts[t.key]}` }))}
      />
      <div className="sm:max-w-xl">
        <SearchInput value={q} onChange={setQ} placeholder="Search dependants" />
      </div>

      {rows.isLoading ? (
        <ListSkeleton rows={6} />
      ) : rows.isError ? (
        <ErrorState onRetry={() => rows.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No dependants"
          description="Residents can add household members from their profile."
          icon={<UsersRound className="h-6 w-6" />}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((d) => (
            <Card key={d.id} className="p-3">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {d.full_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{d.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {isStaff(d.relationship) ? "Domestic staff" : "Relative"}
                    {d.relationship ? `(${d.relationship})` : ""} of {nameOf(d.resident_id)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {d.age ? `${d.age}y` : ""}
                    {d.age && d.phone ? " · " : ""}
                    {d.phone ?? ""}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
