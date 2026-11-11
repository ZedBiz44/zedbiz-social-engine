import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mail } from "lucide-react";
import { BackButton, Field } from "@/components/flow-shared";
import { createPendingClaim } from "@/lib/save.functions";
import type { PendingCreateResult } from "@/lib/save-types";
import type { FlowState, PostIdea } from "@/lib/flow-types";
import type { SampleBusiness } from "@/lib/sample-data";

export function SaveStep({
  state,
  business,
  ideas,
  onReset,
  onBack,
}: {
  state: FlowState;
  business?: SampleBusiness | undefined;
  ideas: PostIdea[];
  onReset: () => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const fetchCreatePending = useServerFn(createPendingClaim);

  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState<number>(0);
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"choose" | "email" | "pending" | "error">("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result: PendingCreateResult = await fetchCreatePending({
        data: {
          email: email.trim(),
          businessName: business?.businessName ?? state.businessName,
          website: state.website,
          topic: state.selectedTopic ?? "",
          isCustomTopic: state.isCustomTopic,
          description: state.businessDescription,
          ideas,
          selectedIdeaIndex,
        },
      });
      if (result.ok) {
        setMaskedEmail(result.emailMasked);
        setPhase("pending");
        // Redirect to sign-in with the claim token so the visitor can claim
        // after verifying their email (works across browsers — token is in URL).
        navigate({ to: "/auth", search: { claim: result.claimToken } });
      } else {
        if (result.reason === "rate_limited") {
          setError("Too many attempts — please wait a minute and try again.");
        } else if (result.reason === "invalid_email") {
          setError("Please enter a valid email address.");
        } else {
          setError("We couldn't save your ideas right now. Please try again.");
        }
        setPhase("error");
      }
    } catch {
      setError("We couldn't save your ideas right now. Please try again.");
      setPhase("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">
          Save my ideas &amp; draft a post
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Pick the idea you want to draft, then enter your email. We'll save all three ideas to your
          account so you can draft and edit a post later.
        </p>

        <div className="mt-5 rounded-xl border border-dashed border-border bg-secondary/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What you're saving
          </p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Row k="Business" v={business?.businessName ?? state.businessName} />
            <Row k="Website" v={state.website} />
            <Row k="Topic" v={state.selectedTopic ?? "—"} />
            <Row k="Post ideas" v={`${ideas.length} drafted`} />
          </dl>
        </div>
      </div>

      {phase !== "pending" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold text-foreground">Choose an idea to draft</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All three ideas are saved. Pick the one you want to turn into a post first.
          </p>
          <div className="mt-4 space-y-3">
            {ideas.map((idea, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIdeaIndex(i)}
                className={[
                  "block w-full rounded-xl border p-4 text-left transition-all",
                  selectedIdeaIndex === i
                    ? "border-primary bg-accent/15"
                    : "border-border bg-background hover:border-primary/50",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      selectedIdeaIndex === i
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {selectedIdeaIndex === i ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{idea.hook}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{idea.angle}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={onSubmitEmail} className="mt-5 space-y-3">
            <Field label="Your email" htmlFor="saveEmail">
              <input
                id="saveEmail"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              We'll send a verification link. After you confirm, your ideas are saved to your
              account. No spam — we use this only to save your work.
            </p>
            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </span>
              ) : (
                "Save my ideas & draft a post"
              )}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <BackButton onClick={onBack} className="sm:w-auto" />
            <button
              type="button"
              onClick={onReset}
              className="w-full flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/30"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {phase === "pending" && (
        <div className="rounded-2xl border border-accent/60 bg-accent/15 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Check your email to finish saving
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                We've held onto your three ideas. Verify your email{" "}
                <span className="font-medium text-foreground">{maskedEmail}</span> and sign in to
                claim them and draft your post.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Taking you to the sign-in page… If you already have an account, just sign in with
                this email.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium text-foreground">{v}</dd>
    </div>
  );
}
