import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg, getJahresKonfiguration, tarifvertraege2026 as tarife } from '../../config';
import type { GrossIncomeInput, TarifInput } from '../../types';
import { calculate, validateInput } from '../index';
import { effectiveGross, resolveTarif } from '../tarif';
import { child, input, parent } from './helpers';

const gross = (tarif: Partial<TarifInput> = {}): GrossIncomeInput => ({
  quelle: 'tarif',
  tarif: { tarifId: 'tvoed-vka', gruppe: 'E 9b', stufe: 3, arbeitszeit: 100, jahressonderzahlung: true, zulagen: [], ...tarif },
  bruttoMonatlich: 0,
  sonderzahlungenJahr: 0,
  arbeitszeit: 100,
  steuerklasse: 1,
  kinderfreibetraege: 0,
  kirchensteuerSatz: 0,
  krankenkasse: 'durchschnitt',
  kvZusatzbeitrag: 2.9,
  pvKinder: 1,
  zusatzversorgung: { kasse: 'keine', anProzent: 0, agUmlageProzent: 0, anSteuerfrei: false, agBeitragProzent: 0 },
});

describe('Tariftabellen-Konfiguration', () => {
  it('enthält die fünf Tarifwerke mit je 6 Stufen und positiven Beträgen', () => {
    expect(tarife.tabellen.map((t) => t.id)).toEqual(['tvoed-vka', 'tvoed-bund', 'tv-l', 'tvoed-sue', 'tv-ba']);
    for (const t of tarife.tabellen) {
      for (const g of t.gruppen) {
        expect(g.werte).toHaveLength(6);
        expect(g.werte.some((v) => v !== null)).toBe(true);
        g.werte.forEach((v) => v !== null && expect(v).toBeGreaterThan(1000));
        expect(g.jahressonderzahlung).toBeGreaterThan(0);
      }
    }
  });
});

describe('Stichproben gegen die Quelle (oeffentlicher-dienst.info, Monatswerte 2026)', () => {
  const wert = (tarifId: string, gruppe: string, stufe: number) =>
    tarife.tabellen.find((t) => t.id === tarifId)!.gruppen.find((g) => g.id === gruppe)!.werte[stufe - 1];
  it.each([
    ['tv-ba', 'TE V', 2, 3530.78], // auch lohntastik.de
    ['tv-ba', 'TE I', 6, 7567.33],
    ['tv-ba', 'TE VIII', 1, 2733.55],
    ['tvoed-vka', 'E 15', 6, 8204.11],
    ['tvoed-vka', 'E 1', 2, 2534.55],
    ['tvoed-bund', 'E 9c', 1, 3978.29],
    ['tv-l', 'E 13', 4, 5873.56],
    ['tvoed-sue', 'S 8a', 3, 3976.82],
  ])('%s %s Stufe %i = %f €', (tarifId, gruppe, stufe, erwartet) => {
    expect(wert(tarifId, gruppe, stufe)).toBe(erwartet);
  });
});

