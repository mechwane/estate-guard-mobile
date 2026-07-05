import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import {
  ChevronRight,
  ShieldCheck,
  LogOut,
  Phone,
  LifeBuoy,
  Users,
  IdCard,
  Settings,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app/resident/more")({
  component: More,
});

function More() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const name = session?.profile?.full_name || session?.email || "Resident";
  const avatar = session?.profile?.avatar_url;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const isPremium = (session?.profile as any)?.premium_plan === "premium";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <FadeIn>
        <Card className="flex items-center gap-3 p-4">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-primary/80 to-primary">
            {avatar ? (
              <img src={avatar} alt={name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-primary-foreground">
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-foreground">{name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {session?.estate?.name ?? "No estate"}
            </div>
            <Link
              to="/app/resident/profile"
              className="mt-2 inline-block rounded-lg bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              Edit Profile
            </Link>
          </div>
        </Card>
      </FadeIn>

      {/* Premium banner */}
      <FadeIn delay={0.05}>
        <Card
          className={`relative overflow-hidden p-4 ${
            isPremium
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500"
              : "bg-gradient-to-r from-rose-600 to-red-500"
          } border-0 text-white`}
        >
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Estate Premium
              </div>
              <div className="mt-1 text-xs opacity-90">
                {isPremium
                  ? "You're on Premium. Enjoy priority support."
                  : "Unlock priority requests & premium perks."}
              </div>
            </div>
            {!isPremium && (
              <button className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium backdrop-blur-sm hover:bg-white/30">
                Upgrade
              </button>
            )}
          </div>
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        </Card>
      </FadeIn>

      <Stagger className="space-y-3">
        <Section title="Estate Support">
          <Row
            to="/app/resident/contacts"
            icon={<Phone className="h-4 w-4" />}
            label="Estate Contacts"
          />
          <Row
            to="/app/resident/support"
            icon={<LifeBuoy className="h-4 w-4" />}
            label="Support Tickets"
          />
        </Section>

        <Section title="App">
          <Row
            to="/app/resident/dependents"
            icon={<Users className="h-4 w-4" />}
            label="Dependents"
          />
          <Row to="/app/resident/ids" icon={<IdCard className="h-4 w-4" />} label="Manage IDs" />
          <Row
            to="/app/resident/verification"
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Estate Verification"
          />
        </Section>

        <Section title="App Support">
          <Row
            to="/app/resident/profile"
            icon={<Settings className="h-4 w-4" />}
            label="App Settings"
          />
          <Row
            to="/app/resident/support"
            icon={<HelpCircle className="h-4 w-4" />}
            label="FAQs"
          />
        </Section>
      </Stagger>

      <FadeIn delay={0.2}>
        <button
          onClick={signOut}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </FadeIn>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <StaggerItem>
      <div className="space-y-1.5">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        <div className="card-surface divide-y divide-border overflow-hidden">{children}</div>
      </div>
    </StaggerItem>
  );
}

function Row({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3 text-sm text-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
