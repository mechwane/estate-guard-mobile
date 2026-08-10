import { createFileRoute } from "@tanstack/react-router";
import { Contact } from "lucide-react";
import { EstateContactsList } from "@/components/estate-contacts";
import { FadeIn } from "@/components/motion-kit";

export const Route = createFileRoute("/app/guard/contacts")({
  component: GuardContacts,
  head: () => ({
    meta: [
      { title: "Estate Contacts — Guard" },
      {
        name: "description",
        content:
          "Guards can call or chat with the estate manager, security supervisors and management team.",
      },
      { property: "og:title", content: "Estate Contacts — Guard" },
      {
        property: "og:description",
        content: "Call or chat with estate management from the guard app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function GuardContacts() {
  return (
    <div className="space-y-3">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Contact className="h-4 w-4 text-primary" /> Estate Contacts
        </h1>
        <p className="text-xs text-muted-foreground">
          Reach the estate manager, supervisors and security posts.
        </p>
      </FadeIn>
      <EstateContactsList chatTo="/app/guard/chat" />
    </div>
  );
}
