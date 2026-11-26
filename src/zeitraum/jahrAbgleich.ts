import type { CalculationInput, JahresKonfiguration, ParentInput } from '../types';
import { getJahresKonfiguration } from '../config';

/**
 * Beim Jahreswechsel die aus Listen gewählten Sätze (Krankenkasse, Zusatzversorgung) auf die Werte des
 * neuen Jahres setzen; manuell eingegebene Sätze bleiben unverändert.
 */
export function syncParentToYear(p: ParentInput, jk: JahresKonfiguration): ParentInput {
  const g = p.gross;
  const kasse = jk.krankenkassen.kassen.find((k) => k.id === g.krankenkasse);
  const kvZusatzbeitrag =
    g.krankenkasse === 'durchschnitt' ? jk.lohnsteuer.sv.kvZusatzbeitragDurchschnitt : kasse ? kasse.zusatzbeitrag : g.kvZusatzbeitrag;
  const zvKasse = jk.zusatzversorgung.kassen.find((k) => k.id === g.zusatzversorgung.kasse);
  const zusatzversorgung = zvKasse
    ? {
        kasse: zvKasse.id,
        anProzent: zvKasse.anProzent,
        agUmlageProzent: zvKasse.agUmlageProzent,
        anSteuerfrei: zvKasse.anSteuerfrei,
        agBeitragProzent: zvKasse.agBeitragProzent,
      }
    : g.zusatzversorgung;
  return { ...p, gross: { ...g, kvZusatzbeitrag, zusatzversorgung } };
}

/** Eingaben auf ein anderes Berechnungsjahr umstellen (Listensätze des Jahres übernehmen) */
export function inputFuerJahr(input: CalculationInput, jahr: number): CalculationInput {
  if (input.jahr === jahr) return input;
  const jk = getJahresKonfiguration(jahr);
  return { ...input, jahr, parents: { A: syncParentToYear(input.parents.A, jk), B: syncParentToYear(input.parents.B, jk) } };
}
