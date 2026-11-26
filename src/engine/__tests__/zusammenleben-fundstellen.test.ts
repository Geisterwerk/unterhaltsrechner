import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import type { CalculationInput } from '../../types';
import { calculate } from '../index';
import { notwendigerSelbstbehalt } from '../income';
import { child, input, parent } from './helpers';

const berlin = (inp: CalculationInput): CalculationInput => ({ ...inp, options: { ...inp.options, leitlinien: 'berlin' } });
const alleZeilen = (r: ReturnType<typeof calculate>) => r.steps.flatMap((s) => s.lines);

describe('Selbstbehalt bei Zusammenleben mit leistungsfähigem Partner (Leitlinien 21.5)', () => {
  it('senkt den notwendigen Selbstbehalt um 10 %', () => {
    expect(notwendigerSelbstbehalt(parent('A', 2000), cfg)).toBe(1450);
    expect(notwendigerSelbstbehalt(parent('A', 2000, { zusammenleben: true }), cfg)).toBe(1305);
    expect(notwendigerSelbstbehalt(parent('A', 0, { employed: false, zusammenleben: true }), cfg)).toBe(1080);
  });

  it('erhöht im Mangelfall den Zahlbetrag', () => {
    // A 1.600 €: ohne Ersparnis 1.600 − 1.450 = 150 €, mit Ersparnis 1.600 − 1.305 = 295 €
    const ohne = calculate(input('residenz', parent('A', 1600), parent('B', 1000), [child('k1', 0)]), cfg);
    const mit = calculate(input('residenz', parent('A', 1600, { zusammenleben: true }), parent('B', 1000), [child('k1', 0)]), cfg);
    expect(ohne.payments[0].amount).toBe(150);
    expect(mit.payments[0].amount).toBe(295);
    const zeile = alleZeilen(mit).find((l) => l.label === 'Notwendiger Selbstbehalt A');
    expect(zeile?.value).toBe(1305);
    expect(zeile?.note).toContain('Leitlinien NRW 21.5 Abs. 5');
  });

  it('nennt die Fundstelle der gewählten Leitlinien', () => {
    const r = calculate(
      berlin(input('residenz', parent('A', 1600, { zusammenleben: true }), parent('B', 1000), [child('k1', 0)])),
      cfg,
    );
    expect(alleZeilen(r).find((l) => l.label === 'Notwendiger Selbstbehalt A')?.note).toContain('Leitlinien KG Berlin 21.5');
  });

  it('senkt auch den Selbstbehalt beim Ehegattenunterhalt', () => {
    const basis = input('residenz', parent('A', 2500, { zusammenleben: true }), parent('B', 0, { employed: false }), [child('k1', 0)]);
    const r = calculate({ ...basis, ehegatte: { aktiv: true, art: 'trennung' } }, cfg);
    const zeile = r.steps.find((s) => s.title === 'Ehegattenunterhalt')!.lines.find((l) => l.label.startsWith('Leistungsfähigkeit A'))!;
    // Ehegatten-Selbstbehalt 1.600 € − 10 % = 1.440 €
    expect(zeile.label).toContain('Selbstbehalt 1.440,00 €');
    expect(zeile.note).toContain('21.5');
  });
});

describe('Fundstellen je gewählter Leitlinie', () => {
  it('Kranken-/Pflegeversicherung des Kindes verweist auf Ziff. 11.1 der gewählten Leitlinien', () => {
    const kind = [child('k1', 1, { krankenversicherung: 120 })];
    const nrw = calculate(input('residenz', parent('A', 4000), parent('B', 1500), kind), cfg);
    const kg = calculate(berlin(input('residenz', parent('A', 4000), parent('B', 1500), kind)), cfg);
    const hinweise = (r: ReturnType<typeof calculate>) =>
      alleZeilen(r)
        .map((l) => l.note ?? '')
        .filter((n) => n.includes('11.1'));
    expect(hinweise(nrw).every((n) => n.includes('Leitlinien NRW 11.1'))).toBe(true);
    expect(hinweise(kg).length).toBeGreaterThan(0);
    expect(hinweise(kg).every((n) => n.includes('Leitlinien KG Berlin 11.1'))).toBe(true);
  });
});
