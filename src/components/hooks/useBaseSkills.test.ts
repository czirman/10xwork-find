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
