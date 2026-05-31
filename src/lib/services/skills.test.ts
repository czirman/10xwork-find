import { describe, it, expect } from "vitest";

import type { Skill } from "@/types";
import { dedupKey, isDuplicate, normalize, validateSkillName, MAX_SKILL_NAME_LENGTH } from "./skills";

const mk = (id: string, name: string): Skill => ({ id, name });

describe("normalize", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalize("  Spring   Boot  ")).toBe("Spring Boot");
  });
});

describe("validateSkillName", () => {
  it("rejects empty input with an error message", () => {
    const r = validateSkillName("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.error).toBe("string");
  });

  it("rejects whitespace-only input", () => {
    expect(validateSkillName("   ").ok).toBe(false);
  });

  it("accepts single-character skills (min length 1)", () => {
    for (const name of ["C", "R", "Go"]) {
      expect(validateSkillName(name)).toEqual({ ok: true, value: name });
    }
  });

  it("accepts real skills with tech punctuation", () => {
    for (const name of ["CI/CD", "Node.js", ".NET", "C++", "C#", "Spring-Boot"]) {
      expect(validateSkillName(name).ok).toBe(true);
    }
  });

  it("returns the normalized value on success", () => {
    expect(validateSkillName("  Java  ")).toEqual({ ok: true, value: "Java" });
  });

  it("rejects names longer than the max length", () => {
    const tooLong = "a".repeat(MAX_SKILL_NAME_LENGTH + 1);
    expect(validateSkillName(tooLong).ok).toBe(false);
  });

  it("accepts a name exactly at the max length", () => {
    const atLimit = "a".repeat(MAX_SKILL_NAME_LENGTH);
    expect(validateSkillName(atLimit).ok).toBe(true);
  });

  it("rejects control characters and emoji junk", () => {
    expect(validateSkillName("Java\u0001").ok).toBe(false);
    expect(validateSkillName("Java\u{1F600}").ok).toBe(false);
  });
});

describe("dedupKey", () => {
  it("is case-insensitive and trimmed", () => {
    expect(dedupKey("Git")).toBe(dedupKey("  git "));
  });
});

describe("isDuplicate", () => {
  const skills = [mk("1", "Git"), mk("2", "Java")];

  it("detects a case-insensitive trimmed duplicate", () => {
    expect(isDuplicate("git ", skills)).toBe(true);
  });

  it("returns false for a genuinely new name", () => {
    expect(isDuplicate("Docker", skills)).toBe(false);
  });

  it("excludes the edited row itself via excludeId", () => {
    // Renaming skill #1 to its own (differently-cased) name is not a duplicate.
    expect(isDuplicate("GIT", skills, "1")).toBe(false);
    // But colliding with a *different* skill still is.
    expect(isDuplicate("java", skills, "1")).toBe(true);
  });
});
