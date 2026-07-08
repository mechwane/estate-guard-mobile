import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { fetchSessionInfo, roleHome } from "@/lib/session";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Splash,
  head: () => ({
    meta: [
      { title: "Estate Guard — Estate operations, elevated." },
      { name: "description", content: "Estate Guard streamlines resident, guard, and administrator workflows across gated estates." },
      { property: "og:title", content: "Estate Guard — Estate operations, elevated." },
      { property: "og:description", content: "Estate Guard streamlines resident, guard, and administrator workflows across gated estates." },
      { property: "og:url", content: "https://guard-estate-flow.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://guard-estate-flow.lovable.app/" }],
  }),
});

function Splash() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      const { data } = await supabase.auth.getSession();
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/auth/sign-in", replace: true });
        return;
      }
      const info = await fetchSessionInfo();
      navigate({ to: roleHome(info.role), replace: true });
    };
    void go();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-dark px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,color-mix(in_oklch,var(--color-accent)_30%,transparent),transparent_60%),radial-gradient(circle_at_80%_90%,color-mix(in_oklch,var(--color-primary)_60%,transparent),transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-5">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="relative"
        >
          <motion.div
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.6, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-3xl bg-accent/40"
          />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent to-accent/70 text-primary-dark shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]">
            <ShieldCheck className="h-10 w-10" strokeWidth={2.5} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-primary-foreground">
            Estate Guard
          </h1>
          <div className="mt-1 text-sm text-primary-foreground/70">
            Estate operations, elevated.
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-2 flex gap-1.5"
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
              className="h-1.5 w-1.5 rounded-full bg-accent"
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
