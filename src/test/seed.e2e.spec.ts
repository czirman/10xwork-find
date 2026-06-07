import { test, expect } from "@playwright/test";

// Pokrywa Ryzyko #6 z context/foundation/test-plan.md:
// "Operacja CRUD psuje listę — duplikat, pusta/whitespace nazwa zaakceptowana,
//  edycja koliduje, albo usunięcie kasuje zły element."
// Anti-pattern (§2/§6): sam happy-path (dodaj jedną, sprawdź że jest) BEZ
// przypadków kolizji / dedupe / pustych. Dlatego testujemy odrzucenia.
test.describe("Zarządzanie umiejętnościami (Base Skills) - Walidacja CRUD (Ryzyko #6)", () => {
  // 3. UNIKALNE IDENTYFIKATORY: unikalna nazwa na każde uruchomienie testu,
  // żeby przebiegi nie kolidowały ze sobą.
  const uniqueId = Date.now();
  const testSkillName = `Umiejetnosc_Testowa_${uniqueId}`;

  // 4. CLEANUP: aplikacja trzyma dane na urządzeniu (localStorage, brak API).
  // Czyścimy magazyn po każdym teście, żeby nie zaśmiecać kolejnych przebiegów.
  test.afterEach(async ({ page }) => {
    await page
      .evaluate(() => {
        localStorage.clear();
      })
      .catch(() => {
        /* ignoruj, jeśli strona nie ma jeszcze origin/localStorage */
      });
  });

  // 5. NAZWA POWIĄZANA Z RYZYKIEM: odnosi się wprost do logiki biznesowej #6.
  test("Naruszenie unikalności nazwy umiejętności powinno zablokować dodanie i pokazać błąd", async ({ page }) => {
    // 1. Inicjalizacja - wejście na działającą lokalnie aplikację (baseURL z config).
    await page.goto("/");

    // 1. SELEKTORY getByRole: intuicyjnie szukamy pola formularza i przycisku.
    await page.getByRole("textbox", { name: "Nazwa umiejętności", exact: true }).fill(testSkillName);
    await page.getByRole("button", { name: "Dodaj" }).click();

    // 2. CZEKANIE NA STAN: Playwright sam czeka, aż element stanie się widoczny.
    // Po dodaniu na liście pojawia się przycisk "Usuń <nazwa>" — to potwierdza
    // obecność umiejętności (rola, nie sztywny czas).
    await expect(page.getByRole("button", { name: `Usuń ${testSkillName}` })).toBeVisible();

    // Próba dodania dokładnie takiej samej umiejętności (wywołanie ryzyka).
    await page.getByRole("textbox", { name: "Nazwa umiejętności", exact: true }).fill(testSkillName);
    await page.getByRole("button", { name: "Dodaj" }).click();

    // Weryfikacja stanu końcowego - oczekujemy komunikatu o błędzie walidacji.
    const errorMessage = page.getByRole("alert");
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText("Ta umiejętność już istnieje.");
  });

  // Drugi przypadek #6: pusta / złożona z samych spacji nazwa musi być odrzucona.
  test("Pusta lub złożona ze spacji nazwa powinna zostać odrzucona z komunikatem", async ({ page }) => {
    await page.goto("/");

    // Same spacje — po normalizacji to pusta nazwa.
    await page.getByRole("textbox", { name: "Nazwa umiejętności", exact: true }).fill("   ");
    await page.getByRole("button", { name: "Dodaj" }).click();

    const errorMessage = page.getByRole("alert");
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText("Nazwa umiejętności nie może być pusta.");

    // Lista nie powinna dostać żadnego elementu (brak przycisków "Usuń ...").
    await expect(page.getByRole("button", { name: /^Usuń / })).toHaveCount(0);
  });
});
