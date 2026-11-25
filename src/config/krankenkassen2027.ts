import type { KrankenkassenConfig } from '../types';
import { krankenkassen2026 } from './krankenkassen2026';

/**
 * Krankenkassen 2027 – VORLÄUFIG: Die Kassen legen ihre Zusatzbeiträge 2027 erst zum Jahreswechsel fest.
 * Bis dahin werden die Sätze 2026 angezeigt.
 */
export const krankenkassen2027: KrankenkassenConfig = {
  ...krankenkassen2026,
  stand: '2026 (Sätze 2027 noch nicht veröffentlicht)',
  sourceNote: 'VORLÄUFIG: Zusatzbeiträge der Kassen aus 2026 übernommen – Sätze 2027 bitte bei der Kasse prüfen.',
};
