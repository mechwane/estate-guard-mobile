import { createFileRoute } from "@tanstack/react-router";
import { UserProfile } from "@/components/user-profile";

export const Route = createFileRoute("/app/super/profile")({
  component: () => <UserProfile roleLabel="Super Admin" />,
  head: () => ({ meta: [{ title: "Super Admin Profile — Estate Guard" }] }),
});
