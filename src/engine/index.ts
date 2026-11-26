import { getJahresKonfiguration } from '../config';
import type {
  CalculationInput,
  CalculationResult,
  CalculationStep,
  ChildCare,
  ChildPayment,
  ParentId,
  PaymentFlow,
  UnterhaltsTabelleConfig,
  ValidationIssue,
} from '../types';
import { AGE_STAGE_LABELS } from '../types';
import { calculateBarunterhalt, rang1PaymentsOf } from './barunterhalt';
import {
  commonMinorZahlbetrag,
  computeAdultShares,
  otherChildZahlbetrag,
  resolveCommonChildren,
  resolveOtherChildren,
} from './children';
import { StepSections, type EngineContext, type StepId } from './context';
import { fmt, incomeStep, pct } from './format';
import { fundstelle, leitlinienFuer } from '../config/leitlinien';
import { kvBeitrag } from './children';
import { bereinigtesEinkommen, notwendigerSelbstbehalt } from './income';
import { groupWithStufung } from './table';
import { otherParent, round2, sum } from './util';
import { calculateEhegatte } from './ehegatte';
import { calculateMehrbedarf } from './mehrbedarf';
import { validateInput } from './validate';
import { calculateWechsel } from './wechsel';

const PARENTS: ParentId[] = ['A', 'B'];

const STEP_TITLES: Record<StepId, string> = {
  2: 'Betreuung & weitere unterhaltsberechtigte Kinder / Vorwegabzüge',
  3: 'Maßgebliches Einkommen & Tabellenstufe',
  4: 'Tabellenbedarf & Kindergeldanrechnung',
  5: 'Haftungsquoten & Selbstbehaltsprüfung / Mangelfall',
  6: 'Finaler Zahlbetrag / Spitzenausgleich',
};

/**
 * Einstiegspunkt der Engine: reine Funktion ohne Seiteneffekte.
 * Das Betreuungsmodell wird je Kind festgelegt; gemischte Konstellationen werden so berechnet:
 *  1. Barunterhalt je Elternteil für Kinder, die beim anderen Elternteil leben (inkl. volljähriger Kinder),
 *     unter Einbeziehung aller gleichrangigen Kinder.
 *  2. Wechselmodell-Kinder auf Basis der Einkommen nach Vorwegabzug dieser Barunterhaltszahlungen.
 */
export function calculate(input: CalculationInput, tabelleOverride?: UnterhaltsTabelleConfig): CalculationResult {
  const erster = berechne(input, tabelleOverride);
  // Ehegatte als weiterer Unterhaltsberechtigter des Pflichtigen (DT Anm. A.I): zweiter Durchlauf, wenn der
  // ehegattenunterhaltspflichtige Elternteil zugleich Kindesunterhalt zahlt
  const eh = erster.ehegatte;
  if (!eh || !erster.payments.some((z) => z.payer === eh.payer && z.art !== 'mehrbedarf')) return erster;
  const p = eh.payer;
  const zweiter = berechne(
    {
      ...input,
      parents: { ...input.parents, [p]: { ...input.parents[p], weitereBerechtigte: input.parents[p].weitereBerechtigte + 1 } },
    },
    tabelleOverride,
  );
  zweiter.issues.push({
    severity: 'warning',
    message: `Der unterhaltsberechtigte Ehegatte wird bei ${input.parents[p].label} als weiterer Berechtigter für die Zu-/Herabstufung der Kindesunterhaltstabelle gezählt.`,
  });
  return zweiter;
}

