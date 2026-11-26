import { fundstelle, leitlinienFuer } from '../config/leitlinien';
import { giltAlsErwerbstaetig, haushaltsersparnisHinweis, mitHaushaltsersparnis } from './income';
import type { CalculationStep, ChildPayment, EhegattenErgebnis, ParentId, StepLine, ValidationIssue } from '../types';
import { otherChildZahlbetrag } from './children';
import type { EngineContext } from './context';
import { fmt } from './format';
import { groupWithStufung } from './table';
import { otherParent, round2, sum } from './util';

const PARENTS: ParentId[] = ['A', 'B'];

export interface EhegattenResult {
  step: CalculationStep;
  ergebnis: EhegattenErgebnis | null;
  issues: ValidationIssue[];
}

/**
 * Ehegattenunterhalt nach der Quotenmethode (DT 2026 Teil B, Leitlinien NRW 2026 Nr. 15, 21.4):
 * 1. Prägendes Einkommen = bereinigtes Einkommen − Kindesunterhalt (Zahlbeträge, Kinder sind vorrangig)
 * 2. Erwerbseinkommen mit Erwerbsanreiz 1/10 → 45 % der Differenz, sonstige Einkünfte 50 %
 * 3. Mindestbedarf des Berechtigten (Existenzminimum)
 * 4. Leistungsfähigkeit: dem Pflichtigen bleibt der Selbstbehalt gegenüber dem Ehegatten
 *
 * Nicht berücksichtigt: Vorsorgeunterhalt, trennungsbedingter Mehrbedarf, Begrenzung nach § 1578b BGB.
 */
