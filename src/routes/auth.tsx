// Public sign-in / sign-up route (email/password, email verification).
import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sign in — Social Media Machine by ZedBiz" },
      {
        name: "description",
        content: "Sign in or create an account to save your post ideas and drafts.",
      },
      { property: "og:title", content: "Sign in — Social Media Machine by ZedBiz" },
      { property: "og:description", content: "Sign in to save your post ideas and drafts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

export default AuthPage;
