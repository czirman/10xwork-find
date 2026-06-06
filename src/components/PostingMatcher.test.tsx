import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PostingMatcher from "./PostingMatcher";
import type { Skill } from "@/types";

const skill = (id: string, name: string): Skill => ({ id, name });
const SKILLS = [skill("1", "Java"), skill("2", "Git"), skill("3", "Docker")];

async function generate(user: ReturnType<typeof userEvent.setup>, text: string) {
  if (text) await user.type(screen.getByLabelText("Treść oferty pracy"), text);
  await user.click(screen.getByRole("button", { name: "Generuj" }));
}

describe("PostingMatcher", () => {
  it("generates a CV-ready section from a posting", async () => {
    const user = userEvent.setup();
    render(<PostingMatcher skills={SKILLS} />);

    await generate(user, "Looking for Java and Git experience, plus Rust.");

    expect(screen.getByLabelText("Wygenerowana sekcja umiejętności")).toHaveTextContent("Java, Git");
  });

  it("lists unmatched terms", async () => {
    const user = userEvent.setup();
    render(<PostingMatcher skills={SKILLS} />);

    await generate(user, "Java, Rust, Elixir");

    const list = screen.getByRole("list", { name: "Nierozpoznane terminy" });
    expect(within(list).getByText("Rust")).toBeInTheDocument();
    expect(within(list).getByText("Elixir")).toBeInTheDocument();
  });

  it("copies exactly the generated section to the clipboard", async () => {
    const user = userEvent.setup();
    // Spy AFTER setup: user-event installs its own navigator.clipboard stub.
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<PostingMatcher skills={SKILLS} />);

    await generate(user, "Java, Git");
    await user.click(screen.getByRole("button", { name: "Kopiuj" }));

    expect(writeText).toHaveBeenCalledWith("Java, Git");
    expect(await screen.findByRole("status")).toHaveTextContent(/skopiowano/i);
    writeText.mockRestore();
  });

  it("shows a no-match message when nothing matches", async () => {
    const user = userEvent.setup();
    render(<PostingMatcher skills={[skill("1", "Java")]} />);

    await generate(user, "Rust, Haskell");

    expect(screen.getByRole("status")).toHaveTextContent(/nie pasuje/i);
    expect(screen.queryByRole("button", { name: "Kopiuj" })).not.toBeInTheDocument();
  });

  it("rejects an empty posting with an inline message", async () => {
    const user = userEvent.setup();
    render(<PostingMatcher skills={SKILLS} />);

    await generate(user, "");

    expect(screen.getByRole("alert")).toHaveTextContent(/wklej treść oferty/i);
  });

  it("prompts to add skills first when the list is empty", async () => {
    const user = userEvent.setup();
    render(<PostingMatcher skills={[]} />);

    await generate(user, "Java");

    expect(screen.getByRole("alert")).toHaveTextContent(/dodaj swoje umiejętności/i);
  });
});
