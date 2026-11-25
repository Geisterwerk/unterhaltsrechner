import type { LohnsteuerConfig } from '../types';

/**
 * Lohnsteuer- und Sozialversicherungsparameter 2026.
 *
 * Quellen: Programmablaufplan für die maschinelle Berechnung der Lohnsteuer 2026
 * (BMF-Schreiben vom 12.11.2025, Anlage 1 – UPTAB26, MST5-6, UPEVP, MSOLZ) sowie
 * Rechengrößen der Sozialversicherung 2026.
 *
 * Für ein neues Jahr eine neue Datei mit derselben Struktur anlegen und in
 * `src/config/index.ts` als aktive Konfiguration eintragen.
 */
export const lohnsteuer2026: LohnsteuerConfig = {
  name: 'Lohnsteuer / Sozialversicherung 2026',
  validFrom: '2026-01-01',
  sourceNote:
    'Schätzung nach PAP 2026 für gesetzlich versicherte Arbeitnehmer – keine individuellen Freibeträge, keine Lohnsteuer-Jahresausgleichs- oder Einkommensteuererstattungen.',
  tarif: {
    grundfreibetrag: 12348,
    zone2Start: 17800,
    zone3Start: 69879,
    zone4Start: 277826,
    zone1: { a: 914.51, b: 1400 },
    zone2: { a: 173.1, b: 2397, c: 1034.87 },
    zone3: { rate: 0.42, abzug: 11135.63 },
    zone4: { rate: 0.45, abzug: 19470.38 },
  },
  stkl56: { w1: 14071, w2: 34939, w3: 222260, mindestsatz: 0.14 },
  arbeitnehmerPauschbetrag: 1230,
  sonderausgabenPauschbetrag: 36,
  entlastungsbetragAlleinerziehende: 4260,
  kinderfreibetragJeZaehler: 9756,
  soli: { freigrenze: 20350, satz: 0.055, milderungssatz: 0.119 },
  sv: {
    bbgRvAvJahr: 101400,
    bbgKvPvJahr: 69750,
    rvAn: 0.093,
    avAn: 0.013,
    kvAn: 0.073,
    kvAnVorsorge: 0.07,
    kvZusatzbeitragDurchschnitt: 2.9,
    pvAn: 0.018,
    pvKinderlosZuschlag: 0.006,
    pvAbschlagJeKind: 0.0025,
    pvAbschlagBisKind: 5,
  },
  vorsorgeHoechstbetrag: 1900,
};
