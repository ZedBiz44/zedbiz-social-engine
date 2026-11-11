import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  SAMPLE_BUSINESSES,
  GENERIC_TOPICS,
  buildGenericIdeas,
  matchSampleBusiness,
  type PostIdea,
  type TopicSuggestion,
} from "@/lib/sample-data";
import { EMPTY_STATE, type FlowState, type Step } from "@/lib/flow-types";
import { Header, ProgressBar, SampleBanner } from "@/components/flow-shared";
import { BusinessStep } from "@/components/steps/business-step";
import { TopicsStep } from "@/components/steps/topics-step";
import { IdeasStep } from "@/components/steps/ideas-step";
import { SaveStep } from "@/components/steps/save-step";
import { researchTopics, researchIdeas } from "@/lib/research.functions";
import type { IdeasResult, TopicsResult } from "@/lib/research-types";

type TopicsPhase = "idle" | "loading" | "done";
type IdeasPhase = "idle" | "loading" | "done";

export function SocialMediaMachine() {
  const [step, setStep] = useState<Step>("business");
  const [state, setState] = useState<FlowState>(EMPTY_STATE);
  const [customTopicDraft, setCustomTopicDraft] = useState("");
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Live research state
  const [topicsPhase, setTopicsPhase] = useState<TopicsPhase>("idle");
  const [topicsResult, setTopicsResult] = useState<TopicsResult | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [ideasPhase, setIdeasPhase] = useState<IdeasPhase>("idle");
  const [ideasResult, setIdeasResult] = useState<IdeasResult | null>(null);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  const fetchTopics = useServerFn(researchTopics);
  const fetchIdeas = useServerFn(researchIdeas);

  function patch(p: Partial<FlowState>) {
    setState((s) => ({ ...s, ...p }));
  }

  function handleBusinessSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.businessName.trim() || !state.website.trim()) return;
    const match = matchSampleBusiness(state.website);
    // Explicit flow mode — NOT inferred from matchedDomain presence or a
    // topic-id prefix. "sample" = fixture demo business; "live" = anything
    // else (drives whether the ideas Server Function is called).
    patch({
      matchedDomain: match ? match.domain : null,
      mode: match ? "sample" : "live",
      businessDescription: "",
      selectedTopic: null,
      isCustomTopic: false,
    });
    if (match) {
      // Sample business — show the labelled sample topics directly.
      setTopicsResult(null);
      setTopicsPhase("idle");
      setStep("topics");
    } else {
      // Unmatched site — kick off live research for topics.
      void runLiveTopics();
      setStep("topics");
    }
  }

  async function runLiveTopics() {
    setTopicsPhase("loading");
    setTopicsError(null);
    try {
      const result = await fetchTopics({
        data: {
          businessName: state.businessName,
          website: state.website,
          ...(state.businessDescription.trim()
            ? { description: state.businessDescription.trim() }
            : {}),
        },
      });
      setTopicsResult(result);
      setTopicsPhase("done");
    } catch {
      // Preserve inputs; show a clear, generic message (never raw errors).
      setTopicsError(
        "We couldn't research topics right now. Enter your own topic below, or try again in a moment.",
      );
      setTopicsPhase("done");
    }
  }

  const availableTopics: TopicSuggestion[] = useMemo(() => {
    if (state.matchedDomain) {
      const biz = SAMPLE_BUSINESSES.find((b) => b.domain === state.matchedDomain);
      return biz?.topics ?? [];
    }
    // Live research result, otherwise generic fallback.
    if (topicsResult?.topics && topicsResult.topics.length > 0) {
      return topicsResult.topics;
    }
    return GENERIC_TOPICS;
  }, [state.matchedDomain, topicsResult]);

  const business = useMemo(
    () =>
      state.matchedDomain
        ? SAMPLE_BUSINESSES.find((b) => b.domain === state.matchedDomain)
        : undefined,
    [state.matchedDomain],
  );

  function chooseTopic(title: string, isCustom: boolean) {
    patch({ selectedTopic: title, isCustomTopic: isCustom });
    if (state.mode === "sample") {
      // Fixture sample business — use the labelled sample ideas immediately,
      // no Server Function call.
      setIdeasResult(null);
      setIdeasPhase("idle");
      setStep("ideas");
    } else {
      // Live flow — EVERY topic (suggested or custom) in a successful
      // description-based flow calls the ideas Server Function with the
      // current business name, the selected topic, and the description.
      void runLiveIdeas(title, isCustom);
      setStep("ideas");
    }
  }

  async function runLiveIdeas(topic: string, isCustom: boolean) {
    setIdeasPhase("loading");
    setIdeasError(null);
    try {
      const result = await fetchIdeas({
        data: {
          businessName: state.businessName,
          website: state.website,
          topic,
          isCustom,
          ...(state.businessDescription.trim()
            ? { description: state.businessDescription.trim() }
            : {}),
        },
      });
      setIdeasResult(result);
      setIdeasPhase("done");
    } catch {
      setIdeasError(
        "We couldn't draft ideas right now. Sample-style ideas are shown below — or go back and try another topic.",
      );
      setIdeasPhase("done");
    }
  }

  const ideas: PostIdea[] = useMemo(() => {
    if (!state.selectedTopic) return [];
    if (state.mode === "sample" && business) {
      return business.ideasByTopic[state.selectedTopic] ?? [];
    }
    // Accept VALIDATED model output from either a live (website-text) or a
    // description-grounded request. The previous bug only accepted
    // source === "live", so a successful description-based generation
    // (source === "description") was bypassed here and generic templates
    // were shown under the "Based on your description" badge.
    if (
      (ideasResult?.source === "live" || ideasResult?.source === "description") &&
      ideasResult.ideas.length > 0
    ) {
      return ideasResult.ideas;
    }
    // No validated model output yet (loading, failure, or not connected) —
    // show clearly-labelled fallback templates so the preview still works.
    return buildGenericIdeas(state.businessDescription, state.selectedTopic);
  }, [state.selectedTopic, state.mode, business, ideasResult, state.businessDescription]);

  // Badges are derived from the ACTUAL topics/ideas response source — never
  // from a guessed topic-id prefix or the presence of a sample domain.
  // "Live research": real model request grounded in website text.
  // "Based on your description": real model request grounded in the visitor's
  //   one-sentence description. Both require validated model output.
  // Fallback/sample results show the muted "Sample suggestions" label only.
  const showLiveTopicsBadge = topicsResult?.source === "live";
  const showLiveIdeasBadge = ideasResult?.source === "live";
  const showDescTopicsBadge = topicsResult?.source === "description";
  const showDescIdeasBadge = ideasResult?.source === "description";
  const isLiveFlow = state.mode === "live";

  function copyIdea(idea: PostIdea, index: number) {
    const text = [
      `Hook: ${idea.hook}`,
      `Angle: ${idea.angle}`,
      `Reader takeaway: ${idea.takeaway}`,
    ].join("\n\n");
    void navigator.clipboard?.writeText(text);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex(null), 1800);
  }

  function reset() {
    setState(EMPTY_STATE);
    setCustomTopicDraft("");
    setShowCustomTopic(false);
    setCopiedIndex(null);
    setStep("business");
    setTopicsPhase("idle");
    setTopicsResult(null);
    setTopicsError(null);
    setIdeasPhase("idle");
    setIdeasResult(null);
    setIdeasError(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:pt-10">
        <ProgressBar step={step} />

        {step === "business" && (
          <BusinessStep state={state} onPatch={patch} onSubmit={handleBusinessSubmit} />
        )}

        {step === "topics" && (
          <TopicsStep
            state={state}
            business={business}
            topics={availableTopics}
            showCustomTopic={showCustomTopic}
            customTopicDraft={customTopicDraft}
            onCustomTopicDraft={setCustomTopicDraft}
            onToggleCustomTopic={setShowCustomTopic}
            onChoose={chooseTopic}
            onDescChange={(v) => patch({ businessDescription: v })}
            onBack={() => setStep("business")}
            isLive={isLiveFlow}
            showLiveBadge={showLiveTopicsBadge}
            showDescriptionBadge={showDescTopicsBadge}
            topicsPhase={topicsPhase}
            topicsResult={topicsResult}
            topicsError={topicsError}
            onRetryTopics={() => void runLiveTopics()}
          />
        )}

        {step === "ideas" && (
          <IdeasStep
            state={state}
            business={business}
            ideas={ideas}
            copiedIndex={copiedIndex}
            onCopy={copyIdea}
            onContinue={() => setStep("save")}
            onBack={() => setStep("topics")}
            isLive={isLiveFlow}
            showLiveBadge={showLiveIdeasBadge}
            showDescriptionBadge={showDescIdeasBadge}
            ideasPhase={ideasPhase}
            ideasError={ideasError}
          />
        )}

        {step === "save" && (
          <SaveStep
            state={state}
            business={business}
            ideas={ideas}
            onReset={reset}
            onBack={() => setStep("ideas")}
          />
        )}
      </main>
      <SampleBanner />
    </div>
  );
}
