import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, ArrowLeft, Receipt, Copy } from "lucide-react";
import { Card, EmptyState, ListSkeleton } from "@/components/ui-kit";
import { ngn, genRef } from "@/lib/format";

export const Route = createFileRoute("/app/resident/vtu/$service")({
  component: PurchasePage,
});

const SERVICE_LABEL: Record<string, string> = {
  airtime: "Airtime",
  data: "Data",
  electricity: "Electricity",
  cable: "Cable TV",
};

const RECIPIENT_LABEL: Record<string, string> = {
  airtime: "Phone number",
  data: "Phone number",
  electricity: "Meter number",
  cable: "Smartcard / IUC number",
};

const DATA_PACKAGES = [
  { label: "1GB · 30 days", amount: 500 },
  { label: "2GB · 30 days", amount: 1000 },
  { label: "5GB · 30 days", amount: 2500 },
  { label: "10GB · 30 days", amount: 4500 },
];
const CABLE_PACKAGES = [
  { label: "Basic", amount: 2500 },
  { label: "Standard", amount: 5500 },
  { label: "Premium", amount: 12500 },
];

type Step = "form" | "confirm" | "loading" | "success" | "failed";

function PurchasePage() {
  const { service } = Route.useParams() as { service: string };
  const navigate = useNavigate();
  const { data: session } = useSession();

  const valid = ["airtime", "data", "electricity", "cable"].includes(service);

  const { data: providers, isLoading } = useQuery({
    enabled: valid,
    queryKey: ["vtu-providers", service],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vtu_providers")
        .select("code,name,service_type")
        .eq("service_type", service)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [providerCode, setProviderCode] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [packageLabel, setPackageLabel] = useState<string>("");
  const [step, setStep] = useState<Step>("form");
  const [tx, setTx] = useState<{ id: string; reference: string; amount: number; provider_name: string; recipient: string; package_label: string | null; status: string; created_at: string } | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (providers && providers.length > 0 && !providerCode) setProviderCode(providers[0].code);
  }, [providers, providerCode]);

  const providerName = useMemo(
    () => providers?.find((p) => p.code === providerCode)?.name ?? "",
    [providers, providerCode],
  );

  if (!valid) {
    return (
      <EmptyState title="Unknown service" description="Return to VTU services." action={
        <Link to="/app/resident/vtu" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Back</Link>
      } />
    );
  }

  const packages = service === "data" ? DATA_PACKAGES : service === "cable" ? CABLE_PACKAGES : null;

  const validate = () => {
    if (!providerCode) return "Choose a provider";
    if (recipient.trim().length < 5) return `Enter a valid ${RECIPIENT_LABEL[service].toLowerCase()}`;
    const amt = Number(amount);
    if (!amt || amt < 50) return "Enter a valid amount";
    if (amt > 500000) return "Amount too large";
    return "";
  };

  const onReview = () => {
    const e = validate();
    if (e) return toast.error(e);
    setStep("confirm");
  };

  const onPay = async () => {
    if (!session?.userId) return;
    setStep("loading");
    setErr("");
    const reference = genRef("VTU");
    const amt = Number(amount);
    // Simulated processing (no real gateway in MVP)
    await new Promise((r) => setTimeout(r, 1400));
    const success = Math.random() > 0.08;
    const { data, error } = await supabase
      .from("vtu_transactions")
      .insert({
        user_id: session.userId,
        estate_id: session.estate?.id ?? null,
        service_type: service,
        provider_code: providerCode,
        provider_name: providerName,
        recipient: recipient.trim(),
        package_label: packageLabel || null,
        amount: amt,
        status: success ? "success" : "failed",
        reference,
      })
      .select("id,reference,amount,provider_name,recipient,package_label,status,created_at")
      .single();
    if (error || !data) {
      setErr(error?.message ?? "Could not save transaction");
      setStep("failed");
      return;
    }
    await supabase.from("audit_logs").insert({
      estate_id: session.estate?.id ?? null,
      actor_id: session.userId,
      action: `vtu.${service}.${success ? "success" : "failed"}`,
      entity: "vtu_transactions",
      entity_id: data.id,
      metadata: { reference, amount: amt, provider: providerCode },
    });
    setTx(data);
    setStep(success ? "success" : "failed");
  };

  return (
    <div className="space-y-4">
      <button onClick={() => (step === "form" ? navigate({ to: "/app/resident/vtu" }) : setStep("form"))} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{SERVICE_LABEL[service]}</h2>
        <Link to="/app/resident/vtu/history" className="text-xs font-medium text-primary">History</Link>
      </div>

      {step === "form" && (
        <div className="space-y-4">
          {isLoading ? <ListSkeleton rows={2} /> : (
            <>
              <Field label="Provider">
                <select value={providerCode} onChange={(e) => setProviderCode(e.target.value)} className="input">
                  {(providers ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </Field>
              <Field label={RECIPIENT_LABEL[service]}>
                <input value={recipient} onChange={(e) => setRecipient(e.target.value)} inputMode={service === "airtime" || service === "data" ? "tel" : "text"} className="input" />
              </Field>

              {packages ? (
                <Field label="Package">
                  <div className="grid grid-cols-2 gap-2">
                    {packages.map((p) => (
                      <button key={p.label} onClick={() => { setPackageLabel(p.label); setAmount(String(p.amount)); }} className={`card-surface p-3 text-left text-xs ${packageLabel === p.label ? "border-primary ring-1 ring-primary/30" : ""}`}>
                        <div className="font-medium text-foreground">{p.label}</div>
                        <div className="mt-0.5 text-primary">{ngn(p.amount)}</div>
                      </button>
                    ))}
                  </div>
                </Field>
              ) : (
                <Field label="Amount (NGN)">
                  <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="input" placeholder="e.g. 1000" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[500, 1000, 2000, 5000].map((v) => (
                      <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted">{ngn(v)}</button>
                    ))}
                  </div>
                </Field>
              )}

              <button onClick={onReview} className="btn-primary w-full">Review</button>
            </>
          )}
        </div>
      )}

      {step === "confirm" && (
        <Card>
          <h3 className="text-sm font-semibold">Confirm transaction</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Service" v={SERVICE_LABEL[service]} />
            <Row k="Provider" v={providerName} />
            <Row k={RECIPIENT_LABEL[service]} v={recipient} />
            {packageLabel && <Row k="Package" v={packageLabel} />}
            <Row k="Amount" v={<span className="font-semibold text-foreground">{ngn(amount)}</span>} />
          </dl>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep("form")} className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">Edit</button>
            <button onClick={onPay} className="btn-primary flex-1">Pay {ngn(amount)}</button>
          </div>
        </Card>
      )}

      {step === "loading" && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processing your payment…</p>
          </div>
        </Card>
      )}

      {step === "success" && tx && <Receipt_ tx={tx} onNew={() => resetAll(setStep, setRecipient, setAmount, setPackageLabel)} />}
      {step === "failed" && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <XCircle className="h-8 w-8 text-destructive" />
            <h3 className="text-sm font-semibold">Transaction failed</h3>
            <p className="text-xs text-muted-foreground">{err || "The provider declined this transaction. No amount was charged."}</p>
            <div className="mt-3 flex w-full gap-2">
              <button onClick={() => setStep("form")} className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium">Try again</button>
              <Link to="/app/resident/vtu/history" className="btn-primary flex-1 text-center">View history</Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function resetAll(setStep: (s: Step) => void, ...resets: Array<(v: string) => void>) {
  resets.forEach((r) => r(""));
  setStep("form");
}

function Receipt_({ tx, onNew }: { tx: NonNullable<ReturnType<typeof useState<any>>[0]> extends infer T ? any : never; onNew: () => void }) {
  const copy = async () => { await navigator.clipboard.writeText(tx.reference); toast.success("Reference copied"); };
  return (
    <div className="space-y-3 animate-fade-in">
      <Card className="bg-gradient-to-br from-[color:var(--color-primary-dark)] to-[color:var(--color-primary)] text-primary-foreground">
        <div className="flex items-center gap-2 text-primary-foreground/80"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wider">Payment successful</span></div>
        <div className="mt-2 text-3xl font-semibold">{ngn(tx.amount)}</div>
        <div className="mt-1 text-sm text-primary-foreground/85">{tx.provider_name} · {tx.recipient}</div>
      </Card>
      <Card>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><Receipt className="h-3.5 w-3.5" /> Receipt</div>
        <dl className="mt-3 space-y-2 text-sm">
          <Row k="Reference" v={<button onClick={copy} className="inline-flex items-center gap-1 font-mono text-xs text-primary"><Copy className="h-3 w-3" />{tx.reference}</button>} />
          {tx.package_label && <Row k="Package" v={tx.package_label} />}
          <Row k="Status" v={<span className="text-[color:var(--color-success)]">Success</span>} />
          <Row k="Date" v={new Date(tx.created_at).toLocaleString()} />
        </dl>
      </Card>
      <div className="flex gap-2">
        <button onClick={onNew} className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium">New purchase</button>
        <Link to="/app/resident/vtu/history" className="btn-primary flex-1 text-center">History</Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm text-foreground">{v}</dd></div>;
}
