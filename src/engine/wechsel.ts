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
 * Haftung nach Einkommen über dem angemessenen Selbstbehalt, je Elternteil höchstens der Tabellenbetrag
 * nach dem eigenen Einkommen (BGH XII ZB 565/15 Rn. 26 f.);
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
  // Wohnmehrbedarf: tatsächliche Wohnkosten des Kindes in beiden Haushalten, soweit sie den im
  // Tabellenbetrag enthaltenen Wohnanteil übersteigen (BGH XII ZB 565/15 – Mehrbedarf im Wechselmodell)
  const bedarf = new Map<string, number>();
  const wohnen = new Map<string, { A: number; B: number; summe: number; mehrbedarf: number }>();
  const mehrkosten = new Map<string, number>();
  for (const m of minors) {
    const t = tableAmount(group, m.stage, cfg);
    const mk = Math.max(0, m.input.wechselMehrkosten);
    const own = minorOwnIncomeCredit(m);
    const wA = Math.max(0, m.input.wechselWohnkosten?.A ?? 0);
    const wB = Math.max(0, m.input.wechselWohnkosten?.B ?? 0);
    const summe = round2(wA + wB);
    const imTabellenbetrag = round2(t * cfg.wohnkostenanteilTabelle);
    const wohnMehr = summe > 0 ? round2(Math.max(0, summe - imTabellenbetrag)) : 0;
    wohnen.set(m.input.id, { A: wA, B: wB, summe, mehrbedarf: wohnMehr });
    mehrkosten.set(m.input.id, round2(mk + wohnMehr));
    const b = round2(Math.max(0, t + wohnMehr + mk - own));
    bedarf.set(m.input.id, b);
    if (summe > 0) {
      s.add(4, {
        label: `${m.input.label}: Wohnmehrbedarf`,
        value: `Wohnkosten ${fmt(wA)} + ${fmt(wB)} = ${fmt(summe)} − Wohnanteil im Tabellenbetrag ${fmt(imTabellenbetrag)} = ${fmt(wohnMehr)}`,
        note: `Wohnanteil ${Math.round(cfg.wohnkostenanteilTabelle * 100)} % von ${fmt(t)} (Faustwert)`,
      });
    }
    s.add(4, {
      label: `${m.input.label} (${AGE_STAGE_LABELS[m.stage]})`,
      value: `Tabelle ${fmt(t)}${wohnMehr > 0 ? ` + Wohnmehrbedarf ${fmt(wohnMehr)}` : ''}${
        mk > 0 ? ` + Mehrkosten ${fmt(mk)}` : ''
      }${own > 0 ? ` − ½ Eigeneinkommen ${fmt(own)}` : ''} = ${fmt(b)}`,
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

  // Haftungsanteile je Kind, begrenzt auf den Tabellenbedarf nach dem eigenen Einkommen
  // (BGH XII ZB 565/15 Rn. 26 f.: Haftung höchstens wie bei alleiniger Unterhaltshaftung)
  const stufungsAnzahl = input.options.wechselStufung ? common.length : 2;
  const eigeneGruppe: Record<ParentId, number> = {
    A: groupWithStufung(adjusted.A, stufungsAnzahl, cfg).group,
    B: groupWithStufung(adjusted.B, stufungsAnzahl, cfg).group,
  };
  const shares = new Map<string, Record<ParentId, { anteil: number; ungekappt: number; grenze: number }>>();
  const totalShare: Record<ParentId, number> = { A: 0, B: 0 };
  for (const m of minors) {
    const b = bedarf.get(m.input.id)!;
    const mk = mehrkosten.get(m.input.id)!;
    const own = minorOwnIncomeCredit(m);
    const entry = {} as Record<ParentId, { anteil: number; ungekappt: number; grenze: number }>;
    for (const p of PARENTS) {
      const ungekappt = round2(b * quote[p]);
      // Grenze: eigener Tabellenbetrag zzgl. Quotenanteil an (Wohn-)Mehrkosten abzgl. Quotenanteil am Kindeseinkommen
      const grenze = round2(Math.max(0, tableAmount(eigeneGruppe[p], m.stage, cfg) + (mk - own) * quote[p]));
      entry[p] = { anteil: Math.min(ungekappt, grenze), ungekappt, grenze };
      totalShare[p] += entry[p].anteil;
    }
    shares.set(m.input.id, entry);
    for (const p of PARENTS) {
      if (entry[p].anteil < entry[p].ungekappt) {
        s.add(5, {
          label: `${m.input.label}: Haftungsanteil ${label(p)} begrenzt`,
          value: `${fmt(entry[p].ungekappt)} → ${fmt(entry[p].anteil)}`,
          note: `höchstens Tabellenbetrag nach eigenem Einkommen (Gruppe ${eigeneGruppe[p]})`,
        });
      }
    }
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
    const { A: sa, B: sb } = shares.get(m.input.id)!;
    const shareA = sa.anteil;
    const shareB = sb.anteil;
    // Naturalleistung je Elternteil: eigene Wohnkosten des Kindes + Hälfte des übrigen Bedarfs.
    // Ohne Wohnkosten: jeder deckt die Hälfte in natura, Ausgleich = halbe Differenz der Haftungsanteile.
    const w = wohnen.get(m.input.id)!;
    const gedeckt = round2(shareA + shareB);
    const uebrig = round2(Math.max(0, gedeckt - w.summe));
    const natura: Record<ParentId, number> = { A: round2(w.A + uebrig / 2), B: round2(w.B + uebrig / 2) };
    const barAtoB = round2((shareA - natura.A - (shareB - natura.B)) / 2);
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
        note: sa.anteil < sa.ungekappt || sb.anteil < sb.ungekappt ? 'nach Begrenzung auf den eigenen Tabellenbetrag' : undefined,
      },
      ...(w.summe > 0
        ? [
            {
              label: '  Leistung in natura',
              value: `${label('A')} ${fmt(natura.A)} · ${label('B')} ${fmt(natura.B)}`,
              note: `eigene Wohnkosten des Kindes + ½ des übrigen Bedarfs (${fmt(uebrig)})`,
            },
          ]
        : []),
      {
        label: w.summe > 0 ? '  Barunterhaltsausgleich (Anteil − Leistung in natura)' : '  Barunterhaltsausgleich (½ Differenz)',
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
