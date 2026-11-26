import { verfuegbareJahre } from '../config';
import { calculate } from '../engine';
import { round2 } from '../engine/util';
import type { AgeStage, CalculationInput, ChildPayment, ParentId, ParentInput, PaymentFlow } from '../types';
import { inputFuerJahr } from './jahrAbgleich';

/**
 * Unterhalt über einen Zeitraum: Berechnung Monat für Monat mit den Eingaben des Rechners.
 *
 * - Altersstufen werden je Monat aus dem Geburtsdatum ermittelt; die höhere Stufe gilt ab dem Monat, in dem das
 *   Kind das Lebensjahr vollendet (§ 1612a Abs. 3 BGB).
 * - Je Monat gelten Tabelle, Kindergeld und Selbstbehalte des jeweiligen Kalenderjahres.
 * - Einkommen bleibt gleich, außer es sind Einkommensänderungen ab einem Monat erfasst; übrige Eingaben bleiben gleich.
 * - Einmaliger Sonderbedarf ist nicht enthalten (sonst würde er jeden Monat gezählt).
 * - Rückstand = Summe der monatlichen Ausgleichsbeträge zwischen den Eltern − bereits gezahlte Beträge.
 */

export const MAX_MONATE = 120;

/** Ab einem Monat gilt für einen Elternteil ein neues Einkommen (in der gewählten Einkommensart: netto bzw. brutto) */
export interface EinkommensAenderung {
  id: string;
  /** erster Monat mit dem neuen Einkommen, Format JJJJ-MM */
  ab: string;
  elternteil: ParentId;
  betrag: number;
}

export interface ZeitraumEingabe {
  /** erster Monat, Format JJJJ-MM */
  von: string;
  /** letzter Monat (einschließlich), Format JJJJ-MM */
  bis: string;
  /** bereits monatlich gezahlter Betrag (an den anderen Elternteil) – optional */
  gezahlt: { zahler: ParentId; betragMonatlich: number } | null;
  /** Einkommensänderungen innerhalb des Zeitraums */
  aenderungen?: EinkommensAenderung[];
}

/** Einstellungen des Zeitraum-Bereichs (Oberfläche, Speicherdatei, PDF) */
export interface ZeitraumEinstellung {
  aktiv: boolean;
  von: string;
  bis: string;
  mitGezahlt: boolean;
  zahler: ParentId;
  betragMonatlich: number;
  aenderungen: EinkommensAenderung[];
}

export function zeitraumStandard(heute: Date = new Date()): ZeitraumEinstellung {
  const j = heute.getFullYear();
  return {
    aktiv: false,
    von: `${j}-01`,
    bis: `${j}-${String(heute.getMonth() + 1).padStart(2, '0')}`,
    mitGezahlt: false,
    zahler: 'A',
    betragMonatlich: 0,
    aenderungen: [],
  };
}

export function zeitraumEingabeAus(e: ZeitraumEinstellung): ZeitraumEingabe {
  return {
    von: e.von,
    bis: e.bis,
    gezahlt: e.mitGezahlt ? { zahler: e.zahler, betragMonatlich: e.betragMonatlich } : null,
    aenderungen: e.aenderungen,
  };
}

/** Bezeichnung der Einkommensart eines Elternteils; null, wenn Änderungen nicht möglich sind (Tarif-Eingabe) */
export function einkommensart(p: ParentInput): 'netto' | 'brutto' | null {
  if (p.incomeMode === 'netto') return 'netto';
  return p.gross.quelle === 'manuell' ? 'brutto' : null;
}

function mitEinkommen(p: ParentInput, betrag: number): ParentInput {
  const art = einkommensart(p);
  if (art === 'netto') return { ...p, netIncome: betrag };
  if (art === 'brutto') return { ...p, gross: { ...p.gross, bruttoMonatlich: betrag } };
  return p;
}

/** im Monat geltende Einkommensänderung je Elternteil (die zuletzt begonnene) */
function geltendeAenderungen(aenderungen: EinkommensAenderung[], monat: string): Partial<Record<ParentId, EinkommensAenderung>> {
  const out: Partial<Record<ParentId, EinkommensAenderung>> = {};
  for (const a of [...aenderungen].sort((x, y) => x.ab.localeCompare(y.ab))) {
    if (MONAT.test(a.ab) && a.ab <= monat) out[a.elternteil] = a;
  }
  return out;
}

export interface MonatsZahlung {
  childId: string | null;
  label: string;
  stage: AgeStage | null;
  payer: ParentId;
  payee: ChildPayment['payee'];
  amount: number;
}

