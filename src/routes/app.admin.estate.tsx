import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SheetModal,
  ConfirmActionDialog,
} from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { initialsFor } from "@/lib/avatar";
import {
  Bell,
  Building2,
  ChevronDown,
  Clock,
  Contact,
  Hash,
  Home,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/app/admin/estate")({
  component: EstateProfile,
  head: () => ({
    meta: [
      { title: "Estate Profile — Estate Guard" },
      {
        name: "description",
        content:
          "Estate branding, address setup, guest-code validity, estate contacts and live gate activity.",
      },
      { property: "og:title", content: "Estate Profile — Estate Guard" },
      {
        property: "og:description",
        content: "Configure estate branding, addresses, code validity and estate contacts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const listToText = (v: string[] | null | undefined) => (v ?? []).join(", ");
const textToList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function Section({
  title,
  icon,
  action,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {children && (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>
        {action}
      </div>
      {open && children && <div className="border-t border-border/60 p-4">{children}</div>}
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      {rows ? (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      )}
    </label>
  );
}

type EstateRow = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  short_name: string | null;
  automatic_billing: boolean;
  streets: string[] | null;
  house_numbers: string[] | null;
  unit_numbers: string[] | null;
  code_validity: string[] | null;
};

function EstateProfile() {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;
  const qc = useQueryClient();

  const [sheet, setSheet] = useState<null | "estate" | "address" | "validity" | "contact">(null);
  const [warn, setWarn] = useState<null | "address" | "validity">(null);

  const estate = useQuery({
    queryKey: ["admin-estate", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estates")
        .select("*")
        .eq("id", estateId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EstateRow | null;
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

  // ---- Update estate (branding + basics) ----
  const [form, setForm] = useState({
    name: "",
    short_name: "",
    logo_url: "",
    automatic_billing: false,
    address: "",
    city: "",
    state: "",
    contact_email: "",
    contact_phone: "",
  });
  const [addressForm, setAddressForm] = useState({ streets: "", house_numbers: "", unit_numbers: "" });
  const [validity, setValidity] = useState("");

  useEffect(() => {
    const e = estate.data;
    if (!e) return;
    setForm({
      name: e.name ?? "",
      short_name: e.short_name ?? "",
      logo_url: e.logo_url ?? "",
      automatic_billing: !!e.automatic_billing,
      address: e.address ?? "",
      city: e.city ?? "",
      state: e.state ?? "",
      contact_email: e.contact_email ?? "",
      contact_phone: e.contact_phone ?? "",
    });
    setAddressForm({
      streets: listToText(e.streets),
      house_numbers: listToText(e.house_numbers),
      unit_numbers: listToText(e.unit_numbers),
    });
    setValidity(listToText(e.code_validity));
  }, [estate.data]);

  const savePatch = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("estates")
        .update(patch as never)
        .eq("id", estateId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estate updated");
      setSheet(null);
      qc.invalidateQueries({ queryKey: ["admin-estate", estateId] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not update estate"),
  });

  // ---- Contacts ----
  const [contactForm, setContactForm] = useState({
    id: "",
    label: "",
    role: "",
    phone: "",
    email: "",
  });
  const saveContact = useMutation({
    mutationFn: async () => {
      const payload = {
        estate_id: estateId!,
        label: contactForm.label.trim(),
        role: contactForm.role.trim() || null,
        phone: contactForm.phone.trim() || null,
        email: contactForm.email.trim() || null,
      };
      if (!payload.label) throw new Error("Contact name is required");
      const { error } = contactForm.id
        ? await supabase.from("estate_contacts").update(payload).eq("id", contactForm.id)
        : await supabase.from("estate_contacts").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact saved");
      setSheet(null);
      qc.invalidateQueries({ queryKey: ["admin-estate-contacts", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estate_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact removed");
      qc.invalidateQueries({ queryKey: ["admin-estate-contacts", estateId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!estateId) return <EmptyState title="No estate assigned" />;

  const e = estate.data;

  return (
    <Stagger className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <StaggerItem className="space-y-3">
        <Card className="overflow-hidden p-0">
          <div className="relative flex min-h-40 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-transparent px-6 py-9 text-center">
            {e?.logo_url && (
              <img
                src={e.logo_url}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-[1px]"
              />
            )}
            <div className="relative">
              {e?.logo_url ? (
                <img
                  src={e.logo_url}
                  alt={`${e?.name ?? "Estate"} logo`}
                  className="mx-auto mb-2 h-14 w-14 rounded-xl border border-border/60 bg-card object-contain p-1"
                />
              ) : (
                <Building2 className="mx-auto mb-2 h-7 w-7 text-primary" />
              )}
              <div className="text-xl font-bold tracking-tight">{e?.name ?? "Estate"}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[e?.address, e?.city, e?.state].filter(Boolean).join(", ") || "No address set"}
              </div>
              <div className="mt-2 inline-flex items-center gap-2">
                <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold tracking-wider">
                  {e?.code}
                </span>
                {e?.short_name && (
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
                    {e.short_name}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSheet("estate")}
              aria-label="Update estate"
              className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        </Card>

        <Section
          title="Address Setup"
          icon={<Home className="h-4 w-4" />}
          action={
            <button
              onClick={() => setWarn("address")}
              aria-label="Edit address setup"
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          }
          defaultOpen
        >
          <dl className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Street names", e?.streets],
                ["House numbers", e?.house_numbers],
                ["Unit numbers", e?.unit_numbers],
              ] as const
            ).map(([label, list]) => (
              <div key={label} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed">
                  {(list ?? []).length > 0 ? listToText(list) : "Not set"}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          title="Code Setup"
          icon={<Hash className="h-4 w-4" />}
          action={
            <button
              onClick={() => setWarn("validity")}
              aria-label="Edit code validity"
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          }
        >
          <p className="text-sm text-muted-foreground">
            Residents join this estate with the code below. Share it only with verified residents.
          </p>
          <div className="mt-3 inline-flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2">
            <span className="font-mono text-lg font-semibold tracking-widest">{e?.code}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(e?.code ?? "");
                toast.success("Estate code copied");
              }}
              className="text-xs font-medium text-primary"
            >
              Copy
            </button>
          </div>
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Guest code validity options
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(e?.code_validity ?? []).length === 0 ? (
                <span className="text-xs text-muted-foreground">Not set</span>
              ) : (
                (e?.code_validity ?? []).map((v) => (
                  <span
                    key={v}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs"
                  >
                    {v}
                  </span>
                ))
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Estate Contacts"
          icon={<Contact className="h-4 w-4" />}
          action={
            <button
              onClick={() => {
                setContactForm({ id: "", label: "", role: "", phone: "", email: "" });
                setSheet("contact");
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add contact
            </button>
          }
          defaultOpen
        >
          {contacts.isLoading ? (
            <ListSkeleton rows={3} />
          ) : contacts.isError ? (
            <ErrorState onRetry={() => contacts.refetch()} />
          ) : contacts.data?.length === 0 ? (
            <EmptyState title="No contacts yet" description="Add estate managers and security." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {contacts.data?.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 transition-shadow hover:shadow-md"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initialsFor(c.label)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.label}</div>
                    <div className="truncate text-xs text-primary">{c.role ?? "Contact"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {c.phone ?? c.email ?? ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      aria-label={`Edit ${c.label}`}
                      onClick={() => {
                        setContactForm({
                          id: c.id,
                          label: c.label,
                          role: c.role ?? "",
                          phone: c.phone ?? "",
                          email: c.email ?? "",
                        });
                        setSheet("contact");
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label={`Remove ${c.label}`}
                      onClick={() => deleteContact.mutate(c.id)}
                      className="rounded-md p-1 text-destructive/80 hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </StaggerItem>

      <StaggerItem>
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
                  const label = a.checked_out_at
                    ? "App Check Out"
                    : a.checked_in_at
                      ? "App Check In"
                      : "Code created";
                  return (
                    <li key={a.id} className="rounded-lg px-3 py-2 hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{label}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {a.guest_name}
                          </div>
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
      </StaggerItem>

      {/* Update estate */}
      <SheetModal
        open={sheet === "estate"}
        title="Update Estate"
        onClose={() => setSheet(null)}
        width="md"
        footer={
          <button
            onClick={() =>
              savePatch.mutate({
                name: form.name.trim(),
                short_name: form.short_name.trim() || null,
                logo_url: form.logo_url.trim() || null,
                automatic_billing: form.automatic_billing,
                address: form.address.trim() || null,
                city: form.city.trim() || null,
                state: form.state.trim() || null,
                contact_email: form.contact_email.trim() || null,
                contact_phone: form.contact_phone.trim() || null,
              })
            }
            disabled={savePatch.isPending || !form.name.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {savePatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        }
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-xs font-medium text-muted-foreground">Estate Logo</div>
            <div className="mx-auto mt-2 grid h-20 w-20 place-items-center overflow-hidden rounded-xl border border-border bg-muted/40">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Estate logo preview" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          </div>
          <Field
            label="Logo image URL"
            value={form.logo_url}
            onChange={(v) => setForm({ ...form, logo_url: v })}
            placeholder="https://…"
          />

          <button
            type="button"
            onClick={() => setForm({ ...form, automatic_billing: !form.automatic_billing })}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left"
            aria-pressed={form.automatic_billing}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Automatic billing</span>
              <span className="block text-[11px] text-muted-foreground">
                Automatically disable residents that owe estate dues.
              </span>
            </span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.automatic_billing ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${form.automatic_billing ? "left-[1.375rem]" : "left-0.5"}`}
              />
            </span>
          </button>

          <Field label="Title" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field
            label="Short title"
            value={form.short_name}
            onChange={(v) => setForm({ ...form, short_name: v })}
          />
          <Field
            label="Address"
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v })}
            rows={2}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field
              label="State"
              value={form.state}
              onChange={(v) => setForm({ ...form, state: v })}
            />
            <Field
              label="Contact email"
              value={form.contact_email}
              onChange={(v) => setForm({ ...form, contact_email: v })}
            />
            <Field
              label="Contact phone"
              value={form.contact_phone}
              onChange={(v) => setForm({ ...form, contact_phone: v })}
            />
          </div>
        </div>
      </SheetModal>

      {/* Address setup */}
      <SheetModal
        open={sheet === "address"}
        title="Address Setup"
        onClose={() => setSheet(null)}
        width="md"
        footer={
          <button
            onClick={() =>
              savePatch.mutate({
                streets: textToList(addressForm.streets),
                house_numbers: textToList(addressForm.house_numbers),
                unit_numbers: textToList(addressForm.unit_numbers),
              })
            }
            disabled={savePatch.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {savePatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-destructive">Warning</span> — use a comma as
            separator. Editing addresses affects resident records and payment history.
          </div>
          <Field
            label="Street names"
            rows={4}
            placeholder="Road 1, Road 2, Private Area 1"
            value={addressForm.streets}
            onChange={(v) => setAddressForm({ ...addressForm, streets: v })}
          />
          <Field
            label="House numbers"
            rows={3}
            placeholder="e.g. 1, 2A, 3B"
            value={addressForm.house_numbers}
            onChange={(v) => setAddressForm({ ...addressForm, house_numbers: v })}
          />
          <Field
            label="Unit numbers"
            rows={3}
            placeholder="e.g. 1, 2A, 3B"
            value={addressForm.unit_numbers}
            onChange={(v) => setAddressForm({ ...addressForm, unit_numbers: v })}
          />
        </div>
      </SheetModal>

      {/* Validity setup */}
      <SheetModal
        open={sheet === "validity"}
        title="Validity Setup"
        onClose={() => setSheet(null)}
        width="md"
        footer={
          <button
            onClick={() => savePatch.mutate({ code_validity: textToList(validity) })}
            disabled={savePatch.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {savePatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-destructive">Warning</span> — edit with caution. Use
            values like minute, hour, day. Use comma as a separator.
          </div>
          <Field
            label="Validity"
            rows={4}
            placeholder="1 Hour, 6 Hours, 1 Day"
            value={validity}
            onChange={setValidity}
          />
        </div>
      </SheetModal>

      {/* Contact editor */}
      <SheetModal
        open={sheet === "contact"}
        title={contactForm.id ? "Edit contact" : "Add contact"}
        onClose={() => setSheet(null)}
        width="sm"
        footer={
          <button
            onClick={() => saveContact.mutate()}
            disabled={saveContact.isPending || !contactForm.label.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saveContact.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save contact
          </button>
        }
      >
        <div className="space-y-3">
          <Field
            label="Name"
            value={contactForm.label}
            onChange={(v) => setContactForm({ ...contactForm, label: v })}
          />
          <Field
            label="Role"
            placeholder="Estate Manager, Security…"
            value={contactForm.role}
            onChange={(v) => setContactForm({ ...contactForm, role: v })}
          />
          <Field
            label="Phone"
            value={contactForm.phone}
            onChange={(v) => setContactForm({ ...contactForm, phone: v })}
          />
          <Field
            label="Email"
            value={contactForm.email}
            onChange={(v) => setContactForm({ ...contactForm, email: v })}
          />
        </div>
      </SheetModal>

      <ConfirmActionDialog
        open={warn !== null}
        tone="destructive"
        title="Warning"
        description={
          warn === "address"
            ? "Only edit address setup when necessary, this can affect payment records."
            : "Only edit code validity when necessary, this changes the options residents see when issuing guest codes."
        }
        confirmLabel="Ok"
        onCancel={() => setWarn(null)}
        onConfirm={() => {
          const next = warn;
          setWarn(null);
          setSheet(next);
        }}
      />
    </Stagger>
  );
}
