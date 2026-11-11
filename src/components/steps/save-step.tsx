import { Check } from "lucide-react";
import { BackButton } from "@/components/flow-shared";
import type { FlowState, PostIdea } from "@/lib/flow-types";
import type { SampleBusiness } from "@/lib/sample-data";

export function SaveStep({
  state,
  business,
  ideas,
  saved,
  onSave,
  onReset,
  onBack,
}: {
  state: FlowState;
  business?: SampleBusiness | undefined;
  ideas: PostIdea[];
  saved: boolean;
  onSave: () => void;
  onReset: () => void;
  onBack: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">
          Save my ideas &amp; draft a post
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          You're previewing the full flow with sample data. In this preview, “Save” doesn't store
          anything yet.
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

        <div className="mt-5 rounded-xl border border-accent/60 bg-accent/15 p-4">
          <p className="text-sm font-medium text-foreground">Saving connects in the next phase.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            In the next phase, this button will save your ideas and draft a post to your account.
            For now it's a preview — no email is collected and nothing is stored.
          </p>
        </div>

        {!saved ? (
          <button
            type="button"
            onClick={onSave}
            className="mt-5 w-full rounded-lg bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Save my ideas &amp; draft a post
          </button>
        ) : (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-accent bg-accent/20 px-4 py-3 text-sm font-medium text-foreground">
            <Check className="h-4 w-4 text-primary" />
            Preview complete — nothing was saved (sample data).
          </div>
        )}

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
