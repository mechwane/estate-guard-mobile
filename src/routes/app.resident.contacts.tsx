import { createFileRoute } from "@tanstack/react-router";
import { Contact } from "lucide-react";
import { EstateContactsList } from "@/components/estate-contacts";
import { FadeIn } from "@/components/motion-kit";

export const Route = createFileRoute("/app/resident/contacts")({
  component: Contacts,
  head: () => ({
    meta: [
      { title: "Estate Contacts — Estate Guard" },
      {
        name: "description",
        content:
          "Call or chat with your estate manager, security posts and management team directly from the app.",
      },
      { property: "og:title", content: "Estate Contacts — Estate Guard" },
      {
        property: "og:description",
        content: "Reach your estate manager and security team by call or live chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Contacts() {
  return (
    <div className="space-y-3">
      <FadeIn>
        <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Contact className="h-4 w-4 text-primary" /> Estate Contacts
        </h1>
        <p className="text-xs text-muted-foreground">
          Call or chat with estate management and security.
        </p>
      </FadeIn>
      <EstateContactsList chatTo="/app/resident/chat" />
    </div>
  );
}
