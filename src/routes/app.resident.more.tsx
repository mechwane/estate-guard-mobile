import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  Pencil,
  Check,
  X,
  MessageSquareHeart,
  Star,
  Share2,
  Shield,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/more")({
  component: More,
});

function More() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const name = session?.profile?.full_name || session?.email || "Resident";
  const profile = session?.profile as any;
  const avatarPath = profile?.avatar_url;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const plan = profile?.premium_plan ?? "free";
  const isPremium = plan === "premium";
  const expires: string | null = profile?.expires_at ?? null;
  const verification = profile?.verification_status ?? "not_submitted";

  useEffect(() => {
    if (!avatarPath) return setAvatarUrl(null);
    supabase.storage
      .from("avatars")
      .createSignedUrl(avatarPath, 60 * 60)
      .then(({ data }) => setAvatarUrl(data?.signedUrl ?? null));
  }, [avatarPath]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function shareApp() {
    const url = typeof window !== "undefined" ? window.location.origin : "https://estateguard.app";
    const shareData = {
      title: "Estate Guard",
      text: "Manage your estate, invites, bills and more with Estate Guard.",
      url,
    };
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share(shareData);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      } else {
        toast.info(url);
      }
    } catch {
      /* user cancelled share */
    }
  }

  function rateApp() {
    toast.info("Rating opens after the app is published to the store", {
      description: "Coming soon.",
    });
  }

  return (
    <div className="space-y-4">
      <FadeIn>
        <div>
          <h1 className="text-xl font-semibold text-foreground">More</h1>
          <p className="text-xs text-muted-foreground">Your profile, support & settings</p>
        </div>
      </FadeIn>

      {/* Profile card */}
      <FadeIn delay={0.05}>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-primary/70 to-primary ring-2 ring-primary/20">
              {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-primary-foreground">
                  {initials}
                </div>
              )}
              {isPremium && (
                <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 text-[10px] text-white shadow ring-2 ring-card">
                  ★
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-foreground">{name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {session?.estate?.name ?? "No estate"}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <VerifBadge status={verification} />
                <Link
                  to="/app/resident/profile"
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary transition-transform hover:scale-105"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* Premium banner */}
      <FadeIn delay={0.1}>
        <button
          type="button"
          onClick={() => setShowUpgrade(true)}
          className={`relative w-full cursor-pointer overflow-hidden rounded-xl border-0 p-4 text-left text-white shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99] ${
            isPremium
              ? "bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500"
              : "bg-gradient-to-r from-primary via-primary-dark to-amber-600"
          }`}
        >
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Estate Premium
              </div>
              <div className="mt-1 text-xs opacity-90">
                {isPremium
                  ? expires
                    ? `Active · renews ${new Date(expires).toLocaleDateString()}`
                    : "You're on Premium. Priority support enabled."
                  : "Unlock priority requests, faster support & premium perks."}
              </div>
            </div>
            <span
              className="shrink-0 rounded-lg bg-white/25 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
            >
              {isPremium ? "Manage" : "Upgrade"}
            </span>
          </div>
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/5 blur-3xl" />
        </button>
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
            to="/app/resident/access"
            icon={<ShieldCheck className="h-4 w-4" />}
            label="My Access Methods"
          />
          <Row
            to="/app/resident/pass"
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Biometric Pass"
          />
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
            to="/app/resident/settings"
            icon={<Settings className="h-4 w-4" />}
            label="App Settings"
          />
          <Row
            to="/app/resident/faqs"
            icon={<HelpCircle className="h-4 w-4" />}
            label="FAQs"
          />
          <Row
            to="/app/resident/feedback"
            icon={<MessageSquareHeart className="h-4 w-4" />}
            label="Feedback & Suggestions"
          />
        </Section>

        <Section title="App Usage">
          <ActionRow
            icon={<Star className="h-4 w-4" />}
            label="Rate app"
            onClick={rateApp}
          />
          <ActionRow
            icon={<Share2 className="h-4 w-4" />}
            label="Share app"
            onClick={shareApp}
          />
          <Row
            to="/app/resident/privacy"
            icon={<Shield className="h-4 w-4" />}
            label="Privacy Policy"
          />
          <Row
            to="/app/resident/terms"
            icon={<FileText className="h-4 w-4" />}
            label="Terms & Conditions"
          />
        </Section>
      </Stagger>

      <FadeIn delay={0.25}>
        <button
          onClick={signOut}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </FadeIn>

      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          currentPlan={plan}
        />
      )}
    </div>
  );
}

function VerifBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    approved: { label: "Verified", className: "bg-emerald-500/15 text-emerald-500" },
    pending: { label: "Pending review", className: "bg-amber-500/15 text-amber-500" },
    rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
    incomplete: { label: "Incomplete", className: "bg-muted text-muted-foreground" },
    not_submitted: { label: "Not verified", className: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? map.not_submitted;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${s.className}`}>
      <ShieldCheck className="h-3 w-3" /> {s.label}
    </span>
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

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3 text-sm text-foreground">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
          {icon}
        </span>
        {label}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function Row({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3 text-sm text-foreground">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
          {icon}
        </span>
        {label}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

const PLANS = [
  {
    id: "monthly",
    label: "Monthly",
    price: "₦2,500",
    per: "/month",
    days: 30,
    highlight: false,
  },
  {
    id: "yearly",
    label: "Yearly",
    price: "₦24,000",
    per: "/year",
    days: 365,
    highlight: true,
    tag: "Save 20%",
  },
];

function UpgradeModal({
  onClose,
  currentPlan,
}: {
  onClose: () => void;
  currentPlan: string;
}) {
  const [selected, setSelected] = useState("yearly");

  const perks = [
    "Priority handling on service requests",
    "Faster support responses",
    "Unlimited dependents & IDs",
    "Premium community badge",
  ];

  return (
    <ModalPortal>
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-[scale-in_0.2s_ease-out] overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl"
      >
        <div className="relative bg-gradient-to-br from-primary via-primary-dark to-amber-600 p-5 text-white">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" /> Estate Premium
          </div>
          <div className="mt-1 text-xs opacity-90">
            Current plan: <span className="font-medium">{currentPlan === "premium" ? "Premium" : "Free"}</span>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <ul className="space-y-2">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p}
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-2">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                  selected === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {p.tag && (
                  <span className="absolute -top-2 right-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white">
                    {p.tag}
                  </span>
                )}
                <div className="text-xs font-medium text-muted-foreground">{p.label}</div>
                <div className="mt-1 text-base font-semibold text-foreground">
                  {p.price}
                  <span className="text-xs font-normal text-muted-foreground">{p.per}</span>
                </div>
              </button>
            ))}
          </div>

          <button
            disabled
            aria-disabled="true"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm font-medium text-muted-foreground"
          >
            Upgrade — Coming soon
          </button>

          <p className="text-center text-[11px] text-muted-foreground">
            Secure payment integration is not yet configured. Upgrades will be enabled
            once payments are live.
          </p>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
