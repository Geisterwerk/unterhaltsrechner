import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** WCAG 2.1 A/AA mit axe prüfen; gibt verständliche Fehlerliste aus */
async function axePruefen(page: Page) {
  const ergebnis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const fehler = ergebnis.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} – ${v.nodes.length}× z. B. ${v.nodes[0]?.target.join(' ')}`,
  );
  expect(fehler, 'Barrierefreiheitsfehler (axe)').toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Kindesunterhaltsrechner' })).toBeVisible();
});

test('Startseite ohne axe-Befunde', async ({ page }) => {
  await axePruefen(page);
});

test('Wechselmodell, Brutto-Eingabe und Zeitraum ohne axe-Befunde', async ({ page }) => {
  await page.getByRole('button', { name: 'Wechselmodell 50 : 50' }).click();
  await page.getByRole('radio', { name: /Brutto eingeben/ }).first().click();
  await page.getByRole('button', { name: 'Zeitraum berechnen' }).click();
  await page.getByRole('button', { name: '+ Einkommensänderung' }).click();
  await page.getByRole('button', { name: /Erklärung: Kinderzuschlag/ }).first().click();
  await axePruefen(page);
});

test('Änderungsprotokoll-Dialog ohne axe-Befunde', async ({ page }) => {
  await page.getByRole('button', { name: /Was ist neu/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await axePruefen(page);
});

test('Eingabefelder sind über ihre Beschriftung erreichbar', async ({ page }) => {
  await expect(page.getByLabel('Nettoeinkommen (monatlich)').first()).toBeVisible();
  await expect(page.getByLabel('Kinderzuschlag (monatlich)').first()).toBeVisible();
  await expect(page.getByLabel('Berechnungsjahr', { exact: true })).toBeVisible();
  // Hinweistext ist als Beschreibung verknüpft
  await expect(page.getByRole('spinbutton', { name: 'Eigenes Einkommen (netto)', exact: true }).first()).toHaveAccessibleDescription(
    'z. B. Ausbildungsvergütung',
  );
});

test('Umschalter lassen sich mit den Pfeiltasten bedienen', async ({ page }) => {
  const gruppe = page.getByRole('radiogroup', { name: /Betreuungsmodell/ }).first();
  const aktiv = gruppe.getByRole('radio', { checked: true });
  await aktiv.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gruppe.getByRole('radio', { name: /Wechselmodell/ })).toHaveAttribute('aria-checked', 'true');
  await expect(gruppe.getByRole('radio', { name: /Wechselmodell/ })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(gruppe.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
});
