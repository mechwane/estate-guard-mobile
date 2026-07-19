import { createFileRoute } from "@tanstack/react-router";
import { UserProfile } from "@/components/user-profile";

export const Route = createFileRoute("/app/admin/profile")({
  component: () => <UserProfile roleLabel="Estate Admin" />,
  head: () => ({ meta: [{ title: "Admin Profile — Estate Guard" }] }),
});
