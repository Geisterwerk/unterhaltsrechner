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
  netto: number;
  /** hinzugerechneter Wohnvorteil */
  wohnvorteil: number;
  berufsbedingt: number;
  berufsbedingtHinweis: string;
  /** berücksichtigte (ggf. auf 4 % des Bruttos gekürzte) Altersvorsorge */
  altersvorsorge: number;
  altersvorsorgeHinweis?: string;
  schulden: number;
  sonstige: number;
  bereinigt: number;
}

/**
 * Unterhaltsrechtlich bereinigtes Nettoeinkommen:
 * Netto + Wohnvorteil − berufsbedingte Aufwendungen − Altersvorsorge (max. 4 % Brutto)
 * − berücksichtigungsfähige Schulden − Sonstiges.
 */
export function bereinigtesEinkommen(
  parent: ParentInput,
  jk: Pick<JahresKonfiguration, 'tabelle' | 'lohnsteuer' | 'tarife' | 'zusatzversorgung'>,
): BereinigtesEinkommen {
  const cfg = jk.tabelle;
  const eff = parent.incomeMode === 'brutto' ? effectiveGross(parent.gross, jk.tarife) : null;
  const brutto = eff ? nettoAusBrutto(eff.gross, jk.lohnsteuer, jk.zusatzversorgung) : undefined;
  const tarif = eff?.tarif ?? undefined;
  const teilzeit = eff?.teilzeit ?? undefined;
  const netto = brutto ? Math.max(0, brutto.nettoMonat) : Math.max(0, parent.netIncome);
  const d = parent.deductions;
  let berufsbedingt = 0;
  let berufsbedingtHinweis = 'keine';

  if (!parent.employed) {
    berufsbedingtHinweis = 'nicht erwerbstätig – keine berufsbedingten Aufwendungen';
  } else if (d.berufsbedingtMode === 'pauschal') {
    const p = cfg.pauschale;
    berufsbedingt = netto <= 0 ? 0 : round2(clamp(netto * p.rate, p.min, p.max ?? Number.POSITIVE_INFINITY));
    berufsbedingtHinweis = `Pauschale ${Math.round(p.rate * 100)} %${p.min > 0 ? `, min. ${p.min} €` : ''}${
      p.max !== null ? `, max. ${p.max} €` : ''
    } – nach den Leitlinien nur bei Anhaltspunkten bzw. fiktivem Einkommen`;
  } else if (d.berufsbedingtMode === 'konkret') {
    berufsbedingt = Math.max(0, d.berufsbedingtKonkret);
    berufsbedingtHinweis = 'konkret nachgewiesen';
  }

  // zusätzliche Altersvorsorge: bis 4 % des Bruttoeinkommens (BGH XII ZR 149/01); prüfbar nur bei Brutto-Eingabe
  const altersvorsorgeAngegeben = Math.max(0, d.altersvorsorge);
  const altersvorsorgeGrenze = brutto ? round2((brutto.jahresbrutto / 12) * ALTERSVORSORGE_QUOTE) : null;
  const altersvorsorge =
    altersvorsorgeGrenze === null ? altersvorsorgeAngegeben : Math.min(altersvorsorgeAngegeben, altersvorsorgeGrenze);
  const altersvorsorgeHinweis =
    altersvorsorgeAngegeben <= 0
      ? undefined
      : altersvorsorgeGrenze === null
        ? 'Grenze 4 % des Bruttos nicht geprüft (Netto-Eingabe)'
        : altersvorsorge < altersvorsorgeAngegeben
          ? `gekürzt von ${altersvorsorgeAngegeben.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € auf 4 % des Bruttos`
          : `innerhalb der Grenze von 4 % des Bruttos (${altersvorsorgeGrenze.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €)`;
  const schulden = Math.max(0, d.schulden);
  const sonstige = Math.max(0, d.sonstige);
  const wohnvorteil = Math.max(0, d.wohnvorteil ?? 0);
  const bereinigt = round2(Math.max(0, netto + wohnvorteil - berufsbedingt - altersvorsorge - schulden - sonstige));

  return {
    brutto,
    tarif,
    teilzeit,
    netto,
    wohnvorteil,
    berufsbedingt,
    berufsbedingtHinweis,
    altersvorsorge,
    altersvorsorgeHinweis,
    schulden,
    sonstige,
    bereinigt,
  };
}

/** Höchstsatz der zusätzlichen Altersvorsorge beim Kindesunterhalt (Anteil am Bruttoeinkommen) */
export const ALTERSVORSORGE_QUOTE = 0.04;

/** Notwendiger Selbstbehalt ggü. minderjährigen und privilegiert volljährigen Kindern */
export function notwendigerSelbstbehalt(parent: ParentInput, cfg: UnterhaltsTabelleConfig): number {
  return parent.employed ? cfg.selbstbehalt.notwendigErwerbstaetig : cfg.selbstbehalt.notwendigNichtErwerbstaetig;
}
