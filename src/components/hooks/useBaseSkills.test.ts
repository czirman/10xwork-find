import { describe, it, expect, beforeEach, vi } from "vitest";
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

// Risk #4 — persistence & degrade-safely. Oracle: FR-004 (the base-skills list must
// survive across sessions) and NFR robustness (the on-device tool must not crash when
// storage is unavailable). The headline proof is a true round-trip *through a remount*:
// the write side and read side are tested separately above, but only a mutate → unmount →
// fresh mount cycle proves a session boundary is actually crossed.
describe("persistence round-trip (#4)", () => {
  it("persists an added skill across a simulated restart", () => {
    const { result, unmount } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Java");
    });
    // Literal expected list: the name we set, plus the id the hook generated.
    const expected = [{ id: result.current.skills[0].id, name: "Java" }];

    unmount();
    const remounted = renderHook(() => useBaseSkills());
    expect(remounted.result.current.skills).toEqual(expected);
  });

  it("persists an edited skill across a simulated restart", () => {
    const { result, unmount } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Git");
    });
    const id = result.current.skills[0].id;
    act(() => {
      result.current.editSkill(id, "GitHub");
    });
    const expected = [{ id, name: "GitHub" }];

    unmount();
    const remounted = renderHook(() => useBaseSkills());
    expect(remounted.result.current.skills).toEqual(expected);
  });

  it("persists a deletion across a simulated restart", () => {
    const { result, unmount } = renderHook(() => useBaseSkills());
    act(() => {
      result.current.addSkill("Java");
      result.current.addSkill("Git");
    });
    const javaId = result.current.skills[0].id;
    const gitId = result.current.skills[1].id;
    act(() => {
      result.current.removeSkill(gitId);
    });
    const expected = [{ id: javaId, name: "Java" }];

    unmount();
    const remounted = renderHook(() => useBaseSkills());
    expect(remounted.result.current.skills).toEqual(expected);
  });
});

// Risk #4 — degrade-safely. The discard-and-start-fresh behavior on unreadable stored
// bytes is a *conscious* product decision, not an accident of `readStore`.
describe("destroy-on-open is a conscious decision (#4)", () => {
  // Oracle: the 2026-06-04 decision — unknown/future schema versions and corrupt bytes
  // are intentionally discarded (start-fresh), per the `SkillsStore` contract comment in
  // `src/types.ts:17-24` ("reads must tolerate older/unknown shapes by falling back to an
  // empty list"). Expected values trace to that decision, NOT to `readStore` output.
  it.each([
    ["an unknown-version envelope", JSON.stringify({ version: 99, skills: [{ id: "old", name: "Stale" }] })],
    ["corrupt JSON", "{ not valid json"],
  ])("opens empty on %s and persists a clean v1 envelope after the first add", (_label, seed) => {
    window.localStorage.setItem(STORAGE_KEY, seed);

    const { result } = renderHook(() => useBaseSkills());
    expect(result.current.skills).toEqual([]);

    act(() => {
      result.current.addSkill("Java");
    });

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? "") as SkillsStore;
    expect(stored.version).toBe(1);
    // Exact-array match: proves the prior unreadable bytes (e.g. the stale `Stale` entry)
    // are gone by design, replaced by a clean v1 envelope holding only the new add.
    expect(stored.skills.map((s) => s.name)).toEqual(["Java"]);
  });
});

// Risk #4 — NFR robustness: best-effort persistence must not crash CRUD when the
// on-device store is unavailable (quota exceeded / private mode).
describe("CRUD survives a storage-write failure (#4)", () => {
  it("keeps an add in memory without throwing when localStorage.setItem fails", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    try {
      const { result } = renderHook(() => useBaseSkills());
      act(() => {
        expect(result.current.addSkill("Java")).toEqual({ ok: true });
      });
      expect(result.current.skills.map((s) => s.name)).toEqual(["Java"]);
      // Guard against a false green: the throwing path must actually be exercised.
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