function berechne(input: CalculationInput, tabelleOverride?: UnterhaltsTabelleConfig): CalculationResult {
  // jahresabhängige Werte; die Unterhaltstabelle kann (z. B. in Tests) explizit vorgegeben werden
  const basis = getJahresKonfiguration(input.jahr);
  const jk = tabelleOverride ? { ...basis, tabelle: tabelleOverride } : basis;
  const cfg = jk.tabelle;
  const validation = validateInput(input, jk);
  if (jk.status === 'vorlaeufig') {
    validation.unshift({
      severity: 'warning',
      message: `Berechnungsjahr ${jk.jahr} ist vorläufig: Nicht alle Werte sind amtlich veröffentlicht (Details im Hinweis oberhalb der Eingaben bzw. im PDF-Bericht).`,
    });
  }
  if (validation.some((i) => i.severity === 'error')) {
    return { issues: validation, ok: false, payments: [], summary: [], saldo: null, steps: [], einmalig: [], ehegatte: null };
  }
  const issues: ValidationIssue[] = [...validation];
  const label = (p: ParentId) => input.parents[p].label;
  const careText = (care: ChildCare) => (care === 'wechsel' ? 'Wechselmodell 50 : 50' : `lebt bei ${label(care)}`);

  // Einkommen & Kinder
  const ll = leitlinienFuer(input.options.leitlinien);
  const common = resolveCommonChildren(input, cfg);
  // Kranken-/Pflegeversicherung nicht familienversicherter minderjähriger Kinder im Residenzmodell: trägt der
  // Barunterhaltspflichtige zusätzlich; sein Einkommen wird darum bereinigt (Leitlinien NRW 11.1, BGH XII ZB 338/17)
  const kvResidenz = (p: ParentId) =>
    round2(sum(common.filter((c) => c.stage < 3 && c.care === otherParent(p)).map((c) => kvBeitrag(c.input))));
  const inc = {
    A: bereinigtesEinkommen(input.parents.A, jk, ll, kvResidenz('A')),
    B: bereinigtesEinkommen(input.parents.B, jk, ll, kvResidenz('B')),
  };
  const others = {
    A: resolveOtherChildren(input.parents.A.otherChildren, input.referenceDate),
    B: resolveOtherChildren(input.parents.B.otherChildren, input.referenceDate),
  };

  // Volljährige: Haftungsanteile beider Eltern (Vorwegabzug: vorläufiger Barunterhalt für Minderjährige)
  const adults = common.filter((c) => c.stage === 3);
  const adultVorweg: Record<ParentId, number> = { A: 0, B: 0 };
  for (const p of PARENTS) {
    const g = groupWithStufung(
      inc[p].bereinigt,
      common.length + others[p].length + Math.max(0, input.parents[p].weitereBerechtigte),
      cfg,
    ).group;
    adultVorweg[p] = round2(
      sum(common.filter((c) => c.stage < 3 && c.care === otherParent(p)).map((c) => commonMinorZahlbetrag(c, g, cfg))) +
        sum(
          others[p]
            .filter((o) => o.input.care === 'barunterhalt' && o.stage < 3)
            .map((o) => otherChildZahlbetrag(o, g, cfg)),
        ),
    );
  }
  const adultShares = computeAdultShares(adults, { A: inc.A.bereinigt, B: inc.B.bereinigt }, adultVorweg, cfg, {
    A: notwendigerSelbstbehalt(input.parents.A, cfg, ll),
    B: notwendigerSelbstbehalt(input.parents.B, cfg, ll),
  });

  const ctx: EngineContext = { input, cfg, inc, common, others, adultShares, label };

  // Teilberechnungen
  const all = new StepSections();
  all.add(
    2,
    { label: 'Betreuung je gemeinsamem Kind', heading: true },
    ...common.map((c) => ({
      label: `${c.input.label} (${AGE_STAGE_LABELS[c.stage]})`,
      value:
        c.stage === 3
          ? `volljährig – ${c.input.eigenerHaushalt ? 'eigener Haushalt' : careText(c.care)}${
              c.rang === 4 ? ' (Rang 4)' : ' (privilegiert, Rang 1)'
            }`
          : careText(c.care),
    })),
  );
  if (adultShares.length > 0) {
    all.add(5, { label: 'Volljährige gemeinsame Kinder – Haftungsquoten', heading: true });
    for (const a of adultShares) {
      all.add(
        5,
        {
          label: `${a.label}: Bedarf`,
          value: `${fmt(a.bedarf)} (${
            a.eigenerHaushalt
              ? `fester Bedarf bei eigenem Haushalt, darin ${fmt(cfg.wohnkostenanteilEigenerHaushalt)} Warmmiete`
              : `Gr. ${a.group}, Einkommen beider Eltern ${fmt(a.combinedIncome)}`
          }) − KG ${fmt(
            a.kindergeld,
          )}${a.krankenversicherung > 0 ? ` + Kranken-/Pflegeversicherung ${fmt(a.krankenversicherung)}` : ''}${
            a.ownIncomeNet > 0 ? ` − Eigeneinkommen ${fmt(a.ownIncomeNet)}` : ''
          }${
            a.kinderzuschlag > 0 ? ` − Kinderzuschlag ${fmt(a.kinderzuschlag)}` : ''
          } = ${fmt(a.restbedarf)}`,
        },
        {
          label: `${a.label}: Haftungsquote`,
          value: `${label('A')}: ${pct(a.quote.A)} (${fmt(a.share.A)}) · ${label('B')}: ${pct(a.quote.B)} (${fmt(a.share.B)})`,
          note: `Sockel: ${a.sockel}; verfügbar ${fmt(a.available.A)} / ${fmt(a.available.B)}${
            a.obergrenze.A !== null
              ? ` · höchstens nach eigenem Einkommen: ${fmt(a.obergrenze.A)} / ${fmt(a.obergrenze.B ?? 0)}`
              : ''
          }`,
        },
      );
      if (a.aboveTable) {
        issues.push({
          severity: 'warning',
          message: `Zusammengerechnetes Elterneinkommen für ${a.label} liegt über der Tabelle – Bedarf ggf. konkret ermitteln.`,
        });
      }
    }
  }

  const payments: ChildPayment[] = [];
  const barVorweg: Record<ParentId, number> = { A: 0, B: 0 };
  for (const p of PARENTS) {
    const r = calculateBarunterhalt(p, ctx);
    if (!r) continue;
    all.merge(r.sections);
    payments.push(...r.payments);
    issues.push(...r.issues);
    barVorweg[p] = rang1PaymentsOf(p, r.payments, ctx);
  }
  // KV/PV-Beitrag des Kindes zusätzlich zum Tabellenunterhalt (Residenzmodell)
  for (const c of common.filter((x) => x.stage < 3 && x.care !== 'wechsel' && kvBeitrag(x.input) > 0)) {
    const kv = kvBeitrag(c.input);
    const zahler = otherParent(c.care as ParentId);
    const z = payments.find((x) => x.childId === c.input.id && x.payer === zahler);
    if (z) {
      z.amount = round2(z.amount + kv);
      z.kv = kv;
      z.note = `${z.note ? `${z.note}; ` : ''}inkl. Kranken-/Pflegeversicherung ${fmt(kv)}`;
      all.add(4, {
        label: `${c.input.label}: Kranken-/Pflegeversicherung`,
        value: kv,
        money: true,
        note: `zusätzlich von ${label(zahler)} zu tragen (nicht im Tabellenbetrag, ${fundstelle(ll, '11.1')})`,
      });
    } else {
      issues.push({
        severity: 'warning',
        message: `${c.input.label}: Der Kranken-/Pflegeversicherungsbeitrag konnte keiner Zahlung zugeordnet werden (keine Leistungsfähigkeit?) – gesondert prüfen.`,
      });
    }
  }

  const w = calculateWechsel(ctx, barVorweg);
  if (w) {
    all.merge(w.sections);
    payments.push(...w.payments);
    issues.push(...w.issues);
  }

  // Volljährige ohne Zahlung (z. B. keine Leistungsfähigkeit) trotzdem aufführen
  for (const c of common) {
    if (!payments.some((p) => p.childId === c.input.id)) {
      payments.push({
        childId: c.input.id,
        label: c.input.label,
        stage: c.stage,
        care: c.care,
        payer: null,
        payee: null,
        amount: 0,
        note: 'kein Zahlungsanspruch ermittelt',
      });
    }
  }
  for (const p of payments) p.art = p.art ?? 'unterhalt';

  // Mehr- und Sonderbedarf (nach Haftungsquoten, nach Abzug des Kindesunterhalts)
  const mb = calculateMehrbedarf(ctx, payments);
  if (mb) {
    payments.push(...mb.payments);
    issues.push(...mb.issues);
  }
  // stabile Sortierung nach Kind, Unterhalt vor Mehrbedarf
  payments.sort(
    (a, b) =>
      common.findIndex((c) => c.input.id === a.childId) - common.findIndex((c) => c.input.id === b.childId) ||
      (a.art === 'mehrbedarf' ? 1 : 0) - (b.art === 'mehrbedarf' ? 1 : 0),
  );

  if (adults.length > 0) {
    issues.push({
      severity: 'warning',
      message:
        'Für volljährige Kinder haften beide Eltern anteilig für den Barunterhalt; die Zahlung steht dem Kind selbst zu.',
    });
  }

  // Ehegattenunterhalt (nachrangig, nach Abzug des Kindesunterhalts)
  const eh = calculateEhegatte(ctx, payments);
  if (eh) issues.push(...eh.issues);
  const summary = summarize(payments);
  if (eh?.ergebnis) {
    const f = summary.find((x) => x.payer === eh.ergebnis!.payer && x.payee === eh.ergebnis!.payee);
    if (f) f.amount = round2(f.amount + eh.ergebnis.amount);
    else summary.push({ payer: eh.ergebnis.payer, payee: eh.ergebnis.payee, amount: eh.ergebnis.amount });
  }
  const saldo = computeSaldo(summary);
  const inkl = [mb && mb.payments.length > 0 ? 'Mehrbedarf' : '', eh?.ergebnis ? 'Ehegattenunterhalt' : ''].filter(Boolean);
  all.add(6, { label: inkl.length > 0 ? `Gesamt monatlich (inkl. ${inkl.join(' und ')})` : 'Gesamt', heading: true });
  for (const f of summary) {
    all.add(6, {
      label: `${label(f.payer)} → ${f.payee === 'Kind' ? 'volljährige Kinder' : label(f.payee)}`,
      value: f.amount,
      money: true,
      emphasis: true,
    });
  }
  if (saldo) {
    all.add(6, {
      label: `Saldo bei Verrechnung: ${label(saldo.payer)} → ${label(saldo.payee as ParentId)}`,
      value: saldo.amount,
      money: true,
      emphasis: true,
      note: 'nur bei einvernehmlicher Verrechnung – die Ansprüche der Kinder bestehen rechtlich getrennt',
    });
  }

  const steps: CalculationStep[] = [
    incomeStep(input, inc),
    ...([2, 3, 4, 5, 6] as StepId[]).map((id) => ({ id, title: STEP_TITLES[id], lines: all.lines[id] })),
    ...(mb ? [mb.step] : []),
    ...(eh ? [eh.step] : []),
  ];

  return { issues, ok: true, payments, summary, saldo, steps, einmalig: mb?.einmalig ?? [], ehegatte: eh?.ergebnis ?? null };
}

