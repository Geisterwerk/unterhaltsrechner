import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg, getJahresKonfiguration } from '../../config';
import { leitlinienFuer } from '../../config/leitlinien';
import type { CalculationInput } from '../../types';
import { calculate } from '../index';
import { bereinigtesEinkommen, notwendigerSelbstbehalt } from '../income';
import { child, input, parent } from './helpers';

const jk = getJahresKonfiguration(2026);
const ded = (o: Partial<ReturnType<typeof parent>['deductions']>) => ({ ...parent('X', 0).deductions, ...o });
const mitLeitlinien = (inp: CalculationInput, id: 'nrw' | 'sued' | 'nds' | 'berlin'): CalculationInput => ({
  ...inp,
  options: { ...inp.options, leitlinien: id },
});

describe('Leitlinien wählbar', () => {
  it('5 %-Pauschale: NRW/Süd ohne Grenzen, Niedersachsen 50–150 €', () => {
    const hoch = parent('A', 4000, { deductions: ded({ berufsbedingtMode: 'pauschal' }) });
    const niedrig = parent('A', 800, { deductions: ded({ berufsbedingtMode: 'pauschal' }) });
    expect(bereinigtesEinkommen(hoch, jk, leitlinienFuer('nrw')).berufsbedingt).toBe(200);
    expect(bereinigtesEinkommen(hoch, jk, leitlinienFuer('sued')).berufsbedingt).toBe(200);
    expect(bereinigtesEinkommen(hoch, jk, leitlinienFuer('nds')).berufsbedingt).toBe(150);
    expect(bereinigtesEinkommen(niedrig, jk, leitlinienFuer('nds')).berufsbedingt).toBe(50);
    expect(bereinigtesEinkommen(niedrig, jk, leitlinienFuer('nrw')).berufsbedingt).toBe(40);
  });

  it('Altersvorsorge: NRW 4 % zusätzlich, Süd 23 % insgesamt abzüglich RV-Beitrag (AN + AG)', () => {
    const p = parent('A', 0, { incomeMode: 'brutto', deductions: ded({ altersvorsorge: 500 }) });
    const brutto = { ...p, gross: { ...p.gross, bruttoMonatlich: 4000, sonderzahlungenJahr: 0 } };
    expect(bereinigtesEinkommen(brutto, jk, leitlinienFuer('nrw')).altersvorsorge).toBe(160);
    // 23 % − 2 × 9,3 % = 4,4 % von 4.000 €
    expect(bereinigtesEinkommen(brutto, jk, leitlinienFuer('sued')).altersvorsorge).toBe(176);
  });

  it('Ausbildungsaufwand bei eigenem Haushalt: NRW nicht, Süd/Niedersachsen schon', () => {
    const kind = child('k1', 3, { ownIncome: 600, eigenerHaushalt: true, adultRank: 'sonstig' });
    const basis = input('residenz', parent('A', 4000), parent('B', 2500), [kind]);
    const nrw = calculate(mitLeitlinien(basis, 'nrw'), cfg);
    const sued = calculate(mitLeitlinien(basis, 'sued'), cfg);
    const gesamt = (r: ReturnType<typeof calculate>) => r.payments.reduce((a, p) => a + p.amount, 0);
    // im Süden mindern nur 500 € (600 − 100) den Bedarf → höhere Zahlung
    expect(Math.round((gesamt(sued) - gesamt(nrw)) * 100) / 100).toBe(100);
  });
});

describe('Leitlinien des Kammergerichts Berlin', () => {
  it('Pauschale 5 %, mindestens 50 €, höchstens 150 €', () => {
    const p = (netto: number) => parent('A', netto, { deductions: ded({ berufsbedingtMode: 'pauschal' }) });
    expect(bereinigtesEinkommen(p(4000), jk, leitlinienFuer('berlin')).berufsbedingt).toBe(150);
    expect(bereinigtesEinkommen(p(800), jk, leitlinienFuer('berlin')).berufsbedingt).toBe(50);
    expect(bereinigtesEinkommen(p(2000), jk, leitlinienFuer('berlin')).berufsbedingt).toBe(100);
  });

  it('kein pauschaler Ausbildungsaufwand: Ausbildungsvergütung zählt voll', () => {
    const kind = child('k1', 2, { ownIncome: 500 });
    const basis = input('residenz', parent('A', 3000), parent('B', 1500), [kind]);
    const nrw = calculate(mitLeitlinien(basis, 'nrw'), cfg).payments[0].amount;
    const berlin = calculate(mitLeitlinien(basis, 'berlin'), cfg).payments[0].amount;
    // Minderjährige: Eigeneinkommen hälftig – in NRW (500 − 100) / 2 = 200, in Berlin 500 / 2 = 250
    expect(Math.round((nrw - berlin) * 100) / 100).toBe(50);
  });
});

