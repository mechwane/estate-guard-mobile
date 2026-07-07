import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import {
  Receipt,
  Copy,
  Share2,
  CheckCircle2,
  Pencil,
  ChevronDown,
  Search,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { format, isBefore, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/bills")({
  component: Bills,
});

type MainTab = "dues" | "utility";
type StatusTab = "unpaid" | "paid" | "overdue";

function Bills() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [main, setMain] = useState<MainTab>("dues");
  const [tab, setTab] = useState<StatusTab>("unpaid");
  const [copied, setCopied] = useState(false);
  const [addressOpen, setAddressOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const addressCode =
    (session?.profile as any)?.address_code ??
    (session?.estate?.code && session?.profile?.house_number
      ? `${session.estate.code}/${session.profile.house_number}`
      : session?.estate?.code
        ? `${session.estate.code}/—`
        : "—");

  const { data, isLoading } = useQuery({
    queryKey: ["bills", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("resident_id", session!.userId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const pay = useMutation({
    mutationFn: async (billId: string) => {
      const bill = (data ?? []).find((b) => b.id === billId);
      if (!bill || !session?.userId || !session.estate?.id) throw new Error("Missing context");
      const { error } = await supabase.from("bills").update({ status: "paid" }).eq("id", billId);
      if (error) throw error;
      await supabase.from("payments").insert({
        bill_id: billId,
        estate_id: session.estate.id,
        resident_id: session.userId,
        amount: bill.amount,
        method: "manual",
      });
    },
    onMutate: (id) => setPayingId(id),
    onSettled: () => setPayingId(null),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? []).filter((b) => {
      const isUtility = /water|power|electric|utility|net|internet|waste/i.test(
        b.title + " " + (b.description ?? ""),
      );
      if ((main === "utility") !== isUtility) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q)
      );
    });
    const now = new Date();
    return {
      unpaid: list.filter((b) => b.status === "unpaid" && !isBefore(new Date(b.due_date), now)),
      paid: list.filter((b) => b.status === "paid"),
      overdue: list.filter((b) => b.status === "unpaid" && isBefore(new Date(b.due_date), now)),
    };
  }, [data, main, search]);

  const current = grouped[tab];

  const totals = useMemo(() => {
    const now = new Date();
    const outstanding = (data ?? [])
      .filter((b) => b.status === "unpaid")
      .reduce((s, b) => s + Number(b.amount), 0);
    const overdueCount = (data ?? []).filter(
      (b) => b.status === "unpaid" && isBefore(new Date(b.due_date), now),
    ).length;
    return { outstanding, overdueCount };
  }, [data]);

  async function copyCode() {
    await navigator.clipboard.writeText(addressCode);
    setCopied(true);
    toast.success("Address code copied");
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareCode() {
    if (navigator.share) {
      try {
        await navigator.share({ text: `My estate address code: ${addressCode}` });
      } catch {
        /* dismissed */
      }
    } else {
      await copyCode();
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Main tabs */}
      <FadeIn>
        <div className="relative flex border-b border-border">
          {(["dues", "utility"] as MainTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setMain(t)}
              className={`relative flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                main === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "dues" ? "Estate Dues" : "Bills & Utility"}
              {main === t && (
                <motion.span
                  layoutId="billsTab"
                  className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Summary strip */}
      <FadeIn delay={0.04}>
        <div className="grid grid-cols-2 gap-2">
          <div className="card-surface p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Outstanding
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              ₦{totals.outstanding.toLocaleString()}
            </div>
          </div>
          <div className="card-surface p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Overdue
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums text-foreground">
              {totals.overdueCount}
              {totals.overdueCount > 0 && (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Search */}
      <FadeIn delay={0.08}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bills"
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-9 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </FadeIn>

      {/* Address code card — collapsible */}
      <FadeIn delay={0.12}>
        <Card className="overflow-hidden p-0">
          <button
            onClick={() => setAddressOpen((v) => !v)}
            className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/30"
          >
            <span className="text-sm font-medium text-foreground">Address Info</span>
            <motion.span
              animate={{ rotate: addressOpen ? 0 : -90 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="text-muted-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {addressOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="space-y-3 px-4 pb-4">
                  <p className="text-xs text-muted-foreground">
                    Please share your Address Identification Code with people in your household, to
                    avoid payment issues.
                  </p>
                  <div className="flex items-center justify-between rounded-lg bg-gradient-to-br from-primary/8 via-transparent to-transparent p-3 ring-1 ring-primary/20">
                    <div className="min-w-0">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Address Code
                      </div>
                      <div className="mt-0.5 truncate font-mono text-sm font-semibold text-foreground">
                        {addressCode}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <IconBtn label="Copy" onClick={copyCode}>
                        {copied ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </IconBtn>
                      <IconBtn label="Share" onClick={shareCode}>
                        <Share2 className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn label="Edit" onClick={() => setConfirmEdit(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </FadeIn>

      {/* Status pill tabs */}
      <div className="card-surface relative flex items-center justify-between p-1.5">
        {(["unpaid", "overdue", "paid"] as StatusTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="relative flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize"
          >
            {tab === t && (
              <motion.span
                layoutId="statusPill"
                className="absolute inset-0 rounded-lg bg-primary"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span
              className={`relative ${
                tab === t ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t} ({grouped[t].length})
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : current.length === 0 ? (
        <EmptyState
          title={
            main === "utility" && !search
              ? "No utility bills yet"
              : search
                ? "No matching bills"
                : `No ${tab} bills`
          }
          icon={<Receipt className="h-6 w-6" />}
        />
      ) : (
        <Stagger className="space-y-2">
          {current.map((b) => {
            const overdue = tab === "overdue";
            const dueDate = new Date(b.due_date);
            const busy = payingId === b.id;
            return (
              <StaggerItem key={b.id}>
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {b.title}
                        </div>
                        {b.description && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {b.description}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Due {format(dueDate, "MMM d, yyyy")}</span>
                          <span aria-hidden>·</span>
                          <span>
                            {isBefore(dueDate, new Date())
                              ? `${formatDistanceToNow(dueDate)} ago`
                              : `in ${formatDistanceToNow(dueDate)}`}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-base font-semibold tabular-nums text-foreground">
                          ₦{Number(b.amount).toLocaleString()}
                        </div>
                        <div className="mt-1">
                          <StatusBadge
                            tone={
                              b.status === "paid" ? "success" : overdue ? "error" : "warning"
                            }
                          >
                            {overdue ? "overdue" : b.status}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
                    {b.status !== "paid" && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        disabled={busy}
                        onClick={() => pay.mutate(b.id)}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary-dark disabled:opacity-60"
                      >
                        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {busy ? "Processing" : "Mark as paid"}
                      </motion.button>
                    )}
                  </Card>
                </motion.div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {/* Update Info modal */}
      <AnimatePresence>
        {confirmEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setConfirmEdit(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-2xl bg-card p-6 text-center shadow-xl ring-1 ring-border"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">Update Info</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Updating your address info will require another approval.
              </p>
              <div className="mt-5 space-y-2">
                <button
                  onClick={() => {
                    setConfirmEdit(false);
                    navigate({ to: "/app/resident/profile" });
                  }}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
                >
                  Proceed
                </button>
                <button
                  onClick={() => setConfirmEdit(false)}
                  className="w-full rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      aria-label={label}
      className="rounded-full border border-border bg-card p-2 text-foreground hover:bg-muted"
    >
      {children}
    </motion.button>
  );
}
