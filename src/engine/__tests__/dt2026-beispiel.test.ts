import { describe, expect, it } from 'vitest';
import { duesseldorferTabelle2026 as cfg } from '../../config';
import { calculate } from '../index';
import { child, input, parent } from './helpers';

/**
 * Amtliches Rechenbeispiel der Düsseldorfer Tabelle 2026, Anm. C (Mangelfälle):
 * U: bereinigtes Einkommen 1.750 €; Kinder 18 (privilegiert, allgemeine Schulausbildung), 7 und 5 Jahre,
 * alle bei E, der nicht barunterhaltspflichtig ist und das Kindergeld bezieht.
 * Verteilungsmasse 300 €, Einsatzbeträge 439 + 428,50 + 356,50 = 1.224 €
 * → K1 107,60 €, K2 105,02 €, K3 87,38 €.
 */
describe('Düsseldorfer Tabelle 2026 – amtliches Mangelfallbeispiel (Anm. C)', () => {
  it('liefert exakt die Beträge der Tabelle', () => {
    const U = parent('U', 1750);
    const E = parent('E', 0, { employed: false });
    const r = calculate(
      input('residenz', U, E, [
        child('K1', 3, { adultRank: 'privilegiert' }),
        child('K2', 1),
        child('K3', 0),
      ]),
      cfg,
    );
    const betrag = (id: string) => r.payments.filter((p) => p.childId === id && p.payer === 'A').reduce((a, p) => a + p.amount, 0);
    expect(betrag('K1')).toBe(107.6);
    expect(betrag('K2')).toBe(105.02);
    expect(betrag('K3')).toBe(87.38);
  });
});
