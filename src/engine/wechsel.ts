import type { ChildPayment, ParentId } from '../types';
import { AGE_STAGE_LABELS } from '../types';
import { minorOwnIncomeCredit, otherChildZahlbetrag } from './children';
import { StepSections, type EngineContext, type PartialResult } from './context';
import { fmt, pct } from './format';
import { notwendigerSelbstbehalt } from './income';
import { getGroup, groupWithStufung, tableAmount } from './table';
import { round2 } from './util';

const PARENTS: ParentId[] = ['A', 'B'];

/**
 * Paritätisches Wechselmodell für alle minderjährigen gemeinsamen Kinder mit Betreuung 'wechsel'
 * (BGH XII ZB 234/13, XII ZB 45/16):
 * Bedarf nach dem zusammengerechneten, um Vorwegabzüge bereinigten Einkommen zzgl. Mehrkosten;
 * Haftung nach Einkommen über dem angemessenen Selbstbehalt;
 * Kindergeld: Barunterhaltsanteil (½) nach Haftungsquote, Betreuungsanteil (½) hälftig.
 *
 * @param barunterhaltVorweg Barunterhalt, den jeder Elternteil bereits für gemeinsame Kinder
 *        im Residenzmodell zahlt (gleichrangige Verpflichtung → Vorwegabzug)
 */
