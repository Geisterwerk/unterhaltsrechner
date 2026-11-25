import type { LohnsteuerConfig } from '../types';
import { lohnsteuer2026 } from './lohnsteuer2026';

/**
 * Lohnsteuer- und Sozialversicherungsparameter 2027 – VORLÄUFIG.
 *
 * Tarif und Steuerklassen V/VI: Regierungsentwurf Einkommensteuerreformgesetz 2027, BT-Drs. 21/8235 vom
 * 28.09.2026 (§ 32a Abs. 1, § 32 Abs. 6, § 39b Abs. 2 Satz 7 EStG) – noch nicht verabschiedet.
 * Soli-Freigrenze: im Entwurf unverändert (20.350 €).
 * Beitragsbemessungsgrenzen: Kabinettsbeschluss Sozialversicherungsrechengrößen-Verordnung 2027 vom 07.10.2026
 * (Zustimmung des Bundesrats ausstehend). Durchschnittlicher Zusatzbeitrag 2027: 2,9 % (BAnz AT 30.10.2026).
 * Beitragssätze RV/AV/KV/PV: aus 2026 übernommen (für 2027 nicht abschließend bestätigt).
 */
export const lohnsteuer2027: LohnsteuerConfig = {
  ...lohnsteuer2026,
  name: 'Lohnsteuer / Sozialversicherung 2027 (vorläufig)',
  validFrom: '2027-01-01',
  sourceNote:
    'VORLÄUFIG: Tarif 2027 laut Regierungsentwurf (BT-Drs. 21/8235), BBG laut Kabinettsbeschluss, Beitragssätze aus 2026 übernommen.',
  tarif: {
    grundfreibetrag: 12564,
    zone2Start: 17800,
    zone3Start: 70601,
    zone4Start: 250000,
    zone1: { a: 952.24, b: 1400 },
    zone2: { a: 170.74, b: 2397, c: 993.86 },
    zone3: { rate: 0.42, abzug: 11241.73 },
    zone4: { rate: 0.45, abzug: 18741.7 },
    zone5: { start: 280000, rate: 0.47, abzug: 24341.68 },
  },
  stkl56: { w1: 14251, w2: 35299, w3: 200000, w4: 224000, mindestsatz: 0.14 },
  // 2 × (3.564 € Kinderfreibetrag + 1.464 € BEA-Freibetrag)
  kinderfreibetragJeZaehler: 10056,
  sv: {
    ...lohnsteuer2026.sv,
    bbgRvAvJahr: 106200,
    bbgKvPvJahr: 76500,
    kvZusatzbeitragDurchschnitt: 2.9,
  },
};
