// Thin server-function wrappers (client-safe to import). All real logic
// lives in research.server.ts so this file stays a pure RPC boundary.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { researchIdeasServer, researchTopicsServer } from "@/lib/research.server";

const topicsSchema = z.object({
  businessName: z.string().min(1).max(120),
  website: z.string().min(1).max(300),
  description: z.string().max(400).optional(),
});

export const researchTopics = createServerFn({ method: "POST" })
  .validator((data) => topicsSchema.parse(data))
  .handler(async ({ data }) =>
    researchTopicsServer({
      businessName: data.businessName,
      website: data.website,
      ...(data.description ? { description: data.description } : {}),
    }),
  );

const ideasSchema = z.object({
  businessName: z.string().min(1).max(120),
  website: z.string().min(1).max(300),
  topic: z.string().min(1).max(200),
  isCustom: z.boolean(),
  description: z.string().max(400).optional(),
});

export const researchIdeas = createServerFn({ method: "POST" })
  .validator((data) => ideasSchema.parse(data))
  .handler(async ({ data }) =>
    researchIdeasServer({
      businessName: data.businessName,
      website: data.website,
      topic: data.topic,
      isCustom: data.isCustom,
      ...(data.description ? { description: data.description } : {}),
    }),
  );
