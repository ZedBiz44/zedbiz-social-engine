// Owner dashboard route — lists the signed-in user's saved idea sets + drafts.
import { createFileRoute } from "@tanstack/react-router";
import { OwnerDashboard } from "@/components/owner-dashboard";

export const Route = createFileRoute("/_authenticated/")({
  component: OwnerDashboard,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My saved ideas & drafts — Social Media Machine by ZedBiz" },
      {
        name: "description",
        content: "Your saved post idea sets and drafted captions, signed in to your account.",
      },
      { property: "og:title", content: "My saved ideas & drafts — Social Media Machine" },
      { property: "og:description", content: "Your saved post idea sets and drafted captions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

export default OwnerDashboard;
