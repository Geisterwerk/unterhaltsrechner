import { expect, test, type Page } from '@playwright/test';

/** Konsolenfehler und fehlgeschlagene Anfragen sammeln – jeder Test erwartet eine fehlerfreie Seite */
function fehlerSammeln(page: Page): string[] {
  const fehler: string[] = [];
  page.on('console', (m) => m.type() === 'error' && fehler.push(m.text()));
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('response', (r) => r.status() >= 400 && fehler.push(`${r.status()} ${r.url()}`));
  return fehler;
}

let fehler: string[] = [];
test.beforeEach(async ({ page }) => {
  fehler = fehlerSammeln(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Kindesunterhaltsrechner' })).toBeVisible();
});
test.afterEach(() => {
  expect(fehler, 'Fehler in Konsole oder Netzwerk').toEqual([]);
});

test('Standardeingaben ergeben einen Zahlbetrag und einen Rechenweg', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Rechenweg' })).toBeVisible();
  await expect(page.getByText('Elternteil A → Elternteil B').first()).toBeVisible();
  await expect(page.getByText(/\d+,\d{2} €/).first()).toBeVisible();
});

test('Wechselmodell zeigt Wohnkostenfelder und den Spitzenausgleich', async ({ page }) => {
  await page.getByRole('button', { name: 'Wechselmodell 50 : 50' }).click();
  await expect(page.getByText('Wohnkosten des Kindes bei Elternteil A').first()).toBeVisible();
  await expect(page.getByText('Spitzenausgleich Wechselmodell gesamt')).toBeVisible();
});

test('Eingabe ändert das Ergebnis', async ({ page }) => {
  const vorher = await page.locator('body').innerText();
  const netto = page.locator('section', { has: page.locator('#parent-name-A') }).getByRole('spinbutton').first();
  await netto.fill('5000');
  await expect.poll(() => page.locator('body').innerText()).not.toBe(vorher);
});

test('Info-Button klappt eine Erklärung auf und zu', async ({ page }) => {
  const knopf = page.getByRole('button', { name: 'Erklärung: Kinderzuschlag (monatlich)' }).first();
  await knopf.click();
  await expect(knopf).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('BGH, Beschluss vom 28.10.2020').first()).toBeVisible();
  await knopf.click();
  await expect(knopf).toHaveAttribute('aria-expanded', 'false');
});

