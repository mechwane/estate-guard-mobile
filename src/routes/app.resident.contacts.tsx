import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card, EmptyState } from "@/components/ui-kit";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion-kit";
import { Phone, Mail, Contact } from "lucide-react";

export const Route = createFileRoute("/app/resident/contacts")({
  component: Contacts,
});

function Contacts() {
  const { data: session } = useSession();
  const list = useQuery({
    queryKey: ["estate-contacts", session?.estate?.id],
    enabled: !!session?.estate?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estate_contacts")
        .select("*")
        .eq("estate_id", session!.estate!.id)
        .order("label");
      if (error) throw error;
      return data;
    },
  });

  if (!list.data || list.data.length === 0) {
    return (
      <FadeIn>
        <EmptyState
          title="No estate contacts yet"
          description="Your estate admin will add contact numbers here."
          icon={<Contact className="h-6 w-6" />}
        />
      </FadeIn>
    );
  }

  return (
    <Stagger className="space-y-2">
      {list.data.map((c) => (
        <StaggerItem key={c.id}>
          <Card className="p-4">
            <div className="text-sm font-medium text-foreground">{c.label}</div>
            {c.role && <div className="text-xs text-muted-foreground">{c.role}</div>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-primary">
                  <Phone className="h-3.5 w-3.5" /> {c.phone}
                </a>
              )}
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  className="inline-flex items-center gap-1 text-primary"
                >
                  <Mail className="h-3.5 w-3.5" /> {c.email}
                </a>
              )}
            </div>
          </Card>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
