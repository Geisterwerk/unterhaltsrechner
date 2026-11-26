import { fundstelle, leitlinienFuer, type Leitlinien } from '../config/leitlinien';
import type { JahresKonfiguration, ParentInput, UnterhaltsTabelleConfig } from '../types';
import { nettoAusBrutto, type BruttoNettoResult } from './brutto';
import { effectiveGross, type TarifErgebnis, type TeilzeitUmrechnung } from './tarif';
import { clamp, round2 } from './util';

export interface BereinigtesEinkommen {
  /** gesetzt, wenn das Netto aus dem Bruttolohn geschätzt wurde */
  brutto?: BruttoNettoResult;
  /** gesetzt, wenn der Bruttolohn aus einer Tariftabelle stammt */
  tarif?: TarifErgebnis;
  /** gesetzt, wenn ein Vollzeit-Bruttolohn auf Teilzeit umgerechnet wurde */
  teilzeit?: TeilzeitUmrechnung;
  /** angesetztes Nettoeinkommen (bei fiktivem Einkommen das erzielbare Netto) */
  netto: number;
  /** tatsächliches Netto, falls ein höheres fiktives Einkommen angesetzt wurde */
  nettoTatsaechlich?: number;
  /** true, wenn ein fiktives (erzielbares) Einkommen angesetzt wurde */
  fiktiv: boolean;
  /** hinzugerechneter Wohnvorteil */
  wohnvorteil: number;
  berufsbedingt: number;
  berufsbedingtHinweis: string;
  /** berücksichtigte (ggf. auf die Höchstgrenze gekürzte) Altersvorsorge */
  altersvorsorge: number;
  altersvorsorgeHinweis?: string;
  schulden: number;
  sonstige: number;
  /** Beitrag zur privaten Kranken- und Pflegeversicherung des Elternteils */
  pkv: number;
  /** Kranken-/Pflegeversicherung von Kindern, die dieser Elternteil als Barunterhaltspflichtiger trägt */
  kvKinder: number;
  bereinigt: number;
}

/** gilt der Elternteil als erwerbstätig (tatsächlich oder wegen fiktiv angesetzten Erwerbseinkommens)? */
export function giltAlsErwerbstaetig(parent: ParentInput): boolean {
  return parent.employed || !!parent.fiktiv?.aktiv;
}

const euro = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Unterhaltsrechtlich bereinigtes Nettoeinkommen:
 * Netto (ggf. fiktiv) + Wohnvorteil − berufsbedingte Aufwendungen − Altersvorsorge (Höchstgrenze laut Leitlinien)
 * − berücksichtigungsfähige Schulden − Sonstiges − private KV/PV − KV/PV der Kinder (Leitlinien NRW 11.1).
 */
