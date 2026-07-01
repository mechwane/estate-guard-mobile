import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSessionInfo, roleHome } from "@/lib/session";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      const { data } = await supabase.auth.getSession();
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/auth/sign-in", replace: true });
        return;
      }
      const info = await fetchSessionInfo();
      navigate({ to: roleHome(info.role), replace: true });
    };
    void go();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 fade-in">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold tracking-tight text-foreground">Estate Guard</div>
          <div className="mt-1 text-sm text-muted-foreground">Estate operations, simplified.</div>
        </div>
      </div>
    </div>
  );
}
