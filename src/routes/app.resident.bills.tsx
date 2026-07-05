import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { Receipt, Copy, Share2, CheckCircle2 } from "lucide-react";
import { format, isBefore } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/bills")({
  component: Bills,
});

type MainTab = "dues" | "utility";
type StatusTab = "unpaid" | "paid" | "overdue";

function Bills() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [main, setMain] = useState<MainTab>("dues");
  const [tab, setTab] = useState<StatusTab>("unpaid");
  const [copied, setCopied] = useState(false);

  const addressCode =
    (session?.profile as any)?.address_code ??
    (session?.estate?.code && session?.profile?.house_number
      ? `${session.estate.code}/${session.profile.house_number}`
      : session?.estate?.code
        ? `${session.estate.code}/—`
        : "—");

  const { data } = useQuery({
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
    onSuccess: () => {
      toast.success("Marked paid");
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const list = (data ?? []).filter((b) => {
      const isUtility = /water|power|electric|utility|net|internet|waste/i.test(
        b.title + " " + (b.description ?? ""),
      );
      return main === "utility" ? isUtility : !isUtility;
    });
    const now = new Date();
    return {
      unpaid: list.filter((b) => b.status === "unpaid" && !isBefore(new Date(b.due_date), now)),
      paid: list.filter((b) => b.status === "paid"),
      overdue: list.filter((b) => b.status === "unpaid" && isBefore(new Date(b.due_date), now)),
    };
  }, [data, main]);

  const current = grouped[tab];

  async function copyCode() {
    await navigator.clipboard.writeText(addressCode);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareCode() {
    if (navigator.share) {
      await navigator.share({ text: `My address code: ${addressCode}` });
    } else {
      await copyCode();
    }
  }

  return (
    <div className="space-y-4">
      {/* Main tabs */}
      <FadeIn>
        <div className="flex border-b border-border">
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
                <span className="absolute inset-x-4 -bottom-px h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Address code card */}
      <FadeIn delay={0.05}>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">
            Please share your Address Identification Code with people in your household, to avoid
            payment issues.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/40 p-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Address Code
              </div>
              <div className="mt-0.5 font-mono text-sm text-foreground">{addressCode}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={copyCode}
                className="rounded-full border border-border bg-card p-2 hover:bg-muted"
                aria-label="Copy"
              >
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={shareCode}
                className="rounded-full border border-border bg-card p-2 hover:bg-muted"
                aria-label="Share"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* Status pill tabs */}
      <div className="card-surface flex items-center justify-between p-1.5">
        {(["unpaid", "overdue", "paid"] as StatusTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t} ({grouped[t].length})
          </button>
        ))}
      </div>

      {current.length === 0 ? (
        <EmptyState title={`No ${tab} bills`} icon={<Receipt className="h-6 w-6" />} />
      ) : (
        <Stagger className="space-y-2">
          {current.map((b) => {
            const overdue = tab === "overdue";
            return (
              <StaggerItem key={b.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {b.title}
                      </div>
                      {b.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {b.description}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        Due {format(new Date(b.due_date), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold tabular-nums text-foreground">
                        ₦{Number(b.amount).toLocaleString()}
                      </div>
                      <StatusBadge
                        tone={b.status === "paid" ? "success" : overdue ? "error" : "warning"}
                      >
                        {overdue ? "overdue" : b.status}
                      </StatusBadge>
                    </div>
                  </div>
                  {b.status !== "paid" && (
                    <button
                      disabled={pay.isPending}
                      onClick={() => pay.mutate(b.id)}
                      className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
                    >
                      Mark as paid
                    </button>
                  )}
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
