import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, ErrorState, ListSkeleton } from "@/components/ui-kit";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/app/super/settings")({
  component: PlatformSettings,
});

type SettingsForm = {
  support_email: string;
  company_name: string;
  contact_phone: string;
  privacy_policy: string;
  terms: string;
  invite_expiry_days: string;
  premium_features: string;
  platform_notice: string;
};

const DEFAULTS: SettingsForm = {
  support_email: "",
  company_name: "",
  contact_phone: "",
  privacy_policy: "",
  terms: "",
  invite_expiry_days: "14",
  premium_features: "",
  platform_notice: "",
};

function PlatformSettings() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(DEFAULTS);

  const settings = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "general")
        .maybeSingle();
      if (error) throw error;
      const value = (data?.value && typeof data.value === "object" ? data.value : {}) as Partial<SettingsForm>;
      const next = { ...DEFAULTS, ...value };
      setForm(next);
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const inviteDays = Number(form.invite_expiry_days);
      if (!Number.isFinite(inviteDays) || inviteDays < 1) throw new Error("Invite expiry must be at least 1 day");
      const { error } = await supabase.from("platform_settings").upsert({
        key: "general",
        value: form,
        updated_by: session?.userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Platform settings saved");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (settings.isLoading) return <ListSkeleton rows={5} />;
  if (settings.isError) return <ErrorState onRetry={() => settings.refetch()} />;

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="App support email" value={form.support_email} onChange={(v) => setForm({ ...form, support_email: v })} type="email" />
          <Field label="Company / contact name" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
          <Field label="Contact phone" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
          <Field label="Invite expiry defaults (days)" value={form.invite_expiry_days} onChange={(v) => setForm({ ...form, invite_expiry_days: v })} type="number" />
        </div>
        <Area label="General platform notice" value={form.platform_notice} onChange={(v) => setForm({ ...form, platform_notice: v })} />
        <Area label="Premium feature settings" value={form.premium_features} onChange={(v) => setForm({ ...form, premium_features: v })} />
        <Area label="Privacy policy content" value={form.privacy_policy} onChange={(v) => setForm({ ...form, privacy_policy: v })} rows={5} />
        <Area label="Terms and conditions content" value={form.terms} onChange={(v) => setForm({ ...form, terms: v })} rows={5} />
        <button disabled={save.isPending} onClick={() => save.mutate()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
          {save.isPending ? "Saving…" : "Save platform settings"}
        </button>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

function Area({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}