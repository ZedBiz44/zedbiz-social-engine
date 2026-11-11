import { Check, Copy } from "lucide-react";
import { BackButton } from "@/components/flow-shared";
import type { FlowState, PostIdea } from "@/lib/flow-types";
import type { SampleBusiness } from "@/lib/sample-data";

export function IdeasStep({
  state,
  business,
  ideas,
  copiedIndex,
  onCopy,
  onContinue,
  onBack,
}: {
  state: FlowState;
  business?: SampleBusiness | undefined;
  ideas: PostIdea[];
  copiedIndex: number | null;
  onCopy: (idea: PostIdea, index: number) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">
          Three post ideas for {business?.businessName ?? state.businessName}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Topic: <span className="font-medium text-foreground">{state.selectedTopic}</span>
          {state.isCustomTopic && <span className="ml-1 text-muted-foreground">(your topic)</span>}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          All three are shown below — review them before saving anything.
        </p>
      </div>

      <div className="space-y-4">
        {ideas.map((idea, i) => (
          <article
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Post idea
              </span>
            </div>

            <IdeaBlock label="Hook" value={idea.hook} />
            <IdeaBlock label="Business angle" value={idea.angle} />
            <IdeaBlock label="Reader takeaway" value={idea.takeaway} />

            <button
              type="button"
              onClick={() => onCopy(idea, i)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary sm:w-auto"
            >
              {copiedIndex === i ? (
                <>
                  <Check className="h-4 w-4 text-primary" /> Copied idea
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy idea
                </>
              )}
            </button>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <BackButton onClick={onBack} className="sm:w-auto" />
        <button
          type="button"
          onClick={onContinue}
          className="w-full flex-1 rounded-lg bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Save my ideas &amp; draft a post
        </button>
      </div>
    </section>
  );
}

function IdeaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}
