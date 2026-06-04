import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

import type { SkillsStore } from "@/types";
import { STORAGE_KEY, useBaseSkills } from "./useBaseSkills";

beforeEach(() => {
  window.localStorage.clear();
});

describe("useBaseSkills", () => {
  it("starts empty when nothing is stored", () => {
    const { result } = renderHook(() => useBaseSkills());
    expect(result.current.skills).toEqual([]);
  });

  it("adds a skill and persists it to localStorage", () => {
    const { result } = renderHook(() => useBaseSkills());

    act(() => {
      expect(result.current.addSkill("Java")).toEqual({ ok: true });
    });

    expect(result.current.skills.map((s) => s.name)).toEqual(["Java"]);

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? "") as SkillsStore;
    expect(stored.version).toBe(1);
    expect(stored.skills.map((s) => s.name)).toEqual(["Java"]);
  });

  it("reads a previously persisted list back on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, skills: [{ id: "1", name: "Git" }] }));

    const { result } = renderHook(() => useBaseSkills());
    expect(result.current.skills).toEqual([{ id: "1", name: "Git" }]);
  });

  it("rejects a case-insensitive duplicate without adding", () => {
    const { result } = renderHook(() => useBaseSkills());

    act(() => {
      result.current.addSkill("Git");
    });
    act(() => {
      const r = result.current.addSkill("  git ");
      expect(r.ok).toBe(false);
    });

    expect(result.current.skills.map((s) => s.name)).toEqual(["Git"]);
  });

  it("edits a skill in place", () => {
    const { result } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Git");
    });
    const id = result.current.skills[0].id;

    act(() => {
      expect(result.current.editSkill(id, "GitHub")).toEqual({ ok: true });
    });
    expect(result.current.skills[0].name).toBe("GitHub");
  });

  it("removes then restores a skill at its original index", () => {
    const { result } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Java");
      result.current.addSkill("Git");
      result.current.addSkill("Docker");
    });

    const removed = result.current.skills[1]; // "Git"
    let undo: { id: string; index: number } | null = null;
    act(() => {
      const r = result.current.removeSkill(removed.id);
      undo = r && { id: r.skill.id, index: r.index };
    });
    expect(result.current.skills.map((s) => s.name)).toEqual(["Java", "Docker"]);
    expect(undo).toEqual({ id: removed.id, index: 1 });

    act(() => {
      result.current.restoreSkill(removed, 1);
    });
    expect(result.current.skills.map((s) => s.name)).toEqual(["Java", "Git", "Docker"]);
  });

  it("falls back to an empty list on malformed stored data", () => {
    window.localStorage.setItem(STORAGE_KEY, "{ not valid json");
    const { result } = renderHook(() => useBaseSkills());
    expect(result.current.skills).toEqual([]);
  });

  it("falls back to an empty list on an unexpected version", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, skills: [{ id: "1", name: "Git" }] }));
    const { result } = renderHook(() => useBaseSkills());
    expect(result.current.skills).toEqual([]);
  });
});

// Risk #6 — CRUD integrity. Oracle: FR-002 (edit is a first-class op that must not
// corrupt the list) and FR-003 (delete removes only the intended item). A CRUD bug
// here puts a wrong/duplicated/lost skill into the list the user relies on.
describe("editSkill integrity (#6)", () => {
  it("rejects renaming a skill onto a name already owned by a different skill, leaving the list unchanged", () => {
    const { result } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Git");
      result.current.addSkill("Java");
    });
    const before = result.current.skills.map((s) => ({ ...s }));
    const gitId = before[0].id;

    act(() => {
      // case-insensitive collision with the *other* skill ("Java")
      expect(result.current.editSkill(gitId, "java").ok).toBe(false);
    });

    expect(result.current.skills).toEqual(before);
  });

  it("rejects an empty/whitespace new name on edit, leaving the row unchanged", () => {
    const { result } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Git");
    });
    const before = result.current.skills.map((s) => ({ ...s }));

    act(() => {
      expect(result.current.editSkill(before[0].id, "   ").ok).toBe(false);
    });

    expect(result.current.skills).toEqual(before);
  });

  it("edits only the targeted skill and leaves its siblings byte-identical", () => {
    const { result } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Java");
      result.current.addSkill("Git");
      result.current.addSkill("Docker");
    });
    const [first, middle, last] = result.current.skills.map((s) => ({ ...s }));

    act(() => {
      expect(result.current.editSkill(middle.id, "GitHub")).toEqual({ ok: true });
    });

    expect(result.current.skills[0]).toEqual(first);
    expect(result.current.skills[2]).toEqual(last);
    expect(result.current.skills[1]).toEqual({ id: middle.id, name: "GitHub" });
  });
});

describe("removeSkill integrity (#6)", () => {
  it("returns null and leaves the list unchanged when the id does not exist", () => {
    const { result } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Java");
      result.current.addSkill("Git");
    });
    const before = result.current.skills.map((s) => ({ ...s }));

    let returned: unknown = "sentinel";
    act(() => {
      returned = result.current.removeSkill("does-not-exist");
    });

    expect(returned).toBeNull();
    expect(result.current.skills).toEqual(before);
  });
});