test('Änderungsprotokoll öffnet und schließt sich', async ({ page }) => {
  await page.getByRole('button', { name: /Was ist neu/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Änderungsprotokoll' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Eingaben speichern und wieder laden', async ({ page }) => {
  const netto = page.locator('section', { has: page.locator('#parent-name-A') }).getByRole('spinbutton').first();
  await netto.fill('4321');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Eingaben speichern' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^unterhalt-eingaben-\d{4}-\d{2}-\d{2}\.json$/);
  const pfad = await download.path();

  await netto.fill('1000');
  await page.getByLabel('Gespeicherte Eingaben auswählen').setInputFiles(pfad);
  await expect(netto).toHaveValue('4321');
  await expect(page.getByRole('status')).toContainText('geladen');
});

test('PDF-Bericht wird erzeugt', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /PDF/ }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});

test('keine seitliche Verschiebung (auch auf dem Smartphone)', async ({ page }) => {
  const { breite, inhalt } = await page.evaluate(() => ({
    breite: document.documentElement.clientWidth,
    inhalt: document.documentElement.scrollWidth,
  }));
  expect(inhalt).toBeLessThanOrEqual(breite);
});

test('Zeitraum mit Altersstufenwechsel und Rückstand', async ({ page }) => {
  const kinder = page.locator('section', { has: page.getByRole('heading', { name: 'Gemeinsame Kinder' }) });
  await kinder.getByLabel('Art der Altersangabe').first().selectOption('birthdate');
  await kinder.getByLabel('Geburtsdatum').first().fill('2020-06-15');

  await page.getByRole('button', { name: 'Zeitraum berechnen' }).click();
  const panel = page.locator('section', { hasText: 'Zeitraum und Rückstand' });
  await panel.getByLabel('Erster Monat').fill('2026-01');
  await panel.getByLabel('Letzter Monat').fill('2026-12');
  await expect(panel.getByText('01/2026–05/2026')).toBeVisible();
  await expect(panel.getByText('06/2026–12/2026')).toBeVisible();

  // tatsächliche Zahlungen: Januar–März 900 €, ab Mai 900 € (April ohne Zahlung)
  await panel.getByRole('button', { name: '+ Zahlung' }).click();
  await panel.getByLabel('Zahlung 1: bis Monat').fill('2026-03');
  await panel.getByRole('spinbutton', { name: 'Je Monat' }).first().fill('900');
  await panel.getByRole('button', { name: '+ Zahlung' }).click();
  await panel.getByLabel('Zahlung 2: von Monat').fill('2026-05');
  await panel.getByRole('spinbutton', { name: 'Je Monat' }).nth(1).fill('900');
  await expect(panel.getByText('Rückstand Elternteil A an Elternteil B', { exact: true })).toBeVisible();
  await expect(panel.getByRole('cell', { name: /^04\/2026\s*1 Monat$/ })).toBeVisible();

  // Betreuungswechsel: Kind 1 ab Oktober im Wechselmodell
  await panel.getByRole('button', { name: '+ Betreuungswechsel' }).click();
  await panel.getByLabel('Betreuungswechsel 1: ab Monat').fill('2026-10');
  await expect(panel.getByText(/Kind 1 \(6–11 Jahre\): Elternteil . → Elternteil . .*€/).first()).toBeVisible();

  // Einkommensänderung ab September
  await panel.getByRole('button', { name: '+ Einkommensänderung' }).click();
  await panel.getByLabel('Einkommensänderung 1: ab Monat').fill('2026-09');
  const neu = panel.getByText('Neues Nettoeinkommen', { exact: true }).locator('xpath=ancestor::div[2]');
  await neu.getByRole('spinbutton').fill('4000');
  // Einkommensänderung ab 09 und Betreuungswechsel ab 10 → eigene Abschnitte
  await expect(panel.getByRole('cell', { name: /^09\/2026/ })).toBeVisible();
  await expect(panel.getByRole('cell', { name: /^10\/2026–12\/2026/ })).toBeVisible();
  await expect(panel.getByText('Nettoeinkommen Elternteil A: 4.000,00 €').first()).toBeVisible();

  // PDF enthält den Zeitraum
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /PDF/ }).first().click()]);
  const fs = await import('node:fs');
  expect(fs.readFileSync(await pdf.path()).length).toBeGreaterThan(1000);

  const { breite, inhalt } = await page.evaluate(() => ({
    breite: document.documentElement.clientWidth,
    inhalt: document.documentElement.scrollWidth,
  }));
  expect(inhalt).toBeLessThanOrEqual(breite);
});

test('Kinderzuschlag senkt den Zahlbetrag', async ({ page }) => {
  const kinder = page.locator('section', { has: page.getByRole('heading', { name: 'Gemeinsame Kinder' }) });
  const vorher = await page.locator('body').innerText();
  // Feld über seine Beschriftung finden (Field-Wurzel = zweiter Vorfahre der Beschriftung)
  const feld = kinder.getByText('Kinderzuschlag (monatlich)', { exact: true }).first().locator('xpath=ancestor::div[2]');
  await feld.getByRole('spinbutton').fill('100');
  await expect(page.locator('body')).toContainText('− Kinderzuschlag 100,00 €');
  expect(await page.locator('body').innerText()).not.toBe(vorher);
});

test('Leitlinien, fiktives Einkommen und private Krankenversicherung', async ({ page }) => {
  const vorher = await page.locator('body').innerText();
  await page.getByLabel('Leitlinien', { exact: true }).selectOption('nds');
  const elternA = page.locator('section', { has: page.locator('#parent-name-A') });
  await elternA.getByLabel('Berufsbedingte Aufwendungen', { exact: true }).selectOption('pauschal');
  await expect(page.getByText(/höchstens 150 €/).first()).toBeVisible();

  const elternB = page.locator('section', { has: page.locator('#parent-name-B') });
  await elternB.getByText('Fiktives Einkommen ansetzen (Erwerbsobliegenheit verletzt)').click();
  await elternB.getByRole('spinbutton', { name: 'Erzielbares Nettoeinkommen (monatlich)' }).fill('2400');
  await expect(page.getByText('Elternteil B: fiktives Nettoeinkommen')).toBeVisible();

  const kinder = page.locator('section', { has: page.getByRole('heading', { name: 'Gemeinsame Kinder' }) });
  await kinder.getByRole('spinbutton', { name: 'Kranken-/Pflegeversicherung (privat)' }).first().fill('120');
  await expect(page.getByText(/inkl\. Kranken-\/Pflegeversicherung 120,00 €/).first()).toBeVisible();
  expect(await page.locator('body').innerText()).not.toBe(vorher);
});
