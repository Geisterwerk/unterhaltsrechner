import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import { calculate } from '../../engine';
import { child, input, otherChild, parent } from '../../engine/__tests__/helpers';
import { createReportPdf, pdfText, reportFilename } from '../pdfReport';
import { buildReportModel } from '../reportModel';

const beispiel = () => {
  const A = parent('Vater', 0, {
    incomeMode: 'brutto',
    gross: {
      ...parent('x', 0).gross,
      quelle: 'tarif',
      tarif: { tarifId: 'tv-ba', gruppe: 'TE V', stufe: 1, arbeitszeit: 100, jahressonderzahlung: true, zulagen: ['fs1'] },
      zusatzversorgung: { kasse: 'vbl-west', anProzent: 1.81, agUmlageProzent: 5.49, anSteuerfrei: false, agBeitragProzent: 0 },
    },
    otherChildren: [otherChild('Lena', 0)],
  });
  const inp = input('gemischt', A, parent('Mutter', 1800), [
    child('Kind 1', 1, { care: 'B' }),
    child('Kind 2', 0, { care: 'wechsel' }),
  ]);
  return { inp, result: calculate(inp, cfg) };
};

describe('Berichtsmodell', () => {
  it('enthält Ergebnis, Eingaben, Rechenweg und Grundlagen', () => {
    const { inp, result } = beispiel();
    const m = buildReportModel(inp, result, new Date('2026-11-20T10:00:00'));
    expect(m.stichtag).toBe('20.11.2026');
    expect(m.ergebnis.ok).toBe(true);
    expect(m.ergebnis.zusammenfassung[0]).toMatch(/^Vater zahlt an Mutter: .* monatlich$/);
    expect(m.ergebnis.zahlungen.map((z) => z.betreuung)).toEqual(['lebt bei Mutter', 'Wechselmodell 50 : 50']);
    expect(m.eingaben.map((s) => s.titel)).toEqual(['Vater', 'Mutter', 'Gemeinsame Kinder', 'Berechnungsoptionen']);
    const vater = Object.fromEntries(m.eingaben[0].zeilen);
    expect(vater['Bruttolohn aus Tarif']).toContain('TV-BA');
    expect(vater['Zulagen']).toContain('Funktionsstufe 1');
    expect(vater['Zusatzversorgung']).toContain('VBL West');
    expect(m.rechenweg.map((s) => s.titel)[0]).toBe('1. Bereinigtes Nettoeinkommen');
    expect(m.rechenweg).toHaveLength(6);
    expect(m.grundlagen.some((g) => g.includes('Düsseldorfer Tabelle 2026'))).toBe(true);
    expect(m.grundlagen.some((g) => g.includes('Lohnsteuer'))).toBe(true);
  });

  it('meldet Fehler statt Ergebnis bei ungültiger Eingabe', () => {
    const inp = input('residenz', parent('A', -5), parent('B', 1000), []);
    const m = buildReportModel(inp, calculate(inp, cfg));
    expect(m.ergebnis.ok).toBe(false);
    expect(m.ergebnis.fehler.length).toBeGreaterThan(0);
  });
});

describe('PDF', () => {
  it('ersetzt Zeichen außerhalb von WinAnsi', () => {
    expect(pdfText('a − b ≥ c → d ⌀ 5 €, Größe „x“ – ½')).toBe('a - b >= c -> d Ø 5 €, Größe „x“ – ½');
  });

  it('erzeugt ein mehrseitiges A4-PDF mit Kopf, Ergebnis und Seitenzahlen', () => {
    const { inp, result } = beispiel();
    const doc = createReportPdf(buildReportModel(inp, result), { compress: false });
    const pdf = doc.output();
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    for (const t of ['Berechnung Kindesunterhalt', 'Rechtlicher Hinweis', 'Ergebnis', 'Rechenweg', 'Seite 1 von']) {
      expect(pdf).toContain(t);
    }
  });

  it('Dateiname mit Datum', () => {
    expect(reportFilename(new Date('2026-11-20T12:00:00Z'))).toBe('Unterhaltsberechnung_2026-11-20.pdf');
  });
});
