import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { Bell, Moon, Globe, Lock, ChevronRight, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/settings")({
  component: Settings,
});

const KEYS = {
  notif: "eg.pref.notifications",
  theme: "eg.pref.theme",
  lang: "eg.pref.language",
};

function Settings() {
  const [notif, setNotif] = useState(true);
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNotif(localStorage.getItem(KEYS.notif) !== "false");
    const t = localStorage.getItem(KEYS.theme);
    setDark(t ? t === "dark" : document.documentElement.classList.contains("dark"));
    setLang(localStorage.getItem(KEYS.lang) ?? "en");
  }, []);

  function toggleNotif(v: boolean) {
    setNotif(v);
    localStorage.setItem(KEYS.notif, String(v));
    toast.success(v ? "Notifications enabled" : "Notifications muted");
  }

  function toggleDark(v: boolean) {
    setDark(v);
    localStorage.setItem(KEYS.theme, v ? "dark" : "light");
    document.documentElement.classList.toggle("dark", v);
  }

  function changeLang(v: string) {
    setLang(v);
    localStorage.setItem(KEYS.lang, v);
    toast.success("Language preference saved");
  }

  return (
    <div className="space-y-4">
      <FadeIn>
        <div>
          <h1 className="text-xl font-semibold text-foreground">App Settings</h1>
          <p className="text-xs text-muted-foreground">Customize how Estate Guard behaves</p>
        </div>
      </FadeIn>

      <Stagger className="space-y-3">
        <StaggerItem>
          <Card className="divide-y divide-border p-0">
            <ToggleRow
              icon={<Bell className="h-4 w-4" />}
              label="Push notifications"
              hint="Invites, requests and estate updates"
              checked={notif}
              onChange={toggleNotif}
            />
            <ToggleRow
              icon={<Moon className="h-4 w-4" />}
              label="Dark mode"
              hint="Match your system or force dark"
              checked={dark}
              onChange={toggleDark}
            />
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-foreground">Language</div>
                  <div className="text-xs text-muted-foreground">Interface language</div>
                </div>
              </div>
              <select
                value={lang}
                onChange={(e) => changeLang(e.target.value)}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="pcm">Pidgin</option>
              </select>
            </div>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <div className="space-y-1.5">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </div>
            <div className="card-surface divide-y divide-border overflow-hidden">
              <LinkRow
                to="/app/resident/profile"
                icon={<User className="h-4 w-4" />}
                label="Edit profile"
              />
              <LinkRow
                to="/auth/reset-password"
                icon={<Lock className="h-4 w-4" />}
                label="Change password"
              />
            </div>
          </div>
        </StaggerItem>
      </Stagger>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm text-foreground">{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function LinkRow({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3 text-sm text-foreground">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        {label}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
