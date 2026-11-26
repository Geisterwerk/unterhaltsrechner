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

  await panel.getByText('Bereits gezahlte Beträge abziehen').click();
  await panel.locator('div', { has: page.getByText('Gezahlt je Monat', { exact: true }) }).getByRole('spinbutton').last().fill('900');
  await expect(panel.getByText('Rückstand Elternteil A', { exact: true })).toBeVisible();

  // Einkommensänderung ab September
  await panel.getByRole('button', { name: '+ Einkommensänderung' }).click();
  await panel.getByLabel('Einkommensänderung 1: ab Monat').fill('2026-09');
  const neu = panel.getByText('Neues Nettoeinkommen', { exact: true }).locator('xpath=ancestor::div[2]');
  await neu.getByRole('spinbutton').fill('4000');
  await expect(panel.getByText('09/2026–12/2026')).toBeVisible();
  await expect(panel.getByText('Nettoeinkommen Elternteil A: 4.000,00 €')).toBeVisible();

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
