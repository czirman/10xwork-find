import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBaseSkills } from "@/components/hooks/useBaseSkills";
import type { Skill } from "@/types";

/** How long the "Cofnij" (undo) affordance stays available after a delete. */
const UNDO_WINDOW_MS = 6000;

interface PendingUndo {
  skill: Skill;
  index: number;
}

/**
 * Interactive surface for managing base skills: add, list, inline-edit,
 * delete-with-undo. All persistence/validation lives in {@link useBaseSkills};
 * this component owns only transient UI state. Mounted client-only (see
 * index.astro) so it never touches localStorage during SSR.
 */
export default function BaseSkillsManager() {
  const { skills, addSkill, editSkill, removeSkill, restoreSkill } = useBaseSkills();

  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function clearUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setPendingUndo(null);
  }

  function handleAdd(e: React.SyntheticEvent) {
    e.preventDefault();
    const result = addSkill(addValue);
    if (result.ok) {
      setAddValue("");
      setAddError(null);
    } else {
      setAddError(result.error);
    }
  }

  function startEdit(skill: Skill) {
    setEditingId(skill.id);
    setEditValue(skill.name);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function handleEditSave(e: React.SyntheticEvent) {
    e.preventDefault();
    if (editingId === null) return;
    const result = editSkill(editingId, editValue);
    if (result.ok) {
      setEditingId(null);
      setEditError(null);
    } else {
      setEditError(result.error);
    }
  }

  function handleDelete(skill: Skill) {
    const removed = removeSkill(skill.id);
    if (!removed) return;
    if (editingId === skill.id) cancelEdit();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPendingUndo(removed);
    undoTimer.current = setTimeout(clearUndo, UNDO_WINDOW_MS);
  }

  function handleUndo() {
    if (pendingUndo) restoreSkill(pendingUndo.skill, pendingUndo.index);
    clearUndo();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={addValue}
            onChange={(e) => {
              setAddValue(e.target.value);
              if (addError) setAddError(null);
            }}
            aria-label="Nazwa umiejętności"
            aria-invalid={addError ? true : undefined}
            placeholder="np. Java, Git, CI/CD"
          />
          <Button type="submit">Dodaj</Button>
        </div>
        {addError && (
          <p role="alert" className="text-destructive text-sm">
            {addError}
          </p>
        )}
      </form>

      {pendingUndo && (
        <div
          role="status"
          className="bg-muted/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <span>Usunięto „{pendingUndo.skill.name}”.</span>
          <Button type="button" variant="ghost" size="sm" onClick={handleUndo}>
            Cofnij
          </Button>
        </div>
      )}

      {skills.length === 0 ? (
        <p className="text-sm text-gray-500">Nie masz jeszcze żadnych umiejętności. Dodaj pierwszą powyżej.</p>
      ) : (
        <ul aria-label="Twoje umiejętności" className="flex flex-col gap-2">
          {skills.map((skill) =>
            editingId === skill.id ? (
              <li key={skill.id}>
                <form onSubmit={handleEditSave} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        if (editError) setEditError(null);
                      }}
                      aria-label="Edytuj nazwę umiejętności"
                      aria-invalid={editError ? true : undefined}
                      autoFocus
                    />
                    <Button type="submit">Zapisz</Button>
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Anuluj
                    </Button>
                  </div>
                  {editError && (
                    <p role="alert" className="text-destructive text-sm">
                      {editError}
                    </p>
                  )}
                </form>
              </li>
            ) : (
              <li key={skill.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span>{skill.name}</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Edytuj ${skill.name}`}
                    onClick={() => {
                      startEdit(skill);
                    }}
                  >
                    Edytuj
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Usuń ${skill.name}`}
                    onClick={() => {
                      handleDelete(skill);
                    }}
                  >
                    Usuń
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
