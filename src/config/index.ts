import type { JahresKonfiguration } from '../types';
import { duesseldorferTabelle2026 } from './duesseldorferTabelle2026';
import { duesseldorferTabelle2027 } from './duesseldorferTabelle2027';
import { krankenkassen2026 } from './krankenkassen2026';
import { krankenkassen2027 } from './krankenkassen2027';
import { lohnsteuer2026 } from './lohnsteuer2026';
import { lohnsteuer2027 } from './lohnsteuer2027';
import { tarifvertraege2026 } from './tarifvertraege2026';
import { tarifvertraege2027 } from './tarifvertraege2027';
import { zusatzversorgung2026 } from './zusatzversorgung2026';
import { zusatzversorgung2027 } from './zusatzversorgung2027';

/**
 * Register aller Berechnungsjahre. Für ein neues Jahr: Konfigurationsdateien anlegen und hier eintragen.
 * Ist ein Jahr noch nicht vollständig amtlich, `status: 'vorlaeufig'` setzen und `hinweise` pflegen.
 */
export const JAHRE: JahresKonfiguration[] = [
  {
    jahr: 2026,
    status: 'endgueltig',
    hinweise: [],
    tabelle: duesseldorferTabelle2026,
    lohnsteuer: lohnsteuer2026,
    krankenkassen: krankenkassen2026,
    tarife: tarifvertraege2026,
    zusatzversorgung: zusatzversorgung2026,
  },
  {
    jahr: 2027,
    status: 'vorlaeufig',
    hinweise: [
      'Düsseldorfer Tabelle 2027 und Mindestunterhalt sind noch nicht veröffentlicht – Tabellenbeträge, Bedarfskontrollbeträge und Selbstbehalte aus 2026 übernommen.',
      'Kindergeld 267 €, Steuertarif, Kinderfreibetrag und Steuerklassen V/VI laut Regierungsentwurf Einkommensteuerreformgesetz 2027 (BT-Drs. 21/8235) – noch nicht verabschiedet.',
      'Beitragsbemessungsgrenzen 2027 laut Kabinettsbeschluss (Bundesrat ausstehend); Beitragssätze aus 2026 übernommen; durchschnittlicher Zusatzbeitrag 2,9 %.',
      'Zusatzbeiträge der einzelnen Krankenkassen und VBL-Sätze (außer VBL Ost AG-Umlage 2,59 %) aus 2026 übernommen.',
      'Tarifverträge: TV-L ab 01.03.2027 +2,0 %; TVöD und TV-BA ohne Folgeabschluss – Tabellen 2026 übernommen.',
    ],
    tabelle: duesseldorferTabelle2027,
    lohnsteuer: lohnsteuer2027,
    krankenkassen: krankenkassen2027,
    tarife: tarifvertraege2027,
    zusatzversorgung: zusatzversorgung2027,
  },
];

export const verfuegbareJahre = JAHRE.map((j) => j.jahr);

export function getJahresKonfiguration(jahr: number): JahresKonfiguration {
  const k = JAHRE.find((j) => j.jahr === jahr);
  if (!k) throw new Error(`Für das Jahr ${jahr} ist keine Konfiguration hinterlegt.`);
  return k;
}

/** Standardjahr: das aktuelle Kalenderjahr, falls hinterlegt, sonst das neueste endgültige Jahr */
export function standardJahr(heute: Date = new Date()): number {
  const aktuell = heute.getFullYear();
  if (verfuegbareJahre.includes(aktuell)) return aktuell;
  const endgueltig = JAHRE.filter((j) => j.status === 'endgueltig').map((j) => j.jahr);
  return Math.max(...(endgueltig.length > 0 ? endgueltig : verfuegbareJahre));
}

export {
  duesseldorferTabelle2026,
  duesseldorferTabelle2027,
  krankenkassen2026,
  krankenkassen2027,
  lohnsteuer2026,
  lohnsteuer2027,
  tarifvertraege2026,
  tarifvertraege2027,
  zusatzversorgung2026,
  zusatzversorgung2027,
};
