import type { KrankenkassenConfig } from '../types';

/**
 * Zusatzbeiträge 2026 der zehn größten gesetzlichen Krankenkassen (nach Versicherten, Stand 01.07.2026).
 *
 * Quellen: krankenkassen.de – Versichertenstatistik und Liste der Zusatzbeiträge 2026; am 20.11.2026 mit
 * krankenkasseninfo.de gegengeprüft (alle zehn Sätze bestätigt, IKK classic seit 01.08.2026).
 * Vor Verwendung mit den Angaben der Kassen bzw. des GKV-Spitzenverbands abgleichen; unterjährige
 * Beitragsänderungen sind nicht berücksichtigt. Für ein neues Jahr eine neue Datei anlegen und in
 * `src/config/index.ts` eintragen.
 */
export const krankenkassen2026: KrankenkassenConfig = {
  stand: '01.07.2026',
  sourceNote: 'Zusatzbeiträge laut krankenkassen.de – bitte vor Verwendung bei der Kasse prüfen.',
  kassen: [
    { id: 'tk', name: 'Techniker Krankenkasse (TK)', zusatzbeitrag: 2.69 },
    { id: 'barmer', name: 'BARMER', zusatzbeitrag: 3.29 },
    { id: 'dak', name: 'DAK-Gesundheit', zusatzbeitrag: 3.2 },
    { id: 'aok-bw', name: 'AOK Baden-Württemberg', zusatzbeitrag: 2.99 },
    { id: 'aok-bayern', name: 'AOK Bayern', zusatzbeitrag: 2.69 },
    { id: 'aok-plus', name: 'AOK PLUS', zusatzbeitrag: 3.1 },
    { id: 'aok-niedersachsen', name: 'AOK Niedersachsen', zusatzbeitrag: 2.98 },
    { id: 'aok-rheinland-hamburg', name: 'AOK Rheinland/Hamburg', zusatzbeitrag: 3.29 },
    { id: 'aok-nordwest', name: 'AOK NordWest', zusatzbeitrag: 2.99 },
    {
      id: 'ikk-classic',
      name: 'IKK classic',
      zusatzbeitrag: 3.85,
      hinweis: '3,85 % seit 01.08.2026; bis 31.07.2026 galten 3,40 %',
    },
  ],
};
