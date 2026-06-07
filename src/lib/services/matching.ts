/**
 * Pure matching engine for S-02 (generate tailored skills section). No I/O — the
 * UI passes in the declared skills, the raw posting text, and a prebuilt synonym
 * index, and gets back a CV-ready section + the unmatched terms.
 *
 * Runs client-side (data-locality NFR). Free of Node built-ins on purpose so a
 * future dependency can't reintroduce the `path.posix` Workers bug.
 */

import type { Skill } from "@/types";
import { dedupKey } from "@/lib/services/skills";

/** Developer-curated map: canonical skill name → posting phrasings that mean it. */
export type SynonymMap = Record<string, string[]>;

/** Inverted lookup built once from a {@link SynonymMap}: matchKey(phrase) → canonical. */
export type SynonymIndex = Map<string, string>;

export interface MatchResult {
  /** Matched declared-skill names, in declared-list order, deduped, joined by ", ". */
  section: string;
  /** The matched declared skills — always a subset of the skills passed in. */
  matched: Skill[];
  /** Distinct posting terms (first-seen casing) that matched no declared skill. */
  unmatched: string[];
}

/**
 * Edge punctuation is stripped, but `+` and `#` are preserved so "C", "C++" and
 * "C#" never collapse to the same key. Only the *edges* are stripped, so internal
 * punctuation survives ("Node.js" → "node.js", "CI/CD" → "ci/cd").
 */
const STRIP_LEADING = /^[^\p{L}\p{N}+#]+/u;
const STRIP_TRAILING = /[^\p{L}\p{N}+#]+$/u;

/**
 * Punctuation-tolerant comparison key for matching. Builds on `dedupKey` (trim +
 * collapse whitespace + lowercase) by stripping leading/trailing punctuation,
 * preserving `+`/`#`. Additive — never mutate the S-01 primitives.
 */
export function matchKey(name: string): string {
  return dedupKey(name).replace(STRIP_LEADING, "").replace(STRIP_TRAILING, "");
}

/**
 * Term delimiters for free-text postings. Deliberately excludes `/ + # . -` so
 * "CI/CD", "C++", "C#", "Node.js" and "front-end" survive as single tokens
 * (their edge punctuation, if any, is handled by {@link matchKey}).
 */
const DELIMITERS = /[\n\r\t,;|()[\]{}•●▪·*]+/;

/** Split a raw posting into trimmed, non-empty candidate terms. */
export function tokenizePosting(text: string): string[] {
  return text
    .split(DELIMITERS)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

/** Build the inverted index: every synonym AND each canonical maps to its canonical. */
export function buildSynonymIndex(map: SynonymMap): SynonymIndex {
  const index: SynonymIndex = new Map();
  for (const [canonical, synonyms] of Object.entries(map)) {
    for (const phrase of [canonical, ...synonyms]) {
      const key = matchKey(phrase);
      if (key && !index.has(key)) index.set(key, canonical);
    }
  }
  return index;
}

/** True when `needle` appears as a contiguous run of whole words inside `haystack`. */
function isContiguous(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    let matched = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/**
 * Hybrid lookup for one candidate term: exact inverted-index hit first, else
 * whole-word containment of any synonym phrase within the term (so "knowledge of
 * Git" resolves "Git"). Containment is checked against both the space-split words
 * and a slash-split variant, so slash-joined compounds ("Docker/Kubernetes",
 * "Java/J2EE") resolve each side — while exact lookup above keeps slash-bearing
 * canonicals like "CI/CD" intact. Returns the union of all matched canonicals.
 */
function canonicalsForTerm(termKey: string, index: SynonymIndex): string[] {
  const exact = index.get(termKey);
  if (exact) return [exact];

  const wordSets = [termKey.split(" "), termKey.split(/[ /]+/)];
  const found = new Set<string>();
  for (const [synKey, canonical] of index) {
    const syn = synKey.split(" ");
    if (wordSets.some((words) => isContiguous(words, syn))) found.add(canonical);
  }
  return [...found];
}

/**
 * Classify each posting term against the user's declared skills via the synonym
 * index. Output is provably a subset of `skills`: a canonical only contributes
 * when it joins to a declared skill by {@link matchKey}, and the declared skill's
 * verbatim `name` is what gets emitted. A term that yields no declared skill
 * (map gap or undeclared skill) is reported as unmatched.
 */
export function matchPosting(skills: Skill[], postingText: string, index: SynonymIndex): MatchResult {
  const declaredByKey = new Map<string, Skill>();
  for (const skill of skills) {
    const key = matchKey(skill.name);
    if (key && !declaredByKey.has(key)) declaredByKey.set(key, skill);
  }

  const matchedIds = new Set<string>();
  const unmatched: string[] = [];
  const seenUnmatched = new Set<string>();

  for (const term of tokenizePosting(postingText)) {
    const termKey = matchKey(term);
    if (!termKey) continue;

    let matchedThisTerm = false;
    for (const canonical of canonicalsForTerm(termKey, index)) {
      const skill = declaredByKey.get(matchKey(canonical));
      if (skill) {
        matchedIds.add(skill.id);
        matchedThisTerm = true;
      }
    }

    if (!matchedThisTerm && !seenUnmatched.has(termKey)) {
      seenUnmatched.add(termKey);
      unmatched.push(term);
    }
  }

  const matched = skills.filter((skill) => matchedIds.has(skill.id));
  return { section: matched.map((skill) => skill.name).join(", "), matched, unmatched };
}
