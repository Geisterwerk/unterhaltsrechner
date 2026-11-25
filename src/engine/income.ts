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
  berufsbedingt: number;
  berufsbedingtHinweis: string;
  altersvorsorge: number;
  schulden: number;
  sonstige: number;
  bereinigt: number;
}

/**
 * Unterhaltsrechtlich bereinigtes Nettoeinkommen:
 * Netto − berufsbedingte Aufwendungen − Altersvorsorge − berücksichtigungsfähige Schulden − Sonstiges.
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

  const altersvorsorge = Math.max(0, d.altersvorsorge);
  const schulden = Math.max(0, d.schulden);
  const sonstige = Math.max(0, d.sonstige);
  const bereinigt = round2(Math.max(0, netto - berufsbedingt - altersvorsorge - schulden - sonstige));

  return { brutto, tarif, teilzeit, netto, berufsbedingt, berufsbedingtHinweis, altersvorsorge, schulden, sonstige, bereinigt };
}

/** Notwendiger Selbstbehalt ggü. minderjährigen und privilegiert volljährigen Kindern */
export function notwendigerSelbstbehalt(parent: ParentInput, cfg: UnterhaltsTabelleConfig): number {
  return parent.employed ? cfg.selbstbehalt.notwendigErwerbstaetig : cfg.selbstbehalt.notwendigNichtErwerbstaetig;
}
