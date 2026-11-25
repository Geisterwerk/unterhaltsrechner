import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg, krankenkassen2026, lohnsteuer2026 as lst, tarifvertraege2026, zusatzversorgung2026 as zvCfg } from '../../config';
import type { GrossIncomeInput } from '../../types';
import { lohnsteuerStkl56, nettoAusBrutto, pvSatzAn, tarifEinkommensteuer } from '../brutto';
import { effectiveGross } from '../tarif';
import { calculate } from '../index';
import { child, input, parent } from './helpers';

const gross = (o: Partial<GrossIncomeInput> = {}): GrossIncomeInput => ({
  quelle: 'manuell',
  tarif: { tarifId: 'tvoed-vka', gruppe: 'E 9b', stufe: 3, arbeitszeit: 100, jahressonderzahlung: true, zulagen: [] },
  bruttoMonatlich: 4000,
  sonderzahlungenJahr: 0,
  arbeitszeit: 100,
  steuerklasse: 1,
  kinderfreibetraege: 0,
  kirchensteuerSatz: 0,
    krankenkasse: 'durchschnitt',
  kvZusatzbeitrag: 2.9,
  pvKinder: 1,
  zusatzversorgung: { kasse: 'keine', anProzent: 0, agUmlageProzent: 0, anSteuerfrei: false, agBeitragProzent: 0 },
  ...o,
});

describe('Einkommensteuertarif 2026 (§ 32a EStG)', () => {
  it('rechnet die Tarifzonen', () => {
    expect(tarifEinkommensteuer(12348, lst)).toBe(0);
    expect(tarifEinkommensteuer(17799, lst)).toBe(1034); // (914,51·0,5451 + 1.400)·0,5451
    expect(tarifEinkommensteuer(40000, lst)).toBe(7209);
    expect(tarifEinkommensteuer(100000, lst)).toBe(30864); // 0,42·x − 11.135,63
    expect(tarifEinkommensteuer(300000, lst)).toBe(115529); // 0,45·x − 19.470,38
  });

  it('ist an den Zonengrenzen (nahezu) stetig', () => {
    expect(Math.abs(tarifEinkommensteuer(69879, lst) - tarifEinkommensteuer(69878, lst))).toBeLessThanOrEqual(1);
    expect(Math.abs(tarifEinkommensteuer(277826, lst) - tarifEinkommensteuer(277825, lst))).toBeLessThanOrEqual(1);
  });

  it('Steuerklasse V/VI: Mindeststeuersatz 14 % im unteren Bereich', () => {
    // UP5-6: 2 · (ESt(12.500) − ESt(7.500)) = 42 < 14 % · 10.000 = 1.400
    expect(lohnsteuerStkl56(10000, lst)).toBe(1400);
  });
});

describe('Brutto-Netto-Schätzung', () => {
  it('Steuerklasse I, 4.000 € brutto, 1 Kind (PV)', () => {
    // SV: RV 4.464 + AV 624 + KV 4.200 (7,3 % + 1,45 %) + PV 864 = 10.152
    // Vorsorgepauschale 4.464 + 4.920 = 9.384; zvE 48.000 − 1.230 − 36 − 9.384 = 37.350 → LSt 6.382
    const r = nettoAusBrutto(gross(), lst, zvCfg);
    expect(r.sozialversicherung).toBeCloseTo(10152, 2);
    expect(r.vorsorgepauschale).toBe(9384);
    expect(r.zvE).toBe(37350);
    expect(r.lohnsteuer).toBe(6382);
    expect(r.soli).toBe(0);
    expect(r.nettoMonat).toBeCloseTo((48000 - 6382 - 10152) / 12, 2);
  });

  it('Steuerklasse III ergibt mehr, V weniger Netto als I', () => {
    const i = nettoAusBrutto(gross(), lst, zvCfg).nettoMonat;
    expect(nettoAusBrutto(gross({ steuerklasse: 3 }), lst, zvCfg).nettoMonat).toBeGreaterThan(i);
    expect(nettoAusBrutto(gross({ steuerklasse: 5 }), lst, zvCfg).nettoMonat).toBeLessThan(i);
  });

  it('Kirchensteuer, Soli und Kinderfreibeträge bei hohem Einkommen', () => {
    const ohne = nettoAusBrutto(gross({ bruttoMonatlich: 9000, kirchensteuerSatz: 9 }), lst, zvCfg);
    expect(ohne.soli).toBeGreaterThan(0);
    expect(ohne.kirchensteuer).toBeGreaterThan(0);
    // Kinderfreibeträge mindern nur Soli/KiSt, nicht die Lohnsteuer
    const mit = nettoAusBrutto(gross({ bruttoMonatlich: 9000, kirchensteuerSatz: 9, kinderfreibetraege: 2 }), lst, zvCfg);
    expect(mit.lohnsteuer).toBe(ohne.lohnsteuer);
    expect(mit.kirchensteuer).toBeLessThan(ohne.kirchensteuer);
  });

  it('Beitragsbemessungsgrenzen deckeln die Sozialversicherung', () => {
    const r = nettoAusBrutto(gross({ bruttoMonatlich: 12000 }), lst, zvCfg);
    expect(r.rv).toBeCloseTo(101400 * 0.093, 2);
    expect(r.kv).toBe(6103.13); // 69.750 · 8,75 % = 6.103,125 → auf Cent gerundet
  });

  it('Pflegeversicherung: Kinderlosenzuschlag und Abschläge', () => {
    expect(pvSatzAn(0, lst)).toBeCloseTo(0.024, 6);
    expect(pvSatzAn(1, lst)).toBeCloseTo(0.018, 6);
    expect(pvSatzAn(3, lst)).toBeCloseTo(0.013, 6);
    expect(pvSatzAn(7, lst)).toBeCloseTo(0.008, 6);
  });

  it('fließt in die Unterhaltsberechnung ein', () => {
    const A = parent('A', 0, { incomeMode: 'brutto', gross: gross() });
    const r = calculate(input('residenz', A, parent('B', 1500), [child('k1', 0)]), cfg);
    expect(r.ok).toBe(true);
    const step1 = r.steps.find((s) => s.id === 1)!;
    expect(step1.lines.some((l) => l.label.includes('Bruttolohn'))).toBe(true);
    const netto = step1.lines.find((l) => l.label.startsWith('A: Nettoeinkommen'));
    expect(netto?.value).toBeCloseTo((48000 - 6382 - 10152) / 12, 2);
  });
});

