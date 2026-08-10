import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Phone, Mail, Contact, MessageSquare, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState, ErrorState, ListSkeleton } from "@/components/ui-kit";
import { Stagger, StaggerItem } from "@/components/motion-kit";

/**
 * Estate contact directory (estate manager, security posts, accountant…) with a
 * Call action and a Chat action that opens the live management thread.
 */
export function EstateContactsList({ chatTo }: { chatTo: string }) {
  const { data: session } = useSession();
  const estateId = session?.estate?.id;

  const list = useQuery({
    queryKey: ["estate-contacts", estateId],
    enabled: !!estateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estate_contacts")
        .select("*")
        .eq("estate_id", estateId!)
        .order("label");
      if (error) throw error;
      return data;
    },
  });

  if (list.isLoading) return <ListSkeleton rows={4} />;
  if (list.isError) return <ErrorState onRetry={() => list.refetch()} />;

  if (!list.data || list.data.length === 0) {
    return (
      <EmptyState
        title="No estate contacts yet"
        description="Your estate admin will add contact numbers here."
        icon={<Contact className="h-6 w-6" />}
      />
    );
  }

  return (
    <Stagger className="space-y-3">
      {list.data.map((c) => (
        <StaggerItem key={c.id}>
          <Card className="p-4 transition-shadow hover:shadow-md">
            <div className="text-sm font-semibold uppercase leading-snug text-foreground">
              {c.label}
            </div>
            {c.role && <div className="mt-0.5 text-xs text-muted-foreground">{c.role}</div>}

            {c.phone && (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                  <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.phone}</span>
                </span>
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition-transform hover:bg-muted/50 active:scale-95"
                >
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              </div>
            )}

            {c.email && (
              <a
                href={`mailto:${c.email}`}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary"
              >
                <Mail className="h-3.5 w-3.5" /> {c.email}
              </a>
            )}

            <Link
              to={chatTo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-transform hover:bg-muted/50 active:scale-[0.98]"
            >
              <MessageSquare className="h-4 w-4" /> Chat
            </Link>
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
