import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import type { CalculationInput } from '../../types';
import { calculate } from '../index';
import { child, input, parent } from './helpers';

const mitEhegatte = (inp: CalculationInput, art: 'trennung' | 'nachehelich' = 'trennung'): CalculationInput => ({
  ...inp,
  ehegatte: { aktiv: true, art },
});
const ku = (r: ReturnType<typeof calculate>, payer: 'A' | 'B') =>
  r.payments.filter((p) => p.payer === payer).reduce((a, p) => a + p.amount, 0);

describe('Ehegattenunterhalt (Quotenmethode, DT Teil B / Leitlinien NRW 15)', () => {
  it('Normalfall: 45 % der Differenz nach Abzug des Kindesunterhalts; Ehegatte zählt für die Stufung', () => {
    // Kind bei B; A 3.000 €, B 1.000 €, beide erwerbstätig.
    // Mit Ehegatte 2 Berechtigte → Gruppe 4: 559 − 129,50 = 429,50
    // Ehegattenunterhalt: 45 % × (3.000 − 429,50 − 1.000) = 706,73; Leistungsfähigkeit 3.000 − 429,50 − 1.600 = 970,50
    const r = calculate(mitEhegatte(input('residenz', parent('A', 3000), parent('B', 1000), [child('k1', 0)])), cfg);
    expect(ku(r, 'A')).toBe(429.5);
    expect(r.ehegatte).toMatchObject({ payer: 'A', payee: 'B', amount: 706.73, gekuerzt: false });
    expect(r.summary).toEqual([{ payer: 'A', payee: 'B', amount: 1136.23 }]);
    expect(r.steps.find((s) => s.id === 8)?.title).toBe('Ehegattenunterhalt');
    expect(r.issues.some((i) => i.message.includes('als weiterer Berechtigter'))).toBe(true);
  });

  it('Mangelfall: Mindestbedarf 1.200 €, aber gekürzt auf den Betrag über dem Selbstbehalt von 1.600 €', () => {
    // A 2.500 €, B ohne Einkommen (nicht erwerbstätig). Kindesunterhalt Gruppe 2: 381,50
    // Quote 953,33 < Mindestbedarf 1.200; leistungsfähig nur 2.500 − 381,50 − 1.600 = 518,50
    const B = parent('B', 0, { employed: false });
    const r = calculate(mitEhegatte(input('residenz', parent('A', 2500), B, [child('k1', 0)])), cfg);
    expect(ku(r, 'A')).toBe(381.5);
    expect(r.ehegatte).toMatchObject({ payer: 'A', payee: 'B', amount: 518.5, gekuerzt: true });
  });

  it('Richtung ergibt sich aus den Einkommen: hier zahlt der betreuende Elternteil', () => {
    // A 1.800 € zahlt Kindesunterhalt (Mangelfall: 1.800 − 1.450 = 350); B 4.000 €
    // Ehegattenunterhalt B → A: 45 % × (4.000 − 1.450) = 1.147,50
    const r = calculate(mitEhegatte(input('residenz', parent('A', 1800), parent('B', 4000), [child('k1', 0)])), cfg);
    expect(ku(r, 'A')).toBe(350);
    expect(r.ehegatte).toMatchObject({ payer: 'B', payee: 'A', amount: 1147.5 });
    expect(r.saldo).toEqual({ payer: 'B', payee: 'A', amount: 797.5 });
  });

  it('ohne Option keine Änderung am Kindesunterhalt', () => {
    const r = calculate(input('residenz', parent('A', 3000), parent('B', 1000), [child('k1', 0)]), cfg);
    expect(r.ehegatte).toBeNull();
    // ohne Ehegatte nur 1 Berechtigter → Höherstufung auf Gruppe 5: 584 − 129,50
    expect(ku(r, 'A')).toBe(454.5);
    expect(r.steps.some((s) => s.id === 8)).toBe(false);
  });

  it('nachehelicher Unterhalt weist auf § 1578b BGB hin', () => {
    const r = calculate(mitEhegatte(input('residenz', parent('A', 3000), parent('B', 1000), [child('k1', 0)]), 'nachehelich'), cfg);
    expect(r.issues.some((i) => i.message.includes('1578b'))).toBe(true);
  });
});
