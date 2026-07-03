import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, StatusBadge } from "@/components/ui-kit";
import { toast } from "sonner";
import { Loader2, ScanLine, Search, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/guard/validate")({
  component: GuardValidate,
});

type Invite = {
  id: string; guest_name: string; phone: string | null; purpose: string | null;
  visit_time: string; expires_at: string; code: string; status: string;
  checked_in_at: string | null; checked_out_at: string | null; resident_id: string;
  vehicle_number: string | null; num_guests: number;
};

function GuardValidate() {
  const { data: session } = useSession();
  const [code, setCode] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(false);
  const [result, setResult] = useState<Invite | null>(null);
  const [host, setHost] = useState<{ full_name: string; unit: string | null } | null>(null);

  const validate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.estate?.id) return;
    setBusy(true); setResult(null); setHost(null);
    const { data, error } = await supabase.rpc("validate_guest_code" as any, { _code: code.trim() } as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    if (!r?.ok) { toast.error("Code not found"); return; }
    setResult(r.invite as Invite);
    setHost(r.host);
    if (r.expired) toast.error("Code expired");
    else if (r.revoked) toast.error("Code revoked");
    else if (r.already_checked_out) toast.info("Visit completed");
    else if (r.already_checked_in) toast.info("Already inside");
    else toast.success("Guest verified");
  };

  const act = async (kind: "in" | "out") => {
    if (!result) return;
    setActing(true);
    const fn = kind === "in" ? "guard_check_in" : "guard_check_out";
    const args = kind === "in"
      ? { _invite_id: result.id, _vehicle_number: vehicle.trim() || null }
      : { _invite_id: result.id };
    const { data, error } = await supabase.rpc(fn as any, args as any);
    setActing(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    setResult(r.invite as Invite);
    toast.success(kind === "in" ? "Entry recorded" : "Exit recorded");
  };

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={validate} className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Enter code</div>
          <div className="flex gap-2">
            <input
              inputMode="numeric" pattern="[0-9]*" maxLength={6}
              placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="flex-1 rounded-lg border border-border bg-card px-3 py-3 text-center font-mono text-2xl tracking-widest outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button disabled={busy || code.length < 4} type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          <button type="button" onClick={() => toast.info("Camera scan is not enabled in MVP — enter code manually")} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">
            <ScanLine className="h-4 w-4" /> Scan QR (coming soon)
          </button>
        </form>
      </Card>

      {result && (
        <Card className="slide-up">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Guest</div>
              <div className="mt-0.5 text-base font-semibold text-foreground">{result.guest_name}</div>
              {result.phone && <div className="mt-0.5 text-sm text-muted-foreground">{result.phone}</div>}
              <div className="mt-1 text-xs text-muted-foreground">
                {result.purpose || "Visit"}{result.num_guests > 1 ? ` · ${result.num_guests} guests` : ""} · {format(new Date(result.visit_time), "MMM d, p")}
              </div>
              {host && <div className="mt-2 text-xs text-muted-foreground">Host: <span className="text-foreground">{host.full_name}{host.unit ? ` · Unit ${host.unit}` : ""}</span></div>}
            </div>
            <StatusBadge tone={result.status === "active" ? "primary" : result.status === "used" ? "success" : "neutral"}>{result.status}</StatusBadge>
          </div>

          {!result.checked_in_at && (
            <input
              value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())}
              placeholder="Vehicle number (optional)"
              className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => act("in")} disabled={acting || !!result.checked_in_at} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50">
              <LogIn className="h-4 w-4" /> Check in
            </button>
            <button onClick={() => act("out")} disabled={acting || !result.checked_in_at || !!result.checked_out_at} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              <LogOut className="h-4 w-4" /> Check out
            </button>
          </div>

          {(result.checked_in_at || result.checked_out_at) && (
            <div className="mt-3 text-xs text-muted-foreground">
              {result.checked_in_at && <>In {format(new Date(result.checked_in_at), "p")} </>}
              {result.checked_out_at && <>· Out {format(new Date(result.checked_out_at), "p")}</>}
              {result.vehicle_number && <> · Vehicle {result.vehicle_number}</>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
