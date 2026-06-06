import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { matchPosting, type MatchResult } from "@/lib/services/matching";
import { SYNONYM_INDEX } from "@/lib/services/synonym-map";
import type { Skill } from "@/types";

interface PostingMatcherProps {
  /** The user's live declared skills (owned by the parent's single useBaseSkills). */
  skills: Skill[];
}

/**
 * S-02 surface: paste a job posting, generate a CV-ready comma-separated skills
 * section (drawn only from declared skills via the synonym map) + a flat list of
 * unmatched terms, with clipboard copy. Pure matching lives in `matching.ts`;
 * this component owns only transient UI state. Mounted client-only via the parent.
 */
export default function PostingMatcher({ skills }: PostingMatcherProps) {
  const [posting, setPosting] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate(e: React.SyntheticEvent) {
    e.preventDefault();
    setCopied(false);

    if (skills.length === 0) {
      setResult(null);
      setError("Najpierw dodaj swoje umiejętności bazowe powyżej.");
      return;
    }
    if (posting.trim().length === 0) {
      setResult(null);
      setError("Wklej treść oferty pracy.");
      return;
    }

    setError(null);
    setResult(matchPosting(skills, posting, SYNONYM_INDEX));
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.section);
      setCopied(true);
      setError(null);
    } catch {
      setCopied(false);
      setError("Nie udało się skopiować do schowka. Skopiuj tekst ręcznie.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Dopasuj do oferty</h2>
        <p className="text-sm text-gray-500">
          Wklej wymagania z oferty, aby otrzymać sekcję umiejętności gotową do CV.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="flex flex-col gap-2">
        <textarea
          value={posting}
          onChange={(e) => {
            setPosting(e.target.value);
            if (error) setError(null);
          }}
          aria-label="Treść oferty pracy"
          aria-invalid={error ? true : undefined}
          placeholder="Wklej tutaj wymagania z oferty pracy…"
          rows={8}
          className={cn(
            "border-input placeholder:text-muted-foreground min-h-32 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          )}
        />
        <div>
          <Button type="submit">Generuj</Button>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="flex flex-col gap-4">
          {result.section ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Sekcja umiejętności do CV</h3>
              <p
                aria-label="Wygenerowana sekcja umiejętności"
                className="bg-muted/40 rounded-md border px-3 py-2 text-sm"
              >
                {result.section}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  Kopiuj
                </Button>
                {copied && (
                  <span role="status" className="text-sm text-gray-500">
                    Skopiowano do schowka.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p role="status" className="text-sm text-gray-500">
              Żadna z Twoich umiejętności nie pasuje do tej oferty.
            </p>
          )}

          {result.unmatched.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Nierozpoznane terminy z oferty</h3>
              <ul aria-label="Nierozpoznane terminy" className="flex flex-wrap gap-2">
                {result.unmatched.map((term) => (
                  <li key={term} className="bg-muted/40 rounded-md border px-2 py-1 text-sm">
                    {term}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
