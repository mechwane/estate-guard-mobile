import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  ScrollTabs,
  SheetModal,
  StatusBadge,
} from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { ngn } from "@/lib/format";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Activity,
  ChevronDown,
  CreditCard,
  Fingerprint,
  Home,
  Mail,
  MessageSquare,
  Phone,
  ScanFace,
  Smartphone,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/app/admin/resident/$id")({
  component: ResidentProfile,
  head: () => ({
    meta: [
      { title: "Resident Profile — Estate Guard" },
      {
        name: "description",
        content:
          "Full resident record: access methods, devices, payment summary and address information.",
      },
      { property: "og:title", content: "Resident Profile — Estate Guard" },
      {
        property: "og:description",
        content: "Manage a single resident's access, billing and address details.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Bill = {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string;
  status: string;
  collection_id: string | null;
  created_at: string;
};

function ResidentProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const [reasonFor, setReasonFor] = useState<"disapprove" | "disable" | null>(null);
  const [reason, setReason] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [cardNo, setCardNo] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [openBill, setOpenBill] = useState<Bill | null>(null);

  const profile = useQuery({
    queryKey: ["admin-resident", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const extras = useQuery({
    queryKey: ["admin-resident-extras", id, estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const [bills, pays, bio, devices, cards, vehicles, acts] = await Promise.all([
        supabase
          .from("bills")
          .select("id,title,description,amount,due_date,status,collection_id,created_at")
          .eq("resident_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("payments").select("id,bill_id,amount,method,paid_at").eq("resident_id", id),
        supabase
          .from("biometric_access")
          .select("id,biometric_type,enrollment_status,access_status,device_id,last_used_at")
          .eq("resident_id", id),
        supabase.from("access_devices").select("id,name,device_type").eq("estate_id", estateId!),
        supabase
          .from("access_cards")
          .select("id,card_number,active,issued_at")
          .eq("resident_id", id),
        supabase.from("vehicle_tags").select("id,plate,active,tag_number").eq("resident_id", id),
        supabase
          .from("audit_logs")
          .select("id,action,entity,entity_id,metadata,created_at")
          .eq("estate_id", estateId!)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);
      const err = [bills, pays, bio, devices, cards, vehicles, acts].map((r) => r.error).find(Boolean);
      if (err) throw err;
      return {
        bills: (bills.data ?? []) as Bill[],
        payments: (pays.data ?? []) as {
          id: string;
          bill_id: string;
          amount: number;
          method: string;
          paid_at: string;
        }[],
        bio: bio.data ?? [],
        devices: devices.data ?? [],
        cards: cards.data ?? [],
        vehicles: vehicles.data ?? [],
        activities: (acts.data ?? []).filter(
          (a) => a.entity_id === id || JSON.stringify(a.metadata ?? {}).includes(id),
        ),
      };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-resident", id] });
    qc.invalidateQueries({ queryKey: ["admin-resident-extras"] });
    qc.invalidateQueries({ queryKey: ["admin-residents"] });
  };

  const logReason = async (action: string, note: string) => {
    await supabase.rpc("log_activity", {
      _action: action,
      _entity: "profile",
      _entity_id: id,
      _metadata: { reason: note },
    });
  };

  const setApproved = useMutation({
    mutationFn: async ({ approved, note }: { approved: boolean; note?: string }) => {
      const { error } = await supabase.rpc("set_estate_access", {
        _user_id: id,
        _approved: approved,
      });
      if (error) throw error;
      if (note) await logReason(approved ? "resident.approved" : "resident.disapproved", note);
    },
    onSuccess: () => {
      toast.success("Resident access updated");
      setReasonFor(null);
      setReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disableAll = useMutation({
    mutationFn: async (note: string) => {
      for (const b of extras.data?.bio ?? []) {
        await supabase.rpc("admin_upsert_biometric_access", {
          _resident_id: id,
          _dependent_id: null,
          _biometric_type: b.biometric_type,
          _device_id: b.device_id,
          _enrollment_status: b.enrollment_status,
          _access_status: "disabled",
          _notes: note,
        } as never);

      }
      await supabase.from("access_cards").update({ active: false }).eq("resident_id", id);
      await supabase.from("vehicle_tags").update({ active: false }).eq("resident_id", id);
      await logReason("resident.access_disabled", note);
    },
    onSuccess: () => {
      toast.success("All access methods disabled");
      setReasonFor(null);
      setReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleBio = useMutation({
    mutationFn: async ({ type, on }: { type: "face" | "fingerprint"; on: boolean }) => {
      const existing = (extras.data?.bio ?? []).find((b) => b.biometric_type === type);
      const { error } = await supabase.rpc("admin_upsert_biometric_access", {
        _resident_id: id,
        _dependent_id: null,
        _biometric_type: type,
        _device_id: existing?.device_id ?? null,
        _enrollment_status: existing?.enrollment_status ?? (on ? "pending" : "not_enrolled"),
        _access_status: on ? "active" : "disabled",
        _notes: null,
      } as never);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access method updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignId = useMutation({
    mutationFn: async () => {
      if (!cardNo.trim()) throw new Error("Enter an ID / card number");
      const { error } = await supabase.from("access_cards").insert({
        estate_id: estateId!,
        resident_id: id,
        card_number: cardNo.trim(),
        active: true,
      });
      if (error) throw error;
      await logReason("resident.id_assigned", cardNo.trim());
    },
    onSuccess: () => {
      toast.success("ID assigned");
      setAssignOpen(false);
      setCardNo("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePhone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: phone.trim() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact updated");
      setEditOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grantMulti = useMutation({
    mutationFn: async () => {
      const email = (profile.data as { email?: string } | null)?.email;
      if (!email) throw new Error("Resident has no email on file");
      const { error } = await supabase.rpc("admin_grant_multi_code", {
        _email: email,
        _ttl_minutes: 60 * 24,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Switched to multi access for 24h"),
    onError: (e: Error) => toast.error(e.message),
  });

  const p = profile.data as Record<string, string | boolean | null> | null;
  const bio = extras.data?.bio ?? [];
  const face = bio.find((b) => b.biometric_type === "face");
  const finger = bio.find((b) => b.biometric_type === "fingerprint");

  const totals = useMemo(() => {
    const bills = extras.data?.bills ?? [];
    const paid = bills
      .filter((b) => b.status === "paid")
      .reduce((s, b) => s + Number(b.amount), 0);
    const owing = bills
      .filter((b) => b.status === "unpaid" || b.status === "overdue")
      .reduce((s, b) => s + Number(b.amount), 0);
    return { paid, owing };
  }, [extras.data]);

  if (profile.isLoading) return <ListSkeleton rows={6} />;
  if (profile.isError) return <ErrorState onRetry={() => profile.refetch()} />;
  if (!p)
    return (
      <EmptyState
        title="Resident not found"
        description="This record is not part of your estate."
      />
    );

  const name = String(p['full_name'] ?? "Resident");
  const addressLine = [
    p['street'] && `${p['street']}`,
    p['house_number'] && `No ${p['house_number']}`,
    p['unit'] && `Unit ${p['unit']}`,
    p['occupant_type'] === "commercial" ? "Commercial" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Stagger className="space-y-4">
        {/* Header */}
        <StaggerItem>
          <Card className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/70 to-primary text-2xl font-semibold text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-foreground">{name}</h2>
            <p className="text-xs text-muted-foreground">{addressLine || "No address on file"}</p>
            <p className="mt-0.5 text-xs">
              <span className={p['approved'] ? "text-[color:var(--color-success)]" : "text-destructive"}>
                {p['approved'] ? "Active" : "Disapproved"}
              </span>
              {p['updated_at'] && (
                <span className="text-muted-foreground">
                  {" "}
                  · last updated{" "}
                  {formatDistanceToNow(new Date(String(p['updated_at'])), { addSuffix: true })}
                </span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <StatusBadge tone="primary">Single access user</StatusBadge>
              <button
                onClick={() => grantMulti.mutate()}
                disabled={grantMulti.isPending}
                className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                Switch
              </button>
            </div>
          </Card>
        </StaggerItem>

        {/* Biometrics */}
        <StaggerItem>
          <div className="grid gap-3 sm:grid-cols-2">
            <BioTile
              icon={<ScanFace className="h-5 w-5" />}
              label="Face Recognition"
              status={face?.access_status ?? "disabled"}
              enrollment={face?.enrollment_status}
              on={face?.access_status === "active"}
              onToggle={(on) => toggleBio.mutate({ type: "face", on })}
            />
            <BioTile
              icon={<Fingerprint className="h-5 w-5" />}
              label="Fingerprint"
              status={finger?.access_status ?? "disabled"}
              enrollment={finger?.enrollment_status}
              on={finger?.access_status === "active"}
              onToggle={(on) => toggleBio.mutate({ type: "fingerprint", on })}
            />
          </div>
        </StaggerItem>

        {/* Contact rows */}
        <StaggerItem>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{String(p['email'] ?? "No email")}</span>
              </div>
              <a
                href={`mailto:${String(p['email'] ?? "")}`}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Send email
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{String(p['phone'] ?? "No phone")}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPhone(String(p['phone'] ?? ""));
                    setEditOpen(true);
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Edit
                </button>
                <a
                  href={`tel:${String(p['phone'] ?? "")}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Call
                </a>
              </div>
            </div>
          </Card>
        </StaggerItem>

        {/* Actions */}
        <StaggerItem>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {p['approved'] ? (
              <ActionBtn tone="destructive" onClick={() => setReasonFor("disapprove")}>
                Disapprove
              </ActionBtn>
            ) : (
              <ActionBtn tone="success" onClick={() => setApproved.mutate({ approved: true })}>
                Approve
              </ActionBtn>
            )}
            <ActionBtn onClick={() => setReasonFor("disable")}>Disable access</ActionBtn>
            <ActionBtn onClick={() => navigate({ to: "/app/admin/messages" })}>
              <MessageSquare className="h-3.5 w-3.5" /> Chat
            </ActionBtn>
            <ActionBtn onClick={() => setAssignOpen(true)}>
              <CreditCard className="h-3.5 w-3.5" /> Assign ID
            </ActionBtn>
          </div>
        </StaggerItem>

        {/* My devices */}
        <StaggerItem>
          <Accordion icon={<Smartphone className="h-4 w-4" />} title="My Devices" defaultOpen>
            {bio.length === 0 && (extras.data?.cards ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No enrolled gate devices, cards or tags yet.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {bio.map((b) => (
                  <div key={b.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium capitalize">{b.biometric_type}</span>
                      <StatusBadge tone={b.access_status === "active" ? "success" : "neutral"}>
                        {b.access_status}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(extras.data?.devices ?? []).find((d) => d.id === b.device_id)?.name ??
                        "No gate device linked"}{" "}
                      · {b.enrollment_status}
                    </p>
                    {b.last_used_at && (
                      <p className="text-[11px] text-muted-foreground">
                        Last used{" "}
                        {formatDistanceToNow(new Date(b.last_used_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                ))}
                {(extras.data?.cards ?? []).map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Card {c.card_number}</span>
                      <StatusBadge tone={c.active ? "success" : "neutral"}>
                        {c.active ? "active" : "revoked"}
                      </StatusBadge>
                    </div>
                  </div>
                ))}
                {(extras.data?.vehicles ?? []).map((v) => (
                  <div key={v.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Vehicle {v.plate}</span>
                      <StatusBadge tone={v.active ? "success" : "neutral"}>
                        {v.active ? "active" : "inactive"}
                      </StatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Login sessions are limited to one device — a resident signing in elsewhere must log
              out of the first device.
            </p>
          </Accordion>
        </StaggerItem>

        {/* Payment summary */}
        <StaggerItem>
          <Accordion icon={<Wallet className="h-4 w-4" />} title="Payment Summary" defaultOpen>
            <div className="mb-3 flex gap-4 text-xs">
              <span className="text-muted-foreground">
                Paid <b className="text-foreground">{ngn(totals.paid)}</b>
              </span>
              <span className="text-muted-foreground">
                Owing <b className="text-destructive">{ngn(totals.owing)}</b>
              </span>
            </div>
            {(extras.data?.bills ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No levies billed to this resident.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(extras.data?.bills ?? []).map((b) => {
                  const isPaid = b.status === "paid" || b.status === "waived";
                  return (
                    <button
                      key={b.id}
                      onClick={() => setOpenBill(b)}
                      className="rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:shadow-sm"
                    >
                      <div className="text-xs font-semibold uppercase leading-snug text-foreground">
                        {b.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Due {format(new Date(b.due_date), "d MMM yyyy")} · {b.status}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Paid</span>
                        <span>{ngn(isPaid ? b.amount : 0)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Owing</span>
                        <span className={isPaid ? "" : "text-destructive"}>
                          {ngn(isPaid ? 0 : b.amount)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Accordion>
        </StaggerItem>

        {/* Address information */}
        <StaggerItem>
          <Accordion icon={<Home className="h-4 w-4" />} title="Address Information">
            <dl className="divide-y divide-border text-sm">
              <Row label="Billing" value={p['approved'] ? "Active" : "Excluded"} />
              <Row label="Address Code" value={String(p['address_code'] ?? "—")} />
              <Row label="Address" value={addressLine || "—"} />
              <Row label="Address Status" value={String(p['verification_status'] ?? "—")} />
              <Row label="Street Name" value={String(p['street'] ?? "—")} />
              <Row label="House Number" value={String(p['house_number'] ?? "—")} />
              <Row label="Unit Number" value={String(p['unit'] ?? "—")} />
              <Row label="Block" value={String(p['block'] ?? "—")} />
              <Row
                label="Occupant Type"
                value={p['occupant_type'] === "commercial" ? "Commercial" : "Resident"}
              />
              <Row label="Contact Person Name" value={name} />
              <Row label="Contact Person Phone" value={String(p['phone'] ?? "—")} />
              <Row label="Arrears" value={ngn(totals.owing)} />
            </dl>
          </Accordion>
        </StaggerItem>
      </Stagger>

      {/* Recent activity rail */}
      <FadeIn>
        <Card className="xl:sticky xl:top-20">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-primary" /> Recent Activities
          </div>
          <div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {(extras.data?.activities ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No recorded activity yet.</p>
            ) : (
              (extras.data?.activities ?? []).map((a) => (
                <div key={a.id} className="rounded-lg border border-border/70 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{a.action}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {a.entity ?? ""}{" "}
                    {(a.metadata as { reason?: string } | null)?.reason ?? ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </FadeIn>

      {/* Reason modal */}
      <SheetModal
        open={reasonFor !== null}
        title={reasonFor === "disable" ? "Disable access" : "Disapprove resident"}
        onClose={() => {
          setReasonFor(null);
          setReason("");
        }}
        footer={
          <button
            onClick={() =>
              reasonFor === "disable"
                ? disableAll.mutate(reason.trim())
                : setApproved.mutate({ approved: false, note: reason.trim() })
            }
            disabled={!reason.trim() || disableAll.isPending || setApproved.isPending}
            className="w-full rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-60"
          >
            Confirm
          </button>
        }
      >
        <label className="block text-xs font-medium text-muted-foreground">
          Reason (saved to change history)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder={
            reasonFor === "disable"
              ? "Why is gate access being disabled?"
              : "Why is this resident being disapproved?"
          }
          className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </SheetModal>

      {/* Assign ID */}
      <SheetModal
        open={assignOpen}
        title="Assign ID"
        onClose={() => setAssignOpen(false)}
        footer={
          <button
            onClick={() => assignId.mutate()}
            disabled={assignId.isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Assign
          </button>
        }
      >
        <p className="text-xs text-muted-foreground">
          Issues an estate access ID (card / tag number) to {name}. It becomes active at the gate
          immediately and appears under My Devices.
        </p>
        <input
          value={cardNo}
          onChange={(e) => setCardNo(e.target.value)}
          placeholder="e.g. LG2RA-00231"
          className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </SheetModal>

      {/* Edit contact */}
      <SheetModal
        open={editOpen}
        title="Edit contact"
        onClose={() => setEditOpen(false)}
        footer={
          <button
            onClick={() => savePhone.mutate()}
            disabled={savePhone.isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Save
          </button>
        }
      >
        <label className="block text-xs font-medium text-muted-foreground">Phone number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </SheetModal>

      {openBill && (
        <BillDetail
          bill={openBill}
          residentName={name}
          payments={(extras.data?.payments ?? []).filter((x) => x.bill_id === openBill.id)}
          onClose={() => setOpenBill(null)}
        />
      )}
    </div>
  );
}

function BillDetail({
  bill,
  residentName,
  payments,
  onClose,
}: {
  bill: Bill;
  residentName: string;
  payments: { id: string; amount: number; method: string; paid_at: string }[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"payments" | "history">("payments");
  const history = useQuery({
    queryKey: ["bill-history", bill.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,action,metadata,created_at")
        .eq("entity_id", bill.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <SheetModal open title={bill.title} onClose={onClose} width="lg">
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {bill.status === "paid" ? "Settled" : "Outstanding"} · {residentName}
        </div>
        <div className="mt-1 text-2xl font-semibold text-primary">{ngn(bill.amount)}</div>
        <div className="text-[11px] text-muted-foreground">
          Due {format(new Date(bill.due_date), "d MMMM yyyy")}
        </div>
      </div>
      <div className="mt-4">
        <ScrollTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "payments", label: "Payments" },
            { key: "history", label: "Payment History" },
          ]}
        />
      </div>
      <div className="mt-3 space-y-2">
        {tab === "payments" ? (
          payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment recorded yet.</p>
          ) : (
            payments.map((pay) => (
              <div key={pay.id} className="rounded-lg border border-border p-3">
                <div className="text-[11px] text-muted-foreground">
                  {format(new Date(pay.paid_at), "EEEE, d MMMM yyyy")}
                </div>
                <div className="text-sm font-medium">
                  Credit of {ngn(pay.amount)} applied
                </div>
                <div className="text-[11px] text-muted-foreground">via {pay.method}</div>
              </div>
            ))
          )
        ) : (history.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No history entries for this levy.</p>
        ) : (
          (history.data ?? []).map((h) => (
            <div key={h.id} className="rounded-lg border border-border p-3">
              <div className="text-[11px] text-muted-foreground">
                {format(new Date(h.created_at), "EEEE, d MMMM yyyy")}
              </div>
              <div className="text-sm font-medium">{h.action}</div>
              <div className="text-[11px] text-muted-foreground">
                {(h.metadata as { reason?: string } | null)?.reason ?? ""}
              </div>
            </div>
          ))
        )}
      </div>
    </SheetModal>
  );
}

function BioTile({
  icon,
  label,
  status,
  enrollment,
  on,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  enrollment?: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {status}
          {enrollment ? ` · ${enrollment}` : ""}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onToggle(!on)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "destructive" | "success";
}) {
  const cls =
    tone === "destructive"
      ? "border-destructive/40 text-destructive hover:bg-destructive/10"
      : tone === "success"
        ? "border-[color:var(--color-success)]/40 text-[color:var(--color-success)] hover:bg-[color:var(--color-success)]/10"
        : "border-border text-foreground hover:bg-muted";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${cls}`}
    >
      {children}
    </button>
  );
}

function Accordion({
  icon,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card-surface overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted/40"
      >
        <span className="text-primary">{icon}</span>
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-border px-4 py-4">{children}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}
