import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import { calculate } from '../index';
import { child, input, parent } from './helpers';

const zahlung = (r: ReturnType<typeof calculate>, id: string) => r.payments.find((p) => p.childId === id)!;

describe('Kinderzuschlag (§ 6a BKGG, BGH XII ZB 512/19)', () => {
  it('mindert den Zahlbetrag im Residenzmodell in voller Höhe', () => {
    // bei 4.000 € bleibt die Einkommensgruppe gleich (bei knappen Einkommen kann der niedrigere Zahlbetrag
    // über die Bedarfskontrolle eine höhere Gruppe zulassen)
    const ohne = calculate(input('residenz', parent('A', 4000), parent('B', 1000), [child('k1', 0)]), cfg);
    const mit = calculate(
      input('residenz', parent('A', 4000), parent('B', 1000), [child('k1', 0, { kinderzuschlag: 150 })]),
      cfg,
    );
    expect(round(zahlung(ohne, 'k1').amount - zahlung(mit, 'k1').amount)).toBe(150);
    const step4 = mit.steps.find((s) => s.id === 4)!;
    expect(step4.lines.some((l) => String(l.value).includes('− Kinderzuschlag 150,00 €'))).toBe(true);
  });

  it('wird anders als Erwerbseinkommen nicht halbiert', () => {
    const eigen = calculate(
      input('residenz', parent('A', 2000), parent('B', 1000), [child('k1', 2, { ownIncome: 400 })]),
      cfg,
    );
    const kiz = calculate(
      input('residenz', parent('A', 2000), parent('B', 1000), [child('k1', 2, { kinderzuschlag: 300 })]),
      cfg,
    );
    // Eigeneinkommen 400 − 100 Ausbildungsaufwand = 300, davon ½ = 150; Kinderzuschlag 300 voll
    const ohne = calculate(input('residenz', parent('A', 2000), parent('B', 1000), [child('k1', 2)]), cfg);
    expect(round(zahlung(ohne, 'k1').amount - zahlung(eigen, 'k1').amount)).toBe(150);
    expect(round(zahlung(ohne, 'k1').amount - zahlung(kiz, 'k1').amount)).toBe(300);
  });

  it('mindert auch im Wechselmodell den Bedarf', () => {
    const r = calculate(
      input('wechsel', parent('A', 3000), parent('B', 2800), [child('k1', 1, { kindergeldRecipient: 'A', kinderzuschlag: 100 })]),
      cfg,
    );
    const step4 = r.steps.find((s) => s.id === 4)!;
    expect(step4.lines.find((l) => l.label.startsWith('k1 ('))?.value).toContain('− Kinderzuschlag 100,00 € = 838,00 €');
  });
});

const round = (v: number) => Math.round(v * 100) / 100;
