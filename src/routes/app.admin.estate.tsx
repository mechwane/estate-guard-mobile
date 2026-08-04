import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton } from "@/components/ui-kit";
import { Building2, ChevronDown, Contact, Hash, Home, Bell } from "lucide-react";

export const Route = createFileRoute("/app/admin/estate")({
  component: EstateProfile,
  head: () => ({
    meta: [
      { title: "Estate Profile — Estate Guard" },
      { name: "description", content: "Estate address setup, access code and estate contacts." },
      { property: "og:title", content: "Estate Profile — Estate Guard" },
      { property: "og:description", content: "Estate address setup, access code and estate contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Section({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden p-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border/60 p-4">{children}</div>}
    </Card>
  );
}

function EstateProfile() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();

  const estate = useQuery({
    queryKey: ["admin-estate", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase.from("estates").select("*").eq("id", estateId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const contacts = useQuery({
    queryKey: ["admin-estate-contacts", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estate_contacts")
        .select("*")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activity = useQuery({
    queryKey: ["admin-estate-activity", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_invites")
        .select("id,guest_name,code,checked_in_at,checked_out_at,created_at")
        .eq("estate_id", estateId!)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 20_000,
  });

  const [form, setForm] = useState({ address: "", city: "", state: "", contact_email: "", contact_phone: "" });
  useEffect(() => {
    if (!estate.data) return;
    setForm({
      address: estate.data.address ?? "",
      city: estate.data.city ?? "",
      state: estate.data.state ?? "",
      contact_email: estate.data.contact_email ?? "",
      contact_phone: estate.data.contact_phone ?? "",
    });
  }, [estate.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("estates").update(form).eq("id", estateId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate details updated");
      qc.invalidateQueries({ queryKey: ["admin-estate", estateId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update estate"),
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <Card className="overflow-hidden p-0">
          <div className="flex min-h-36 flex-col items-center justify-center bg-gradient-to-br from-primary/25 via-primary/10 to-transparent px-6 py-8 text-center">
            <Building2 className="mb-2 h-7 w-7 text-primary" />
            <div className="text-xl font-bold tracking-tight">{estate.data?.name ?? "Estate"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {[estate.data?.address, estate.data?.city, estate.data?.state].filter(Boolean).join(", ") || "No address set"}
            </div>
            <div className="mt-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold tracking-wider">
              {estate.data?.code}
            </div>
          </div>
        </Card>

        <Section title="Address Setup" icon={<Home className="h-4 w-4" />} defaultOpen>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["address", "Street address"],
                ["city", "City"],
                ["state", "State"],
                ["contact_email", "Contact email"],
                ["contact_phone", "Contact phone"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs font-medium text-muted-foreground">
                {label}
                <input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
            ))}
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </Section>

        <Section title="Code Setup" icon={<Hash className="h-4 w-4" />}>
          <p className="text-sm text-muted-foreground">
            Residents join this estate with the code below. Share it only with verified residents.
          </p>
          <div className="mt-3 inline-flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2">
            <span className="font-mono text-lg font-semibold tracking-widest">{estate.data?.code}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(estate.data?.code ?? "");
                toast.success("Estate code copied");
              }}
              className="text-xs font-medium text-primary"
            >
              Copy
            </button>
          </div>
        </Section>

        <Section title="Estate Contacts" icon={<Contact className="h-4 w-4" />} defaultOpen>
          {contacts.isLoading ? (
            <ListSkeleton rows={3} />
          ) : contacts.isError ? (
            <ErrorState onRetry={() => contacts.refetch()} />
          ) : contacts.data?.length === 0 ? (
            <EmptyState title="No contacts yet" description="Estate contacts appear here once added." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {contacts.data?.map((c) => (
                <div key={c.id} className="rounded-lg border border-border/60 bg-card px-3 py-2">
                  <div className="truncate text-sm font-medium">{c.label}</div>
                  <div className="truncate text-xs text-primary">{c.role ?? "Contact"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{c.phone ?? c.email ?? ""}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 text-sm font-semibold">
          <Bell className="h-4 w-4 text-muted-foreground" /> Recent Activities
        </div>
        <div className="max-h-[32rem] overflow-y-auto p-2">
          {activity.isLoading ? (
            <ListSkeleton rows={6} />
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="space-y-1">
              {activity.data?.map((a) => {
                const at = a.checked_out_at ?? a.checked_in_at ?? a.created_at;
                const label = a.checked_out_at ? "Check Out" : a.checked_in_at ? "Check In" : "Code created";
                return (
                  <li key={a.id} className="rounded-lg px-3 py-2 hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{label}</div>
                        <div className="truncate text-xs text-muted-foreground">{a.guest_name}</div>
                        <div className="text-[11px] italic text-muted-foreground/80">{a.code}</div>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(at), { addSuffix: true })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