export interface MonatsErgebnis {
  monat: string;
  ok: boolean;
  /** im Monat geltendes geändertes Einkommen je Elternteil (nur bei erfassten Änderungen) */
  einkommen: Partial<Record<ParentId, number>>;
  zahlungen: MonatsZahlung[];
  /** Ausgleich zwischen den Eltern in diesem Monat (A → B positiv) */
  nettoAB: number;
}

export interface Abschnitt {
  von: string;
  bis: string;
  monate: number;
  einkommen: Partial<Record<ParentId, number>>;
  zahlungen: MonatsZahlung[];
  nettoAB: number;
}

export interface ZeitraumErgebnis {
  monate: MonatsErgebnis[];
  abschnitte: Abschnitt[];
  /** Summe der Ausgleichsbeträge zwischen den Eltern über alle berechneten Monate (A → B positiv) */
  summeNettoAB: number;
  /** Zahlungen direkt an volljährige Kinder (nicht im Ausgleich zwischen den Eltern) */
  summeAnKinder: number;
  gezahltGesamt: number;
  /** offener Betrag (positiv = Rückstand, negativ = Überzahlung) aus Sicht des Zahlers */
  rueckstand: { zahler: ParentId; empfaenger: ParentId; betrag: number } | null;
  hinweise: string[];
  /** Monate, für die keine Werte hinterlegt sind oder die Berechnung fehlschlug */
  ausgelassen: string[];
}

const MONAT = /^(\d{4})-(\d{2})$/;

