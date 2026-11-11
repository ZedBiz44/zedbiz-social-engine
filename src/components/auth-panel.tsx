// Public sign-in / sign-up panel (email/password, email verification).
//
// Rendered INSIDE the working "/" route as a view (not a separate route file),
// because the router plugin had not registered the prior /auth and
// /_authenticated/ modules in the generated route tree, so the editor showed
// "No preview available". This keeps everything on the single registered route.
//
// After sign-in we stay on "/" and switch the view to the dashboard. If a claim
// token is present (returned after email verification, even in another
// browser), it is read from the validated ?claim= search param by the parent.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Field } from "@/components/flow-shared";
import type { PostIdea } from "@/lib/sample-data";

export type ViewMode = "signin" | "signup";

export function AuthPanel({
  claimToken,
  onSignedIn,
}: {
  claimToken?: string | null;
  onSignedIn: (opts: { claimToken?: string | null }) => void;
}) {
  const [mode, setMode] = useState<ViewMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        setInfo(
          "Check your email for a verification link. After you confirm, sign in to claim your saved ideas.",
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        // Signed in — hand control back to the parent. If a claim token is
        // waiting, pass it along so the dashboard can claim the preserved
        // ideas. Works across browsers because the token travels in the URL.
        onSignedIn({ claimToken: claimToken ?? null });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          {mode === "signin" ? "Sign in to save your ideas" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to save your three ideas and draft a post."
            : "Create an account to save ideas and drafts. We'll send a verification link to your email."}
        </p>

        {claimToken && (
          <div className="mt-4 rounded-xl border border-accent/60 bg-accent/15 p-3 text-xs text-foreground">
            Your ideas are waiting. Sign in with the email you used to save them to claim them.
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Email" htmlFor="authEmail">
            <input
              id="authEmail"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Password" htmlFor="authPassword">
            <input
              id="authPassword"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg border border-accent/60 bg-accent/15 px-3 py-2 text-sm text-foreground">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === "signin" ? "Signing in…" : "Creating account…"}
              </span>
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-medium text-primary hover:text-primary/80"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-medium text-primary hover:text-primary/80"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

// Re-export for callers that only want the PostIdea type via this module path.
export type { PostIdea };
