import type {
  AgeStage,
  CalculationInput,
  ChildCare,
  CommonChildInput,
  OtherChildInput,
  ParentId,
  ParentInput,
} from '../../types';

export function parent(label: string, netIncome: number, overrides: Partial<ParentInput> = {}): ParentInput {
  return {
    label,
    incomeMode: 'netto',
    netIncome,
    gross: {
      quelle: 'manuell',
    tarif: { tarifId: 'tvoed-vka', gruppe: 'E 9b', stufe: 3, arbeitszeit: 100, jahressonderzahlung: true, zulagen: [] },
    bruttoMonatlich: 0,
      sonderzahlungenJahr: 0,
      arbeitszeit: 100,
      steuerklasse: 1,
      kinderfreibetraege: 0,
      kirchensteuerSatz: 0,
    krankenkasse: 'durchschnitt',
      kvZusatzbeitrag: 2.9,
      pvKinder: 1,
      zusatzversorgung: { kasse: 'keine', anProzent: 0, agUmlageProzent: 0, anSteuerfrei: false, agBeitragProzent: 0 },
    },
    employed: true,
    deductions: {
      berufsbedingtMode: 'keine',
      berufsbedingtKonkret: 0,
      altersvorsorge: 0,
      schulden: 0,
      sonstige: 0,
      wohnvorteil: 0,
    },
    otherChildren: [],
    weitereBerechtigte: 0,
    ...overrides,
  };
}

type TestChild = Omit<CommonChildInput, 'care'> & { care?: ChildCare };

/** Gemeinsames Kind; ohne `care` wird das Betreuungsmodell von `input()` gesetzt */
export function child(id: string, stage: AgeStage, overrides: Partial<CommonChildInput> = {}): TestChild {
  return {
    id,
    label: id,
    age: { kind: 'stage', stage },
    adultRank: 'privilegiert',
    ownIncome: 0,
    kinderzuschlag: 0,
    kindergeldRecipient: 'B',
    wechselMehrkosten: 0,
    wechselWohnkosten: { A: 0, B: 0 },
    eigenerHaushalt: false,
    bedarfsposten: [],
    ...overrides,
  };
}

export function otherChild(
  id: string,
  stage: AgeStage,
  overrides: Partial<OtherChildInput> = {},
): OtherChildInput {
  return {
    id,
    label: id,
    age: { kind: 'stage', stage },
    adultRank: 'privilegiert',
    care: 'barunterhalt',
    fixedPayment: null,
    ...overrides,
  };
}

/**
 * Eingabe bauen. `model` setzt das Betreuungsmodell aller Kinder ohne eigenes `care`:
 * 'residenz' → Kinder leben bei `residentParent`, 'wechsel' → Wechselmodell, 'gemischt' → care je Kind Pflicht.
 */
export function input(
  model: 'residenz' | 'wechsel' | 'gemischt',
  A: ParentInput,
  B: ParentInput,
  children: TestChild[],
  residentParent: ParentId = 'B',
): CalculationInput {
  const fallback: ChildCare = model === 'wechsel' ? 'wechsel' : residentParent;
  return {
    jahr: 2026,
    referenceDate: '2026-11-20',
    parents: { A, B },
    children: children.map((c) => ({ ...c, care: c.care ?? fallback })),
    options: {
      haushaltskinderEinbeziehen: true,
      wechselNaturalunterhaltAbzug: true,
      wechselStufung: false,
    },
  };
}
