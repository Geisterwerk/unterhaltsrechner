/**
 * Unterhaltsrechtliche Leitlinien der Oberlandesgerichte (Stand 01.01.2026) – nur die Punkte, in denen sie sich für
 * diesen Rechner unterscheiden. Tabellenbeträge, Selbstbehalte und der Erwerbstätigenbonus (1/10, 45 %) sind gleich.
 *
 * Geprüft am 26.11.2026 anhand der Originaldokumente:
 * - NRW (OLG Düsseldorf, Hamm, Köln): Leitlinien NRW 2026, Ziff. 10.1.2, 10.2.1, 10.2.3
 * - Süddeutsche Leitlinien (OLG Bamberg, Karlsruhe, München, Nürnberg, Stuttgart, Zweibrücken) 2026, Ziff. 10.1, 10.2.1, 10.2.3
 * - Niedersachsen (OLG Braunschweig, Celle, Oldenburg) 2026, Ziff. 10.1.2, 10.2.1, 10.2.3
 * - Berlin (Kammergericht) 2026, Ziff. 10.1.2, 10.2.1, 10.2.3, 13.2
 */

export type LeitlinienId = 'nrw' | 'sued' | 'nds' | 'berlin';

export interface Leitlinien {
  id: LeitlinienId;
  name: string;
  kurz: string;
  quelle: string;
  pauschale: {
    rate: number;
    min: number;
    max: number | null;
    /** Erläuterung der Voraussetzungen (Rechenweg) */
    hinweis: string;
    /** Pauschale wird bei fiktivem Erwerbseinkommen automatisch angesetzt */
    beiFiktivemEinkommen: boolean;
  };
  /**
   * pauschaler Ausbildungsaufwand (100 €) vom Einkommen des Kindes: 'immer', 'nurElternhaushalt' (nur wenn das Kind
   * bei einem Elternteil wohnt) oder 'nurNachweis' (keine Pauschale – Kosten konkret nachweisen)
   */
  ausbildungsaufwand: 'immer' | 'nurElternhaushalt' | 'nurNachweis';
  /**
   * zusätzliche Altersvorsorge: 'zusatz' = Anteil am Brutto zusätzlich zur gesetzlichen RV;
   * 'gesamt' = Gesamtaltersvorsorge einschließlich AN- und AG-Anteil zur gesetzlichen RV
   */
  altersvorsorge: { art: 'zusatz' | 'gesamt'; quote: number; text: string };
}

export const LEITLINIEN: Record<LeitlinienId, Leitlinien> = {
  nrw: {
    id: 'nrw',
    name: 'Leitlinien NRW 2026 (OLG Düsseldorf, Hamm, Köln)',
    kurz: 'Leitlinien NRW',
    quelle: 'https://www.olg-duesseldorf.nrw.de/infos/Duesseldorfer_Tabelle/Tabelle-2026/Leitlinien-NRW-2026.pdf',
    pauschale: {
      rate: 0.05,
      min: 0,
      max: null,
      hinweis: 'Pauschale 5 % – nach Leitlinien NRW 10.2.1 in der Regel nur bei fiktivem Erwerbseinkommen, sonst konkret darlegen',
      beiFiktivemEinkommen: true,
    },
    ausbildungsaufwand: 'nurElternhaushalt',
    altersvorsorge: { art: 'zusatz', quote: 0.04, text: '4 % des Bruttos zusätzlich (Leitlinien NRW 10.1.2)' },
  },
  sued: {
    id: 'sued',
    name: 'Süddeutsche Leitlinien 2026 (OLG Bamberg, Karlsruhe, München, Nürnberg, Stuttgart, Zweibrücken)',
    kurz: 'Süddeutsche Leitlinien',
    quelle:
      'https://www.justiz.bayern.de/media/images/behoerden-und-gerichte/oberlandesgerichte/nuernberg/su%CC%88ddeutsche_leitlinien_2026.pdf',
    pauschale: {
      rate: 0.05,
      min: 0,
      max: null,
      hinweis: 'Pauschale 5 % – nach SüdL 10.2.1 bei Anhaltspunkten, nur für nichtselbständige Arbeit',
      beiFiktivemEinkommen: false,
    },
    ausbildungsaufwand: 'immer',
    altersvorsorge: {
      art: 'gesamt',
      quote: 0.23,
      text: 'insgesamt 23 % des Bruttos einschließlich AN- und AG-Anteil zur Rentenversicherung (SüdL 10.1)',
    },
  },
  nds: {
    id: 'nds',
    name: 'Leitlinien Niedersachsen 2026 (OLG Braunschweig, Celle, Oldenburg)',
    kurz: 'Leitlinien Niedersachsen',
    quelle: 'https://oberlandesgericht-celle.niedersachsen.de/download/224452/Unterhaltsrechtliche_Leitlinien_2026.pdf.pdf',
    pauschale: {
      rate: 0.05,
      min: 50,
      max: 150,
      hinweis: 'Pauschale 5 %, bei Vollzeit mindestens 50 €, höchstens 150 € (Leitlinien Nds 10.2.1)',
      beiFiktivemEinkommen: false,
    },
    ausbildungsaufwand: 'immer',
    altersvorsorge: { art: 'zusatz', quote: 0.04, text: '4 % des Gesamtbruttos zusätzlich (Leitlinien Nds 10.1.2)' },
  },
  berlin: {
    id: 'berlin',
    name: 'Leitlinien des Kammergerichts Berlin 2026',
    kurz: 'Leitlinien KG Berlin',
    quelle: 'https://www.berlin.de/gerichte/was-moechten-sie-erledigen/familiensachen/unterhaltsrechtlleitlinienkg_01012026.pdf',
    pauschale: {
      rate: 0.05,
      min: 50,
      max: 150,
      hinweis: 'Pauschale 5 %, mindestens 50 €, höchstens 150 € – nur nichtselbständige Arbeit (Leitlinien KG 10.2.1)',
      beiFiktivemEinkommen: false,
    },
    ausbildungsaufwand: 'nurNachweis',
    altersvorsorge: { art: 'zusatz', quote: 0.04, text: '4 % des Gesamtbruttos zusätzlich (Leitlinien KG 10.1.2)' },
  },
};

export const LEITLINIEN_IDS: LeitlinienId[] = ['berlin', 'nrw', 'sued', 'nds'];

/** Standard, wenn keine Leitlinien gewählt sind (auch für ältere Speicherdateien ohne Angabe) */
export const STANDARD_LEITLINIEN: LeitlinienId = 'berlin';

export function leitlinienFuer(id: LeitlinienId | undefined): Leitlinien {
  return LEITLINIEN[id ?? STANDARD_LEITLINIEN] ?? LEITLINIEN[STANDARD_LEITLINIEN];
}
