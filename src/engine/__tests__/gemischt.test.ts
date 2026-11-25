import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import { calculate } from '../index';
import { child, input, parent } from './helpers';

const r2 = (v: number) => Math.round(v * 100) / 100;
const paid = (r: ReturnType<typeof calculate>, id: string) => r.payments.find((p) => p.childId === id)!;

describe('Betreuungsmodell je Kind', () => {
  it('Residenz (Kind lebt bei B) und Wechselmodell gemischt – Barunterhalt als Vorwegabzug im Wechselmodell', () => {
    // A: 4.000 €, B: 2.500 €; k1 (6–11) lebt bei B, k2 (0–5) im Wechselmodell, Kindergeld bei B
    const r = calculate(
      input('gemischt', parent('A', 4000), parent('B', 2500), [
        child('k1', 1, { care: 'B' }),
        child('k2', 0, { care: 'wechsel', kindergeldRecipient: 'B' }),
      ]),
      cfg,
    );
    expect(r.ok).toBe(true);

    // Barunterhalt A: 2 Berechtigte, 4.000 € → Gruppe 6; k2 fiktiv in der Bedarfskontrolle
    // 715 − 129,50 = 585,50; Rest 4.000 − 585,50 − 493,50 = 2.921 ≥ 2.150
    expect(paid(r, 'k1')).toMatchObject({ payer: 'A', payee: 'B', amount: 585.5 });

    // Wechselmodell: A 4.000 − 585,50 = 3.414,50; B 2.500 → 5.914,50 → Gruppe 11 → 817 €
    const qA = (3414.5 - 1750) / (3414.5 - 1750 + 750);
    const shareA = r2(817 * qA);
    const shareB = r2(817 * (750 / 2414.5));
    const bar = r2((shareA - shareB) / 2);
    const kg = r2(129.5 * qA + 64.75);
    const net = r2(bar - kg);
    expect(paid(r, 'k2')).toMatchObject({ payer: 'A', payee: 'B' });
    expect(paid(r, 'k2').amount).toBeCloseTo(net, 2);
    expect(paid(r, 'k2').amount).toBeCloseTo(0.7, 2);

    expect(r.summary).toEqual([{ payer: 'A', payee: 'B', amount: r2(585.5 + net) }]);
    expect(r.saldo).toBeNull();

    const step2 = r.steps.find((s) => s.id === 2)!;
    expect(
      step2.lines.some((l) => l.label.includes('Barunterhalt für gemeinsame Kinder') && l.value === 585.5),
    ).toBe(true);
  });

  it('Geschwistertrennung: jedes Kind lebt bei einem anderen Elternteil', () => {
    // A: 3.000 € → Gruppe 4; BKB: 3.000 − 512,50 − 621,50 = 1.866 < 1.950 → Gruppe 3
    //   k1 (6–11, bei B): 614 − 129,50 = 484,50
    // B: 2.500 € → Gruppe 2; BKB: 2.500 − 556,50 − 456,50 = 1.487 < 1.750 → Gruppe 1
    //   k2 (12–17, bei A): 653 − 129,50 = 523,50
    const r = calculate(
      input('gemischt', parent('A', 3000), parent('B', 2500), [
        child('k1', 1, { care: 'B' }),
        child('k2', 2, { care: 'A' }),
      ]),
      cfg,
    );
    expect(paid(r, 'k1')).toMatchObject({ payer: 'A', payee: 'B', amount: 484.5 });
    expect(paid(r, 'k2')).toMatchObject({ payer: 'B', payee: 'A', amount: 523.5 });
    expect(r.summary).toEqual([
      { payer: 'A', payee: 'B', amount: 484.5 },
      { payer: 'B', payee: 'A', amount: 523.5 },
    ]);
    expect(r.saldo).toEqual({ payer: 'B', payee: 'A', amount: 39 });
  });

  it('ohne Einbeziehung der Kinder im eigenen Haushalt entfällt die Herabstufung durch die Bedarfskontrolle', () => {
    const base = input('gemischt', parent('A', 3000), parent('B', 2500), [
      child('k1', 1, { care: 'B' }),
      child('k2', 2, { care: 'A' }),
    ]);
    const r = calculate({ ...base, options: { ...base.options, haushaltskinderEinbeziehen: false } }, cfg);
    // A bleibt in Gruppe 4: 642 − 129,50
    expect(paid(r, 'k1').amount).toBe(512.5);
  });

  it('warnt bei volljährigem Kind im Wechselmodell', () => {
    const r = calculate(
      input('gemischt', parent('A', 4000), parent('B', 2500), [child('k1', 3, { care: 'wechsel' })]),
      cfg,
    );
    expect(r.issues.some((i) => i.message.includes('Wechselmodell entfällt'))).toBe(true);
    // beide Eltern schulden anteiligen Barunterhalt an das Kind
    expect(r.payments.every((p) => p.payee === 'Kind' || p.payee === null)).toBe(true);
  });
});
