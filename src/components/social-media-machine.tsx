import { useEffect, useMemo, useState } from "react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
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
import { AuthPanel } from "@/components/auth-panel";
import { OwnerDashboard } from "@/components/owner-dashboard";
import { researchTopics, researchIdeas } from "@/lib/research.functions";
import type { IdeasResult, TopicsResult } from "@/lib/research-types";
import { supabase } from "@/integrations/supabase/client";

// The whole save/auth/claim/dashboard flow lives inside the single registered
// "/" route. The prior /auth and /_authenticated/ route files were never picked
// up by the router plugin (so the editor showed "No preview available"), so we
// render the sign-in panel and the owner dashboard as in-route VIEWS driven by
// a validated ?view=/?claim= search param and the existing Cloud session.

const routeApi = getRouteApi("/");
type View = "public" | "auth" | "dashboard";

type TopicsPhase = "idle" | "loading" | "done";
type IdeasPhase = "idle" | "loading" | "done";

export function SocialMediaMachine() {
  const navigate = useNavigate();
  // Validated search params from the "/" route's validateSearch.
  const { view: urlView, claim: urlClaim } = routeApi.useSearch();

  // In-route view state. Starts "public" on both server and client (no
  // hydration mismatch); a browser-only effect reconciles it with the session
  // + the ?view=/?claim= params.
  const [view, setView] = useState<View>("public");
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  // Public flow state (persists across search-only navigations on "/").
  const [step, setStep] = useState<Step>("business");
  const [state, setState] = useState<FlowState>(EMPTY_STATE);
  const [customTopicDraft, setCustomTopicDraft] = useState("");
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [topicsPhase, setTopicsPhase] = useState<TopicsPhase>("idle");
  const [topicsResult, setTopicsResult] = useState<TopicsResult | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [ideasPhase, setIdeasPhase] = useState<IdeasPhase>("idle");
  const [ideasResult, setIdeasResult] = useState<IdeasResult | null>(null);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  const fetchTopics = useServerFn(researchTopics);
  const fetchIdeas = useServerFn(researchIdeas);

  // Reconcile view + claim with the Cloud session whenever the URL params
  // change (and once on mount). Browser-only: getUser() reads the session.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const isSignedIn = Boolean(data.user);
      setSignedIn(isSignedIn);
      if (urlClaim) {
        // Returning after email verification (even in another browser): claim
        // the preserved ideas if signed in, else show the sign-in panel.
        setClaimToken(urlClaim);
        setView(isSignedIn ? "dashboard" : "auth");
      } else if (urlView === "dashboard") {
        setView(isSignedIn ? "dashboard" : "public");
      } else if (urlView === "auth") {
        setView(isSignedIn ? "dashboard" : "auth");
      } else {
        setView("public");
      }
    })();
    return () => {
      active = false;
    };
  }, [urlView, urlClaim]);

  function goAuth(token: string) {
    setClaimToken(token);
    void navigate({ to: "/", search: { view: "auth", claim: token } });
  }

  function goDashboard(token?: string | null) {
    setClaimToken(token ?? null);
    void navigate({
      to: "/",
      search: { view: "dashboard", ...(token ? { claim: token } : {}) },
    });
  }

  function goPublic() {
    reset();
    void navigate({ to: "/", search: {} });
  }

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
      setTopicsResult(null);
      setTopicsPhase("idle");
      setStep("topics");
    } else {
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
      setIdeasResult(null);
      setIdeasPhase("idle");
      setStep("ideas");
    } else {
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
    // description-grounded request. Never bypass it for generic templates.
    if (
      (ideasResult?.source === "live" || ideasResult?.source === "description") &&
      ideasResult.ideas.length > 0
    ) {
      return ideasResult.ideas;
    }
    return buildGenericIdeas(state.businessDescription, state.selectedTopic);
  }, [state.selectedTopic, state.mode, business, ideasResult, state.businessDescription]);

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

  if (view === "auth") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <AuthPanel claimToken={claimToken} onSignedIn={(o) => goDashboard(o.claimToken)} />
        <SampleBanner />
      </div>
    );
  }

  if (view === "dashboard") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <OwnerDashboard claimToken={claimToken} onExit={goPublic} />
        <SampleBanner />
      </div>
    );
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
            signedIn={signedIn}
            onEnterAuth={goAuth}
            onClaimReady={(token) => goDashboard(token)}
            onReset={reset}
            onBack={() => setStep("ideas")}
          />
        )}
      </main>
      <SampleBanner />
    </div>
  );
}
