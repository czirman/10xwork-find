import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BaseSkillsManager from "./BaseSkillsManager";

beforeEach(() => {
  window.localStorage.clear();
});

async function addSkill(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText("Nazwa umiejętności"), name);
  await user.click(screen.getByRole("button", { name: "Dodaj" }));
}

describe("BaseSkillsManager", () => {
  it("shows the empty state initially", () => {
    render(<BaseSkillsManager />);
    expect(screen.getByText(/Nie masz jeszcze/i)).toBeInTheDocument();
  });

  it("adds a skill, which appears in the list", async () => {
    const user = userEvent.setup();
    render(<BaseSkillsManager />);

    await addSkill(user, "Java");

    const list = screen.getByRole("list", { name: "Twoje umiejętności" });
    expect(within(list).getByText("Java")).toBeInTheDocument();
  });

  it("edits a skill in place", async () => {
    const user = userEvent.setup();
    render(<BaseSkillsManager />);
    await addSkill(user, "Git");

    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    const editInput = screen.getByLabelText("Edytuj nazwę umiejętności");
    await user.clear(editInput);
    await user.type(editInput, "GitHub");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.queryByText("Git")).not.toBeInTheDocument();
  });

  it("deletes a skill, then restores it via Cofnij", async () => {
    const user = userEvent.setup();
    render(<BaseSkillsManager />);
    await addSkill(user, "Java");

    await user.click(screen.getByRole("button", { name: "Usuń" }));
    expect(screen.queryByText("Java")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    const list = screen.getByRole("list", { name: "Twoje umiejętności" });
    expect(within(list).getByText("Java")).toBeInTheDocument();
  });

  it("rejects a case-insensitive duplicate with an inline error and no new row", async () => {
    const user = userEvent.setup();
    render(<BaseSkillsManager />);
    await addSkill(user, "Git");
    await addSkill(user, "git");

    expect(screen.getByRole("alert")).toHaveTextContent(/już istnieje/i);
    const list = screen.getByRole("list", { name: "Twoje umiejętności" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });
});
