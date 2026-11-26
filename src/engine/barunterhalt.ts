import type { ChildPayment, ParentId } from '../types';
import { AGE_STAGE_LABELS } from '../types';
import { commonMinorZahlbetrag, kindeseinkommenText, otherChildZahlbetrag, type Rang } from './children';
import { StepSections, type EngineContext, type PartialResult } from './context';
import { fmt, pct } from './format';
import { notwendigerSelbstbehalt, giltAlsErwerbstaetig } from './income';
import { getGroup, groupWithStufung, kindergeldCredit, tableAmount } from './table';
import { otherParent, round2, sum } from './util';

/** Ein Unterhaltsberechtigter des barunterhaltspflichtigen Elternteils */
interface Claimant {
  key: string;
  label: string;
  rang: Rang;
  kind: 'zahlung' | 'haushalt' | 'wechsel' | 'weiteres' | 'weiteres-haushalt';
  /** gemeinsames Kind, für das tatsächlich gezahlt wird */
  commonChildId?: string;
  /** Zahlbetrag in Gruppe g */
  amountAt: (group: number) => number;
  /** Einsatzbetrag in der Mangelfallberechnung */
  einsatzbetrag: number;
}

const KIND_NOTE: Record<Claimant['kind'], string> = {
  zahlung: '',
  haushalt: 'gemeinsames Kind im eigenen Haushalt – fiktiv',
  wechsel: 'gemeinsames Kind im Wechselmodell – fiktiv',
  weiteres: 'weiteres Kind, Barunterhalt',
  'weiteres-haushalt': 'weiteres Kind im eigenen Haushalt – fiktiv',
};

/**
 * Barunterhaltsberechnung für einen Elternteil (Residenzmodell-Logik):
 * – zahlt für gemeinsame minderjährige Kinder, die beim anderen Elternteil leben,
 * – sowie seinen Haftungsanteil für volljährige gemeinsame Kinder.
 * Alle gleichrangigen Kinder (auch im eigenen Haushalt, im Wechselmodell oder aus
 * anderen Beziehungen) gehen in Stufung, Bedarfskontrolle und Mangelfall ein.
 *
 * Liefert null, wenn der Elternteil keinen Barunterhalt für gemeinsame Kinder schuldet.
 */
