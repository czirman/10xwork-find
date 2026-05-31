/**
 * Shared entity & DTO types for 10xwork-find.
 *
 * `Skill` is the cross-slice contract: S-01 manages the list; S-02 matches each
 * skill's `name` against job-posting terms via the synonym map, so `name` is a
 * join key — keep it the user's verbatim, normalized text.
 */

/** A single base skill in the user's personal list. */
export interface Skill {
  /** Stable identity — edit/delete operate by id, not by name. */
  id: string;
  /** User-facing skill name; the join key S-02 matches against postings. */
  name: string;
}

/**
 * Persisted localStorage envelope. Versioned so future schema changes have a
 * migration seam; reads must tolerate older/unknown shapes by falling back to
 * an empty list rather than throwing.
 */
export interface SkillsStore {
  version: 1;
  skills: Skill[];
}
