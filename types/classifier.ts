/**
 * Future phase: content-aware filtering (e.g. allow a React tutorial on YouTube, block a music video).
 *
 * This file only defines the contract. Nothing in the MVP implements or calls it, and the MVP
 * makes no classification claims. See README "Future: content classification".
 */

export type ContentCategory =
  | 'education'
  | 'work'
  | 'music'
  | 'entertainment'
  | 'gaming'
  | 'social'
  | 'unknown';

/** The minimal public metadata a content script would extract. Nothing else leaves the page. */
export interface ContentMetadata {
  url: string;
  title: string;
  description?: string;
  /** Platform-provided category if publicly exposed (e.g. YouTube's genre meta tag). */
  platformCategory?: string;
}

export interface ClassificationResult {
  category: ContentCategory;
  /** 0–1. Implementations must report low confidence honestly rather than guessing. */
  confidence: number;
  allowed: boolean;
  /** Human-readable explanation shown to the user. */
  reason: string;
  /** Which implementation produced this, e.g. `rules` or `local-model`. Never mislabel rules as AI. */
  source: string;
}

export interface ContentClassifier {
  readonly id: string;
  classify(
    metadata: ContentMetadata,
    allowedCategories: ReadonlySet<ContentCategory>,
  ): Promise<ClassificationResult>;
}
