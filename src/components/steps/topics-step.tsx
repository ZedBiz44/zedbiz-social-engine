import { Lightbulb, Pencil } from "lucide-react";
import { BackButton, Field } from "@/components/flow-shared";
import type { FlowState, TopicSuggestion } from "@/lib/flow-types";
import type { SampleBusiness } from "@/lib/sample-data";

export function TopicsStep({
  state,
  business,
  topics,
  showCustomTopic,
  customTopicDraft,
  onCustomTopicDraft,
  onToggleCustomTopic,
  onChoose,
  onDescChange,
  onBack,
}: {
  state: FlowState;
  business?: SampleBusiness | undefined;
  topics: TopicSuggestion[];
  showCustomTopic: boolean;
  customTopicDraft: string;
  onCustomTopicDraft: (v: string) => void;
  onToggleCustomTopic: (v: boolean) => void;
  onChoose: (title: string, isCustom: boolean) => void;
  onDescChange: (v: string) => void;
  onBack: () => void;
}) {
  const needsDescription = !state.matchedDomain;
  const descriptionReady = state.businessDescription.trim().length > 0;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">
          {needsDescription
            ? "We couldn't read that site — tell us in one sentence"
            : `Two topics for ${business?.businessName ?? state.businessName}`}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {needsDescription
            ? "No problem. Describe what your business does and we'll suggest topics from that instead."
            : "Pick one to draft three post ideas, or enter your own topic."}
        </p>

        {needsDescription && (
          <div className="mt-5">
            <Field label="One-sentence business description" htmlFor="bizDesc">
              <textarea
                id="bizDesc"
                rows={2}
                value={state.businessDescription}
                onChange={(e) => onDescChange(e.target.value)}
                placeholder="e.g. We are a mobile dog groomer serving the west side, specialising in anxious dogs."
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Topic cards — disabled until description is ready on the unreadable path */}
      <div
        className={[
          "space-y-3 transition-opacity",
          needsDescription && !descriptionReady ? "pointer-events-none opacity-40" : "opacity-100",
        ].join(" ")}
      >
        {topics.map((t) => (
          <button
            key={t.title}
            type="button"
            onClick={() => onChoose(t.title, false)}
            className="block w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-primary">
                <Lightbulb className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold text-foreground">{t.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom topic entry */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {!showCustomTopic ? (
          <button
            type="button"
            onClick={() => onToggleCustomTopic(true)}
            className="flex w-full items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
          >
            <Pencil className="h-4 w-4" />
            Enter your own topic
          </button>
        ) : (
          <div className="space-y-3">
            <Field label="Your topic" htmlFor="customTopic">
              <input
                id="customTopic"
                type="text"
                value={customTopicDraft}
                onChange={(e) => onCustomTopicDraft(e.target.value)}
                placeholder="What do you want to post about?"
                className="w-full rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
              />
            </Field>
            <button
              type="button"
              disabled={!customTopicDraft.trim()}
              onClick={() => onChoose(customTopicDraft.trim(), true)}
              className="w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Use this topic
            </button>
          </div>
        )}
      </div>

      <BackButton onClick={onBack} />
    </section>
  );
}
