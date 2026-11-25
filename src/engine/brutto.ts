import type { GrossIncomeInput, LohnsteuerConfig, ZusatzversorgungConfig } from '../types';
import { round2 } from './util';

/**
 * Brutto-Netto-Schätzung für gesetzlich versicherte Arbeitnehmer nach dem
 * Programmablaufplan Lohnsteuer (Jahresberechnung, vereinfachte Rundung).
 */

export interface BruttoNettoResult {
  bruttoMonatlich: number;
  sonderzahlungenJahr: number;
  jahresbrutto: number;
  vorsorgepauschale: number;
  zvE: number;
  lohnsteuer: number;
  soli: number;
  kirchensteuer: number;
  rv: number;
  av: number;
  kv: number;
  pv: number;
  /** angesetzter Zusatzbeitrag der Krankenkasse in Prozent */
  kvZusatzbeitrag: number;
  sozialversicherung: number;
  /** Arbeitnehmeranteil Zusatzversorgung (Jahr) */
  zusatzversorgungAn: number;
  zusatzversorgungAnProzent: number;
  /** SV-pflichtiger Teil der Arbeitgeberumlage (Jahr) */
  zusatzversorgungHinzurechnung: number;
  /** davon steuerfreier AN-Beitrag nach § 3 Nr. 63 EStG (Jahr) */
  zusatzversorgungSteuerfrei: number;
  /** davon beitragsfreier AN-Beitrag nach § 1 Abs. 1 Satz 1 Nr. 9 SvEV (Jahr) */
  zusatzversorgungSvFrei: number;
  /** Jahresbrutto abzüglich steuerfreier Bezüge */
  steuerpflichtigerArbeitslohn: number;
  nettoJahr: number;
  /** Durchschnittliches Monatsnetto inkl. anteiliger Sonderzahlungen */
  nettoMonat: number;
}

/** Tarifliche Einkommensteuer (UPTAB26) für zu versteuerndes Einkommen x, auf volle Euro abgerundet */
export function tarifEinkommensteuer(x: number, cfg: LohnsteuerConfig): number {
  const t = cfg.tarif;
  const X = Math.floor(Math.max(0, x));
  let st: number;
  if (X < t.grundfreibetrag + 1) {
    st = 0;
  } else if (X < t.zone2Start) {
    const y = (X - t.grundfreibetrag) / 10000;
    st = (y * t.zone1.a + t.zone1.b) * y;
  } else if (X < t.zone3Start) {
    const y = (X - (t.zone2Start - 1)) / 10000;
    st = (y * t.zone2.a + t.zone2.b) * y + t.zone2.c;
  } else if (X < t.zone4Start) {
    st = X * t.zone3.rate - t.zone3.abzug;
  } else if (!t.zone5 || X < t.zone5.start) {
    st = X * t.zone4.rate - t.zone4.abzug;
  } else {
    st = X * t.zone5.rate - t.zone5.abzug;
  }
  return Math.floor(st);
}

/** Einkommensteuer mit Splitting-Faktor (KZTAB 2 bei Steuerklasse III) */
function tarifMitKztab(zvE: number, kztab: number, cfg: LohnsteuerConfig): number {
  return tarifEinkommensteuer(zvE / kztab, cfg) * kztab;
}

/** UP5-6: Steuer für Steuerklasse V/VI auf Basis von zx */
function up56(zx: number, cfg: LohnsteuerConfig): number {
  const st1 = tarifEinkommensteuer(zx * 1.25, cfg);
  const st2 = tarifEinkommensteuer(zx * 0.75, cfg);
  const diff = (st1 - st2) * 2;
  const mist = Math.floor(zx * cfg.stkl56.mindestsatz);
  return Math.max(diff, mist);
}

