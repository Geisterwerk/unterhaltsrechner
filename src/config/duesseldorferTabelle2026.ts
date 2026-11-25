import type { UnterhaltsTabelleConfig } from '../types';

/**
 * Düsseldorfer Tabelle 2026 (Stand: 01.01.2026).
 *
 * Am 20.11.2026 mit dem amtlichen PDF des OLG Düsseldorf abgeglichen
 * (https://www.olg-duesseldorf.nrw.de/infos/Duesseldorfer_Tabelle/Tabelle-2026/DT_2026.pdf):
 * Einkommensgruppen, Tabellenbeträge, Bedarfskontrollbeträge (Gruppe 1: 1.200 € / 1.450 €), Selbstbehalte
 * (notwendig 1.200 € / 1.450 € inkl. 520 € Warmmiete, angemessen 1.750 € inkl. 650 € Warmmiete), Bedarf bei
 * eigenem Haushalt 990 € inkl. 440 € Warmmiete, Kindergeld 259 €.
 *
 * Mindestbedarf (100 %): 486 € / 558 € / 653 € / 698 € (0–5 / 6–11 / 12–17 / ab 18).
 * Für ein neues Jahr eine neue Datei mit derselben Struktur anlegen und in `src/config/index.ts` eintragen.
 */
export const duesseldorferTabelle2026: UnterhaltsTabelleConfig = {
  name: 'Düsseldorfer Tabelle 2026',
  validFrom: '2026-01-01',
  sourceNote:
    'Abgeglichen mit der amtlichen Düsseldorfer Tabelle 2026 (Stand 01.01.2026); Pauschale und Ausbildungsaufwand nach Leitlinien NRW 2026.',
  incomeGroups: [
    {
      group: 1,
      from: 0,
      to: 2100,
      percent: 100,
      amounts: [486, 558, 653, 698],
      bedarfskontrollbetrag: 1450,
      bedarfskontrollbetragNichtErwerbstaetig: 1200,
    },
    { group: 2, from: 2101, to: 2500, percent: 105, amounts: [511, 586, 686, 733], bedarfskontrollbetrag: 1750 },
    { group: 3, from: 2501, to: 2900, percent: 110, amounts: [535, 614, 719, 768], bedarfskontrollbetrag: 1850 },
    { group: 4, from: 2901, to: 3300, percent: 115, amounts: [559, 642, 751, 803], bedarfskontrollbetrag: 1950 },
    { group: 5, from: 3301, to: 3700, percent: 120, amounts: [584, 670, 784, 838], bedarfskontrollbetrag: 2050 },
    { group: 6, from: 3701, to: 4100, percent: 128, amounts: [623, 715, 836, 894], bedarfskontrollbetrag: 2150 },
    { group: 7, from: 4101, to: 4500, percent: 136, amounts: [661, 759, 889, 950], bedarfskontrollbetrag: 2250 },
    { group: 8, from: 4501, to: 4900, percent: 144, amounts: [700, 804, 941, 1006], bedarfskontrollbetrag: 2350 },
    { group: 9, from: 4901, to: 5300, percent: 152, amounts: [739, 849, 993, 1061], bedarfskontrollbetrag: 2450 },
    { group: 10, from: 5301, to: 5700, percent: 160, amounts: [778, 893, 1045, 1117], bedarfskontrollbetrag: 2550 },
    { group: 11, from: 5701, to: 6400, percent: 168, amounts: [817, 938, 1098, 1173], bedarfskontrollbetrag: 2850 },
    { group: 12, from: 6401, to: 7200, percent: 176, amounts: [856, 983, 1150, 1229], bedarfskontrollbetrag: 3250 },
    { group: 13, from: 7201, to: 8200, percent: 184, amounts: [895, 1027, 1202, 1285], bedarfskontrollbetrag: 3750 },
    { group: 14, from: 8201, to: 9700, percent: 192, amounts: [934, 1072, 1254, 1341], bedarfskontrollbetrag: 4350 },
    { group: 15, from: 9701, to: 11200, percent: 200, amounts: [972, 1116, 1306, 1396], bedarfskontrollbetrag: 5050 },
  ],
  selbstbehalt: {
    notwendigErwerbstaetig: 1450,
    notwendigNichtErwerbstaetig: 1200,
    angemessen: 1750,
  },
  kindergeld: 259,
  // Nicht Teil der Düsseldorfer Tabelle 2026, sondern der OLG-Leitlinien (hier: Leitlinien NRW 2026):
  // 10.2.1 Pauschale 5 % nur bei fiktivem Einkommen, sonst konkret – ohne Mindest-/Höchstbetrag
  // (Süddeutsche Leitlinien: 5 % bei Anhaltspunkten). 10.2.3 Ausbildungsaufwand 100 € bei Wohnen im Elternhaushalt.
  pauschale: { rate: 0.05, min: 0, max: null },
  ausbildungsbedingterMehrbedarf: 100,
  // Bedarf eines Studierenden / volljährigen Kindes mit eigenem Haushalt (inkl. 440 € Warmmiete)
  bedarfVolljaehrigEigenerHaushalt: 990,
  wohnkostenanteilEigenerHaushalt: 440,
  // Ehegattenunterhalt: DT 2026 Teil B (I. 45 % / 50 %, II. Selbstbehalt 1.600 € / 1.475 €, III. Existenzminimum
  // 1.450 € / 1.200 €); Leitlinien NRW 2026 15.2 (Erwerbsanreiz 1/10), 15.3 (Quotenmethode bis 11.200 €), 21.4
  ehegatte: {
    erwerbsquote: 0.45,
    sonstigeQuote: 0.5,
    selbstbehalt: { erwerbstaetig: 1600, nichtErwerbstaetig: 1475 },
    mindestbedarf: { erwerbstaetig: 1450, nichtErwerbstaetig: 1200 },
    quotenGrenzeFamilieneinkommen: 11200,
  },
  stufung: {
    standardBerechtigte: 2,
    hoeherstufungBeiEinem: 1,
    herabstufungJeWeiterem: 1,
    maxHerabstufung: 3,
  },
};
