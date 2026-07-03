import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { LogOut, ShieldCheck, Building2, Mail, Phone, History, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/guard/more")({
  component: GuardMore,
});

function GuardMore() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const p = session?.profile;

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{p?.full_name || "Guard"}</div>
            <div className="text-xs text-muted-foreground">Estate guard</div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {session?.email && <Row icon={<Mail className="h-4 w-4" />} label={session.email} />}
          {p?.phone && <Row icon={<Phone className="h-4 w-4" />} label={p.phone} />}
          {session?.estate && <Row icon={<Building2 className="h-4 w-4" />} label={`${session.estate.name} · ${session.estate.code}`} />}
        </div>
      </Card>

      <button onClick={signOut} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/5">
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <p className="text-center text-[11px] text-muted-foreground">Guards can only see and act on records for their assigned estate.</p>
    </div>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex items-center gap-2 text-muted-foreground"><span className="text-muted-foreground/70">{icon}</span><span className="truncate text-foreground">{label}</span></div>;
}
