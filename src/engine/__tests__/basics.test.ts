import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg, getJahresKonfiguration } from '../../config';
import { bereinigtesEinkommen } from '../income';
import { findIncomeGroup, stufungShift } from '../table';
import { ageInYears, resolveStage } from '../util';
import { validateInput } from '../validate';
import { child, input, parent } from './helpers';

describe('Tabelle', () => {
  it('ordnet Einkommensgrenzen korrekt zu', () => {
    expect(findIncomeGroup(2100, cfg).group).toBe(1);
    expect(findIncomeGroup(2101, cfg).group).toBe(2);
    expect(findIncomeGroup(11200, cfg)).toEqual({ group: 15, aboveTable: false });
    expect(findIncomeGroup(12000, cfg)).toEqual({ group: 15, aboveTable: true });
  });

  it('Zu-/Herabstufung nach Anzahl Berechtigter', () => {
    expect(stufungShift(1, cfg)).toBe(1);
    expect(stufungShift(2, cfg)).toBe(0);
    expect(stufungShift(3, cfg)).toBe(-1);
    expect(stufungShift(4, cfg)).toBe(-2);
  });
});

describe('Bereinigtes Einkommen', () => {
  it('Pauschale 5 % ohne Mindest- und Höchstbetrag (Leitlinien 2026)', () => {
    const d = { berufsbedingtMode: 'pauschal' as const, berufsbedingtKonkret: 0, altersvorsorge: 0, schulden: 0, sonstige: 0 };
    expect(bereinigtesEinkommen(parent('A', 800, { deductions: d }), getJahresKonfiguration(2026)).berufsbedingt).toBe(40);
    expect(bereinigtesEinkommen(parent('A', 2000, { deductions: d }), getJahresKonfiguration(2026)).berufsbedingt).toBe(100);
    expect(bereinigtesEinkommen(parent('A', 5000, { deductions: d }), getJahresKonfiguration(2026)).berufsbedingt).toBe(250);
  });

  it('konkrete Abzüge', () => {
    const r = bereinigtesEinkommen(
      parent('A', 3000, {
        deductions: { berufsbedingtMode: 'konkret', berufsbedingtKonkret: 220, altersvorsorge: 120, schulden: 200, sonstige: 0 },
      }),
      getJahresKonfiguration(2026),
    );
    expect(r.bereinigt).toBe(2460);
  });
});

describe('Alter', () => {
  it('Altersstufe wechselt ab dem Geburtsmonat', () => {
    expect(ageInYears('2020-11-30', '2026-11-01')).toBe(6);
    expect(ageInYears('2020-12-01', '2026-11-30')).toBe(5);
    expect(resolveStage({ kind: 'birthdate', birthdate: '2008-11-15' }, '2026-11-01')).toBe(3);
  });
});

describe('Validierung', () => {
  it('meldet negative Werte und fehlende Kinder als Fehler', () => {
    const issues = validateInput(input('residenz', parent('A', -1), parent('B', 1000), []), getJahresKonfiguration(2026));
    expect(issues.filter((i) => i.severity === 'error').length).toBeGreaterThanOrEqual(2);
  });

  it('meldet Geburtsdatum nach Stichtag', () => {
    const issues = validateInput(
      input('residenz', parent('A', 3000), parent('B', 1000), [
        child('k', 0, { age: { kind: 'birthdate', birthdate: '2030-01-01' } }),
      ]),
      getJahresKonfiguration(2026),
    );
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('nach dem Stichtag'))).toBe(true);
  });
});
