import type { ZusatzversorgungConfig } from '../types';
import { zusatzversorgung2026 } from './zusatzversorgung2026';

/**
 * Zusatzversorgung 2027 – VORLÄUFIG.
 * VBL Ost: Arbeitgeberumlage ab 01.01.2027 2,59 % (35. Satzungsänderung, VBL-Rechengrößen 2026 Ost).
 * Übrige Sätze aus 2026 übernommen (VBL-Rechengrößen 2027 noch nicht veröffentlicht).
 */
export const zusatzversorgung2027: ZusatzversorgungConfig = {
  ...zusatzversorgung2026,
  stand: '2027 (vorläufig)',
  sourceNote: 'VORLÄUFIG: VBL Ost AG-Umlage 2,59 % ab 2027; übrige Sätze aus 2026 übernommen.',
  kassen: zusatzversorgung2026.kassen.map((k) =>
    k.id === 'vbl-ost'
      ? {
          ...k,
          agUmlageProzent: 2.59,
          hinweis:
            'Beitrag 6,25 %: Arbeitgeber 2,00 %, Arbeitnehmer 4,25 % (steuerfrei nach § 3 Nr. 63 EStG); Arbeitgeberumlage ab 2027 2,59 %',
        }
      : k,
  ),
};
