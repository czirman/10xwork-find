import { describe, expect, it } from "vitest";

import type { Skill } from "@/types";
import { buildSynonymIndex, matchKey, matchPosting, tokenizePosting, type SynonymMap } from "@/lib/services/matching";

const skill = (id: string, name: string): Skill => ({ id, name });

/**
 * Fixture map authored independently of the shipped seed so expectations are not
 * lifted from the map under test (Risk #1 oracle trap).
 */
const fixtureMap: SynonymMap = {
  Java: ["java", "core java"],
  Git: ["git", "version control", "vcs"],
  Docker: ["docker", "containers"],
  Kubernetes: ["kubernetes", "k8s"],
  "CI/CD": ["ci/cd", "continuous integration"],
  C: [],
  "C++": [],
  "C#": [],
};
const index = buildSynonymIndex(fixtureMap);

describe("matchKey — normalization equivalence (Risk #2)", () => {
  it.each([
    ["Git", " git "],
    ["Git", "GIT"],
    ["Git", "Git."],
    ["Git", "git,"],
    ["CI/CD", "ci/cd"],
    ["Node.js", "node.js"],
  ])("treats %j and %j as equal", (a, b) => {
    expect(matchKey(a)).toBe(matchKey(b));
  });

  it("preserves internal tech punctuation", () => {
    expect(matchKey("Node.js")).toBe("node.js");
    expect(matchKey("CI/CD")).toBe("ci/cd");
  });

  it("keeps C, C++ and C# distinct (collision guard)", () => {
    expect(matchKey("C++")).not.toBe(matchKey("C"));
    expect(matchKey("C#")).not.toBe(matchKey("C"));
    expect(matchKey("C++")).not.toBe(matchKey("C#"));
    expect(matchKey("C++")).toBe("c++");
    expect(matchKey("C#")).toBe("c#");
  });

  it("returns empty for punctuation-only input", () => {
    expect(matchKey("...")).toBe("");
    expect(matchKey("   ")).toBe("");
  });
});

describe("tokenizePosting", () => {
  it("splits on delimiters and trims", () => {
    expect(tokenizePosting("Java, Git; Docker\nKubernetes")).toEqual(["Java", "Git", "Docker", "Kubernetes"]);
  });

  it("keeps slash/dot/plus tokens intact", () => {
    expect(tokenizePosting("CI/CD | Node.js | C++")).toEqual(["CI/CD", "Node.js", "C++"]);
  });

  it("drops empties from bullet lists", () => {
    expect(tokenizePosting("• Java\n• Git\n")).toEqual(["Java", "Git"]);
  });
});

describe("matchPosting — classification", () => {
  it("maps synonyms to declared skills and assembles the section", () => {
    const skills = [skill("1", "Git"), skill("2", "Docker")];
    const result = matchPosting(skills, "Strong knowledge of version control and containers", index);
    expect(result.section).toBe("Git, Docker");
    expect(result.matched.map((s) => s.name)).toEqual(["Git", "Docker"]);
    expect(result.unmatched).toEqual([]);
  });

  it("resolves a term embedded in prose (hybrid containment)", () => {
    const skills = [skill("1", "Git")];
    const result = matchPosting(skills, "Familiarity with Git is required", index);
    expect(result.matched.map((s) => s.name)).toEqual(["Git"]);
  });

  it("lists terms with no declared-skill match as unmatched, deduped", () => {
    const skills = [skill("1", "Git")];
    const result = matchPosting(skills, "Git, Rust, Rust, Elixir", index);
    expect(result.section).toBe("Git");
    expect(result.unmatched).toEqual(["Rust", "Elixir"]);
  });

  it("treats a mapped-but-undeclared skill as unmatched (skill gap)", () => {
    const skills = [skill("1", "Git")];
    const result = matchPosting(skills, "Docker, Git", index);
    expect(result.section).toBe("Git");
    expect(result.unmatched).toEqual(["Docker"]);
  });

  it("emits the user's verbatim name, not the canonical casing", () => {
    const skills = [skill("1", "git")];
    const result = matchPosting(skills, "Version Control", index);
    expect(result.section).toBe("git");
  });

  it("keeps C++ and C# distinct in matching", () => {
    const skills = [skill("1", "C"), skill("2", "C++"), skill("3", "C#")];
    const result = matchPosting(skills, "C++", index);
    expect(result.matched.map((s) => s.name)).toEqual(["C++"]);
  });

  it("resolves both sides of a slash-joined compound", () => {
    const skills = [skill("1", "Docker"), skill("2", "Kubernetes")];
    const result = matchPosting(skills, "containers (Docker/Kubernetes)", index);
    expect(result.matched.map((s) => s.name)).toEqual(["Docker", "Kubernetes"]);
    expect(result.unmatched).toEqual([]);
  });

  it("still matches a slash-bearing canonical in prose (CI/CD guard)", () => {
    const skills = [skill("1", "CI/CD")];
    expect(matchPosting(skills, "CI/CD", index).section).toBe("CI/CD");
    expect(matchPosting(skills, "experience with CI/CD pipelines", index).section).toBe("CI/CD");
  });
});

describe("matchPosting — invariants", () => {
  it("output is a subset of declared skills (Risk #3)", () => {
    const skills = [skill("1", "Java"), skill("2", "Git")];
    const declaredIds = new Set(skills.map((s) => s.id));
    const result = matchPosting(skills, "Java, Git, Kubernetes, Docker, CI/CD, some random prose", index);
    for (const m of result.matched) {
      expect(declaredIds.has(m.id)).toBe(true);
    }
    // section contains only declared names
    const declaredNames = new Set(skills.map((s) => s.name));
    for (const name of result.section.split(", ").filter(Boolean)) {
      expect(declaredNames.has(name)).toBe(true);
    }
  });

  it("preserves declared-list order in the section (golden format, Risk #7)", () => {
    const skills = [skill("1", "Java"), skill("2", "Git"), skill("3", "Docker")];
    // Posting mentions them out of order; output still follows declared order.
    const result = matchPosting(skills, "Docker; Git; Java", index);
    expect(result.section).toBe("Java, Git, Docker");
  });

  it("returns an empty section and no matches for empty or match-less input", () => {
    const skills = [skill("1", "Java")];
    expect(matchPosting(skills, "", index)).toEqual({ section: "", matched: [], unmatched: [] });
    const none = matchPosting(skills, "Rust, Haskell", index);
    expect(none.section).toBe("");
    expect(none.matched).toEqual([]);
    expect(none.unmatched).toEqual(["Rust", "Haskell"]);
  });
});