/** MST5-6: Lohnsteuer in den Steuerklassen V und VI */
export function lohnsteuerStkl56(zzx: number, cfg: LohnsteuerConfig): number {
  const { w1, w2, w3, w4 } = cfg.stkl56;
  const r3 = cfg.tarif.zone3.rate;
  const r4 = cfg.tarif.zone4.rate;
  const r5 = cfg.tarif.zone5?.rate;
  if (zzx > w2) {
    let st = up56(w2, cfg);
    if (zzx <= w3) return st + Math.floor((zzx - w2) * r3);
    st += Math.floor((w3 - w2) * r3);
    // ab w4 (falls vorhanden) gilt der Satz der Zone 5 (2027: 47 %)
    if (w4 === undefined || r5 === undefined || zzx <= w4) return st + Math.floor((zzx - w3) * r4);
    return st + Math.floor((w4 - w3) * r4) + Math.floor((zzx - w4) * r5);
  }
  let st = up56(zzx, cfg);
  if (zzx > w1) {
    const vergl = st;
    const hoch = up56(w1, cfg) + Math.floor((zzx - w1) * r3);
    st = Math.min(hoch, vergl);
  }
  return st;
}

/** Arbeitnehmeranteil Pflegeversicherung (ohne Sonderregelung Sachsen) */
export function pvSatzAn(pvKinder: number, cfg: LohnsteuerConfig): number {
  const sv = cfg.sv;
  if (pvKinder <= 0) return sv.pvAn + sv.pvKinderlosZuschlag;
  const abschlagKinder = Math.max(0, Math.min(pvKinder, sv.pvAbschlagBisKind) - 1);
  return sv.pvAn - abschlagKinder * sv.pvAbschlagJeKind;
}

/** Jahressteuer (Lohnsteuer/ESt-Bemessungsgrundlage) zum zvE nach Steuerklasse */
function steuerNachKlasse(zvE: number, stkl: number, cfg: LohnsteuerConfig): number {
  if (stkl >= 5) return lohnsteuerStkl56(zvE, cfg);
  return tarifMitKztab(zvE, stkl === 3 ? 2 : 1, cfg);
}

