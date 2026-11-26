import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import { calculate } from '../index';
import { child, input, otherChild, parent } from './helpers';

const amountOf = (r: ReturnType<typeof calculate>, id: string) =>
  r.payments.filter((p) => p.childId === id && p.payer === 'A').reduce((a, p) => a + p.amount, 0);

describe('Residenzmodell', () => {
  it('Standardfall: 2 Kinder, 5 %-Pauschale, Gruppe 3', () => {
    // Netto 3.000 € − Pauschale 150 € (Deckel) = 2.850 € → Gruppe 3, 2 Berechtigte → keine Stufung
    const A = parent('Vater', 3000, {
      deductions: { berufsbedingtMode: 'pauschal', berufsbedingtKonkret: 0, altersvorsorge: 0, schulden: 0, sonstige: 0, wohnvorteil: 0 },
    });
    const r = calculate(input('residenz', A, parent('Mutter', 1500), [child('k1', 0), child('k2', 1)]), cfg);

    expect(r.ok).toBe(true);
    // 535 − 129,50 und 614 − 129,50
    expect(amountOf(r, 'k1')).toBeCloseTo(405.5, 2);
    expect(amountOf(r, 'k2')).toBeCloseTo(484.5, 2);
    expect(r.summary).toEqual([{ payer: 'A', payee: 'B', amount: 890 }]);
    expect(r.steps.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('Herabstufung durch ein 3. Kind aus einer anderen Beziehung', () => {
    // 3.600 € → Gruppe 5; 3 Berechtigte → Gruppe 4; Bedarfskontrolle 3.600 − 1.563,50 = 2.036,50 ≥ 1.950
    const A = parent('Vater', 3600, { otherChildren: [otherChild('x', 0)] });
    const r = calculate(input('residenz', A, parent('Mutter', 1500), [child('k1', 1), child('k2', 2)]), cfg);

    expect(amountOf(r, 'k1')).toBeCloseTo(642 - 129.5, 2);
    expect(amountOf(r, 'k2')).toBeCloseTo(751 - 129.5, 2);
    expect(r.summary[0].amount).toBeCloseTo(1134, 2);

    // Gegenprobe ohne weiteres Kind: Gruppe 5
    const r2 = calculate(
      input('residenz', parent('Vater', 3600), parent('Mutter', 1500), [child('k1', 1), child('k2', 2)]),
      cfg,
    );
    expect(r2.summary[0].amount).toBeCloseTo(670 - 129.5 + (784 - 129.5), 2);
  });

  it('Bedarfskontrollbetrag erzwingt zusätzliche Herabstufung', () => {
    // 3.200 € → Gruppe 4 → Stufung Gruppe 3; Rest 1.720,50 < 1.850 → Gruppe 2 (Rest 1.805,50 ≥ 1.750)
    const A = parent('Vater', 3200, { otherChildren: [otherChild('x', 0)] });
    const r = calculate(input('residenz', A, parent('Mutter', 1500), [child('k1', 1), child('k2', 2)]), cfg);
    expect(amountOf(r, 'k1')).toBeCloseTo(586 - 129.5, 2);
    expect(amountOf(r, 'k2')).toBeCloseTo(686 - 129.5, 2);
  });

  it('Mangelfall: anteilige Kürzung über gemeinsame und weitere Kinder', () => {
    // Einkommen 2.000 €, Selbstbehalt 1.450 € → Verteilungsmasse 550 €
    // Einsatzbeträge: 356,50 + 523,50 + 428,50 (weiteres Kind) = 1.308,50 → Quote 42,03 %
    const A = parent('Vater', 2000, { otherChildren: [otherChild('x', 1)] });
    const r = calculate(input('residenz', A, parent('Mutter', 1500), [child('k1', 0), child('k2', 2)]), cfg);

    const q = 550 / 1308.5;
    expect(amountOf(r, 'k1')).toBeCloseTo(356.5 * q, 2);
    expect(amountOf(r, 'k2')).toBeCloseTo(523.5 * q, 2);
    expect(amountOf(r, 'k1')).toBeCloseTo(149.85, 2);
    expect(amountOf(r, 'k2')).toBeCloseTo(220.04, 2);

    const step5 = r.steps.find((s) => s.id === 5)!;
    const otherLine = step5.lines.find((l) => l.label.includes('x'));
    expect(otherLine?.value).toContain('180,11');

    // Gesamte Verteilungsmasse wird ausgeschöpft (Rundung ±1 Cent)
    expect(amountOf(r, 'k1') + amountOf(r, 'k2') + 180.11).toBeCloseTo(550, 1);
  });

  it('nicht erwerbstätiger Pflichtiger: niedrigerer Selbstbehalt, keine Pauschale', () => {
    const A = parent('Vater', 1600, {
      employed: false,
      deductions: { berufsbedingtMode: 'pauschal', berufsbedingtKonkret: 0, altersvorsorge: 0, schulden: 0, sonstige: 0, wohnvorteil: 0 },
    });
    const r = calculate(input('residenz', A, parent('Mutter', 1500), [child('k1', 0)]), cfg);
    // Masse 1.600 − 1.200 = 400 ≥ 356,50 → voller Mindestunterhalt
    expect(amountOf(r, 'k1')).toBeCloseTo(356.5, 2);
    expect(r.issues.some((i) => i.message.includes('nicht erwerbstätig'))).toBe(true);
  });

  it('Höherstufung bei nur einem Berechtigten', () => {
    // 2.850 € → Gruppe 3, 1 Kind → Gruppe 4
    const r = calculate(input('residenz', parent('Vater', 2850), parent('Mutter', 1500), [child('k1', 1)]), cfg);
    expect(amountOf(r, 'k1')).toBeCloseTo(642 - 129.5, 2);
  });
});
