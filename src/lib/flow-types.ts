import type { PostIdea, TopicSuggestion } from "@/lib/sample-data";

export type Step = "business" | "topics" | "ideas" | "save";

export type FlowMode = "sample" | "live";

export type FlowState = {
  businessName: string;
  website: string;
  /** Set when the website matched a sample business. */
  matchedDomain: string | null;
  /**
   * Explicit flow mode — "sample" for the fixture demo businesses, "live" for
   * any other site. Drives whether the ideas Server Function is called. This
   * is NOT inferred from matchedDomain presence or a topic-id prefix.
   */
  mode: FlowMode;
  /** Set when the site could not be read — visitor supplies a description. */
  businessDescription: string;
  /** Extracted short business summary from openrouter:web_fetch website text. */
  businessSummary: string;
  selectedTopic: string | null;
  /** Whether the selected topic was a custom (visitor-entered) one. */
  isCustomTopic: boolean;
};

export const EMPTY_STATE: FlowState = {
  businessName: "",
  website: "",
  matchedDomain: null,
  mode: "sample",
  businessDescription: "",
  businessSummary: "",
  selectedTopic: null,
  isCustomTopic: false,
};

export const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "business", label: "Your business" },
  { key: "topics", label: "Pick a topic" },
  { key: "ideas", label: "Post ideas" },
  { key: "save", label: "Save" },
];

export const SAMPLE_PREVIEW: {
  label: string;
  businessName: string;
  website: string;
}[] = [
  {
    label: "ZedBiz Services (Live site)",
    businessName: "ZedBiz",
    website: "https://zedbiz.com/services",
  },
  {
    label: "Maple Crust Bakery",
    businessName: "Maple Crust Bakery",
    website: "maplecrustbakery.com",
  },
  {
    label: "Northgate Fitness",
    businessName: "Northgate Fitness",
    website: "northgatefitness.ca",
  },
];

export type { PostIdea, TopicSuggestion };
