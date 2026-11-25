import type { CalculationStep, ChildPayment, EinmalZahlung, ParentId, StepLine, ValidationIssue } from '../types';
import { otherChildZahlbetrag } from './children';
import type { EngineContext } from './context';
import { fmt, pct } from './format';
import { groupWithStufung } from './table';
import { otherParent, round2, sum } from './util';

const PARENTS: ParentId[] = ['A', 'B'];

export interface MehrbedarfResult {
  step: CalculationStep;
  payments: ChildPayment[];
  einmalig: EinmalZahlung[];
  issues: ValidationIssue[];
}

/**
 * Mehr- und Sonderbedarf: Beide Eltern haften anteilig nach ihren Einkommen
 * (BGH FamRZ 2009, 962 – Kindergartenkosten). Quote: bereinigtes Einkommen abzüglich des bereits
 * geschuldeten Kindesunterhalts (gemeinsame und weitere Kinder) und des angemessenen Selbstbehalts.
 * Der Elternteil, der die Kosten nicht verauslagt, erstattet seinen Anteil.
 *
 * @param unterhalt bereits ermittelte Unterhaltszahlungen (für den Vorwegabzug)
 */
export function calculateMehrbedarf(ctx: EngineContext, unterhalt: ChildPayment[]): MehrbedarfResult | null {
  const { cfg, inc, common, others, input, label } = ctx;
  const posten = common.flatMap((c) =>
    (c.input.bedarfsposten ?? []).filter((p) => p.betrag > 0).map((p) => ({ kind: c, posten: p })),
  );
  if (posten.length === 0) return null;

  const issues: ValidationIssue[] = [];
  const lines: StepLine[] = [];

  // Haftungsquote
  const verfuegbar: Record<ParentId, number> = { A: 0, B: 0 };
  for (const p of PARENTS) {
    const kindesunterhalt = round2(
      sum(unterhalt.filter((z) => z.payer === p && z.art !== 'mehrbedarf').map((z) => z.amount)),
    );
    const g = groupWithStufung(
      inc[p].bereinigt,
      common.length + others[p].length + Math.max(0, input.parents[p].weitereBerechtigte),
      cfg,
    ).group;
    const weitere = round2(
      sum(
        others[p]
          .filter((o) => o.input.care === 'barunterhalt' && o.rang === 1)
          .map((o) => otherChildZahlbetrag(o, g, cfg)),
      ),
    );
    verfuegbar[p] = round2(Math.max(0, inc[p].bereinigt - kindesunterhalt - weitere - cfg.selbstbehalt.angemessen));
    lines.push({
      label: `${label(p)}: ${fmt(inc[p].bereinigt)} − Kindesunterhalt ${fmt(kindesunterhalt)}${
        weitere > 0 ? ` − weitere Kinder ${fmt(weitere)}` : ''
      } − angemessener Selbstbehalt ${fmt(cfg.selbstbehalt.angemessen)}`,
      value: verfuegbar[p],
      money: true,
    });
  }
  const gesamt = verfuegbar.A + verfuegbar.B;
  let quote: Record<ParentId, number>;
  if (gesamt > 0) {
    quote = { A: verfuegbar.A / gesamt, B: verfuegbar.B / gesamt };
  } else {
    quote = { A: 0.5, B: 0.5 };
    issues.push({
      severity: 'warning',
      message:
        'Mehr-/Sonderbedarf: Beide Eltern liegen nach Kindesunterhalt unter dem angemessenen Selbstbehalt – Aufteilung hilfsweise 50 : 50. Leistungsfähigkeit gesondert prüfen.',
    });
  }
  lines.push({
    label: 'Haftungsquoten für Mehr- und Sonderbedarf',
    value: `${label('A')} ${pct(quote.A)} · ${label('B')} ${pct(quote.B)}`,
    emphasis: true,
  });

  const payments: ChildPayment[] = [];
  const einmalig: EinmalZahlung[] = [];
  const laufend = posten.filter((x) => x.posten.art === 'mehrbedarf');
  const einmal = posten.filter((x) => x.posten.art === 'sonderbedarf');

  if (laufend.length > 0) lines.push({ label: 'Mehrbedarf (monatlich)', heading: true });
  for (const { kind, posten: p } of laufend) {
    const erstatter = otherParent(p.verauslagt);
    const anteil = round2(p.betrag * quote[erstatter]);
    const bez = p.bezeichnung.trim() || 'Mehrbedarf';
    lines.push({
      label: `${kind.input.label}: ${bez} (${fmt(p.betrag)}, bezahlt von ${label(p.verauslagt)})`,
      value: anteil > 0 ? `${fmt(anteil)} ${label(erstatter)} → ${label(p.verauslagt)}` : 'keine Erstattung',
      note: `Anteil ${label(erstatter)}: ${pct(quote[erstatter])}`,
    });
    if (anteil > 0) {
      payments.push({
        childId: kind.input.id,
        label: `${kind.input.label} – ${bez}`,
        stage: kind.stage,
        care: kind.care,
        payer: erstatter,
        payee: p.verauslagt,
        amount: anteil,
        art: 'mehrbedarf',
        note: `Mehrbedarf: ${pct(quote[erstatter])} von ${fmt(p.betrag)}`,
      });
    }
  }

  if (einmal.length > 0) lines.push({ label: 'Sonderbedarf (einmalig)', heading: true });
  for (const { kind, posten: p } of einmal) {
    const erstatter = otherParent(p.verauslagt);
    const anteil = round2(p.betrag * quote[erstatter]);
    const bez = p.bezeichnung.trim() || 'Sonderbedarf';
    lines.push({
      label: `${kind.input.label}: ${bez} (${fmt(p.betrag)}, bezahlt von ${label(p.verauslagt)})`,
      value: anteil > 0 ? `${fmt(anteil)} ${label(erstatter)} → ${label(p.verauslagt)} (einmalig)` : 'keine Erstattung',
      note: `Anteil ${label(erstatter)}: ${pct(quote[erstatter])}`,
    });
    if (anteil > 0) {
      einmalig.push({
        childId: kind.input.id,
        label: kind.input.label,
        bezeichnung: bez,
        gesamtbetrag: p.betrag,
        payer: erstatter,
        payee: p.verauslagt,
        betrag: anteil,
        note: `${pct(quote[erstatter])} von ${fmt(p.betrag)}`,
      });
    }
  }

  return { step: { id: 7, title: 'Mehr- und Sonderbedarf', lines }, payments, einmalig, issues };
}