describe('Brutto aus Tarif', () => {
  it('TVöD VKA E 9b Stufe 3, Vollzeit, mit Jahressonderzahlung 85 %', () => {
    const r = resolveTarif(gross(), tarife)!;
    expect(r.tabellenentgelt).toBe(4203.56);
    expect(r.bruttoMonatlich).toBe(4203.56);
    expect(r.jahressonderzahlung).toBe(3573.03); // 4.203,56 · 85 %
  });

  it('Teilzeit 50 % halbiert Entgelt und Jahressonderzahlung', () => {
    const r = resolveTarif(gross({ arbeitszeit: 50 }), tarife)!;
    expect(r.bruttoMonatlich).toBe(2101.78);
    expect(r.jahressonderzahlung).toBe(1786.51);
  });

  it('ohne Jahressonderzahlung', () => {
    const { gross: g } = effectiveGross(gross({ jahressonderzahlung: false }), tarife);
    expect(g.sonderzahlungenJahr).toBe(0);
    expect(g.bruttoMonatlich).toBe(4203.56);
  });

  it('TV-BA verwendet Tätigkeitsebenen', () => {
    const r = resolveTarif(gross({ tarifId: 'tv-ba', gruppe: 'TE V', stufe: 1 }), tarife)!;
    expect(r.tabellenentgelt).toBe(3240.69);
    expect(r.jahressonderzahlungProzent).toBe(95);
  });

  it('nicht vorhandene Stufe ist ungültig', () => {
    expect(resolveTarif(gross({ gruppe: 'E 1', stufe: 1 }), tarife)).toBeNull();
    const A = parent('A', 0, { incomeMode: 'brutto', gross: gross({ gruppe: 'E 1', stufe: 1 }) });
    const issues = validateInput(input('residenz', A, parent('B', 1500), [child('k1', 0)]), getJahresKonfiguration(2026));
    expect(issues.some((i) => i.severity === 'error' && i.field === 'parents.A.tarif')).toBe(true);
  });

  it('keine Warnung „kein Einkommen“ bei Tarifauswahl (Bruttofeld ist dann leer)', () => {
    const A = parent('A', 0, { incomeMode: 'brutto', gross: gross() });
    const issues = validateInput(input('residenz', A, parent('B', 1500), [child('k1', 0)]), getJahresKonfiguration(2026));
    expect(issues.some((i) => i.message.includes('kein Einkommen'))).toBe(false);
  });

  it('Warnung, wenn Tarif gewählt, aber nicht erwerbstätig', () => {
    const A = parent('A', 0, { incomeMode: 'brutto', employed: false, gross: gross() });
    const issues = validateInput(input('residenz', A, parent('B', 1500), [child('k1', 0)]), getJahresKonfiguration(2026));
    expect(issues.some((i) => i.message.includes('nicht erwerbstätig erfasst'))).toBe(true);
  });

  it('fließt mit Tarifangabe in den Rechenweg ein', () => {
    const A = parent('A', 0, { incomeMode: 'brutto', gross: gross() });
    const r = calculate(input('residenz', A, parent('B', 1500), [child('k1', 0)]), cfg);
    expect(r.ok).toBe(true);
    const step1 = r.steps.find((s) => s.id === 1)!;
    expect(step1.lines.some((l) => l.label.includes('TVöD VKA') && l.value === 'E 9b, Stufe 3')).toBe(true);
    expect(step1.lines.some((l) => l.label.includes('Jahressonderzahlung') && l.value === 3573.03)).toBe(true);
  });
});

describe('TV-BA Funktionsstufen (Referenz: Gehaltsrechner oeffentlicher-dienst.info 2026)', () => {
  it('TE V Stufe 1 mit Funktionsstufe 1: Brutto und Jahressonderzahlung inkl. Funktionsstufe', () => {
    const r = resolveTarif(gross({ tarifId: 'tv-ba', gruppe: 'TE V', stufe: 1, zulagen: ['fs1'] }), tarife)!;
    expect(r.zulagen).toEqual([{ id: 'fs1', name: 'Funktionsstufe 1', betrag: 83.06 }]);
    expect(r.bruttoMonatlich).toBe(3323.75);
    expect(r.jahressonderzahlung).toBe(3157.56); // 95 % von 3.323,75
  });

  it('TE I Stufe 6 mit beiden Funktionsstufen', () => {
    const r = resolveTarif(gross({ tarifId: 'tv-ba', gruppe: 'TE I', stufe: 6, zulagen: ['fs1', 'fs2'] }), tarife)!;
    expect(r.bruttoMonatlich).toBe(8245.8); // 7.567,33 + 226,16 + 452,31
  });

  it('Teilzeit 50 %: Funktionsstufen anteilig', () => {
    const r = resolveTarif(
      gross({ tarifId: 'tv-ba', gruppe: 'TE V', stufe: 1, arbeitszeit: 50, zulagen: ['fs1', 'fs2'] }),
      tarife,
    )!;
    expect(r.zulagen.map((z) => z.betrag)).toEqual([41.53, 83.06]);
    expect(r.bruttoMonatlich).toBe(1744.94); // 1.620,35 + 41,53 + 83,06
  });

  it('Zulagen anderer Tarifverträge werden ignoriert', () => {
    const r = resolveTarif(gross({ zulagen: ['fs1'] }), tarife)!;
    expect(r.zulagen).toEqual([]);
    expect(r.bruttoMonatlich).toBe(4203.56);
  });
});
