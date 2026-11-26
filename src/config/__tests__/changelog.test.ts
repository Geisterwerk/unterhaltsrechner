import { describe, expect, it } from 'vitest';
import { APP_VERSION, CHANGELOG } from '../changelog';

describe('Änderungsprotokoll', () => {
  it('ist absteigend nach Version und Datum sortiert, Versionen eindeutig', () => {
    const num = (v: string) => v.split('.').map(Number).reduce((a, x) => a * 1000 + x, 0);
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(num(CHANGELOG[i - 1].version)).toBeGreaterThan(num(CHANGELOG[i].version));
      expect(CHANGELOG[i - 1].datum >= CHANGELOG[i].datum).toBe(true);
    }
  });

  it('hat gültige Einträge', () => {
    for (const e of CHANGELOG) {
      expect(e.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(e.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.aenderungen.length).toBeGreaterThan(0);
    }
    expect(APP_VERSION).toBe(CHANGELOG[0].version);
  });
});
