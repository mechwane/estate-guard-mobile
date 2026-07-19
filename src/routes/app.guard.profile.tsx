import { createFileRoute } from "@tanstack/react-router";
import { UserProfile } from "@/components/user-profile";

export const Route = createFileRoute("/app/guard/profile")({
  component: () => <UserProfile roleLabel="Guard" />,
  head: () => ({ meta: [{ title: "Guard Profile — Estate Guard" }] }),
});
