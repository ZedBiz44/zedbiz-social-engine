// Sample data for the Social Media Machine public flow.
//
// IMPORTANT: This is clearly-labelled SAMPLE data for preview only. It is NOT
// live research, not scraped, and not connected to any real backend. The
// "website" field is matched against a small set of demo businesses so the
// preview can show the full flow end-to-end. Any site that does not match a
// demo business falls through to the "site cannot be read" path, which asks
// the visitor for a one-sentence business description instead.

export type PostIdea = {
  hook: string;
  angle: string; // business-specific angle
  takeaway: string; // useful reader takeaway
};

export type TopicSuggestion = {
  title: string;
  blurb: string;
};

export type SampleBusiness = {
  /** Domain the visitor might type, normalised (no protocol, lowercase). */
  domain: string;
  businessName: string;
  /** Short description used to generate ideas. */
  description: string;
  topics: TopicSuggestion[];
  ideasByTopic: Record<string, PostIdea[]>;
};

export const SAMPLE_BUSINESSES: SampleBusiness[] = [
  {
    domain: "maplecrustbakery.com",
    businessName: "Maple Crust Bakery",
    description:
      "Neighbourhood artisan bakery selling sourdough, pastries, and seasonal pies, with a small wholesale program for local cafés.",
    topics: [
      {
        title: "Behind the morning bake",
        blurb: "Show what a 4am start really looks like and why the bread tastes the way it does.",
      },
      {
        title: "Pairing pastries with your coffee order",
        blurb: "Help regulars choose the right pastry for their usual flat white or pour-over.",
      },
    ],
    ideasByTopic: {
      "Behind the morning bake": [
        {
          hook: "Your sourdough is 18 hours old by the time you taste it — here's why that matters.",
          angle:
            "Maple Crust's overnight cold ferment is the thing regulars never see but always taste. Make the unseen work the story.",
          takeaway:
            "Readers learn why a long, slow ferment builds deeper flavour than a fast rise — and what to look for in a real sourdough loaf.",
        },
        {
          hook: "The first loaf out of the oven never goes to a customer. Here's where it goes.",
          angle:
            "Turn the bakery's quality-control ritual into a quiet promise about standards that the front counter never breaks.",
          takeaway:
            "A simple test for telling a properly baked loaf from an under-proofed one, using the tap-and-listen trick bakers rely on.",
        },
        {
          hook: "We threw out more flour this week than most bakeries bake. On purpose.",
          angle:
            "Frame Maple Crust's willingness to discard a weak starter as the reason the bread is consistent, not wasteful.",
          takeaway:
            "Why a healthy sourdough starter smells like green apple and doubles predictably — a 30-second check home bakers can copy.",
        },
      ],
      "Pairing pastries with your coffee order": [
        {
          hook: "Ordering a flat white? Don't reach for the croissant. Reach for this.",
          angle:
            "Use Maple Crust's café-wholesale relationships to position the bakery as the pairing expert, not just the supplier.",
          takeaway:
            "A simple rule for matching butter-rich pastries to milk-forward coffees and fruit-filled ones to brighter, acidic brews.",
        },
        {
          hook: "Your pour-over wants a pastry with a little acid. Here's the one.",
          angle:
            "Tie the seasonal fruit galette to single-origin coffee seasonality so the post feels timely rather than evergreen filler.",
          takeaway:
            "How acidity in both coffee and fruit filling can either clash or sing — and one pairing to try this week.",
        },
        {
          hook: "We asked 200 regulars what they order together. Three pairings surprised us.",
          angle:
            "Turn Maple Crust's loyalty into social proof by sharing what the regulars already do, then nudging newcomers toward it.",
          takeaway:
            "Three reliable coffee-and-pastry pairings that work across most menus, so readers can order with confidence anywhere.",
        },
      ],
    },
  },
  {
    domain: "northgatefitness.ca",
    businessName: "Northgate Fitness",
    description:
      "Independent strength-training studio for adults 40+ focused on sustainable training, mobility, and coaching over quick-fix transformations.",
    topics: [
      {
        title: "Strength after 40 without wrecking your knees",
        blurb: "Reassure the studio's core audience that lifting is still for them — done right.",
      },
      {
        title: "The 15-minute mobility habit that fixes stiff mornings",
        blurb: "A small, repeatable win that fits the studio's sustainable-training philosophy.",
      },
    ],
    ideasByTopic: {
      "Strength after 40 without wrecking your knees": [
        {
          hook: "If your knees crack when you stand up, this is the lift you're probably avoiding — and shouldn't.",
          angle:
            "Position Northgate's coaching around controlled, loaded squats as the thing that protects joints rather than punishing them.",
          takeaway:
            "Why a shallow, tempo-controlled box squat builds knee resilience, with one cue readers can try during their next session.",
        },
        {
          hook: "The strongest 55-year-old in our studio doesn't deadlift heavy. Here's what she does instead.",
          angle:
            "Use a real (composite) member story to make sustainable training feel achievable, not aspirational.",
          takeaway:
            "A twice-weekly hinge-and-carry routine that builds strength without peak loads, plus how to progress it safely over a month.",
        },
        {
          hook: "You don't need to squat below parallel. You need to squat to your hips.",
          angle:
            "Reframe a common gym myth through Northgate's individualised-coaching lens so the post reads as expertise, not opinion.",
          takeaway:
            "How to find your own safe squat depth using a box or bench, and why depth is a range, not a rule.",
        },
      ],
      "The 15-minute mobility habit that fixes stiff mornings": [
        {
          hook: "The first 15 minutes of your morning shouldn't be your workout. They should be this.",
          angle:
            "Anchor the habit to Northgate's 'training is a lifestyle' message so mobility feels like part of the program, not an extra.",
          takeaway:
            "A four-move morning mobility sequence that takes 15 minutes and needs no equipment, with reps and tempo spelled out.",
        },
        {
          hook: "Stretching isn't fixing your stiff back. Breathing is. Here's the drill.",
          angle:
            "Show off Northgate's mobility coaching by teaching a counter-intuitive technique most posts get wrong.",
          takeaway:
            "A 90-second crocodile-breathing drill that decompresses the lower back, with a simple way to feel whether it's working.",
        },
        {
          hook: "We tracked 40 members' morning stiffness for a month. One habit beat the rest.",
          angle:
            "Use the studio's coaching culture as the evidence base so the claim feels earned rather than generic.",
          takeaway:
            "The single habit that correlated with the biggest drop in reported stiffness, and how to build it into a busy weekday morning.",
        },
      ],
    },
  },
];