/** Zahlungen nach Zahlungsrichtung zusammenfassen (brutto) */
export function summarize(payments: ChildPayment[]): PaymentFlow[] {
  const map = new Map<string, PaymentFlow>();
  for (const p of payments) {
    if (!p.payer || !p.payee || p.amount <= 0) continue;
    const key = `${p.payer}->${p.payee}`;
    const entry = map.get(key) ?? { payer: p.payer, payee: p.payee, amount: 0 };
    entry.amount = round2(entry.amount + p.amount);
    map.set(key, entry);
  }
  return [...map.values()];
}

/** Saldo, wenn beide Eltern einander zahlen (z. B. Geschwistertrennung oder gemischte Modelle) */
export function computeSaldo(summary: PaymentFlow[]): PaymentFlow | null {
  const ab = summary.find((f) => f.payer === 'A' && f.payee === 'B');
  const ba = summary.find((f) => f.payer === 'B' && f.payee === 'A');
  if (!ab || !ba) return null;
  const net = round2(ab.amount - ba.amount);
  if (net === 0) return { payer: 'A', payee: 'B', amount: 0 };
  return net > 0 ? { payer: 'A', payee: 'B', amount: net } : { payer: 'B', payee: 'A', amount: -net };
}

export { validateInput } from './validate';
export { bereinigtesEinkommen } from './income';
export * from './table';
export { fmt, pct } from './format';
