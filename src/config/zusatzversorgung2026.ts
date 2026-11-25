import type { ZusatzversorgungConfig } from '../types';

/**
 * Zusatzversorgung des öffentlichen Dienstes 2026.
 *
 * Quelle: VBL „Rechengrößen in der Zusatzversorgung 2026" – Abrechnungsverband West (Stand 11.2025)
 * und Abrechnungsverband Ost (Stand 05.2026). Kommunale und kirchliche Zusatzversorgungskassen haben
 * eigene Sätze und werden über „Andere Kasse" manuell erfasst.
 *
 * Steuer: Der Arbeitnehmeranteil an der Umlage (West) wird aus versteuertem Entgelt gezahlt. Der Arbeitnehmer-
 * beitrag zur Kapitaldeckung (Ost) ist nach § 3 Nr. 63 EStG steuerfrei (BFH VI R 57/08), zusammen mit dem
 * Arbeitgeberbeitrag bis 8 % der BBG RV; nach § 1 Abs. 1 Satz 1 Nr. 9 SvEV bis 4 % der BBG RV beitragsfrei.
 *
 * SV-Hinzurechnung nach § 1 Abs. 1 Satz 3 und 4 SvEV: Die Umlage des Arbeitgebers ist beitragspflichtig,
 * soweit sie 2,5 % des zusatzversorgungspflichtigen Entgelts übersteigt, vermindert um 13,30 € monatlich.
 */
export const zusatzversorgung2026: ZusatzversorgungConfig = {
  stand: '2026',
  sourceNote: 'VBL-Rechengrößen 2026 (West Stand 11.2025, Ost Stand 05.2026).',
  kassen: [
    {
      id: 'vbl-west',
      name: 'VBL West (Umlage)',
      anProzent: 1.81,
      agUmlageProzent: 5.49,
      // Arbeitnehmeranteil an der Umlage wird aus versteuertem Einkommen gezahlt
      anSteuerfrei: false,
      agBeitragProzent: 0,
      hinweis: 'Umlage 7,30 %: Arbeitgeber 5,49 %, Arbeitnehmer 1,81 % (aus versteuertem Entgelt)',
    },
    {
      id: 'vbl-ost',
      name: 'VBL Ost (Kapitaldeckung)',
      anProzent: 4.25,
      agUmlageProzent: 1.06,
      // § 3 Nr. 63 EStG (BFH VI R 57/08): Arbeitnehmerbeitrag zur Kapitaldeckung ist steuerfrei
      anSteuerfrei: true,
      agBeitragProzent: 2.0,
      hinweis:
        'Beitrag 6,25 %: Arbeitgeber 2,00 %, Arbeitnehmer 4,25 % (steuerfrei nach § 3 Nr. 63 EStG); zusätzlich Arbeitgeberumlage 1,06 %',
    },
  ],
  hinzurechnungFreiProzent: 2.5,
  hinzurechnungAbzugMonat: 13.3,
  steuerfreiProzentBbg: 8,
  // Annahme: steuerfreier AN-Beitrag fällt unter § 1 Abs. 1 Satz 1 Nr. 9 SvEV – Bestätigung der SV-Träger nicht gefunden
  svFreiProzentBbg: 4,
};
