import { Outlet, createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-dark">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_-5%,color-mix(in_oklch,var(--color-accent)_35%,transparent),transparent_55%),radial-gradient(circle_at_90%_100%,color-mix(in_oklch,var(--color-primary-dark)_90%,transparent),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/20 to-transparent" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-center gap-2.5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/70 text-primary-dark shadow-lg shadow-black/20">
            <ShieldCheck className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-base font-semibold text-primary-foreground">Estate Guard</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8"
        >
          <Outlet />
        </motion.div>

        <p className="mt-6 text-center text-[11px] text-primary-foreground/60">
          Secured by Estate Guard · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