export function calculateBarunterhalt(payer: ParentId, ctx: EngineContext): PartialResult | null {
  const { input, cfg, inc, common, others, adultShares, label } = ctx;
  const recipient = otherParent(payer);
  const payerInput = input.parents[payer];
  const payerIncome = inc[payer].bereinigt;

  const paidMinors = common.filter((c) => c.stage < 3 && c.care === recipient);
  const ownMinors = common.filter((c) => c.stage < 3 && c.care === payer);
  const wechselMinors = common.filter((c) => c.stage < 3 && c.care === 'wechsel');
  const adultsPaid = adultShares.filter((a) => a.share[payer] > 0);
  if (paidMinors.length === 0 && adultsPaid.length === 0) return null;

  const s = new StepSections(`Barunterhalt ${label(payer)}`);
  const issues: PartialResult['issues'] = [];
  const includeFictive = input.options.haushaltskinderEinbeziehen;

  // ---------------------------------------------------------------- Schritt 2
  const payerOthers = others[payer];
  const anzahl = common.length + payerOthers.length + Math.max(0, payerInput.weitereBerechtigte);
  s.add(
    2,
    { label: 'Gemeinsame Kinder (alle Betreuungsformen)', value: common.length },
    { label: `Weitere Kinder von ${label(payer)}`, value: payerOthers.length },
    ...payerOthers.map((o) => ({
      label: `  ${o.input.label || 'Kind'} (${AGE_STAGE_LABELS[o.stage]}, Rang ${o.rang})`,
      value:
        o.input.care === 'haushalt'
          ? 'lebt im eigenen Haushalt (Naturalunterhalt)'
          : o.input.fixedPayment !== null
            ? `Barunterhalt, konkreter Zahlbetrag ${fmt(o.input.fixedPayment)}`
            : 'Barunterhalt nach Tabelle',
    })),
    { label: 'Weitere Berechtigte (z. B. Ehegatte)', value: Math.max(0, payerInput.weitereBerechtigte) },
    { label: 'Unterhaltsberechtigte insgesamt (für Stufung)', value: anzahl, emphasis: true },
  );

  // ---------------------------------------------------------------- Berechtigte
  const claimants: Claimant[] = [];
  for (const m of paidMinors) {
    claimants.push({
      key: `c-${m.input.id}`,
      label: m.input.label,
      rang: 1,
      kind: 'zahlung',
      commonChildId: m.input.id,
      amountAt: (g) => commonMinorZahlbetrag(m, g, cfg),
      einsatzbetrag: commonMinorZahlbetrag(m, 1, cfg),
    });
  }
  for (const a of adultsPaid) {
    const share = a.share[payer];
    claimants.push({
      key: `c-${a.childId}`,
      label: a.label,
      rang: a.rang,
      kind: 'zahlung',
      commonChildId: a.childId,
      amountAt: () => share,
      einsatzbetrag: share,
    });
  }
  if (includeFictive) {
    for (const [list, kind] of [
      [ownMinors, 'haushalt'],
      [wechselMinors, 'wechsel'],
    ] as const) {
      for (const m of list) {
        claimants.push({
          key: `f-${m.input.id}`,
          label: m.input.label,
          rang: 1,
          kind,
          amountAt: (g) => commonMinorZahlbetrag(m, g, cfg),
          einsatzbetrag: commonMinorZahlbetrag(m, 1, cfg),
        });
      }
    }
  }
  for (const o of payerOthers) {
    const imHaushalt = o.input.care === 'haushalt';
    if (imHaushalt && (!includeFictive || o.rang !== 1)) continue;
    claimants.push({
      key: `o-${o.input.id}`,
      label: o.input.label || 'weiteres Kind',
      rang: o.rang,
      kind: imHaushalt ? 'weiteres-haushalt' : 'weiteres',
      amountAt: (g) => otherChildZahlbetrag(o, g, cfg),
      einsatzbetrag: otherChildZahlbetrag(o, 1, cfg),
    });
  }
  const rang1 = claimants.filter((c) => c.rang === 1);
  const rang4 = claimants.filter((c) => c.rang === 4);

  // ---------------------------------------------------------------- Schritt 3
  const stufung = groupWithStufung(payerIncome, anzahl, cfg);
  if (stufung.base.aboveTable) {
    issues.push({
      severity: 'warning',
      message: `Das Einkommen von ${label(payer)} liegt über der höchsten Tabellengruppe – der Bedarf wäre konkret darzulegen; gerechnet wird mit Gruppe ${stufung.base.group}.`,
    });
  }
  s.add(
    3,
    { label: `Bereinigtes Einkommen ${label(payer)}`, value: payerIncome, money: true },
    { label: 'Einkommensgruppe laut Tabelle', value: `Gruppe ${stufung.base.group}` },
    {
      label: 'Zu-/Herabstufung',
      value:
        stufung.shift === 0
          ? 'keine (Standard: 2 Berechtigte)'
          : `${stufung.shift > 0 ? '+' : ''}${stufung.shift} Gruppe(n) bei ${anzahl} Berechtigten`,
    },
    { label: 'Gruppe nach Stufung', value: `Gruppe ${stufung.group}` },
  );

  let group = stufung.group;
  while (true) {
    const g = getGroup(group, cfg);
    const total = round2(sum(rang1.map((c) => c.amountAt(group))));
    const rest = round2(payerIncome - total);
    const bkb =
      !giltAlsErwerbstaetig(payerInput) && g.bedarfskontrollbetragNichtErwerbstaetig !== undefined
        ? g.bedarfskontrollbetragNichtErwerbstaetig
        : g.bedarfskontrollbetrag;
    const ok = rest >= bkb;
    s.add(3, {
      label: `Bedarfskontrolle Gruppe ${group}`,
      value: `${fmt(payerIncome)} − ${fmt(total)} = ${fmt(rest)} ${ok ? '≥' : '<'} ${fmt(bkb)}`,
      note: ok ? 'eingehalten' : group > 1 ? 'unterschritten → Herabstufung' : 'unterschritten (niedrigste Gruppe)',
    });
    if (ok || group === 1) break;
    group -= 1;
  }
  s.add(3, { label: 'Maßgebliche Gruppe', value: `Gruppe ${group}`, emphasis: true });

  // ---------------------------------------------------------------- Schritt 4
  for (const m of [...paidMinors, ...(includeFictive ? [...ownMinors, ...wechselMinors] : [])]) {
    const t = tableAmount(group, m.stage, cfg);
    const kg = kindergeldCredit(m.stage, cfg);
    s.add(4, {
      label: `${m.input.label} (${AGE_STAGE_LABELS[m.stage]})`,
      value: `${fmt(t)} − ½ KG ${fmt(kg)}${kindeseinkommenText(m, fmt)} = ${fmt(
        commonMinorZahlbetrag(m, group, cfg),
      )}`,
      note: m.care === recipient ? `zu zahlen (lebt bei ${label(recipient)})` : KIND_NOTE[m.care === 'wechsel' ? 'wechsel' : 'haushalt'],
    });
  }
  for (const a of adultsPaid) {
    s.add(4, {
      label: `${a.label} (volljährig)`,
      value: `Haftungsanteil ${label(payer)}: ${fmt(a.share[payer])}`,
      note: 'Bedarf und Quote siehe Schritt 5',
    });
  }
  for (const c of claimants.filter((x) => x.kind === 'weiteres' || x.kind === 'weiteres-haushalt')) {
    s.add(4, { label: c.label, value: fmt(c.amountAt(group)), note: KIND_NOTE[c.kind] });
  }

  // ---------------------------------------------------------------- Schritt 5
  const sb = notwendigerSelbstbehalt(payerInput, cfg);
  const amounts = new Map<string, number>(claimants.map((c) => [c.key, c.amountAt(group)]));
  const final = new Map<string, number>();
  const notes = new Map<string, string>();

  const sumRang1 = round2(sum(rang1.map((c) => amounts.get(c.key)!)));
  const rest1 = round2(payerIncome - sumRang1);
  s.add(
    5,
    { label: `Notwendiger Selbstbehalt ${label(payer)}`, value: sb, money: true },
    { label: 'Summe Zahlbeträge Rang 1 (alle gleichrangigen Kinder)', value: sumRang1, money: true },
    { label: 'Verbleibendes Einkommen', value: rest1, money: true },
  );

  if (rest1 >= sb || rang1.length === 0) {
    rang1.forEach((c) => final.set(c.key, amounts.get(c.key)!));
    s.add(5, { label: 'Selbstbehaltsprüfung', value: 'gewahrt – kein Mangelfall', emphasis: true });
  } else {
    const masse = round2(Math.max(0, payerIncome - sb));
    const sumEinsatz = round2(sum(rang1.map((c) => c.einsatzbetrag)));
    const quote = sumEinsatz > 0 ? Math.min(1, masse / sumEinsatz) : 0;
    s.add(
      5,
      { label: 'Mangelfall', value: 'Selbstbehalt unterschritten', emphasis: true },
      { label: 'Verteilungsmasse (Einkommen − Selbstbehalt)', value: masse, money: true },
      { label: 'Summe Einsatzbeträge', value: sumEinsatz, money: true },
      { label: 'Mangelfallquote', value: pct(quote), emphasis: true },
    );
    for (const c of rang1) {
      const v = round2(c.einsatzbetrag * quote);
      final.set(c.key, v);
      notes.set(c.key, `Mangelfall: ${pct(quote)} von ${fmt(c.einsatzbetrag)}`);
      s.add(5, {
        label: `  ${c.label}`,
        value: `${fmt(c.einsatzbetrag)} × ${pct(quote)} = ${fmt(v)}`,
        note: KIND_NOTE[c.kind] || undefined,
      });
    }
  }

  // Rang 4 (sonstige Volljährige) nur aus Einkommen oberhalb des angemessenen Selbstbehalts
  if (rang4.length > 0) {
    const used = round2(sum(rang1.map((c) => final.get(c.key)!)));
    const avail4 = round2(Math.max(0, payerIncome - used - cfg.selbstbehalt.angemessen));
    const claim4 = round2(sum(rang4.map((c) => amounts.get(c.key)!)));
    const q4 = claim4 > 0 ? Math.min(1, avail4 / claim4) : 0;
    s.add(
      5,
      { label: 'Nachrangige volljährige Kinder (Rang 4)', value: claim4, money: true },
      {
        label: `Verfügbar über angemessenem Selbstbehalt (${fmt(cfg.selbstbehalt.angemessen)})`,
        value: avail4,
        money: true,
      },
      { label: 'Quote Rang 4', value: pct(q4) },
    );
    for (const c of rang4) {
      final.set(c.key, round2(amounts.get(c.key)! * q4));
      if (q4 < 1) notes.set(c.key, `nachrangig – gekürzt auf ${pct(q4)}`);
    }
  }

  // ---------------------------------------------------------------- Schritt 6
  const payments: ChildPayment[] = [];
  for (const c of claimants.filter((x) => x.kind === 'zahlung')) {
    const child = common.find((x) => x.input.id === c.commonChildId)!;
    const amount = final.get(c.key) ?? 0;
    const isAdult = child.stage === 3;
    const livesWithPayer = isAdult && child.care === payer && !child.input.eigenerHaushalt;
    const note =
      [notes.get(c.key), livesWithPayer ? 'Kind lebt im Haushalt – kann als Naturalleistung erbracht werden' : '']
        .filter(Boolean)
        .join(' · ') || undefined;
    payments.push({
      childId: child.input.id,
      label: child.input.label,
      stage: child.stage,
      care: child.care,
      payer: amount > 0 ? payer : null,
      payee: amount > 0 ? (isAdult ? 'Kind' : recipient) : null,
      amount,
      note,
    });
    s.add(6, {
      label: `${child.input.label}: ${label(payer)} → ${isAdult ? 'Kind' : label(recipient)}`,
      value: amount,
      money: true,
      note,
    });
  }
  for (const c of claimants.filter((x) => x.kind !== 'zahlung')) {
    s.add(6, {
      label: `  ${c.label}`,
      value: final.get(c.key) ?? 0,
      money: true,
      note: `${KIND_NOTE[c.kind]}${c.kind === 'weiteres' ? ' – Zahlung außerhalb dieser Berechnung' : ''}`,
    });
  }

  return { sections: s, payments, issues };
}

/** Summe der tatsächlichen gleichrangigen (Rang 1) Zahlungen eines Elternteils für gemeinsame Kinder */
export function rang1PaymentsOf(payer: ParentId, payments: ChildPayment[], ctx: EngineContext): number {
  return round2(
    sum(
      payments
        .filter((p) => p.payer === payer)
        .filter((p) => ctx.common.find((c) => c.input.id === p.childId)?.rang === 1)
        .map((p) => p.amount),
    ),
  );
}

