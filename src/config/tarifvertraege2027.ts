import type { TarifConfig, TarifTabelle } from '../types';
import { tarifvertraege2026 } from './tarifvertraege2026';

/**
 * Tariftabellen 2027 – VORLÄUFIG.
 *
 * TV-L: Tabelle ab 01.03.2027 (+2,0 % laut Tarifeinigung vom 14.02.2026), Werte von oeffentlicher-dienst.info
 * (Ansicht Monatswerte, abgerufen 20.11.2026); Jahressonderzahlung wie 2026.
 * TVöD VKA/Bund/SuE und TV-BA: Tabellen 2026 laufen bis 31.03.2027 (TV-BA bis 31.12.2026); Folgetabellen
 * sind noch nicht vereinbart und werden deshalb unverändert übernommen.
 */
const TVL_2027_WERTE: { id: string; werte: (number | null)[] }[] = [
  { id: 'E 15Ü', werte: [6994.28, 7739.08, 8445.94, 8909.53, 9023.57, null] },
  { id: 'E 15', werte: [5771.55, 6188.65, 6409.05, 7191.91, 7784.71, 8011.61] },
  { id: 'E 14', werte: [5246.46, 5626.22, 5937.84, 6409.05, 7131.05, 7338.37] },
  { id: 'E 13Ü', werte: [null, 5208.21, 5474.23, 6409.05, 7131.05, 7338.37] },
  { id: 'E 13', werte: [4854.56, 5208.21, 5474.23, 5991.03, 6705.45, 6899.98] },
  { id: 'E 12', werte: [4397.12, 4691.40, 5314.62, 5861.84, 6568.65, 6759.07] },
  { id: 'E 11', werte: [4261.92, 4533.76, 4843.40, 5314.62, 5998.64, 6171.97] },
  { id: 'E 10', werte: [4119.19, 4385.95, 4691.40, 5002.99, 5595.85, 5757.08] },
  { id: 'E 9b', werte: [3692.50, 3948.23, 4115.77, 4578.77, 4972.60, 5115.17] },
  { id: 'E 9a', werte: [3692.50, 3948.23, 4004.09, 4115.77, 4578.77, 4708.08] },
  { id: 'E 8', werte: [3487.91, 3732.20, 3871.43, 4004.09, 4150.70, 4241.44] },
  { id: 'E 7', werte: [3300.55, 3539.11, 3718.60, 3857.49, 3969.19, 4066.90] },
  { id: 'E 6', werte: [3250.30, 3486.44, 3618.14, 3752.78, 3843.51, 3941.24] },
  { id: 'E 5', werte: [3135.45, 3367.91, 3499.61, 3624.73, 3725.39, 3794.66] },
  { id: 'E 4', werte: [3008.22, 3242.80, 3407.42, 3499.61, 3591.82, 3651.06] },
  { id: 'E 3', werte: [2973.88, 3203.28, 3269.13, 3374.49, 3460.10, 3532.54] },
  { id: 'E 2Ü', werte: [2867.42, 3091.33, 3176.93, 3282.32, 3354.75, 3453.53] },
  { id: 'E 2', werte: [2797.70, 3012.30, 3078.16, 3144.01, 3295.46, 3453.53] },
  { id: 'E 1', werte: [null, 2585.18, 2616.36, 2653.82, 2691.28, 2784.91] },
];

const tvl2026 = tarifvertraege2026.tabellen.find((t) => t.id === 'tv-l')!;

const tvl2027: TarifTabelle = {
  ...tvl2026,
  gueltigAb: '2027-03-01',
  hinweis:
    'Tabelle ab 01.03.2027 (+2,0 % laut Tarifeinigung vom 14.02.2026). Für Januar/Februar 2027 gilt noch die Tabelle 2026.',
  gruppen: TVL_2027_WERTE.map((g) => ({
    ...g,
    jahressonderzahlung: tvl2026.gruppen.find((x) => x.id === g.id)!.jahressonderzahlung,
  })),
};

export const tarifvertraege2027: TarifConfig = {
  sourceNote:
    'VORLÄUFIG: TV-L 2027 laut Tarifeinigung; TVöD und TV-BA aus 2026 übernommen (Folgeabschlüsse noch offen). Quelle: oeffentlicher-dienst.info.',
  tabellen: tarifvertraege2026.tabellen.map((t) =>
    t.id === 'tv-l'
      ? tvl2027
      : {
          ...t,
          hinweis: `${t.hinweis ? `${t.hinweis} ` : ''}Für 2027 noch keine neue Tabelle vereinbart – Werte 2026 übernommen.`,
        },
  ),
};