export function calculateEhegatte(ctx: EngineContext, kindesunterhalt: ChildPayment[]): EhegattenResult | null {
  const { input, cfg, inc, common, others, label } = ctx;
  const opt = input.ehegatte;
  if (!opt?.aktiv) return null;
  const e = cfg.ehegatte;
  const lines: StepLine[] = [];
  const issues: ValidationIssue[] = [];

  // 1. prägendes Einkommen nach Abzug des Kindesunterhalts
  const praegend: Record<ParentId, number> = { A: 0, B: 0 };
  const kuSumme: Record<ParentId, number> = { A: 0, B: 0 };
  for (const p of PARENTS) {
    // KV-Beiträge der Kinder sind bereits vom Einkommen abgezogen (bereinigt) – nicht doppelt berücksichtigen
    const gemeinsam = sum(kindesunterhalt.filter((z) => z.payer === p).map((z) => z.amount - (z.kv ?? 0)));
    const g = groupWithStufung(
      inc[p].bereinigt,
      common.length + others[p].length + Math.max(0, input.parents[p].weitereBerechtigte),
      cfg,
    ).group;
    const weitere = sum(
      others[p].filter((o) => o.input.care === 'barunterhalt').map((o) => otherChildZahlbetrag(o, g, cfg)),
    );
    kuSumme[p] = round2(gemeinsam + weitere);
    praegend[p] = round2(Math.max(0, inc[p].bereinigt - kuSumme[p]));
    lines.push({
      label: `${label(p)}: ${fmt(inc[p].bereinigt)} − Kindesunterhalt ${fmt(kuSumme[p])}`,
      value: praegend[p],
      money: true,
      note: giltAlsErwerbstaetig(input.parents[p]) ? 'Erwerbseinkommen (Erwerbsanreiz 1/10)' : 'sonstige Einkünfte (Halbteilung)',
    });
  }
  const familieneinkommen = round2(praegend.A + praegend.B);
  if (familieneinkommen > e.quotenGrenzeFamilieneinkommen) {
    issues.push({
      severity: 'warning',
      message: `Ehegattenunterhalt: Familieneinkommen über ${fmt(e.quotenGrenzeFamilieneinkommen)} – der Bedarf ist in der Regel konkret darzulegen (${fundstelle(
        leitlinienFuer(input.options.leitlinien),
        '15.3',
      )}); die Quote ist dann nur die Obergrenze.`,
    });
  }

  // 2. Quotenunterhalt (Differenzmethode): positiv = A zahlt an B
  const anteil = (p: ParentId) => (giltAlsErwerbstaetig(input.parents[p]) ? e.erwerbsquote : e.sonstigeQuote) * praegend[p];
  const differenzAzuB = round2(anteil('A') - anteil('B'));
  if (differenzAzuB === 0) {
    lines.push({ label: 'Ehegattenunterhalt', value: 'kein Anspruch (gleiche prägende Einkommen)', emphasis: true });
    return { step: { id: 8, title: 'Ehegattenunterhalt', lines }, ergebnis: null, issues };
  }
  const payer: ParentId = differenzAzuB > 0 ? 'A' : 'B';
  const payee = otherParent(payer);
  const quotenunterhalt = Math.abs(differenzAzuB);
  lines.push({
    label: 'Quotenunterhalt (45 % der Differenz der Erwerbseinkommen, 50 % bei sonstigen Einkünften)',
    value: `${fmt(quotenunterhalt)} ${label(payer)} → ${label(payee)}`,
  });

  // 3. Mindestbedarf des Berechtigten
  const mindestbedarf = giltAlsErwerbstaetig(input.parents[payee]) ? e.mindestbedarf.erwerbstaetig : e.mindestbedarf.nichtErwerbstaetig;
  const eigenesEinkommen = inc[payee].bereinigt;
  const mindestAnspruch = round2(Math.max(0, mindestbedarf - eigenesEinkommen));
  let anspruch = quotenunterhalt;
  if (mindestAnspruch > anspruch) {
    anspruch = mindestAnspruch;
    lines.push({
      label: `Mindestbedarf ${label(payee)} ${fmt(mindestbedarf)} − eigenes Einkommen ${fmt(eigenesEinkommen)}`,
      value: mindestAnspruch,
      money: true,
      note: 'Existenzminimum liegt über dem Quotenunterhalt',
    });
  }

  // 4. Leistungsfähigkeit des Pflichtigen
  const ll = leitlinienFuer(input.options.leitlinien);
  const sb = mitHaushaltsersparnis(
    giltAlsErwerbstaetig(input.parents[payer]) ? e.selbstbehalt.erwerbstaetig : e.selbstbehalt.nichtErwerbstaetig,
    input.parents[payer],
    ll,
  );
  const verfuegbar = round2(Math.max(0, inc[payer].bereinigt - kuSumme[payer] - sb));
  lines.push({
    label: `Leistungsfähigkeit ${label(payer)}: ${fmt(inc[payer].bereinigt)} − Kindesunterhalt ${fmt(kuSumme[payer])} − Selbstbehalt ${fmt(sb)}`,
    value: verfuegbar,
    note: haushaltsersparnisHinweis(input.parents[payer], ll),
    money: true,
  });
  const gekuerzt = anspruch > verfuegbar;
  const amount = round2(Math.min(anspruch, verfuegbar));
  if (gekuerzt) {
    issues.push({
      severity: 'warning',
      message: `Ehegattenunterhalt: Mangelfall – der Anspruch von ${fmt(anspruch)} wird auf ${fmt(amount)} gekürzt, weil ${label(payer)} der Selbstbehalt von ${fmt(sb)} verbleiben muss.`,
    });
  }
  lines.push({
    label: `Ehegattenunterhalt (${opt.art === 'trennung' ? 'Trennungsunterhalt' : 'nachehelicher Unterhalt'})`,
    value: amount > 0 ? `${fmt(amount)} ${label(payer)} → ${label(payee)}` : 'kein Anspruch (nicht leistungsfähig)',
    emphasis: true,
    note: gekuerzt ? `gekürzt von ${fmt(anspruch)}` : undefined,
  });

  issues.push({
    severity: 'warning',
    message:
      opt.art === 'nachehelich'
        ? 'Nachehelicher Unterhalt: Anspruchsgrundlage (z. B. Kinderbetreuung, Alter, Krankheit), Erwerbsobliegenheit sowie Herabsetzung/Befristung (§ 1578b BGB) sind nicht geprüft; Vorsorgeunterhalt ist nicht enthalten.'
        : 'Trennungsunterhalt: Erwerbsobliegenheit und Vorsorgeunterhalt sind nicht berücksichtigt; Ehegattenunterhalt ist nachrangig gegenüber dem Kindesunterhalt.',
  });

  return {
    step: { id: 8, title: 'Ehegattenunterhalt', lines },
    ergebnis: amount > 0 ? { art: opt.art, payer, payee, amount, quotenunterhalt, gekuerzt } : null,
    issues,
  };
}