export function bereinigtesEinkommen(
  parent: ParentInput,
  jk: Pick<JahresKonfiguration, 'tabelle' | 'lohnsteuer' | 'tarife' | 'zusatzversorgung'>,
  ll: Leitlinien = leitlinienFuer(undefined),
  kvKinder = 0,
): BereinigtesEinkommen {
  const eff = parent.incomeMode === 'brutto' ? effectiveGross(parent.gross, jk.tarife) : null;
  const brutto = eff ? nettoAusBrutto(eff.gross, jk.lohnsteuer, jk.zusatzversorgung) : undefined;
  const tarif = eff?.tarif ?? undefined;
  const teilzeit = eff?.teilzeit ?? undefined;
  const nettoIst = brutto ? Math.max(0, brutto.nettoMonat) : Math.max(0, parent.netIncome);

  // fiktives Einkommen bei Verletzung der Erwerbsobliegenheit: das erzielbare Netto ersetzt ein geringeres tatsächliches
  const fiktivNetto = parent.fiktiv?.aktiv ? Math.max(0, parent.fiktiv.netto) : 0;
  const fiktiv = fiktivNetto > nettoIst;
  const netto = fiktiv ? fiktivNetto : nettoIst;

  const d = parent.deductions;
  let berufsbedingt = 0;
  let berufsbedingtHinweis = 'keine';
  const pauschaleAnsetzen =
    d.berufsbedingtMode === 'pauschal' || (fiktiv && d.berufsbedingtMode === 'keine' && ll.pauschale.beiFiktivemEinkommen);

  if (!giltAlsErwerbstaetig(parent)) {
    berufsbedingtHinweis = 'nicht erwerbstätig – keine berufsbedingten Aufwendungen';
  } else if (pauschaleAnsetzen) {
    const p = ll.pauschale;
    berufsbedingt = netto <= 0 ? 0 : round2(clamp(netto * p.rate, p.min, p.max ?? Number.POSITIVE_INFINITY));
    berufsbedingtHinweis =
      d.berufsbedingtMode === 'pauschal' ? p.hinweis : `${p.hinweis} – bei fiktivem Einkommen automatisch angesetzt`;
  } else if (d.berufsbedingtMode === 'konkret') {
    berufsbedingt = Math.max(0, d.berufsbedingtKonkret);
    berufsbedingtHinweis = 'konkret nachgewiesen';
  }

  // zusätzliche Altersvorsorge: Höchstgrenze laut Leitlinien; prüfbar nur bei Brutto-Eingabe
  const altersvorsorgeAngegeben = Math.max(0, d.altersvorsorge);
  const bruttoMonat = brutto ? brutto.jahresbrutto / 12 : null;
  const quote =
    ll.altersvorsorge.art === 'zusatz'
      ? ll.altersvorsorge.quote
      : Math.max(0, ll.altersvorsorge.quote - 2 * jk.lohnsteuer.sv.rvAn); // Gesamtquote abzgl. AN- und AG-Anteil RV
  const altersvorsorgeGrenze = bruttoMonat !== null ? round2(bruttoMonat * quote) : null;
  const altersvorsorge =
    altersvorsorgeGrenze === null ? altersvorsorgeAngegeben : Math.min(altersvorsorgeAngegeben, altersvorsorgeGrenze);
  const quoteText = `${(quote * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} % des Bruttos`;
  const altersvorsorgeHinweis =
    altersvorsorgeAngegeben <= 0
      ? undefined
      : altersvorsorgeGrenze === null
        ? `Höchstgrenze (${ll.altersvorsorge.text}) nicht geprüft (Netto-Eingabe)`
        : altersvorsorge < altersvorsorgeAngegeben
          ? `gekürzt von ${euro(altersvorsorgeAngegeben)} auf ${quoteText}`
          : `innerhalb der Grenze von ${quoteText} (${euro(altersvorsorgeGrenze)})`;
  const schulden = Math.max(0, d.schulden);
  const sonstige = Math.max(0, d.sonstige);
  const wohnvorteil = Math.max(0, d.wohnvorteil ?? 0);
  const pkv = Math.max(0, d.pkv ?? 0);
  const kv = Math.max(0, kvKinder);
  const bereinigt = round2(
    Math.max(0, netto + wohnvorteil - berufsbedingt - altersvorsorge - schulden - sonstige - pkv - kv),
  );

  return {
    brutto,
    tarif,
    teilzeit,
    netto,
    nettoTatsaechlich: fiktiv ? nettoIst : undefined,
    fiktiv,
    wohnvorteil,
    berufsbedingt,
    berufsbedingtHinweis,
    altersvorsorge,
    altersvorsorgeHinweis,
    schulden,
    sonstige,
    pkv,
    kvKinder: kv,
    bereinigt,
  };
}

/** Selbstbehalt nach Haushaltsersparnis bei Zusammenleben mit einem leistungsfähigen Partner (Leitlinien 21.5) */
export function mitHaushaltsersparnis(sb: number, parent: ParentInput, ll: Leitlinien = leitlinienFuer(undefined)): number {
  return parent.zusammenleben ? round2(sb * (1 - ll.zusammenleben.quote)) : sb;
}

/** Erläuterung für den Rechenweg, wenn der Selbstbehalt wegen Zusammenlebens herabgesetzt ist */
export function haushaltsersparnisHinweis(parent: ParentInput, ll: Leitlinien = leitlinienFuer(undefined)): string | undefined {
  return parent.zusammenleben
    ? `um ${Math.round(ll.zusammenleben.quote * 100)} % herabgesetzt – Zusammenleben mit leistungsfähigem Partner (${fundstelle(
        ll,
        ll.zusammenleben.ziffer,
      )})`
    : undefined;
}

/** Notwendiger Selbstbehalt ggü. minderjährigen und privilegiert volljährigen Kindern */
export function notwendigerSelbstbehalt(
  parent: ParentInput,
  cfg: UnterhaltsTabelleConfig,
  ll: Leitlinien = leitlinienFuer(undefined),
): number {
  const sb = giltAlsErwerbstaetig(parent) ? cfg.selbstbehalt.notwendigErwerbstaetig : cfg.selbstbehalt.notwendigNichtErwerbstaetig;
  return mitHaushaltsersparnis(sb, parent, ll);
}
