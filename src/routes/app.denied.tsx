import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSession, roleHome } from "@/lib/session";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app/denied")({
  ssr: false,
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-semibold">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        Your account doesn't have permission to view this page. If you think this is a mistake, contact your estate admin.
      </p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Link to={home} className="btn-primary w-full text-center">Back to my dashboard</Link>
        <button onClick={signOut} className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted">Sign out</button>
      </div>
    </div>
  );
}