export function nettoAusBrutto(
  g: GrossIncomeInput,
  cfg: LohnsteuerConfig,
  zvCfg: ZusatzversorgungConfig,
): BruttoNettoResult {
  const sv = cfg.sv;
  const stkl = g.steuerklasse;
  const bruttoMonatlich = Math.max(0, g.bruttoMonatlich);
  const sonderzahlungenJahr = Math.max(0, g.sonderzahlungenJahr);
  const brutto = bruttoMonatlich * 12 + sonderzahlungenJahr;

  // Zusatzversorgung (VBL o. Ä.): AN-Anteil aus dem Netto; AG-Umlage über 2,5 % − 13,30 €/Monat ist SV-pflichtig
  const zv = g.zusatzversorgung;
  const zvAktiv = zv.kasse !== 'keine';
  const zvAn = zvAktiv ? round2((brutto * Math.max(0, zv.anProzent)) / 100) : 0;
  const zvHinzurechnung = zvAktiv
    ? round2(
        Math.max(
          0,
          (brutto * Math.max(0, zv.agUmlageProzent)) / 100 -
            (brutto * zvCfg.hinzurechnungFreiProzent) / 100 -
            zvCfg.hinzurechnungAbzugMonat * 12,
        ),
      )
    : 0;

  // Kapitaldeckung (z. B. VBL Ost): AN-Beitrag steuerfrei nach § 3 Nr. 63 EStG bis 8 % BBG RV und
  // beitragsfrei nach § 1 Abs. 1 Satz 1 Nr. 9 SvEV bis 4 % BBG RV – jeweils abzüglich des AG-Beitrags
  const agKd = zvAktiv && zv.anSteuerfrei ? (brutto * Math.max(0, zv.agBeitragProzent)) / 100 : 0;
  const zvSteuerfrei =
    zvAktiv && zv.anSteuerfrei
      ? round2(Math.min(zvAn, Math.max(0, (sv.bbgRvAvJahr * zvCfg.steuerfreiProzentBbg) / 100 - agKd)))
      : 0;
  const zvSvFrei =
    zvAktiv && zv.anSteuerfrei
      ? round2(Math.min(zvSteuerfrei, Math.max(0, (sv.bbgRvAvJahr * zvCfg.svFreiProzentBbg) / 100 - agKd)))
      : 0;
  /** steuerpflichtiger Arbeitslohn */
  const steuerBrutto = brutto - zvSteuerfrei;

  // Sozialversicherung (Arbeitnehmeranteile) inkl. Hinzurechnungsbetrag, ohne beitragsfreien ZV-Beitrag
  const svEntgelt = brutto - zvSvFrei + zvHinzurechnung;
  const svRvAv = Math.min(svEntgelt, sv.bbgRvAvJahr);
  const svKvPv = Math.min(svEntgelt, sv.bbgKvPvJahr);
  const zusatzAn = Math.max(0, g.kvZusatzbeitrag) / 2 / 100;
  const pvSatz = pvSatzAn(g.pvKinder, cfg);
  const rv = round2(svRvAv * sv.rvAn);
  const av = round2(svRvAv * sv.avAn);
  const kv = round2(svKvPv * (sv.kvAn + zusatzAn));
  const pv = round2(svKvPv * pvSatz);
  const sozialversicherung = round2(rv + av + kv + pv);

  // Bemessung der Vorsorgepauschale: steuerpflichtiger Arbeitslohn (ohne Hinzurechnungsbetrag)
  const basisRvAv = Math.min(steuerBrutto, sv.bbgRvAvJahr);
  const basisKvPv = Math.min(steuerBrutto, sv.bbgKvPvJahr);

  // Vorsorgepauschale (UPEVP / MVSPKVPV / MVSPHB)
  const vspR = basisRvAv * sv.rvAn;
  const vspKvPv = basisKvPv * (sv.kvAnVorsorge + zusatzAn + pvSatz);
  let vsp = vspR + vspKvPv;
  if (stkl !== 6) {
    const vspHb = Math.min(basisRvAv * sv.avAn + vspKvPv, cfg.vorsorgeHoechstbetrag);
    vsp = Math.max(vsp, vspR + vspHb);
  }
  const vorsorgepauschale = Math.ceil(vsp);

  // Zu versteuerndes Einkommen (Lohnsteuerabzug)
  const anp = stkl === 6 ? 0 : Math.min(cfg.arbeitnehmerPauschbetrag, steuerBrutto);
  const sap = stkl === 6 ? 0 : cfg.sonderausgabenPauschbetrag;
  const efa = stkl === 2 ? cfg.entlastungsbetragAlleinerziehende : 0;
  const zvE = Math.max(0, Math.floor(steuerBrutto - anp - sap - efa - vorsorgepauschale));

  const lohnsteuer = steuerNachKlasse(zvE, stkl, cfg);

  // Bemessungsgrundlage Soli/Kirchensteuer unter Berücksichtigung der Kinderfreibeträge
  const zkf = Math.max(0, g.kinderfreibetraege);
  const kfb = stkl >= 5 ? 0 : zkf * (stkl === 4 ? cfg.kinderfreibetragJeZaehler / 2 : cfg.kinderfreibetragJeZaehler);
  const jbmg = kfb > 0 ? steuerNachKlasse(Math.max(0, zvE - kfb), stkl, cfg) : lohnsteuer;

  const freigrenze = cfg.soli.freigrenze * (stkl === 3 ? 2 : 1);
  const soli =
    jbmg > freigrenze
      ? round2(Math.min(jbmg * cfg.soli.satz, (jbmg - freigrenze) * cfg.soli.milderungssatz))
      : 0;
  const kirchensteuer = round2((jbmg * g.kirchensteuerSatz) / 100);

  const nettoJahr = round2(brutto - lohnsteuer - soli - kirchensteuer - sozialversicherung - zvAn);
  return {
    bruttoMonatlich,
    sonderzahlungenJahr,
    jahresbrutto: brutto,
    vorsorgepauschale,
    zvE,
    lohnsteuer,
    soli,
    kirchensteuer,
    rv,
    av,
    kv,
    pv,
    kvZusatzbeitrag: Math.max(0, g.kvZusatzbeitrag),
    sozialversicherung,
    zusatzversorgungAn: zvAn,
    zusatzversorgungAnProzent: zvAktiv ? Math.max(0, zv.anProzent) : 0,
    zusatzversorgungHinzurechnung: zvHinzurechnung,
    zusatzversorgungSteuerfrei: zvSteuerfrei,
    zusatzversorgungSvFrei: zvSvFrei,
    steuerpflichtigerArbeitslohn: round2(steuerBrutto),
    nettoJahr,
    nettoMonat: round2(nettoJahr / 12),
  };
}