/**
 * Two generic topic suggestions used when a site cannot be read and the
 * visitor gives a one-sentence description instead. They're deliberately
 * broad so they fit almost any business.
 */
export const GENERIC_TOPICS: TopicSuggestion[] = [
  {
    title: "The problem you solve that customers don't name",
    blurb:
      "Surface the unspoken pain your offering quietly fixes, framed from the customer's side of the counter.",
  },
  {
    title: "A behind-the-scenes look at how you do one thing well",
    blurb:
      "Pick a single part of your process and make the craft visible — process builds trust faster than promises.",
  },
];

/**
 * Builds three post ideas for a generic business description. Deterministic
 * so the preview is stable, but clearly templated from the description.
 */
export function buildGenericIdeas(description: string, topicTitle: string): PostIdea[] {
  const clean = description.trim().replace(/\.$/, "");
  const label = clean || "your business";
  return [
    {
      hook: `Most ${label} advice skips the boring part. That's the part that actually matters.`,
      angle: `Lead with the unglamorous step your offering handles for customers, and frame it as the real value — not the flashy outcome.`,
      takeaway:
        "Readers get a one-line test for telling serious providers from marketing-only ones, so they can choose with more confidence.",
    },
    {
      hook: `Here's the question we ask first when someone wants help from ${label}.`,
      angle: `Turn your intake/discovery question into a post that demonstrates expertise and filters for the right customers at once.`,
      takeaway:
        "A single diagnostic question readers can ask themselves before they spend money, plus what their answer usually means.",
    },
    {
      hook: `The fastest way to tell if ${label} is working: look at what stopped being annoying.`,
      angle: `Reframe success around the disappearance of a daily friction, which fits ${topicTitle.toLowerCase()} without sounding like a sales pitch.`,
      takeaway:
        "Three small signs that a service is doing its job, so readers can judge results without needing a dashboard or a report.",
    },
  ];
}

/** Normalise a user-entered website string for matching against sample domains. */
export function normaliseWebsite(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/** Try to match a website to a sample business. Returns null if no match. */
export function matchSampleBusiness(website: string): SampleBusiness | null {
  const norm = normaliseWebsite(website);
  if (!norm) return null;
  return (
    SAMPLE_BUSINESSES.find((b) => b.domain === norm) ??
    SAMPLE_BUSINESSES.find((b) => b.domain.includes(norm) || norm.includes(b.domain)) ??
    null
  );
}
