import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { ResidentChat } from "@/components/estate-chat";
import { Stagger, StaggerItem } from "@/components/motion-kit";

export const Route = createFileRoute("/app/resident/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Chat with management — Estate Guard" },
      {
        name: "description",
        content:
          "Message your estate management team in real time about codes, bills, access and complaints.",
      },
      { property: "og:title", content: "Chat with management — Estate Guard" },
      {
        property: "og:description",
        content: "Real-time chat between residents and their estate management team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ChatPage() {
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
