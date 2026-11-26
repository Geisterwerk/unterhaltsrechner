import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg, getJahresKonfiguration } from '../../config';
import { calculate } from '../index';
import { bereinigtesEinkommen } from '../income';
import { child, input, parent } from './helpers';

const jk = getJahresKonfiguration(2026);
const ded = (o: Partial<ReturnType<typeof parent>['deductions']>) => ({ ...parent('X', 0).deductions, ...o });

describe('Altersvorsorge: höchstens 4 % des Bruttos', () => {
  const bruttoParent = (altersvorsorge: number) => {
    const p = parent('A', 0, { incomeMode: 'brutto', deductions: ded({ altersvorsorge }) });
    return { ...p, gross: { ...p.gross, bruttoMonatlich: 3000, sonderzahlungenJahr: 0 } };
  };

  it('kürzt bei Brutto-Eingabe auf 4 % (3.000 € → 120 €)', () => {
    const e = bereinigtesEinkommen(bruttoParent(200), jk);
    expect(e.altersvorsorge).toBe(120);
    expect(e.altersvorsorgeHinweis).toContain('gekürzt');
    expect(e.bereinigt).toBe(Math.round((e.netto - 120) * 100) / 100);
  });

  it('lässt Beträge innerhalb der Grenze unverändert', () => {
    const e = bereinigtesEinkommen(bruttoParent(100), jk);
    expect(e.altersvorsorge).toBe(100);
    expect(e.altersvorsorgeHinweis).toContain('innerhalb der Grenze');
  });

  it('kürzt bei Netto-Eingabe nicht (Brutto unbekannt), weist aber darauf hin', () => {
    const e = bereinigtesEinkommen(parent('A', 2500, { deductions: ded({ altersvorsorge: 300 }) }), jk);
    expect(e.altersvorsorge).toBe(300);
    expect(e.bereinigt).toBe(2200);
    expect(e.altersvorsorgeHinweis).toContain('nicht geprüft');
  });
});

describe('Wohnvorteil', () => {
  it('wird dem Einkommen hinzugerechnet', () => {
    const e = bereinigtesEinkommen(parent('A', 2500, { deductions: ded({ wohnvorteil: 400, schulden: 100 }) }), jk);
    expect(e.wohnvorteil).toBe(400);
    expect(e.bereinigt).toBe(2800);
  });

  it('erhöht die Einkommensgruppe im Residenzmodell', () => {
    const ohne = calculate(input('residenz', parent('A', 2400), parent('B', 1000), [child('k1', 0)]), cfg);
    const mit = calculate(
      input('residenz', parent('A', 2400, { deductions: ded({ wohnvorteil: 600 }) }), parent('B', 1000), [child('k1', 0)]),
      cfg,
    );
    expect(mit.payments[0].amount).toBeGreaterThan(ohne.payments[0].amount);
  });
});

describe('Wechselmodell: Haftungsanteil höchstens nach eigenem Einkommen (BGH XII ZB 565/15)', () => {
  it('begrenzt den Anteil des Besserverdienenden auf seinen eigenen Tabellenbetrag', () => {
    // A 5.000 €, B 1.800 € → zusammen 6.800 € = Gruppe 12: 983 € (6–11 J.)
    // Quote A 3.250 / 3.300; ungekappt 968,11 € > eigener Tabellenbetrag Gruppe 9 = 849 €
    const r = calculate(
      input('wechsel', parent('A', 5000), parent('B', 1800), [child('k1', 1, { kindergeldRecipient: 'B' })]),
      cfg,
    );
    const step5 = r.steps.find((s) => s.id === 5)!;
    const kappung = step5.lines.find((l) => l.label.includes('begrenzt'));
    expect(kappung?.value).toBe('968,11 € → 849,00 €');
    // Barausgleich = (849 − 14,89) / 2; Kindergeld B → A: ½ × 259 × Quote A + ¼ × 259
    const p = r.payments[0];
    expect(p.payer).toBe('A');
    expect(p.amount).toBeCloseTo(417.06 - 192.29, 1);
  });

  it('greift auch bei mittleren Einkommensunterschieden', () => {
    // A 2.850 €, B 1.900 € → zusammen 4.750 € = Gruppe 8: 804 €; Quote A 88 % → 707,52 €
    // eigener Tabellenbetrag A (Gruppe 3) 614 € → Barausgleich (614 − 96,48) / 2 = 258,76 €; Kindergeld A → B 80,29 €
    const r = calculate(
      input('wechsel', parent('A', 2850), parent('B', 1900), [child('k1', 1, { kindergeldRecipient: 'A' })]),
      cfg,
    );
    expect(r.payments[0]).toMatchObject({ payer: 'A', amount: 339.05 });
  });

  it('greift nicht bei ähnlichen Einkommen', () => {
    // A 3.000 €, B 2.800 € → Gruppe 11: 938 €; Anteil A 509,80 € < eigener Tabellenbetrag Gruppe 4 (642 €)
    const r = calculate(
      input('wechsel', parent('A', 3000), parent('B', 2800), [child('k1', 1, { kindergeldRecipient: 'A' })]),
      cfg,
    );
    expect(r.steps.find((s) => s.id === 5)!.lines.some((l) => l.label.includes('begrenzt'))).toBe(false);
  });
});
