import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import { calculate } from '../index';
import { child, input, parent } from './helpers';

/**
 * A 3.000 €, B 2.800 € → zusammen 5.800 € = Gruppe 11: 938 € (6–11 J.), keine Kappung.
 * Quote A 1.250 / 2.300, B 1.050 / 2.300. Kindergeld bei A: an B ½ × 259 × Quote B + ¼ × 259 = 123,87 €.
 */
const rechne = (wohnA: number, wohnB: number) =>
  calculate(
    input('wechsel', parent('A', 3000), parent('B', 2800), [
      child('k1', 1, { kindergeldRecipient: 'A', wechselWohnkosten: { A: wohnA, B: wohnB } }),
    ]),
    cfg,
  );

describe('Wechselmodell: Wohnmehrbedarf', () => {
  it('ohne Wohnkosten unverändert: halbe Differenz der Haftungsanteile', () => {
    // (509,78 − 428,22) / 2 = 40,78 → 40,78 + 123,87
    const r = rechne(0, 0);
    expect(r.payments[0]).toMatchObject({ payer: 'A', amount: 164.65 });
    expect(r.steps.find((s) => s.id === 4)!.lines.some((l) => l.label.includes('Wohnmehrbedarf'))).toBe(false);
  });

  it('Wohnkosten über dem Wohnanteil erhöhen den Bedarf', () => {
    // 300 + 150 = 450 − 20 % von 938 (187,60) = 262,40 Wohnmehrbedarf → Bedarf 1.200,40
    const r = rechne(300, 150);
    const step4 = r.steps.find((s) => s.id === 4)!;
    expect(step4.lines.find((l) => l.label.includes('Wohnmehrbedarf'))?.value).toContain('= 262,40 €');
    expect(step4.lines.find((l) => l.label.startsWith('k1 ('))?.value).toContain('= 1.200,40 €');
  });

  it('eigene Wohnkosten zählen als Leistung in natura', () => {
    // Anteile A 652,39 / B 548,01; in natura A 300 + ½ × 750,40 = 675,20, B 150 + 375,20 = 525,20
    // Barausgleich: B → A 22,81; Kindergeld A → B 123,87 → A zahlt 101,06
    const r = rechne(300, 150);
    expect(r.payments[0].payer).toBe('A');
    expect(r.payments[0].amount).toBeCloseTo(101.06, 2);
  });

  it('bei gleich hohen Wohnkosten bleibt es bei der halben Differenz (des höheren Bedarfs)', () => {
    // 225 + 225: gleicher Wohnmehrbedarf, gleiche Naturalleistung → (652,39 − 548,01) / 2 = 52,19 + 123,87
    const r = rechne(225, 225);
    expect(r.payments[0].amount).toBeCloseTo(176.06, 2);
  });

  it('Wohnkosten unterhalb des Wohnanteils erzeugen keinen Mehrbedarf, verschieben aber die Naturalleistung', () => {
    // 150 + 0 = 150 < 187,60 → kein Mehrbedarf; A leistet 150 + ½ × 788 = 544, B 394
    // Barausgleich ((509,78 − 544) − (428,22 − 394)) / 2 = −34,22 → B → A; Kindergeld 123,87 → A zahlt 89,65
    const r = rechne(150, 0);
    expect(r.steps.find((s) => s.id === 4)!.lines.find((l) => l.label.includes('Wohnmehrbedarf'))?.value).toContain('= 0,00 €');
    expect(r.payments[0].amount).toBeCloseTo(89.65, 2);
  });
});