describe('Fiktives Einkommen', () => {
  const arbeitslos = parent('A', 0, { employed: false, fiktiv: { aktiv: true, netto: 1600 } });

  it('ersetzt ein geringeres Einkommen, NRW setzt die 5 %-Pauschale an, Elternteil gilt als erwerbstätig', () => {
    const e = bereinigtesEinkommen(arbeitslos, jk, leitlinienFuer('nrw'));
    expect(e.fiktiv).toBe(true);
    expect(e.netto).toBe(1600);
    expect(e.nettoTatsaechlich).toBe(0);
    expect(e.berufsbedingt).toBe(80);
    expect(e.bereinigt).toBe(1520);
    expect(notwendigerSelbstbehalt(arbeitslos, cfg)).toBe(cfg.selbstbehalt.notwendigErwerbstaetig);
  });

  it('nach Süddeutschen Leitlinien keine automatische Pauschale', () => {
    expect(bereinigtesEinkommen(arbeitslos, jk, leitlinienFuer('sued')).berufsbedingt).toBe(0);
  });

  it('greift nicht, wenn das tatsächliche Einkommen höher ist', () => {
    const e = bereinigtesEinkommen(parent('A', 2500, { fiktiv: { aktiv: true, netto: 1600 } }), jk);
    expect(e.fiktiv).toBe(false);
    expect(e.netto).toBe(2500);
  });

  it('führt im Rechner zu einer Zahlung, wo ohne fiktives Einkommen keine wäre', () => {
    const ohne = calculate(input('residenz', parent('A', 0, { employed: false }), parent('B', 2000), [child('k1', 0)]), cfg);
    const mit = calculate(input('residenz', arbeitslos, parent('B', 2000), [child('k1', 0)]), cfg);
    expect(ohne.payments[0].amount).toBe(0);
    // 1.520 € bereinigt − 1.450 € Selbstbehalt = 70 € (Mangelfall)
    expect(mit.payments[0].amount).toBe(70);
    expect(mit.steps[0].lines.some((l) => l.label.includes('fiktives Nettoeinkommen'))).toBe(true);
  });
});

describe('Private Kranken- und Pflegeversicherung', () => {
  it('Elternteil: Beitrag mindert das Einkommen', () => {
    const e = bereinigtesEinkommen(parent('A', 3000, { deductions: ded({ pkv: 450 }) }), jk);
    expect(e.pkv).toBe(450);
    expect(e.bereinigt).toBe(2550);
  });

  it('Kind im Residenzmodell: Barunterhaltspflichtiger trägt den Beitrag zusätzlich, sein Einkommen wird bereinigt', () => {
    const ohne = calculate(input('residenz', parent('A', 4000), parent('B', 1500), [child('k1', 1)]), cfg);
    const mit = calculate(input('residenz', parent('A', 4000), parent('B', 1500), [child('k1', 1, { krankenversicherung: 150 })]), cfg);
    const zOhne = ohne.payments[0];
    const zMit = mit.payments[0];
    expect(zMit.kv).toBe(150);
    expect(zMit.note).toContain('Kranken-/Pflegeversicherung');
    // Einkommen 4.000 − 150 = 3.850 € kann eine niedrigere Gruppe ergeben; der Beitrag kommt in voller Höhe hinzu
    expect(zMit.amount - 150).toBeLessThanOrEqual(zOhne.amount);
    expect(mit.steps[0].lines.some((l) => l.label.includes('Kranken-/Pflegeversicherung der Kinder'))).toBe(true);
  });

  it('Kind im Residenzmodell: Ehegattenunterhalt zieht den Beitrag nicht doppelt ab', () => {
    const basis = input('residenz', parent('A', 4000), parent('B', 1500), [child('k1', 1, { krankenversicherung: 150 })]);
    const r = calculate({ ...basis, ehegatte: { aktiv: true, art: 'trennung' } }, cfg);
    const step = r.steps.find((s) => s.title === 'Ehegattenunterhalt')!;
    const zeileA = step.lines.find((l) => l.label.startsWith('A:'))!;
    // bereinigt (4.000 − 150) − Kindesunterhalt ohne KV-Anteil
    const ku = r.payments.filter((p) => p.payer === 'A').reduce((a, p) => a + p.amount - (p.kv ?? 0), 0);
    expect(zeileA.value).toBeCloseTo(3850 - ku, 2);
  });

  it('Kind im Wechselmodell: Beitrag erhöht den Bedarf und zählt beim Zahler als Leistung in natura', () => {
    const basis = (kvZahler: 'A' | 'B') =>
      input('wechsel', parent('A', 3000), parent('B', 2800), [
        child('k1', 1, { kindergeldRecipient: 'A', krankenversicherung: 200, kvZahler }),
      ]);
    const zahltA = calculate(basis('A'), cfg).payments[0];
    const zahltB = calculate(basis('B'), cfg).payments[0];
    // A zahlt den Beitrag selbst → sein Ausgleich an B ist um 200 € geringer als wenn B ihn zahlt
    expect(zahltA.payer).toBe('A');
    expect(Math.round((zahltB.amount - zahltA.amount) * 100) / 100).toBe(200);
  });

  it('volljähriges Kind: Beitrag kommt zum Bedarf hinzu', () => {
    const ohne = calculate(input('residenz', parent('A', 4000), parent('B', 2500), [child('k1', 3)]), cfg);
    const mit = calculate(input('residenz', parent('A', 4000), parent('B', 2500), [child('k1', 3, { krankenversicherung: 100 })]), cfg);
    const summe = (r: ReturnType<typeof calculate>) => r.payments.reduce((a, p) => a + p.amount, 0);
    expect(Math.round((summe(mit) - summe(ohne)) * 100) / 100).toBe(100);
  });
});
