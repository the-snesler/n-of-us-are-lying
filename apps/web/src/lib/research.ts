import type { Article } from "@nofus/shared";

export type ResearchStep = "choosing" | "writing" | "done";

export interface ResearchProgress {
  step: ResearchStep;
  /** Number of summaries submitted */
  completed: number;
  total: number;
  /** Article currently being written about (only when step === "writing") */
  currentArticle?: Article;
}

/**
 * Derive a player's self-paced research progress from their selected articles.
 * Players alternate choose -> write until they have `total` summaries.
 */
export function getResearchProgress(
  selectedArticles: Article[] | undefined,
  total: number,
): ResearchProgress {
  const articles = selectedArticles || [];
  const completed = articles.filter((a) => a.summary).length;
  const pending = articles.find((a) => !a.summary);

  if (pending) {
    return { step: "writing", completed, total, currentArticle: pending };
  }
  if (completed >= total) {
    return { step: "done", completed, total };
  }
  return { step: "choosing", completed, total };
}