export function calculateWechsel(
  ctx: EngineContext,
  barunterhaltVorweg: Record<ParentId, number>,
): PartialResult | null {
  const { input, cfg, inc, common, others, label } = ctx;
  const minors = common.filter((c) => c.stage < 3 && c.care === 'wechsel');
  if (minors.length === 0) return null;

  const s = new StepSections('Wechselmodell');
  const issues: PartialResult['issues'] = [];

  // ---------------------------------------------------------------- Schritt 2: Vorwegabzüge
  const vorweg: Record<ParentId, number> = { A: 0, B: 0 };
  const adjusted: Record<ParentId, number> = { A: 0, B: 0 };
  for (const p of PARENTS) {
    const own = groupWithStufung(
      inc[p].bereinigt,
      common.length + others[p].length + Math.max(0, input.parents[p].weitereBerechtigte),
      cfg,
    );
    s.add(2, {
      label: `${label(p)}: eigene Einkommensgruppe für weitere Kinder`,
      value: `Gruppe ${own.group}${own.shift !== 0 ? ` (Stufung ${own.shift > 0 ? '+' : ''}${own.shift})` : ''}`,
    });
    if (barunterhaltVorweg[p] > 0) {
      vorweg[p] += barunterhaltVorweg[p];
      s.add(2, {
        label: '  Barunterhalt für gemeinsame Kinder (Residenzmodell)',
        value: barunterhaltVorweg[p],
        money: true,
        note: 'gleichrangige Verpflichtung – siehe Barunterhaltsberechnung',
      });
    }
    for (const o of others[p]) {
      const name = o.input.label || 'weiteres Kind';
      if (o.rang !== 1) {
        s.add(2, { label: `  ${name} (${AGE_STAGE_LABELS[o.stage]})`, value: 'nachrangig (Rang 4) – kein Vorwegabzug' });
        continue;
      }
      if (o.input.care === 'haushalt' && !input.options.wechselNaturalunterhaltAbzug) {
        s.add(2, {
          label: `  ${name} (${AGE_STAGE_LABELS[o.stage]})`,
          value: 'im Haushalt – kein Abzug (Option deaktiviert)',
        });
        continue;
      }
      const amount = otherChildZahlbetrag(o, own.group, cfg);
      vorweg[p] += amount;
      s.add(2, {
        label: `  ${name} (${AGE_STAGE_LABELS[o.stage]})`,
        value: amount,
        money: true,
        note:
          o.input.care === 'haushalt'
            ? 'fiktiver Naturalunterhalt (Kind im eigenen Haushalt)'
            : o.input.fixedPayment !== null
              ? 'konkreter Zahlbetrag'
              : 'Zahlbetrag nach Tabelle',
      });
    }
    vorweg[p] = round2(vorweg[p]);
    adjusted[p] = round2(Math.max(0, inc[p].bereinigt - vorweg[p]));
    s.add(
      2,
      { label: `${label(p)}: Vorwegabzug gesamt`, value: vorweg[p], money: true },
      { label: `${label(p)}: Einkommen nach Vorwegabzug`, value: adjusted[p], money: true, emphasis: true },
    );
  }

  // ---------------------------------------------------------------- Schritt 3: Gesamteinkommen
  const combined = round2(adjusted.A + adjusted.B);
  const st = groupWithStufung(combined, input.options.wechselStufung ? common.length : 2, cfg);
  const group = st.group;
  if (st.base.aboveTable) {
    issues.push({
      severity: 'warning',
      message: 'Das zusammengerechnete Einkommen liegt über der Tabelle – der Bedarf wäre konkret darzulegen.',
    });
  }
  s.add(
    3,
    { label: 'Gesamteinkommen beider Eltern', value: combined, money: true },
    { label: 'Einkommensgruppe laut Tabelle', value: `Gruppe ${st.base.group}` },
    {
      label: 'Zu-/Herabstufung',
      value: input.options.wechselStufung
        ? st.shift === 0
          ? 'keine'
          : `${st.shift > 0 ? '+' : ''}${st.shift} Gruppe(n)`
        : 'nicht angewandt (Option deaktiviert)',
    },
    {
      label: 'Maßgebliche Gruppe',
      value: `Gruppe ${group} (${getGroup(group, cfg).percent} % des Mindestbedarfs)`,
      emphasis: true,
    },
    { label: 'Bedarfskontrollbetrag', value: 'im Wechselmodell nicht anwendbar (Bedarf aus Gesamteinkommen)' },
  );

  // ---------------------------------------------------------------- Schritt 4: Bedarf
  const bedarf = new Map<string, number>();
  for (const m of minors) {
    const t = tableAmount(group, m.stage, cfg);
    const mk = Math.max(0, m.input.wechselMehrkosten);
    const own = minorOwnIncomeCredit(m);
    const b = round2(Math.max(0, t + mk - own));
    bedarf.set(m.input.id, b);
    s.add(4, {
      label: `${m.input.label} (${AGE_STAGE_LABELS[m.stage]})`,
      value: `Tabelle ${fmt(t)}${mk > 0 ? ` + Mehrkosten ${fmt(mk)}` : ''}${
        own > 0 ? ` − ½ Eigeneinkommen ${fmt(own)}` : ''
      } = ${fmt(b)}`,
    });
  }
  s.add(4, {
    label: 'Aufteilung Kindergeld',
    value: `½ Barunterhaltsanteil (${fmt(cfg.kindergeld / 2)}) nach Haftungsquote, ½ Betreuungsanteil (${fmt(
      cfg.kindergeld / 2,
    )}) hälftig`,
  });

  // ---------------------------------------------------------------- Schritt 5: Quoten
  const avail: Record<ParentId, number> = {
    A: round2(Math.max(0, adjusted.A - cfg.selbstbehalt.angemessen)),
    B: round2(Math.max(0, adjusted.B - cfg.selbstbehalt.angemessen)),
  };
  const totalAvail = avail.A + avail.B;
  let quote: Record<ParentId, number>;
  if (totalAvail > 0) {
    quote = { A: avail.A / totalAvail, B: avail.B / totalAvail };
  } else {
    quote = { A: 0.5, B: 0.5 };
    issues.push({
      severity: 'warning',
      message:
        'Wechselmodell: Beide Eltern liegen unter dem angemessenen Selbstbehalt – Haftungsquote hilfsweise 50 : 50. Leistungsfähigkeit gesondert prüfen.',
    });
  }
  for (const p of PARENTS) {
    s.add(5, {
      label: `${label(p)}: ${fmt(adjusted[p])} − angemessener Selbstbehalt ${fmt(cfg.selbstbehalt.angemessen)}`,
      value: avail[p],
      money: true,
    });
  }
  s.add(5, {
    label: 'Haftungsquoten',
    value: `${label('A')} ${pct(quote.A)} · ${label('B')} ${pct(quote.B)}`,
    emphasis: true,
  });

  const totalShare: Record<ParentId, number> = { A: 0, B: 0 };
  for (const m of minors) {
    const b = bedarf.get(m.input.id)!;
    totalShare.A += b * quote.A;
    totalShare.B += b * quote.B;
  }
  for (const p of PARENTS) {
    const sb = notwendigerSelbstbehalt(input.parents[p], cfg);
    const rest = round2(adjusted[p] - totalShare[p]);
    const ok = rest >= sb;
    s.add(5, {
      label: `Selbstbehaltsprüfung ${label(p)}`,
      value: `${fmt(adjusted[p])} − Haftungsanteil ${fmt(round2(totalShare[p]))} = ${fmt(rest)} ${ok ? '≥' : '<'} ${fmt(sb)}`,
      note: ok ? 'gewahrt' : 'unterschritten',
    });
    if (!ok) {
      issues.push({
        severity: 'warning',
        message: `Wechselmodell: Selbstbehalt von ${label(p)} wäre beim Haftungsanteil unterschritten – Leistungsfähigkeit und ggf. Mangelfall gesondert prüfen.`,
      });
    }
  }

  // ---------------------------------------------------------------- Schritt 6: Spitzenausgleich
  const payments: ChildPayment[] = [];
  let netAtoB = 0;
  for (const m of minors) {
    const b = bedarf.get(m.input.id)!;
    const shareA = round2(b * quote.A);
    const shareB = round2(b * quote.B);
    // Barunterhalt: jeder deckt die Hälfte in natura, Ausgleich = halbe Differenz
    const barAtoB = round2((shareA - shareB) / 2);
    // Kindergeld: Empfänger gibt dem anderen dessen Anteil heraus
    const kgRecipient = m.input.kindergeldRecipient;
    const nonRecipient: ParentId = kgRecipient === 'A' ? 'B' : 'A';
    const kgOwed = round2((cfg.kindergeld / 2) * quote[nonRecipient] + cfg.kindergeld / 4);
    const kgAtoB = kgRecipient === 'A' ? kgOwed : -kgOwed;
    const net = round2(barAtoB + kgAtoB);
    netAtoB += net;

    const payer: ParentId | null = net > 0 ? 'A' : net < 0 ? 'B' : null;
    const payee: ParentId | null = payer ? (payer === 'A' ? 'B' : 'A') : null;
    payments.push({
      childId: m.input.id,
      label: m.input.label,
      stage: m.stage,
      care: 'wechsel',
      payer,
      payee,
      amount: Math.abs(net),
      note: `Spitzenausgleich: Barausgleich ${fmt(Math.abs(barAtoB))}, Kindergeldausgleich ${fmt(kgOwed)}`,
    });
    s.add(
      6,
      {
        label: `${m.input.label}: Haftungsanteile`,
        value: `${label('A')} ${fmt(shareA)} · ${label('B')} ${fmt(shareB)}`,
      },
      {
        label: '  Barunterhaltsausgleich (½ Differenz)',
        value: `${fmt(Math.abs(barAtoB))} ${barAtoB >= 0 ? `${label('A')} → ${label('B')}` : `${label('B')} → ${label('A')}`}`,
      },
      {
        label: `  Kindergeldausgleich (Empfänger ${label(kgRecipient)})`,
        value: `${fmt(kgOwed)} ${label(kgRecipient)} → ${label(nonRecipient)}`,
        note: `½ KG × Quote ${pct(quote[nonRecipient])} + ¼ KG Betreuungsanteil`,
      },
      {
        label: '  Spitzenausgleich',
        value: payer ? `${fmt(Math.abs(net))} ${label(payer)} → ${label(payee!)}` : 'kein Ausgleich',
        emphasis: true,
      },
    );
  }
  netAtoB = round2(netAtoB);
  if (minors.length > 1) {
    s.add(6, {
      label: 'Spitzenausgleich Wechselmodell gesamt',
      value:
        netAtoB === 0
          ? 'kein Ausgleich'
          : `${fmt(Math.abs(netAtoB))} ${netAtoB > 0 ? `${label('A')} → ${label('B')}` : `${label('B')} → ${label('A')}`}`,
      emphasis: true,
    });
  }

  return { sections: s, payments, issues };
}
