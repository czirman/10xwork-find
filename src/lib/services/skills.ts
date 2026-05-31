/**
 * Pure validation & dedup rules for base skills. No I/O — safe to unit-test in
 * isolation and reuse from both Add and Edit flows.
 *
 * Validation is deliberately PERMISSIVE: a skill's `name` is S-02's join key
 * against job-posting terms, so rejecting real skills ("C", "Go", "CI/CD",
 * "Node.js", ".NET", "C++", "C#") would silently break matching downstream.
 */

import type { Skill } from "@/types";

/** Maximum length for a skill name (guards accidental paragraph paste). */
export const MAX_SKILL_NAME_LENGTH = 80;

/**
 * Allowed characters: any Unicode letter or number, spaces, and common tech
 * punctuation (`+ # . / - _`). Rejects control characters and other
 * non-printable junk. Keeps "CI/CD", "Node.js", ".NET", "C++", "C#" valid.
 */
const ALLOWED_NAME = /^[\p{L}\p{N} +#./_-]+$/u;

/** Trim and collapse internal whitespace — the canonical stored form. */
export function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Case-insensitive, trimmed comparison key for dedup. */
export function dedupKey(name: string): string {
  return normalize(name).toLowerCase();
}

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validate a candidate skill name. Returns the normalized value on success,
 * or a Polish error message on failure. Min length is 1 (so single-char skills
 * like "C" pass); empty/whitespace-only is rejected.
 */
export function validateSkillName(name: string): ValidationResult {
  const value = normalize(name);

  if (value.length === 0) {
    return { ok: false, error: "Nazwa umiejętności nie może być pusta." };
  }
  if (value.length > MAX_SKILL_NAME_LENGTH) {
    return {
      ok: false,
      error: `Nazwa umiejętności jest za długa (maks. ${MAX_SKILL_NAME_LENGTH} znaków).`,
    };
  }
  if (!ALLOWED_NAME.test(value)) {
    return { ok: false, error: "Nazwa zawiera niedozwolone znaki." };
  }

  return { ok: true, value };
}

/**
 * True when another skill already shares the same dedup key. `excludeId` lets
 * an edit keep its own row without self-colliding.
 */
export function isDuplicate(name: string, skills: Skill[], excludeId?: string): boolean {
  const key = dedupKey(name);
  return skills.some((s) => s.id !== excludeId && dedupKey(s.name) === key);
}
