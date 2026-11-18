import { z } from "zod";

/** Ids of checked-off items in a roadmap or study plan (topic ids, "w3-t2" task ids ...). */
export const progressSchema = z.object({
  completed: z.array(z.string().regex(/^[\w:.-]{1,80}$/, "Invalid item id")).max(1000),
});

export const parseCompleted = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export const MAX_SAVED = 20;