export function monateZwischen(von: string, bis: string): string[] {
  const a = MONAT.exec(von);
  const b = MONAT.exec(bis);
  if (!a || !b) return [];
  let j = Number(a[1]);
  let m = Number(a[2]);
  const endJ = Number(b[1]);
  const endM = Number(b[2]);
  const out: string[] = [];
  while ((j < endJ || (j === endJ && m <= endM)) && out.length <= MAX_MONATE) {
    out.push(`${j}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      j += 1;
    }
  }
  return out;
}

export function monatText(monat: string): string {
  const [j, m] = monat.split('-');
  return `${m}/${j}`;
}

function zahlungenAus(payments: ChildPayment[], ehegatte: { payer: ParentId; payee: ParentId; amount: number } | null): MonatsZahlung[] {
  const z: MonatsZahlung[] = payments
    .filter((p) => p.payer && p.payee && p.amount > 0)
    .map((p) => ({
      childId: p.childId,
      label: p.art === 'mehrbedarf' ? `${p.label} (Mehrbedarf)` : p.label,
      stage: p.stage,
      payer: p.payer!,
      payee: p.payee,
      amount: p.amount,
    }));
  if (ehegatte && ehegatte.amount > 0) {
    z.push({ childId: null, label: 'Ehegattenunterhalt', stage: null, payer: ehegatte.payer, payee: ehegatte.payee, amount: ehegatte.amount });
  }
  return z;
}

function nettoAB(summary: PaymentFlow[]): number {
  const ab = summary.find((f) => f.payer === 'A' && f.payee === 'B')?.amount ?? 0;
  const ba = summary.find((f) => f.payer === 'B' && f.payee === 'A')?.amount ?? 0;
  return round2(ab - ba);
}

export function berechneZeitraum(input: CalculationInput, eingabe: ZeitraumEingabe): ZeitraumErgebnis {
  const hinweise: string[] = [];
  const ausgelassen: string[] = [];
  const alle = monateZwischen(eingabe.von, eingabe.bis);
  if (alle.length > MAX_MONATE) {
    hinweise.push(`Höchstens ${MAX_MONATE} Monate – der Zeitraum wurde gekürzt.`);
    alle.length = MAX_MONATE;
  }

  const monate: MonatsErgebnis[] = [];
  let summeAnKinder = 0;
  for (const monat of alle) {
    const jahr = Number(monat.slice(0, 4));
    if (!verfuegbareJahre.includes(jahr)) {
      ausgelassen.push(monat);
      continue;
    }
    const geltend = geltendeAenderungen(eingabe.aenderungen ?? [], monat);
    const basis = inputFuerJahr(input, jahr);
    const einkommen: Partial<Record<ParentId, number>> = {};
    const parents = { ...basis.parents };
    for (const p of ['A', 'B'] as ParentId[]) {
      const a = geltend[p];
      if (a && einkommensart(parents[p])) {
        parents[p] = mitEinkommen(parents[p], a.betrag);
        einkommen[p] = a.betrag;
      }
    }
    const r = calculate({ ...basis, parents, referenceDate: `${monat}-01` });
    if (!r.ok) {
      ausgelassen.push(monat);
      continue;
    }
    const zahlungen = zahlungenAus(r.payments, r.ehegatte);
    summeAnKinder += r.summary.filter((f) => f.payee === 'Kind').reduce((a, f) => a + f.amount, 0);
    monate.push({ monat, ok: true, einkommen, zahlungen, nettoAB: nettoAB(r.summary) });
  }

  // gleiche aufeinanderfolgende Monate zu Abschnitten zusammenfassen
  const abschnitte: Abschnitt[] = [];
  const schluessel = (m: { zahlungen: MonatsZahlung[]; einkommen: Partial<Record<ParentId, number>> }) =>
    JSON.stringify([m.zahlungen, m.einkommen.A ?? null, m.einkommen.B ?? null]);
  for (const m of monate) {
    const letzter = abschnitte[abschnitte.length - 1];
    const folgemonat = letzter ? monateZwischen(letzter.bis, m.monat).length === 2 : false;
    if (letzter && folgemonat && schluessel(letzter) === schluessel(m)) {
      letzter.bis = m.monat;
      letzter.monate += 1;
    } else {
      abschnitte.push({ von: m.monat, bis: m.monat, monate: 1, einkommen: m.einkommen, zahlungen: m.zahlungen, nettoAB: m.nettoAB });
    }
  }

  const summeNettoAB = round2(monate.reduce((a, m) => a + m.nettoAB, 0));
  const gezahlt = eingabe.gezahlt && eingabe.gezahlt.betragMonatlich > 0 ? eingabe.gezahlt : null;
  const gezahltGesamt = gezahlt ? round2(gezahlt.betragMonatlich * monate.length) : 0;

  let rueckstand: ZeitraumErgebnis['rueckstand'] = null;
  if (gezahlt) {
    const zahler = gezahlt.zahler;
    const geschuldet = zahler === 'A' ? summeNettoAB : -summeNettoAB;
    rueckstand = { zahler, empfaenger: zahler === 'A' ? 'B' : 'A', betrag: round2(geschuldet - gezahltGesamt) };
  } else if (summeNettoAB !== 0) {
    const zahler: ParentId = summeNettoAB > 0 ? 'A' : 'B';
    rueckstand = { zahler, empfaenger: zahler === 'A' ? 'B' : 'A', betrag: Math.abs(summeNettoAB) };
  }

  if (ausgelassen.length > 0) {
    const ohneWerte = ausgelassen.filter((m) => !verfuegbareJahre.includes(Number(m.slice(0, 4))));
    if (ohneWerte.length > 0) {
      hinweise.push(
        `Für ${monatText(ohneWerte[0])}${ohneWerte.length > 1 ? `–${monatText(ohneWerte[ohneWerte.length - 1])}` : ''} sind keine Tabellenwerte hinterlegt (verfügbar: ${verfuegbareJahre.join(', ')}) – diese Monate fehlen in der Summe.`,
      );
    }
    if (ohneWerte.length < ausgelassen.length) {
      hinweise.push('Für einzelne Monate war keine Berechnung möglich (Eingaben prüfen) – sie fehlen in der Summe.');
    }
  }
  if (input.children.some((c) => c.age.kind === 'stage')) {
    hinweise.push('Kinder mit Altersangabe „Altersstufe“ bleiben im ganzen Zeitraum in derselben Stufe – für automatische Stufenwechsel das Geburtsdatum eingeben.');
  }
  if (input.children.some((c) => (c.bedarfsposten ?? []).some((b) => b.art === 'sonderbedarf' && b.betrag > 0))) {
    hinweise.push('Einmaliger Sonderbedarf ist in der Zeitraumsumme nicht enthalten.');
  }
  for (const p of ['A', 'B'] as ParentId[]) {
    if ((eingabe.aenderungen ?? []).some((a) => a.elternteil === p) && !einkommensart(input.parents[p])) {
      hinweise.push(`Einkommensänderungen für ${input.parents[p].label} werden nicht berücksichtigt (Tarif-Eingabe) – Bruttolohn dafür manuell eingeben.`);
    }
  }
  if (summeAnKinder > 0) {
    hinweise.push('Zahlungen direkt an volljährige Kinder sind nicht im Ausgleich zwischen den Eltern enthalten.');
  }

  return {
    monate,
    abschnitte,
    summeNettoAB,
    summeAnKinder: round2(summeAnKinder),
    gezahltGesamt,
    rueckstand,
    hinweise,
    ausgelassen,
  };
}
