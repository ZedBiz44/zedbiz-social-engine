import { useMemo, useState } from "react";
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

export function SocialMediaMachine() {
  const [step, setStep] = useState<Step>("business");
  const [state, setState] = useState<FlowState>(EMPTY_STATE);
  const [customTopicDraft, setCustomTopicDraft] = useState("");
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

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
    });
    setStep("topics");
  }

  const availableTopics: TopicSuggestion[] = useMemo(() => {
    if (state.matchedDomain) {
      const biz = SAMPLE_BUSINESSES.find((b) => b.domain === state.matchedDomain);
      return biz?.topics ?? [];
    }
    return GENERIC_TOPICS;
  }, [state.matchedDomain]);

  const business = useMemo(
    () =>
      state.matchedDomain
        ? SAMPLE_BUSINESSES.find((b) => b.domain === state.matchedDomain)
        : undefined,
    [state.matchedDomain],
  );

  function chooseTopic(title: string, isCustom: boolean) {
    patch({ selectedTopic: title, isCustomTopic: isCustom });
    setStep("ideas");
  }

  const ideas: PostIdea[] = useMemo(() => {
    if (!state.selectedTopic) return [];
    if (state.matchedDomain && business) {
      return business.ideasByTopic[state.selectedTopic] ?? [];
    }
    return buildGenericIdeas(state.businessDescription, state.selectedTopic);
  }, [state.selectedTopic, state.matchedDomain, business, state.businessDescription]);

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
