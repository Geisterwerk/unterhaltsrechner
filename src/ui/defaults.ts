import { STANDARD_LEITLINIEN } from '../config/leitlinien';
import { getJahresKonfiguration, standardJahr } from '../config';
import type { CalculationInput, CommonChildInput, GrossIncomeInput, OtherChildInput, ParentInput } from '../types';

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function defaultGross(jahr: number = standardJahr()): GrossIncomeInput {
  return {
    quelle: 'manuell',
    tarif: { tarifId: 'tvoed-vka', gruppe: 'E 9b', stufe: 3, arbeitszeit: 100, jahressonderzahlung: true, zulagen: [] },
    bruttoMonatlich: 0,
    sonderzahlungenJahr: 0,
    arbeitszeit: 100,
    steuerklasse: 1,
    kinderfreibetraege: 0,
    kirchensteuerSatz: 0,
    krankenkasse: 'durchschnitt',
    kvZusatzbeitrag: getJahresKonfiguration(jahr).lohnsteuer.sv.kvZusatzbeitragDurchschnitt,
    pvKinder: 1,
    zusatzversorgung: { kasse: 'keine', anProzent: 0, agUmlageProzent: 0, anSteuerfrei: false, agBeitragProzent: 0 },
  };
}

export function emptyParent(label: string, netIncome: number): ParentInput {
  return {
    label,
    incomeMode: 'netto',
    netIncome,
    gross: defaultGross(),
    employed: true,
    deductions: {
      berufsbedingtMode: 'keine',
      berufsbedingtKonkret: 0,
      altersvorsorge: 0,
      schulden: 0,
      sonstige: 0,
      wohnvorteil: 0,
      pkv: 0,
    },
    otherChildren: [],
    weitereBerechtigte: 0,
    fiktiv: { aktiv: false, netto: 0 },
    zusammenleben: false,
  };
}

export function newCommonChild(index: number): CommonChildInput {
  return {
    id: newId('kind'),
    label: `Kind ${index}`,
    age: { kind: 'stage', stage: 0 },
    care: 'B',
    adultRank: 'privilegiert',
    ownIncome: 0,
    kinderzuschlag: 0,
    krankenversicherung: 0,
    kindergeldRecipient: 'B',
    wechselMehrkosten: 0,
    wechselWohnkosten: { A: 0, B: 0 },
    eigenerHaushalt: false,
    bedarfsposten: [],
  };
}

export function newOtherChild(index: number): OtherChildInput {
  return {
    id: newId('weiteres'),
    label: `Weiteres Kind ${index}`,
    age: { kind: 'stage', stage: 0 },
    adultRank: 'privilegiert',
    care: 'barunterhalt',
    fixedPayment: null,
  };
}

export function defaultInput(): CalculationInput {
  return {
    ehegatte: { aktiv: false, art: 'trennung' },
    jahr: standardJahr(),
    referenceDate: today(),
    parents: {
      A: emptyParent('Elternteil A', 3000),
      B: emptyParent('Elternteil B', 1800),
    },
    children: [newCommonChild(1), { ...newCommonChild(2), age: { kind: 'stage', stage: 1 } }],
    options: {
      haushaltskinderEinbeziehen: true,
      wechselNaturalunterhaltAbzug: true,
      wechselStufung: false,
      leitlinien: STANDARD_LEITLINIEN,
    },
  };
}
