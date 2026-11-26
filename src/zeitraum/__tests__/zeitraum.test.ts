import { describe, expect, it } from 'vitest';
import { child, input, parent } from '../../engine/__tests__/helpers';
import { berechneZeitraum, monateZwischen } from '../zeitraum';

const basis = (geburtsdatum: string) =>
  input('residenz', parent('A', 3000), parent('B', 1800), [
    child('k1', 0, { age: { kind: 'birthdate', birthdate: geburtsdatum } }),
  ]);

describe('Unterhalt über einen Zeitraum', () => {
  it('zählt Monate über den Jahreswechsel', () => {
    expect(monateZwischen('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monateZwischen('2026-05', '2026-04')).toEqual([]);
  });

  it('wechselt die Altersstufe ab dem Monat des 6. Geburtstags (§ 1612a Abs. 3 BGB)', () => {
    const z = berechneZeitraum(basis('2020-06-15'), { von: '2026-01', bis: '2026-12' });
    expect(z.abschnitte.map((a) => [a.von, a.bis, a.zahlungen[0].stage])).toEqual([
      ['2026-01', '2026-05', 0],
      ['2026-06', '2026-12', 1],
    ]);
    expect(z.abschnitte[1].zahlungen[0].amount).toBeGreaterThan(z.abschnitte[0].zahlungen[0].amount);
    expect(z.summeNettoAB).toBe(
      Math.round((5 * z.abschnitte[0].nettoAB + 7 * z.abschnitte[1].nettoAB) * 100) / 100,
    );
  });

  it('nutzt je Monat die Werte des Kalenderjahres (Kindergeld 2027)', () => {
    const z = berechneZeitraum(basis('2022-03-01'), { von: '2026-11', bis: '2027-02' });
    expect(z.abschnitte.map((a) => [a.von, a.bis])).toEqual([
      ['2026-11', '2026-12'],
      ['2027-01', '2027-02'],
    ]);
    // Kindergeld 259 → 267 €: hälftige Anrechnung senkt den Zahlbetrag um 4 €
    expect(z.abschnitte[0].zahlungen[0].amount - z.abschnitte[1].zahlungen[0].amount).toBeCloseTo(4, 2);
  });

  it('berechnet den Rückstand nach bereits gezahlten Beträgen', () => {
    const z = berechneZeitraum(basis('2015-01-01'), {
      von: '2026-01',
      bis: '2026-12',
      zahlungen: [{ id: 'z', von: '2026-01', bis: '', zahler: 'A', betrag: 300 }],
    });
    expect(z.summeGezahltAB).toBe(3600);
    expect(z.rueckstand).toEqual({
      art: 'rueckstand',
      zahler: 'A',
      empfaenger: 'B',
      betrag: Math.round((z.summeNettoAB - 3600) * 100) / 100,
    });
    expect(z.rueckstand!.betrag).toBeGreaterThan(0);
  });

  it('lässt Monate ohne hinterlegte Werte aus und weist darauf hin', () => {
    const z = berechneZeitraum(basis('2015-01-01'), { von: '2025-11', bis: '2026-02' });
    expect(z.ausgelassen).toEqual(['2025-11', '2025-12']);
    expect(z.monate).toHaveLength(2);
    expect(z.hinweise.some((h) => h.includes('11/2025–12/2025'))).toBe(true);
  });

  it('weist darauf hin, wenn Kinder nur mit Altersstufe erfasst sind', () => {
    const z = berechneZeitraum(input('residenz', parent('A', 3000), parent('B', 1800), [child('k1', 1)]), {
      von: '2026-01',
      bis: '2026-03',
    });
    expect(z.abschnitte).toHaveLength(1);
    expect(z.hinweise.some((h) => h.includes('Geburtsdatum'))).toBe(true);
  });

  it('berücksichtigt Einkommensänderungen ab dem angegebenen Monat', () => {
    const z = berechneZeitraum(basis('2015-01-01'), {
      von: '2026-01',
      bis: '2026-06',
      aenderungen: [{ id: 'x', ab: '2026-04', elternteil: 'A', betrag: 5000 }],
    });
    expect(z.abschnitte.map((a) => [a.von, a.bis, a.einkommen.A ?? null])).toEqual([
      ['2026-01', '2026-03', null],
      ['2026-04', '2026-06', 5000],
    ]);
    expect(z.abschnitte[1].zahlungen[0].amount).toBeGreaterThan(z.abschnitte[0].zahlungen[0].amount);
  });

  it('nimmt bei mehreren Änderungen die zuletzt begonnene', () => {
    const z = berechneZeitraum(basis('2015-01-01'), {
      von: '2026-01',
      bis: '2026-04',
      aenderungen: [
        { id: 'b', ab: '2026-03', elternteil: 'A', betrag: 2500 },
        { id: 'a', ab: '2026-02', elternteil: 'A', betrag: 4000 },
      ],
    });
    expect(z.monate.map((m) => m.einkommen.A ?? null)).toEqual([null, 4000, 2500, 2500]);
  });

  it('rechnet mit wechselnden tatsächlichen Zahlungen und erkennt Überzahlungen', () => {
    const ohne = berechneZeitraum(basis('2015-01-01'), { von: '2026-01', bis: '2026-06' });
    const monatlich = ohne.abschnitte[0].nettoAB;
    const z = berechneZeitraum(basis('2015-01-01'), {
      von: '2026-01',
      bis: '2026-06',
      zahlungen: [
        { id: '1', von: '2026-01', bis: '2026-03', zahler: 'A', betrag: 400 },
        { id: '2', von: '2026-05', bis: '', zahler: 'A', betrag: 450 },
      ],
    });
    // April ohne Zahlung → eigener Abschnitt
    expect(z.abschnitte.map((a) => [a.von, a.bis, a.gezahltAB])).toEqual([
      ['2026-01', '2026-03', 400],
      ['2026-04', '2026-04', 0],
      ['2026-05', '2026-06', 450],
    ]);
    expect(z.summeGezahltAB).toBe(2100);
    expect(z.rueckstand).toMatchObject({ art: 'rueckstand', zahler: 'A', betrag: Math.round((6 * monatlich - 2100) * 100) / 100 });

    const zuViel = berechneZeitraum(basis('2015-01-01'), {
      von: '2026-01',
      bis: '2026-06',
      zahlungen: [{ id: '1', von: '2026-01', bis: '', zahler: 'A', betrag: monatlich + 100 }],
    });
    expect(zuViel.rueckstand).toMatchObject({ art: 'ueberzahlung', zahler: 'A', betrag: 600 });
  });

  it('wechselt das Betreuungsmodell ab dem angegebenen Monat', () => {
    const z = berechneZeitraum(basis('2015-01-01'), {
      von: '2026-01',
      bis: '2026-06',
      betreuung: [{ id: 'b', ab: '2026-04', childId: 'k1', care: 'A' }],
    });
    // Kind lebt zunächst bei B (A zahlt), ab April bei A (B zahlt)
    expect(z.abschnitte.map((a) => [a.von, a.bis, a.zahlungen[0].payer, a.zahlungen[0].care])).toEqual([
      ['2026-01', '2026-03', 'A', 'B'],
      ['2026-04', '2026-06', 'B', 'A'],
    ]);
    expect(z.hinweise.some((h) => h.includes('nicht mehr vorhandenes Kind'))).toBe(false);
  });

  it('ignoriert Änderungen bei Tarif-Eingabe mit Hinweis', () => {
    const inp = basis('2015-01-01');
    inp.parents.A = { ...inp.parents.A, incomeMode: 'brutto', gross: { ...inp.parents.A.gross, quelle: 'tarif' } };
    const z = berechneZeitraum(inp, {
      von: '2026-01',
      bis: '2026-02',
      aenderungen: [{ id: 'x', ab: '2026-02', elternteil: 'A', betrag: 9000 }],
    });
    expect(z.abschnitte).toHaveLength(1);
    expect(z.hinweise.some((h) => h.includes('Tarif-Eingabe'))).toBe(true);
  });
});
