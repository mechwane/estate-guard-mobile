import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { ResidentChat } from "@/components/estate-chat";
import { Stagger, StaggerItem } from "@/components/motion-kit";

export const Route = createFileRoute("/app/guard/chat")({
  component: GuardChatPage,
  head: () => ({
    meta: [
      { title: "Chat with management — Guard" },
      {
        name: "description",
        content:
          "Guards message the estate management team in real time about access, incidents and visitors.",
      },
      { property: "og:title", content: "Chat with management — Guard" },
      {
        property: "og:description",
        content: "Real-time chat between estate guards and management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function GuardChatPage() {
  return (
    <Stagger className="space-y-3">
      <StaggerItem>
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="h-4 w-4 text-primary" /> Chat with management
        </h1>
        <p className="text-xs text-muted-foreground">
          Replies arrive live — no need to refresh the page.
        </p>
      </StaggerItem>
      <StaggerItem>
        <ResidentChat />
      </StaggerItem>
    </Stagger>
  );
}
