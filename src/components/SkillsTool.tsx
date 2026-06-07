import BaseSkillsManager from "@/components/BaseSkillsManager";
import PostingMatcher from "@/components/PostingMatcher";
import { useBaseSkills } from "@/components/hooks/useBaseSkills";

/**
 * Parent island that owns the single `useBaseSkills` instance and shares it with
 * both children, so a skill added in the manager is immediately matchable by the
 * posting matcher (no reload, no state drift). This is the only island mounted at
 * `#app-root`.
 */
export default function SkillsTool() {
  const baseSkills = useBaseSkills();

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Umiejętności bazowe" className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Twoje umiejętności bazowe</h2>
        <BaseSkillsManager {...baseSkills} />
      </section>

      <PostingMatcher skills={baseSkills.skills} />
    </div>
  );
}
