import { useEffect, useState } from "react";

import type { Skill } from "@/types";
import { isDuplicate, validateSkillName } from "@/lib/services/skills";

/** Single namespaced localStorage key holding the versioned skills envelope. */
export const STORAGE_KEY = "10xwork-find:base-skills";

export type MutationResult = { ok: true } | { ok: false; error: string };

export interface UseBaseSkills {
  skills: Skill[];
  /** Validate + dedup, then append. New ids are generated here. */
  addSkill: (name: string) => MutationResult;
  /** Validate + dedup (excluding self), then rename in place. */
  editSkill: (id: string, name: string) => MutationResult;
  /** Hard-delete by id; returns the removed skill + its index for undo, or null. */
  removeSkill: (id: string) => { skill: Skill; index: number } | null;
  /** Re-insert a previously removed skill at its original index (undo). */
  restoreSkill: (skill: Skill, index: number) => void;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `skill_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** SSR-safe, defensive read: tolerate missing key / bad JSON / wrong version. */
function readStore(): Skill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { version?: unknown }).version !== 1 ||
      !Array.isArray((parsed as { skills?: unknown }).skills)
    ) {
      return [];
    }
    return (parsed as { skills: unknown[] }).skills.filter(
      (s): s is Skill =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Skill).id === "string" &&
        typeof (s as Skill).name === "string",
    );
  } catch {
    return [];
  }
}

function writeStore(skills: Skill[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, skills }));
  } catch (err) {
    // Best-effort persistence: quota exceeded or storage disabled
    // (e.g. private mode) must not crash the persist effect — but the
    // silent data loss must still be observable for diagnosis.
    console.warn("useBaseSkills: failed to persist base-skills to localStorage", err);
  }
}

/**
 * Owns base-skills state + localStorage persistence so UI stays presentational.
 * Reads the envelope once on mount, writes on every change.
 */
export function useBaseSkills(): UseBaseSkills {
  const [skills, setSkills] = useState<Skill[]>(readStore);

  useEffect(() => {
    writeStore(skills);
  }, [skills]);

  function addSkill(name: string): MutationResult {
    const result = validateSkillName(name);
    if (!result.ok) return result;
    if (isDuplicate(result.value, skills)) {
      return { ok: false, error: "Ta umiejętność już istnieje." };
    }
    setSkills((prev) => [...prev, { id: newId(), name: result.value }]);
    return { ok: true };
  }

  function editSkill(id: string, name: string): MutationResult {
    const result = validateSkillName(name);
    if (!result.ok) return result;
    if (isDuplicate(result.value, skills, id)) {
      return { ok: false, error: "Ta umiejętność już istnieje." };
    }
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, name: result.value } : s)));
    return { ok: true };
  }

  function removeSkill(id: string): { skill: Skill; index: number } | null {
    const index = skills.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const skill = skills[index];
    setSkills((prev) => prev.filter((s) => s.id !== id));
    return { skill, index };
  }

  function restoreSkill(skill: Skill, index: number): void {
    setSkills((prev) => {
      if (prev.some((s) => s.id === skill.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(Math.max(index, 0), next.length), 0, skill);
      return next;
    });
  }

  return { skills, addSkill, editSkill, removeSkill, restoreSkill };
}
