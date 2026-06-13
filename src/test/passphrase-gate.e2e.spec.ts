import { test, expect } from "@playwright/test";

import { TEST_PASSPHRASE } from "./helpers/auth";

// Pokrywa nowe ryzyko wprowadzone przez S-03 (passphrase-access-gate):
// brama dostępu albo (a) wpuszcza niezalogowanego użytkownika prosto do
// narzędzia, albo (b) blokuje legalny dostęp / gubi sesję po przeładowaniu.
// To ryzyko żyje WYŁĄCZNIE w zintegrowanej, działającej aplikacji — middleware
// na Cloudflare nie wykonuje się w testach jednostkowych (vitest) — więc jest
// to jedyna warstwa, która naprawdę je chroni.
// Ref: context/changes/passphrase-access-gate/plan.md (S-03), FR-009.
// Seed/konwencje: src/test/seed.e2e.spec.ts.
test.describe("Brama dostępu hasłem (S-03)", () => {
  // CLEANUP + NIEZALEŻNOŚĆ: po każdym teście czyścimy ciasteczko sesji i
  // localStorage, żeby sesja z jednego przebiegu nie przeciekła do następnego
  // (testy bezpieczne przy równoległym, losowym uruchamianiu).
  test.afterEach(async ({ context, page }) => {
    await context.clearCookies();
    await page
      .evaluate(() => {
        localStorage.clear();
      })
      .catch(() => {
        /* ignoruj, jeśli strona nie ma jeszcze origin/localStorage */
      });
  });

  // (a) Brama chroni: bez ważnej sesji każda ścieżka prowadzi na /unlock.
  test("Niezalogowany użytkownik na '/' zostaje przekierowany na stronę odblokowania", async ({ page }) => {
    await page.goto("/");

    // CZEKANIE NA STAN: czekamy na przekierowanie, nie na sztywny czas.
    await page.waitForURL("**/unlock");

    // Strona odblokowania jest widoczna (przycisk wg roli; pole hasła wg etykiety,
    // bo input[type=password] nie ma roli "textbox").
    await expect(page.getByRole("button", { name: "Odblokuj" })).toBeVisible();
    await expect(page.getByLabel("Hasło dostępu")).toBeVisible();

    // Narzędzie NIE jest dostępne — pole dodawania umiejętności nie istnieje.
    await expect(page.getByRole("textbox", { name: "Nazwa umiejętności", exact: true })).toHaveCount(0);
  });

  // (b) Brama odrzuca błędne dane: komunikat i dalej brak dostępu.
  test("Błędne hasło pokazuje komunikat błędu i nie wpuszcza do narzędzia", async ({ page }) => {
    await page.goto("/unlock");

    await page.getByLabel("Hasło dostępu").fill("zdecydowanie-niepoprawne-haslo");
    await page.getByRole("button", { name: "Odblokuj" }).click();

    // Komunikat błędu (role="alert") pojawia się, a narzędzie pozostaje zamknięte.
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nazwa umiejętności", exact: true })).toHaveCount(0);
  });

  // (c)+(d) Poprawne hasło wpuszcza do narzędzia, a sesja przetrwa przeładowanie.
  test("Poprawne hasło wpuszcza do narzędzia, a sesja przetrwa przeładowanie", async ({ page }) => {
    await page.goto("/unlock");

    await page.getByLabel("Hasło dostępu").fill(TEST_PASSPHRASE);
    await page.getByRole("button", { name: "Odblokuj" }).click();

    // Po sukcesie opuszczamy /unlock i lądujemy w narzędziu (wyspa React).
    await page.waitForURL((url) => !url.pathname.startsWith("/unlock"));
    const skillInput = page.getByRole("textbox", { name: "Nazwa umiejętności", exact: true });
    await expect(skillInput).toBeVisible();

    // Sesja oparta na ciasteczku przetrwa przeładowanie — brak ponownej bramy.
    await page.reload();
    await expect(skillInput).toBeVisible();
    await expect(page).toHaveURL((url) => !url.pathname.startsWith("/unlock"));
  });
});
