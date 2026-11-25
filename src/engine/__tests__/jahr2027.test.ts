import { describe, expect, it } from 'vitest';
import { getJahresKonfiguration, lohnsteuer2027 as lst27, standardJahr, verfuegbareJahre } from '../../config';
import { lohnsteuerStkl56, tarifEinkommensteuer } from '../brutto';
import { calculate } from '../index';
import { resolveTarif } from '../tarif';
import { child, input, parent } from './helpers';

describe('Jahresregister', () => {
  it('enthält 2026 (endgültig) und 2027 (vorläufig)', () => {
    expect(verfuegbareJahre).toEqual([2026, 2027]);
    expect(getJahresKonfiguration(2026).status).toBe('endgueltig');
    expect(getJahresKonfiguration(2027).status).toBe('vorlaeufig');
    expect(getJahresKonfiguration(2027).hinweise.length).toBeGreaterThan(0);
    expect(() => getJahresKonfiguration(2025)).toThrow();
  });

  it('Standardjahr = aktuelles Jahr, sonst neuestes endgültiges Jahr', () => {
    expect(standardJahr(new Date('2026-11-20'))).toBe(2026);
    expect(standardJahr(new Date('2027-03-01'))).toBe(2027);
    expect(standardJahr(new Date('2031-01-01'))).toBe(2026);
  });
});

describe('Einkommensteuertarif 2027 (Regierungsentwurf, BT-Drs. 21/8235)', () => {
  it('rechnet alle sechs Zonen', () => {
    expect(tarifEinkommensteuer(12564, lst27)).toBe(0);
    expect(tarifEinkommensteuer(17799, lst27)).toBe(993); // (952,24·0,5235 + 1.400)·0,5235
    expect(tarifEinkommensteuer(100000, lst27)).toBe(30758); // 0,42·x − 11.241,73
    expect(tarifEinkommensteuer(260000, lst27)).toBe(98258); // 0,45·x − 18.741,70
    expect(tarifEinkommensteuer(300000, lst27)).toBe(116658); // 0,47·x − 24.341,68
  });

  it('ist an den Zonengrenzen (nahezu) stetig', () => {
    for (const g of [17800, 70601, 250000, 280000]) {
      expect(Math.abs(tarifEinkommensteuer(g, lst27) - tarifEinkommensteuer(g - 1, lst27))).toBeLessThanOrEqual(1);
    }
  });

  it('Steuerklasse V/VI: 47 % oberhalb von 224.000 €', () => {
    const a = lohnsteuerStkl56(300000, lst27);
    const b = lohnsteuerStkl56(301000, lst27);
    expect(b - a).toBe(470);
  });
});

describe('Berechnung mit Jahr 2027', () => {
  it('verwendet Kindergeld 267 € und meldet „vorläufig“', () => {
    const inp = { ...input('residenz', parent('Vater', 2850), parent('Mutter', 1500), [child('k1', 0), child('k2', 1)]), jahr: 2027, referenceDate: '2027-06-01' };
    const r = calculate(inp);
    // Gruppe 3: 535 − 133,50 und 614 − 133,50 (Tabelle 2026 übernommen)
    expect(r.payments.find((p) => p.childId === 'k1')!.amount).toBeCloseTo(401.5, 2);
    expect(r.payments.find((p) => p.childId === 'k2')!.amount).toBeCloseTo(480.5, 2);
    expect(r.issues.some((i) => i.message.includes('vorläufig'))).toBe(true);
  });

  it('warnt, wenn der Stichtag nicht im Berechnungsjahr liegt', () => {
    const inp = { ...input('residenz', parent('Vater', 2850), parent('Mutter', 1500), [child('k1', 0)]), jahr: 2027 };
    expect(calculate(inp).issues.some((i) => i.message.includes('nicht im Berechnungsjahr'))).toBe(true);
  });

  it('TV-L-Tabelle ab 01.03.2027 (+2 %)', () => {
    const g = parent('x', 0).gross;
    const r = resolveTarif(
      { ...g, quelle: 'tarif', tarif: { tarifId: 'tv-l', gruppe: 'E 13', stufe: 4, arbeitszeit: 100, jahressonderzahlung: false, zulagen: [] } },
      getJahresKonfiguration(2027).tarife,
    )!;
    expect(r.tabellenentgelt).toBe(5991.03);
    expect(r.tabelle.gueltigAb).toBe('2027-03-01');
  });
});
