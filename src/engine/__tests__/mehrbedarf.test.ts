import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import { buildVergleich, differenz } from '../../compare/vergleich';
import type { BedarfsPosten } from '../../types';
import { calculate } from '../index';
import { child, input, parent } from './helpers';

const posten = (o: Partial<BedarfsPosten>): BedarfsPosten => ({
  id: 'p',
  bezeichnung: 'Kita',
  art: 'mehrbedarf',
  betrag: 200,
  verauslagt: 'B',
  ...o,
});

describe('Mehr- und Sonderbedarf', () => {
  // A 3.000 €, B 2.000 €; ein Kind (0–5) lebt bei B → A zahlt 584 − 129,50 = 454,50 € (Gruppe 4 + Höherstufung)
  // Quote: A 3.000 − 454,50 − 1.750 = 795,50; B 2.000 − 1.750 = 250 → A 76,09 %
  const qA = 795.5 / 1045.5;

  it('Mehrbedarf (monatlich) wird nach Haftungsquote erstattet', () => {
    const r = calculate(
      input('residenz', parent('A', 3000), parent('B', 2000), [child('k1', 0, { bedarfsposten: [posten({})] })]),
      cfg,
    );
    const mb = r.payments.filter((p) => p.art === 'mehrbedarf');
    expect(mb).toHaveLength(1);
    expect(mb[0]).toMatchObject({ payer: 'A', payee: 'B', label: 'k1 – Kita' });
    expect(mb[0].amount).toBeCloseTo(200 * qA, 2);
    expect(r.summary).toEqual([{ payer: 'A', payee: 'B', amount: Math.round((454.5 + 200 * qA) * 100) / 100 }]);
    expect(r.steps.find((s) => s.id === 7)?.title).toBe('Mehr- und Sonderbedarf');
  });

  it('Sonderbedarf erscheint als einmalige Erstattung, nicht im Monatsbetrag', () => {
    const r = calculate(
      input('residenz', parent('A', 3000), parent('B', 2000), [
        child('k1', 0, { bedarfsposten: [posten({ art: 'sonderbedarf', bezeichnung: 'Klassenfahrt', betrag: 300 })] }),
      ]),
      cfg,
    );
    expect(r.summary).toEqual([{ payer: 'A', payee: 'B', amount: 454.5 }]);
    expect(r.einmalig).toHaveLength(1);
    expect(r.einmalig[0]).toMatchObject({ payer: 'A', payee: 'B', bezeichnung: 'Klassenfahrt', gesamtbetrag: 300 });
    expect(r.einmalig[0].betrag).toBeCloseTo(300 * qA, 2);
  });

  it('verauslagt der Barunterhaltspflichtige, erstattet der andere Elternteil seinen Anteil', () => {
    const r = calculate(
      input('residenz', parent('A', 3000), parent('B', 2000), [
        child('k1', 0, { bedarfsposten: [posten({ verauslagt: 'A', betrag: 100 })] }),
      ]),
      cfg,
    );
    const mb = r.payments.find((p) => p.art === 'mehrbedarf')!;
    expect(mb).toMatchObject({ payer: 'B', payee: 'A' });
    expect(mb.amount).toBeCloseTo(100 * (1 - qA), 2);
    expect(r.saldo).not.toBeNull();
  });
});

describe('Volljährige mit eigenem Haushalt', () => {
  it('fester Bedarf 990 € unabhängig vom Elterneinkommen, Rang 4', () => {
    const kind = child('stud', 3, { care: 'B', eigenerHaushalt: true });
    const r = calculate(input('gemischt', parent('A', 4000), parent('B', 2500), [kind]), cfg);
    // 990 − 259 = 731; Quote 2.250 : 750 → A 548,25, B 182,75
    expect(r.payments.find((p) => p.payer === 'A')!.amount).toBeCloseTo(548.25, 2);
    expect(r.payments.find((p) => p.payer === 'B')!.amount).toBeCloseTo(182.75, 2);
    expect(r.payments.every((p) => p.payee === 'Kind')).toBe(true);
    // höheres Einkommen ändert den Bedarf nicht, nur die Quote
    const r2 = calculate(input('gemischt', parent('A', 6000), parent('B', 2500), [kind]), cfg);
    const summe = r2.payments.reduce((a, p) => a + p.amount, 0);
    expect(summe).toBeCloseTo(731, 2);
    expect(r.issues.some((i) => i.message.includes('nicht privilegiert'))).toBe(true);
  });

  it('ohne eigenen Haushalt: Bedarf nach zusammengerechnetem Einkommen, je Elternteil gedeckelt (Leitlinien NRW 13.1)', () => {
    const r = calculate(input('gemischt', parent('A', 4000), parent('B', 2500), [child('k', 3, { care: 'B' })]), cfg);
    // 6.500 € → Gruppe 12 → 1.229 − 259 = 970; Quote 2.250 : 750 → A 727,50, B 242,50
    // A höchstens nach eigenem Einkommen: 4.000 € → Gruppe 6 → 894 − 259 = 635
    expect(r.payments.find((p) => p.payer === 'A')!.amount).toBe(635);
    expect(r.payments.find((p) => p.payer === 'B')!.amount).toBe(242.5);
  });

  it('Ausbildungsaufwand 100 € nur bei Wohnen im Elternhaushalt', () => {
    // eigener Haushalt: 990 − 259 − 600 (kein Abzug) = 131; Quote 2.250 : 750
    const eh = calculate(
      input('gemischt', parent('A', 4000), parent('B', 2500), [child('k', 3, { care: 'B', eigenerHaushalt: true, ownIncome: 600 })]),
      cfg,
    );
    expect(eh.payments.reduce((a, p) => a + p.amount, 0)).toBeCloseTo(131, 2);
  });
});

describe('Szenarienvergleich', () => {
  it('stellt Ergebnisse gegenüber und berechnet Differenzen zum ersten Szenario', () => {
    const basis = input('residenz', parent('Vater', 3000), parent('Mutter', 1500), [child('k1', 0)]);
    const mehr = { ...basis, parents: { ...basis.parents, A: { ...basis.parents.A, netIncome: 3600 } } };
    const v = buildVergleich([
      { id: '1', name: 'Basis', input: basis },
      { id: '2', name: 'Gehaltserhöhung', input: mehr },
    ]);
    expect(v.spalten).toEqual(['Basis', 'Gehaltserhöhung']);
    const zahlung = v.zeilen.find((z) => z.label === 'Vater → Mutter')!;
    // 3.000 → Gruppe 4 + Höherstufung = Gruppe 5: 584 − 129,50; 3.600 → Gruppe 5 + 1 = Gruppe 6: 623 − 129,50
    expect(zahlung.zahlen).toEqual([454.5, 493.5]);
    expect(differenz(zahlung, 1)).toBe('+39,00 €');
    expect(v.zeilen.find((z) => z.label === 'k1: Betreuung')!.werte).toEqual(['bei Mutter', 'bei Mutter']);
  });
});
