import type { UnterhaltsTabelleConfig } from '../types';
import { duesseldorferTabelle2026 } from './duesseldorferTabelle2026';

/**
 * Düsseldorfer Tabelle 2027 – VORLÄUFIG.
 *
 * Stand 20.11.2026: Die Mindestunterhaltsverordnung 2027 und die Düsseldorfer Tabelle 2027 sind noch nicht
 * veröffentlicht. Tabellenbeträge, Bedarfskontrollbeträge und Selbstbehalte werden daher aus 2026 übernommen.
 * Kindergeld 267 € laut Regierungsentwurf Einkommensteuerreformgesetz 2027 (BT-Drs. 21/8235).
 *
 * Sobald die amtlichen Werte vorliegen, hier die Werte eintragen und in `src/config/index.ts` den Status
 * des Jahres auf 'endgueltig' setzen.
 */
export const duesseldorferTabelle2027: UnterhaltsTabelleConfig = {
  ...duesseldorferTabelle2026,
  name: 'Düsseldorfer Tabelle 2027 (vorläufig)',
  validFrom: '2027-01-01',
  sourceNote:
    'VORLÄUFIG: Tabellenbeträge und Selbstbehalte aus 2026 übernommen (Tabelle 2027 noch nicht veröffentlicht); Kindergeld 267 € laut Gesetzentwurf.',
  kindergeld: 267,
};
