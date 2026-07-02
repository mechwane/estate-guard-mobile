import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSession, roleHome } from "@/lib/session";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app/denied")({
  component: Denied,
});

function Denied() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const home = roleHome(session?.role ?? null);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  };

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold">You don't have permission to view this</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        This area is restricted to a different role. If you believe this is a mistake, contact your estate admin.
      </p>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
        <Link to={home} className="btn-primary w-full text-center">Back to my dashboard</Link>
        <button onClick={signOut} className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted">Sign out</button>
      </div>
    </div>
  );
}
