import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import { calculate } from '../index';
import { child, input, otherChild, parent } from './helpers';

describe('Paritätisches Wechselmodell', () => {
  it('unterschiedliche Einkommen mit Vorwegabzug für ein weiteres Kind', () => {
    // A: 4.000 € − Vorwegabzug 400 € (konkreter Zahlbetrag) = 3.600 €; B: 2.500 €
    // Gesamt 6.100 € → Gruppe 11 → Bedarf 6–11 J.: 938 €
    // Haftung: 1.850 : 750 → Quote A 71,15 %, B 28,85 %
    const A = parent('Vater', 4000, { otherChildren: [otherChild('x', 0, { fixedPayment: 400 })] });
    const B = parent('Mutter', 2500);
    const r = calculate(input('wechsel', A, B, [child('k1', 1, { kindergeldRecipient: 'B' })]), cfg);

    expect(r.ok).toBe(true);
    const qA = 1850 / 2600;
    const shareA = Math.round(938 * qA * 100) / 100; // 667,42
    const shareB = Math.round(938 * (1 - qA) * 100) / 100; // 270,58
    const bar = (shareA - shareB) / 2; // 198,42 A → B
    const kg = Math.round((129.5 * qA + 64.75) * 100) / 100; // 156,89 B → A
    expect(r.summary).toHaveLength(1);
    expect(r.summary[0].payer).toBe('A');
    expect(r.summary[0].payee).toBe('B');
    expect(r.summary[0].amount).toBeCloseTo(bar - kg, 2);
    expect(r.summary[0].amount).toBeCloseTo(41.53, 2);

    // Gegenprobe: geschlossene Formel (qA − qB) · (Bedarf − ½ KG) / 2 − ½ KG
    expect(r.summary[0].amount).toBeCloseTo(((2 * qA - 1) * (938 - 129.5)) / 2 - 129.5, 1);

    const step2 = r.steps.find((s) => s.id === 2)!;
    expect(step2.lines.some((l) => l.label.includes('Vorwegabzug gesamt') && l.value === 400)).toBe(true);
  });

  it('gleiche Einkommen: Kindergeldbezieher gibt die Hälfte des Kindergelds heraus', () => {
    const r = calculate(
      input('wechsel', parent('Vater', 3000), parent('Mutter', 3000), [child('k1', 0, { kindergeldRecipient: 'B' })]),
      cfg,
    );
    expect(r.summary).toEqual([{ payer: 'B', payee: 'A', amount: cfg.kindergeld / 2 }]);
  });

  it('Mehrkosten des Wechselmodells erhöhen den Bedarf', () => {
    const base = calculate(
      input('wechsel', parent('Vater', 5000), parent('Mutter', 2500), [child('k1', 1, { kindergeldRecipient: 'A' })]),
      cfg,
    );
    const mehr = calculate(
      input('wechsel', parent('Vater', 5000), parent('Mutter', 2500), [
        child('k1', 1, { kindergeldRecipient: 'A', wechselMehrkosten: 200 }),
      ]),
      cfg,
    );
    expect(mehr.summary[0].amount).toBeGreaterThan(base.summary[0].amount);
  });
});
