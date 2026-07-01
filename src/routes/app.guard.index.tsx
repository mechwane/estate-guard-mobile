import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, StatusBadge } from "@/components/ui-kit";
import { toast } from "sonner";
import { Loader2, ScanLine, Search, LogIn, LogOut } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/guard/")({
  component: GuardValidate,
});

type Invite = {
  id: string; guest_name: string; phone: string | null; purpose: string | null;
  visit_time: string; expires_at: string; code: string; status: string;
  checked_in_at: string | null; checked_out_at: string | null; resident_id: string;
};

function GuardValidate() {
  const { data: session } = useSession();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Invite | null>(null);
  const [residentName, setResidentName] = useState<string | null>(null);

  const validate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.estate?.id) return;
    setBusy(true); setResult(null); setResidentName(null);
    const { data, error } = await supabase
      .from("guest_invites")
      .select("*")
      .eq("estate_id", session.estate.id)
      .eq("code", code.trim())
      .maybeSingle();
    setBusy(false);
    if (error || !data) { toast.error("Code not found"); return; }
    if (new Date(data.expires_at).getTime() < Date.now()) { toast.error("Code expired"); setResult(data as Invite); return; }
    if (data.status === "revoked") { toast.error("Code revoked"); setResult(data as Invite); return; }
    setResult(data as Invite);
    const { data: p } = await supabase.from("profiles").select("full_name,unit").eq("id", data.resident_id).maybeSingle();
    if (p) setResidentName(`${p.full_name}${p.unit ? " · Unit " + p.unit : ""}`);
    toast.success("Guest verified");
  };

  const act = async (kind: "in" | "out") => {
    if (!result || !session?.userId) return;
    const patch = kind === "in"
      ? { checked_in_at: new Date().toISOString(), status: "used" as const, validated_by: session.userId }
      : { checked_out_at: new Date().toISOString() };
    const { error, data } = await supabase.from("guest_invites").update(patch).eq("id", result.id).select("*").single();
    if (error) { toast.error(error.message); return; }
    setResult(data as Invite);
    await supabase.from("audit_logs").insert({
      estate_id: session.estate!.id,
      actor_id: session.userId,
      action: kind === "in" ? "guest.check_in" : "guest.check_out",
      entity: "guest_invites",
      entity_id: result.id,
    });
    toast.success(kind === "in" ? "Checked in" : "Checked out");
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
                {result.purpose || "Visit"} · Visit {format(new Date(result.visit_time), "MMM d, p")}
              </div>
              {residentName && <div className="mt-2 text-xs text-muted-foreground">Host: <span className="text-foreground">{residentName}</span></div>}
            </div>
            <StatusBadge tone={result.status === "active" ? "primary" : result.status === "used" ? "success" : "neutral"}>{result.status}</StatusBadge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => act("in")} disabled={!!result.checked_in_at} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50">
              <LogIn className="h-4 w-4" /> Check in
            </button>
            <button onClick={() => act("out")} disabled={!result.checked_in_at || !!result.checked_out_at} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              <LogOut className="h-4 w-4" /> Check out
            </button>
          </div>

          {(result.checked_in_at || result.checked_out_at) && (
            <div className="mt-3 text-xs text-muted-foreground">
              {result.checked_in_at && <>In {format(new Date(result.checked_in_at), "p")} </>}
              {result.checked_out_at && <>· Out {format(new Date(result.checked_out_at), "p")}</>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
