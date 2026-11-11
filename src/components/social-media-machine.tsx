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
  const [saved, setSaved] = useState(false);

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
    patch({
      matchedDomain: match ? match.domain : null,
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
    if (state.matchedDomain) {
      // Sample business — use the labelled sample ideas immediately.
      setIdeasResult(null);
      setIdeasPhase("idle");
      setStep("ideas");
    } else {
      // Live — kick off idea generation.
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
    if (state.matchedDomain && business) {
      return business.ideasByTopic[state.selectedTopic] ?? [];
    }
    if (ideasResult?.source === "live" && ideasResult.ideas.length > 0) {
      return ideasResult.ideas;
    }
    return buildGenericIdeas(state.businessDescription, state.selectedTopic);
  }, [state.selectedTopic, state.matchedDomain, business, ideasResult, state.businessDescription]);

  const liveIdeasSource = ideasResult?.source === "live" || ideasResult?.source === "description";
  // "Live research" badge is shown only when a real model request succeeded
  // and was grounded in website text. Description-based results get their own
  // "Based on your description" label; fallback/sample never show "Live".
  const showLiveTopicsBadge = topicsResult?.source === "live";
  const showLiveIdeasBadge = ideasResult?.source === "live";
  const showDescTopicsBadge = topicsResult?.source === "description";
  const showDescIdeasBadge = ideasResult?.source === "description";

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
    setSaved(false);
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
            isLive={!state.matchedDomain}
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
            isLive={!state.matchedDomain}
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
            saved={saved}
            onSave={() => setSaved(true)}
            onReset={reset}
            onBack={() => setStep("ideas")}
          />
        )}
      </main>
      <SampleBanner />
    </div>
  );
}
