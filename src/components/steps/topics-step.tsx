import { AlertCircle, Lightbulb, Loader2, Pencil, RefreshCw } from "lucide-react";
import { BackButton, Field } from "@/components/flow-shared";
import type { FlowState, TopicSuggestion } from "@/lib/flow-types";
import type { TopicsResult } from "@/lib/research-types";
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
  isLive,
  showLiveBadge,
  showDescriptionBadge,
  topicsPhase,
  topicsResult,
  topicsError,
  onRetryTopics,
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
  isLive: boolean;
  showLiveBadge: boolean;
  showDescriptionBadge: boolean;
  topicsPhase: "idle" | "loading" | "done";
  topicsResult: TopicsResult | null;
  topicsError: string | null;
  onRetryTopics: () => void;
}) {
  const loading = isLive && topicsPhase === "loading";
  const needsDescription =
    isLive &&
    !state.matchedDomain &&
    (topicsResult?.needsDescription ?? false) &&
    (topicsResult?.topics?.length ?? 0) === 0;
  const descriptionReady = state.businessDescription.trim().length > 0;
  const isFallback = isLive && !loading && (topicsResult?.source === "fallback" || !!topicsError);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <h2 className="text-lg font-bold text-foreground sm:text-xl">
          {isLive
            ? loading
              ? "Reading your website…"
              : needsDescription
                ? "We couldn't read that site — tell us in one sentence"
                : `Two topics for ${state.businessName}`
            : `Two topics for ${business?.businessName ?? state.businessName}`}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isLive
            ? loading
              ? "Fetching your website with managed web fetch, then drafting two business-specific topics."
              : needsDescription
                ? "No problem. Describe what your business does and we'll suggest topics from that instead."
                : "Pick one to draft three post ideas, or enter your own topic."
            : "Pick one to draft three post ideas, or enter your own topic."}
        </p>

        {/* Source badge — only when a real model request succeeded. */}
        {!loading && !needsDescription && (showLiveBadge || showDescriptionBadge) && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {showLiveBadge ? "Live research" : "Based on your description"}
          </span>
        )}
        {/* Sample suggestions label for fallback output. */}
        {!loading && !needsDescription && isFallback && topics.length > 0 && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Sample suggestions
          </span>
        )}

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
            <button
              type="button"
              disabled={!descriptionReady}
              onClick={onRetryTopics}
              className="mt-3 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Suggest topics from my description
            </button>
          </div>
        )}
      </div>

      {/* Setup / fallback / error notice (plain-language; never credentials) */}
      {isLive && !loading && (topicsResult?.setup || topicsError || isFallback) && (
        <div className="rounded-2xl border border-accent/60 bg-accent/10 p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {topicsResult?.setup
                  ? "Live research isn't connected yet"
                  : topicsError
                    ? "Couldn't generate topics right now"
                    : "Showing sample suggestions"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {topicsError ??
                  topicsResult?.note ??
                  "Showing sample-style topics so you can preview the full flow."}
              </p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Reading your website…
        </div>
      )}

      {!loading && topics.length > 0 && (
        <>
          <div className="space-y-3">
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

          {isLive && !needsDescription && (showLiveBadge || showDescriptionBadge) && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onRetryTopics}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate topics
              </button>
            </div>
          )}
        </>
      )}

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
