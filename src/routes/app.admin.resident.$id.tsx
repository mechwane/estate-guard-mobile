import { createFileRoute } from "@tanstack/react-router";
import { ResidentProfilePanel } from "@/components/resident-profile-panel";

export const Route = createFileRoute("/app/admin/resident/$id")({
  component: ResidentProfileRoute,
  head: () => ({
    meta: [
      { title: "Resident Profile — Estate Guard" },
      {
        name: "description",
        content:
          "Full resident record: access methods, devices, payment summary and address information.",
      },
      { property: "og:title", content: "Resident Profile — Estate Guard" },
      {
        property: "og:description",
        content: "Manage a single resident's access, billing and address details.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResidentProfileRoute() {
  const { id } = Route.useParams();
  return <ResidentProfilePanel id={id} />;
}
