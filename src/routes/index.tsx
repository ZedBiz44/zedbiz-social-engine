import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SocialMediaMachine } from "@/components/social-media-machine";

// The save / auth / claim / dashboard flow is rendered INSIDE this single
// registered route as in-route views, driven by the validated ?view= and
// ?claim= search params + the existing Cloud session. The prior /auth and
// /_authenticated/ route files were never picked up by the router plugin, so
// keeping them broke the build and the editor preview. ?view= drives which
// panel renders; ?claim= carries the one-time claim token back after email
// verification (even in another browser).
const searchSchema = z.object({
  view: z.enum(["public", "auth", "dashboard"]).optional(),
  claim: z.string().min(8).max(200).optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: SocialMediaMachine,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "Social Media Machine by ZedBiz — Post Ideas in Minutes",
      },
      {
        name: "description",
        content:
          "Tell us your business and website. We suggest topics, then draft three post ideas you can use right away.",
      },
      { property: "og:title", content: "Social Media Machine by ZedBiz" },
      {
        property: "og:description",
        content:
          "Turn what you do into posts people actually read. Sample preview — no email collected.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap",
      },
    ],
  }),
});

export default SocialMediaMachine;
