import type { PostIdea, TopicSuggestion } from "@/lib/sample-data";

export type Step = "business" | "topics" | "ideas" | "save";

export type FlowState = {
  businessName: string;
  website: string;
  /** Set when the website matched a sample business. */
  matchedDomain: string | null;
  /** Set when the site could not be read — visitor supplies a description. */
  businessDescription: string;
  selectedTopic: string | null;
  /** Whether the selected topic was a custom (visitor-entered) one. */
  isCustomTopic: boolean;
};

export const EMPTY_STATE: FlowState = {
  businessName: "",
  website: "",
  matchedDomain: null,
  businessDescription: "",
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