describe('Krankenkassen-Konfiguration', () => {
  it('enthält 10 Kassen mit eindeutiger ID und plausiblem Zusatzbeitrag', () => {
    const ids = krankenkassen2026.kassen.map((k) => k.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    for (const k of krankenkassen2026.kassen) {
      expect(k.zusatzbeitrag).toBeGreaterThan(0);
      expect(k.zusatzbeitrag).toBeLessThan(10);
    }
  });

  it('ein höherer Zusatzbeitrag senkt das Netto', () => {
    const ikk = krankenkassen2026.kassen.find((k) => k.id === 'ikk-classic')!;
    const tk = krankenkassen2026.kassen.find((k) => k.id === 'tk')!;
    const nTk = nettoAusBrutto(gross({ krankenkasse: tk.id, kvZusatzbeitrag: tk.zusatzbeitrag }), lst, zvCfg);
    const nIkk = nettoAusBrutto(gross({ krankenkasse: ikk.id, kvZusatzbeitrag: ikk.zusatzbeitrag }), lst, zvCfg);
    // KV-Differenz: 48.000 € · (3,85 − 2,69) % / 2 = 278,40 € im Jahr (abzgl. Steuereffekt)
    expect(nTk.kv - nIkk.kv).toBeCloseTo(-278.4, 2);
    expect(nIkk.nettoMonat).toBeLessThan(nTk.nettoMonat);
  });
});

describe('Zusatzversorgung (VBL)', () => {
  const vblWest = { kasse: 'vbl-west', anProzent: 1.81, agUmlageProzent: 5.49, anSteuerfrei: false, agBeitragProzent: 0 };
  const vblOst = { kasse: 'vbl-ost', anProzent: 4.25, agUmlageProzent: 1.06, anSteuerfrei: true, agBeitragProzent: 2 };

  it('VBL West: AN-Anteil 1,81 % vom Netto, AG-Umlage teilweise SV-pflichtig', () => {
    const ohne = nettoAusBrutto(gross(), lst, zvCfg);
    const mit = nettoAusBrutto(gross({ zusatzversorgung: vblWest }), lst, zvCfg);
    expect(mit.zusatzversorgungAn).toBe(868.8); // 48.000 · 1,81 %
    // 48.000 · 5,49 % = 2.635,20 − 2,5 % (1.200) − 12 · 13,30 (159,60) = 1.275,60
    expect(mit.zusatzversorgungHinzurechnung).toBe(1275.6);
    expect(mit.rv).toBeCloseTo((48000 + 1275.6) * 0.093, 2);
    expect(mit.lohnsteuer).toBe(ohne.lohnsteuer);
    expect(ohne.nettoJahr - mit.nettoJahr).toBeGreaterThan(868.8);
  });

  it('VBL West: AN-Anteil an der Umlage wird aus versteuertem Entgelt gezahlt', () => {
    const mit = nettoAusBrutto(gross({ zusatzversorgung: vblWest }), lst, zvCfg);
    expect(mit.zusatzversorgungSteuerfrei).toBe(0);
    expect(mit.steuerpflichtigerArbeitslohn).toBe(48000);
    expect(mit.zvE).toBe(37350); // wie ohne Zusatzversorgung
  });

  it('VBL Ost: AN-Beitrag 4,25 % steuerfrei (§ 3 Nr. 63 EStG) und beitragsfrei (SvEV) vor der Lohnsteuer', () => {
    const ohne = nettoAusBrutto(gross(), lst, zvCfg);
    const mit = nettoAusBrutto(gross({ zusatzversorgung: vblOst }), lst, zvCfg);
    expect(mit.zusatzversorgungAn).toBe(2040); // 48.000 · 4,25 %
    expect(mit.zusatzversorgungHinzurechnung).toBe(0); // AG-Umlage 1,06 % < 2,5 %
    // Grenzen: 8 % bzw. 4 % von 101.400 € abzüglich AG-Beitrag 2 % (960 €) → beide nicht erreicht
    expect(mit.zusatzversorgungSteuerfrei).toBe(2040);
    expect(mit.zusatzversorgungSvFrei).toBe(2040);
    expect(mit.steuerpflichtigerArbeitslohn).toBe(45960);
    expect(mit.rv).toBeCloseTo(45960 * 0.093, 2);
    // Vorsorgepauschale 4.274,28 + 45.960 · 10,25 % = 8.985,18 → 8.986; zvE 45.960 − 1.230 − 36 − 8.986
    expect(mit.zvE).toBe(35708);
    expect(mit.lohnsteuer).toBeLessThan(ohne.lohnsteuer);
    // Netto sinkt um weniger als den vollen Beitrag, weil Steuer und SV entfallen
    expect(ohne.nettoJahr - mit.nettoJahr).toBeLessThan(2040);
  });

  it('steuerfreier Anteil wird auf 8 % der BBG RV (abzgl. AG-Beitrag) begrenzt', () => {
    const hoch = { kasse: 'manuell', anProzent: 10, agUmlageProzent: 0, anSteuerfrei: true, agBeitragProzent: 2 };
    const r = nettoAusBrutto(gross({ bruttoMonatlich: 8000, zusatzversorgung: hoch }), lst, zvCfg);
    // AN 9.600; Grenze 8.112 − AG 1.920 = 6.192; SV-frei 4.056 − 1.920 = 2.136
    expect(r.zusatzversorgungSteuerfrei).toBe(6192);
    expect(r.zusatzversorgungSvFrei).toBe(2136);
  });

  it('erscheint im Rechenweg', () => {
    const A = parent('A', 0, { incomeMode: 'brutto', gross: gross({ zusatzversorgung: vblWest }) });
    const r = calculate(input('residenz', A, parent('B', 1500), [child('k1', 0)]), cfg);
    const step1 = r.steps.find((s) => s.id === 1)!;
    expect(step1.lines.some((l) => l.label.includes('Zusatzversorgung') && l.value === 868.8)).toBe(true);
  });
});

describe('Teilzeit bei eingegebenem Bruttolohn', () => {
  it('kürzt Vollzeit-Brutto und Sonderzahlungen anteilig', () => {
    const { gross: g, teilzeit } = effectiveGross(gross({ arbeitszeit: 75, sonderzahlungenJahr: 2000 }), tarifvertraege2026);
    expect(g.bruttoMonatlich).toBe(3000);
    expect(g.sonderzahlungenJahr).toBe(1500);
    expect(teilzeit).toEqual({ arbeitszeit: 75, vollzeitMonatlich: 4000, vollzeitSonderzahlungen: 2000 });
    // 100 % → unverändert
    expect(effectiveGross(gross(), tarifvertraege2026).teilzeit).toBeNull();
  });

  it('erscheint im Rechenweg und wird validiert', () => {
    const A = parent('A', 0, { incomeMode: 'brutto', gross: gross({ arbeitszeit: 50 }) });
    const r = calculate(input('residenz', A, parent('B', 1500), [child('k1', 0)]), cfg);
    const step1 = r.steps.find((s) => s.id === 1)!;
    expect(step1.lines.some((l) => l.label === 'A: Bruttolohn bei Vollzeit' && l.value === 4000)).toBe(true);
    expect(step1.lines.some((l) => l.label.startsWith('A: Bruttolohn monatlich (50 % Teilzeit)') && l.value === 2000)).toBe(true);

    const B = parent('A', 0, { incomeMode: 'brutto', gross: gross({ arbeitszeit: 0 }) });
    const r2 = calculate(input('residenz', B, parent('B', 1500), [child('k1', 0)]), cfg);
    expect(r2.issues.some((i) => i.severity === 'error' && i.field === 'parents.A.bruttoArbeitszeit')).toBe(true);
  });
});
