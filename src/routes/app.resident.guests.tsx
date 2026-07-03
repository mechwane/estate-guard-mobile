import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, StatusBadge } from "@/components/ui-kit";
import { format } from "date-fns";
import { Users, UserPlus, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/resident/guests")({
  component: MyGuests,
});

type Tab = "active" | "used" | "expired";

function MyGuests() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("active");

  const { data } = useQuery({
    queryKey: ["my-invites", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_invites")
        .select("*")
        .eq("resident_id", session!.userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 20_000,
  });

  const grouped = useMemo(() => {
    const now = Date.now();
    const list = data ?? [];
    return {
      active: list.filter((i) => i.status === "active" && new Date(i.expires_at).getTime() > now),
      used: list.filter((i) => i.status === "used"),
      expired: list.filter(
        (i) =>
          i.status === "expired" ||
          i.status === "revoked" ||
          (i.status === "active" && new Date(i.expires_at).getTime() <= now),
      ),
    };
  }, [data]);

  const current = grouped[tab];

  return (
    <div className="space-y-4">
      <div className="card-surface flex items-center justify-between p-1.5">
        {(["active", "used", "expired"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t} ({grouped[t].length})
          </button>
        ))}
      </div>

      <Link
        to="/app/resident/invite"
        className="card-surface flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-muted/40"
      >
        <UserPlus className="h-4 w-4" /> New guest invite
      </Link>

      {current.length === 0 ? (
        <EmptyState title={`No ${tab} invites`} icon={<Users className="h-6 w-6" />} />
      ) : (
        <div className="space-y-2">
          {current.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{i.guest_name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {i.purpose || "Visit"} · {format(new Date(i.visit_time), "MMM d, p")}
                  </div>
                </div>
                <StatusBadge
                  tone={
                    i.status === "active" ? "primary" : i.status === "used" ? "success" : "neutral"
                  }
                >
                  {i.status}
                </StatusBadge>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Code
                </span>
                <span className="font-mono text-lg font-semibold tracking-widest text-foreground">
                  {i.code}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Expires {format(new Date(i.expires_at), "MMM d, p")}
                {i.checked_in_at && ` · Checked in ${format(new Date(i.checked_in_at), "p")}`}
                {i.checked_out_at && ` · Out ${format(new Date(i.checked_out_at), "p")}`}
              </div>
              {i.status === "active" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(i.code);
                      toast.success("Code copied");
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy code
                  </button>
                  <a
                    href={`https://wa.me/${(i.phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(`Your access code: ${i.code} — valid until ${format(new Date(i.expires_at), "MMM d, p")}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-dark"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
