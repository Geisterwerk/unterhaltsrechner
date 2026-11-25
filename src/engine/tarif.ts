import type { GrossIncomeInput, TarifConfig, TarifGruppe, TarifTabelle } from '../types';
import { round2 } from './util';

export interface TarifErgebnis {
  tabelle: TarifTabelle;
  gruppe: TarifGruppe;
  stufe: number;
  /** Tabellenentgelt Vollzeit */
  tabellenentgelt: number;
  arbeitszeit: number;
  /** gewählte Zulagen (Monatsbetrag nach Arbeitszeit) */
  zulagen: { id: string; name: string; betrag: number }[];
  /** Monatsbrutto nach Arbeitszeit inkl. Zulagen */
  bruttoMonatlich: number;
  /** Jahressonderzahlung in Euro (0, wenn nicht eingerechnet) */
  jahressonderzahlung: number;
  jahressonderzahlungProzent: number;
}

export function findTarif(cfg: TarifConfig, tarifId: string): TarifTabelle | undefined {
  return cfg.tabellen.find((t) => t.id === tarifId);
}

/** Erste Stufe, die es in einer Gruppe gibt (z. B. E 1 beginnt mit Stufe 2) */
export function ersteGueltigeStufe(gruppe: TarifGruppe): number {
  const i = gruppe.werte.findIndex((v) => v !== null);
  return i < 0 ? 1 : i + 1;
}

/** Tarifentgelt aus Tarif, Gruppe und Stufe ermitteln; null bei ungültiger Kombination */
export function resolveTarif(g: GrossIncomeInput, cfg: TarifConfig): TarifErgebnis | null {
  const tabelle = findTarif(cfg, g.tarif.tarifId);
  const gruppe = tabelle?.gruppen.find((x) => x.id === g.tarif.gruppe);
  if (!tabelle || !gruppe) return null;
  const wert = gruppe.werte[g.tarif.stufe - 1];
  if (wert === null || wert === undefined) return null;
  const arbeitszeit = Math.min(100, Math.max(0, g.tarif.arbeitszeit));
  const grund = round2((wert * arbeitszeit) / 100);
  // Zulagen (z. B. Funktionsstufen) – nur für Gruppen mit hinterlegtem Betrag, bei Teilzeit anteilig
  const gewaehlt = (tabelle.zulagen ?? []).filter(
    (z) => (g.tarif.zulagen ?? []).includes(z.id) && z.betraege[gruppe.id] !== undefined,
  );
  const zulagen = gewaehlt.map((z) => ({
    id: z.id,
    name: z.name,
    betrag: round2((z.betraege[gruppe.id] * arbeitszeit) / 100),
    jsz: z.jahressonderzahlungRelevant,
  }));
  const bruttoMonatlich = round2(grund + zulagen.reduce((a, z) => a + z.betrag, 0));
  const jszBasis = grund + zulagen.filter((z) => z.jsz).reduce((a, z) => a + z.betrag, 0);
  const jahressonderzahlung = g.tarif.jahressonderzahlung
    ? round2((jszBasis * gruppe.jahressonderzahlung) / 100)
    : 0;
  return {
    tabelle,
    gruppe,
    stufe: g.tarif.stufe,
    tabellenentgelt: wert,
    arbeitszeit,
    zulagen: zulagen.map(({ id, name, betrag }) => ({ id, name, betrag })),
    bruttoMonatlich,
    jahressonderzahlung,
    jahressonderzahlungProzent: gruppe.jahressonderzahlung,
  };
}

/**
 * Wirksame Bruttoangaben: bei Quelle 'tarif' werden Monatsbrutto und Sonderzahlung aus der
 * Tariftabelle übernommen, sonst unverändert.
 */
/** Umrechnung eines als Vollzeit eingegebenen Bruttolohns auf Teilzeit */
export interface TeilzeitUmrechnung {
  arbeitszeit: number;
  vollzeitMonatlich: number;
  vollzeitSonderzahlungen: number;
}

export function effectiveGross(
  g: GrossIncomeInput,
  cfg: TarifConfig,
): { gross: GrossIncomeInput; tarif: TarifErgebnis | null; teilzeit: TeilzeitUmrechnung | null } {
  if (g.quelle !== 'tarif') {
    // Betrag eingegeben: bei Teilzeit Vollzeitwerte anteilig kürzen
    const az = Math.min(100, Math.max(0, g.arbeitszeit ?? 100));
    if (az === 100) return { gross: g, tarif: null, teilzeit: null };
    return {
      gross: {
        ...g,
        bruttoMonatlich: round2((Math.max(0, g.bruttoMonatlich) * az) / 100),
        sonderzahlungenJahr: round2((Math.max(0, g.sonderzahlungenJahr) * az) / 100),
      },
      tarif: null,
      teilzeit: { arbeitszeit: az, vollzeitMonatlich: g.bruttoMonatlich, vollzeitSonderzahlungen: g.sonderzahlungenJahr },
    };
  }
  const tarif = resolveTarif(g, cfg);
  if (!tarif) return { gross: { ...g, bruttoMonatlich: 0, sonderzahlungenJahr: 0 }, tarif: null, teilzeit: null };
  return {
    gross: { ...g, bruttoMonatlich: tarif.bruttoMonatlich, sonderzahlungenJahr: tarif.jahressonderzahlung },
    tarif,
    teilzeit: null,
  };
}
