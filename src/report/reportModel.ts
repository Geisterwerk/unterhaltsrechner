import { getJahresKonfiguration } from '../config';
import { fmt } from '../engine';
import { resolveTarif } from '../engine/tarif';
import type {
  AgeInput,
  CalculationInput,
  CalculationResult,
  ChildCare,
  JahresKonfiguration,
  ParentId,
  ParentInput,
  Payee,
  StepLine,
} from '../types';
import { AGE_STAGE_LABELS } from '../types';

/**
 * Inhalt des PDF-Berichts – unabhängig von der PDF-Bibliothek, damit er testbar bleibt.
 */

export type KeyValue = [string, string];

export interface ReportSection {
  titel: string;
  zeilen: KeyValue[];
}

export interface ReportStep {
  titel: string;
  zeilen: { label: string; wert: string; hinweis?: string; betont?: boolean; ueberschrift?: boolean }[];
}

export interface ReportModel {
  titel: string;
  erstelltAm: string;
  stichtag: string;
  jahr: number;
  /** nicht leer, wenn das Berechnungsjahr vorläufige Werte enthält */
  vorlaeufig: string[];
  rechtlicherHinweis: string;
  ergebnis: {
    ok: boolean;
    zusammenfassung: string[];
    saldo?: string;
    zahlungen: { kind: string; alter: string; betreuung: string; zahlung: string; betrag: string; hinweis: string }[];
    einmalig: { posten: string; zahlung: string; betrag: string; hinweis: string }[];
    ehegatte?: string;
    fehler: string[];
  };
  hinweise: string[];
  eingaben: ReportSection[];
  rechenweg: ReportStep[];
  grundlagen: string[];
}

export const RECHTLICHER_HINWEIS =
  'Die Berechnung ist eine unverbindliche Orientierung auf Basis vereinfachter Annahmen. Sie ersetzt keine ' +
  'familienrechtliche Beratung im Einzelfall und ist nicht für rechtsverbindliche Entscheidungen bestimmt. ' +
  'Abweichende Leitlinien der Oberlandesgerichte sowie Besonderheiten des Einzelfalls (z. B. ' +
  'Erwerbsobliegenheit, fiktives Einkommen, konkrete Bedarfsermittlung) bleiben unberücksichtigt. Die Ergebnisse sind vor einer ' +
  'Weiterverwendung fachlich zu prüfen.';

const datum = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('.') : iso);
const pct = (v: number) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;

function careText(care: ChildCare, parents: Record<ParentId, ParentInput>): string {
  return care === 'wechsel' ? 'Wechselmodell 50 : 50' : `lebt bei ${parents[care].label}`;
}

function ageText(age: AgeInput): string {
  return age.kind === 'stage' ? AGE_STAGE_LABELS[age.stage] : `geb. ${datum(age.birthdate)}`;
}

function payeeText(p: Payee, parents: Record<ParentId, ParentInput>): string {
  return p === 'Kind' ? 'das Kind' : parents[p].label;
}

function stepValue(l: StepLine): string {
  if (l.value === undefined) return '';
  return l.money && typeof l.value === 'number' ? fmt(l.value) : String(l.value);
}

function parentSection(p: ParentId, input: CalculationInput, jk: JahresKonfiguration): ReportSection {
  const activeTarife = jk.tarife;
  const activeKrankenkassen = jk.krankenkassen;
  const activeZusatzversorgung = jk.zusatzversorgung;
  const parent = input.parents[p];
  const z: KeyValue[] = [];
  z.push(['Erwerbsstatus', parent.employed ? 'erwerbstätig' : 'nicht erwerbstätig']);
  if (parent.incomeMode === 'netto') {
    z.push(['Nettoeinkommen (monatlich)', fmt(parent.netIncome)]);
  } else {
    const g = parent.gross;
    if (g.quelle === 'tarif') {
      const t = resolveTarif(g, activeTarife);
      z.push([
        'Bruttolohn aus Tarif',
        t
          ? `${t.tabelle.name}, ${t.gruppe.id}, ${t.tabelle.stufenLabel} ${t.stufe}, ${pct(t.arbeitszeit)} Arbeitszeit`
          : 'ungültige Tarifauswahl',
      ]);
      if (t && t.zulagen.length > 0) z.push(['Zulagen', t.zulagen.map((x) => `${x.name} ${fmt(x.betrag)}`).join(', ')]);
      if (t) z.push(['Jahressonderzahlung', g.tarif.jahressonderzahlung ? `${pct(t.jahressonderzahlungProzent)} eingerechnet` : 'nicht eingerechnet']);
    } else {
      const tz = (g.arbeitszeit ?? 100) < 100;
      z.push([tz ? 'Bruttolohn bei Vollzeit (monatlich)' : 'Bruttolohn (monatlich)', fmt(g.bruttoMonatlich)]);
      if (g.sonderzahlungenJahr > 0) z.push([tz ? 'Sonderzahlungen bei Vollzeit (Jahr)' : 'Sonderzahlungen (Jahr)', fmt(g.sonderzahlungenJahr)]);
      if (tz) z.push(['Arbeitszeit', pct(g.arbeitszeit)]);
    }
    z.push(['Steuerklasse', ['I', 'II', 'III', 'IV', 'V', 'VI'][g.steuerklasse - 1]]);
    z.push(['Kirchensteuer', g.kirchensteuerSatz === 0 ? 'keine' : pct(g.kirchensteuerSatz)]);
    z.push(['Kinderfreibeträge', String(g.kinderfreibetraege).replace('.', ',')]);
    z.push(['Kinder unter 25 (Pflegeversicherung)', String(g.pvKinder)]);
    const kasse = activeKrankenkassen.kassen.find((k) => k.id === g.krankenkasse);
    z.push([
      'Krankenkasse / Zusatzbeitrag',
      `${kasse ? kasse.name : g.krankenkasse === 'durchschnitt' ? 'Durchschnitt' : 'andere Kasse'} – ${pct(g.kvZusatzbeitrag)}`,
    ]);
    const zv = g.zusatzversorgung;
    const zvKasse = activeZusatzversorgung.kassen.find((k) => k.id === zv.kasse);
    z.push([
      'Zusatzversorgung',
      zv.kasse === 'keine'
        ? 'keine'
        : `${zvKasse ? zvKasse.name : 'andere Kasse'} – AN ${pct(zv.anProzent)}${zv.anSteuerfrei ? ' (steuerfrei)' : ''}`,
    ]);
  }
  const d = parent.deductions;
  z.push([
    'Berufsbedingte Aufwendungen',
    d.berufsbedingtMode === 'pauschal' ? '5 %-Pauschale' : d.berufsbedingtMode === 'konkret' ? fmt(d.berufsbedingtKonkret) : 'keine',
  ]);
  if ((d.wohnvorteil ?? 0) > 0) z.push(['Wohnvorteil', fmt(d.wohnvorteil)]);
  if (d.altersvorsorge > 0) z.push(['Altersvorsorge (angegeben)', fmt(d.altersvorsorge)]);
  if (d.schulden > 0) z.push(['Berücksichtigungsfähige Schulden', fmt(d.schulden)]);
  if (d.sonstige > 0) z.push(['Sonstige Abzüge', fmt(d.sonstige)]);
  if (parent.weitereBerechtigte > 0) z.push(['Weitere Berechtigte (z. B. Ehegatte)', String(parent.weitereBerechtigte)]);
  parent.otherChildren.forEach((c, i) => {
    z.push([
      `Weiteres Kind ${i + 1}: ${c.label || '–'}`,
      `${ageText(c.age)}, ${c.care === 'haushalt' ? 'lebt im eigenen Haushalt' : 'Barunterhalt'}${
        c.care === 'barunterhalt' && c.fixedPayment !== null ? ` (Zahlbetrag ${fmt(c.fixedPayment)})` : ''
      }${c.age.kind === 'stage' && c.age.stage === 3 ? `, ${c.adultRank === 'privilegiert' ? 'privilegiert' : 'sonstig'} volljährig` : ''}`,
    ]);
  });
  return { titel: parent.label, zeilen: z };
}

export function buildReportModel(
  input: CalculationInput,
  result: CalculationResult,
  erstelltAm: Date = new Date(),
): ReportModel {
  const jk = getJahresKonfiguration(input.jahr);
  const activeTable = jk.tabelle;
  const activeLohnsteuer = jk.lohnsteuer;
  const activeTarife = jk.tarife;
  const parents = input.parents;
  const errors = result.issues.filter((i) => i.severity === 'error').map((i) => i.message);
  const warnings = result.issues.filter((i) => i.severity === 'warning').map((i) => i.message);

  const zusammenfassung = result.ok
    ? result.summary.length === 0
      ? ['Es ergibt sich keine Zahlungspflicht.']
      : result.summary.map((s) => `${parents[s.payer].label} zahlt an ${payeeText(s.payee, parents)}: ${fmt(s.amount)} monatlich`)
    : [];

  const saldo =
    result.saldo && result.ok
      ? result.saldo.amount === 0
        ? 'Saldo bei Verrechnung: beide Zahlungen heben sich auf.'
        : `Saldo bei Verrechnung: ${parents[result.saldo.payer].label} an ${payeeText(result.saldo.payee, parents)} ${fmt(
            result.saldo.amount,
          )} (nur einvernehmlich – die Ansprüche stehen den Kindern getrennt zu).`
      : undefined;

  const eigenerHaushalt = (childId: string) => !!input.children.find((c) => c.id === childId)?.eigenerHaushalt;
  const zahlungen = result.payments.map((p) => ({
    kind: p.label,
    alter: AGE_STAGE_LABELS[p.stage],
    betreuung: p.stage === 3 && eigenerHaushalt(p.childId) ? 'eigener Haushalt' : careText(p.care, parents),
    zahlung: p.payer && p.payee ? `${parents[p.payer].label} an ${payeeText(p.payee, parents)}` : '–',
    betrag: fmt(p.amount),
    hinweis: p.note ?? '',
  }));

  const kinder: ReportSection = {
    titel: 'Gemeinsame Kinder',
    zeilen: input.children.map((c) => [
      c.label,
      [
        ageText(c.age),
        careText(c.care, parents),
        `Kindergeld: ${parents[c.kindergeldRecipient].label}`,
        c.ownIncome > 0 ? `eigenes Einkommen ${fmt(c.ownIncome)}` : '',
        c.age.kind === 'stage' && c.age.stage === 3 ? `${c.adultRank === 'privilegiert' ? 'privilegiert' : 'sonstig'} volljährig` : '',
        c.eigenerHaushalt ? 'eigener Haushalt' : '',
        ...(c.bedarfsposten ?? [])
          .filter((b) => b.betrag > 0)
          .map(
            (b) =>
              `${b.art === 'mehrbedarf' ? 'Mehrbedarf' : 'Sonderbedarf'} ${b.bezeichnung || ''} ${fmt(b.betrag)}${
                b.art === 'mehrbedarf' ? '/Monat' : ' einmalig'
              } (bezahlt von ${parents[b.verauslagt].label})`,
          ),
        c.care === 'wechsel' && ((c.wechselWohnkosten?.A ?? 0) > 0 || (c.wechselWohnkosten?.B ?? 0) > 0)
          ? `Wohnkosten ${parents.A.label} ${fmt(c.wechselWohnkosten.A)} / ${parents.B.label} ${fmt(c.wechselWohnkosten.B)}`
          : '',
        c.care === 'wechsel' && c.wechselMehrkosten > 0 ? `Mehrkosten ${fmt(c.wechselMehrkosten)}` : '',
        (c.kinderzuschlag ?? 0) > 0 ? `Kinderzuschlag ${fmt(c.kinderzuschlag)}` : '',
      ]
        .filter(Boolean)
        .join(', '),
    ]),
  };

  const o = input.options;
  const optionen: ReportSection = {
    titel: 'Berechnungsoptionen',
    zeilen: [
      ['Berechnungsjahr', `${jk.jahr}${jk.status === 'vorlaeufig' ? ' (vorläufig)' : ''}`],
      ['Stichtag (Altersberechnung)', datum(input.referenceDate)],
      ['Selbst betreute Kinder beim Zahlenden berücksichtigen', o.haushaltskinderEinbeziehen ? 'ja' : 'nein'],
      ['Wechselmodell: weitere Kinder im Haushalt vorweg abziehen', o.wechselNaturalunterhaltAbzug ? 'ja' : 'nein'],
      ['Wechselmodell: Zu-/Herabstufung nach Kinderzahl', o.wechselStufung ? 'ja' : 'nein'],
      [
        'Ehegattenunterhalt',
        input.ehegatte?.aktiv ? (input.ehegatte.art === 'trennung' ? 'Trennungsunterhalt' : 'nachehelicher Unterhalt') : 'nicht berechnet',
      ],
    ],
  };

  const rechenweg: ReportStep[] = result.steps.map((s) => ({
    titel: `${s.id}. ${s.title}`,
    zeilen: s.lines.map((l) => ({
      label: l.label.trim(),
      wert: stepValue(l),
      hinweis: l.note,
      betont: l.emphasis,
      ueberschrift: l.heading,
    })),
  }));

  const nutztBrutto = (['A', 'B'] as ParentId[]).some((p) => parents[p].incomeMode === 'brutto');
  const nutztTarif = (['A', 'B'] as ParentId[]).some(
    (p) => parents[p].incomeMode === 'brutto' && parents[p].gross.quelle === 'tarif',
  );
  const grundlagen = [
    `${activeTable.name} (gültig ab ${datum(activeTable.validFrom)}) – Kindergeld ${fmt(activeTable.kindergeld)}, Selbstbehalt notwendig ${fmt(
      activeTable.selbstbehalt.notwendigErwerbstaetig,
    )} / ${fmt(activeTable.selbstbehalt.notwendigNichtErwerbstaetig)}, angemessen ${fmt(activeTable.selbstbehalt.angemessen)}`,
    ...(nutztBrutto ? [`${activeLohnsteuer.name}: ${activeLohnsteuer.sourceNote}`] : []),
    ...(nutztTarif ? [activeTarife.sourceNote] : []),
    activeTable.sourceNote,
  ];

  return {
    titel: 'Berechnung Kindesunterhalt',
    erstelltAm: erstelltAm.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }),
    stichtag: datum(input.referenceDate),
    jahr: jk.jahr,
    vorlaeufig: jk.status === 'vorlaeufig' ? jk.hinweise : [],
    rechtlicherHinweis: RECHTLICHER_HINWEIS,
    ergebnis: {
      ok: result.ok,
      zusammenfassung,
      saldo,
      zahlungen,
      einmalig: result.einmalig.map((e) => ({
        posten: `${e.label} – ${e.bezeichnung} (Gesamtkosten ${fmt(e.gesamtbetrag)})`,
        zahlung: `${parents[e.payer].label} an ${parents[e.payee].label}`,
        betrag: fmt(e.betrag),
        hinweis: e.note ?? '',
      })),
      ehegatte: result.ehegatte
        ? `Davon Ehegattenunterhalt (${result.ehegatte.art === 'trennung' ? 'Trennungsunterhalt' : 'nachehelich'}): ${
            parents[result.ehegatte.payer].label
          } an ${parents[result.ehegatte.payee].label} ${fmt(result.ehegatte.amount)}${result.ehegatte.gekuerzt ? ' (wegen Leistungsfähigkeit gekürzt)' : ''}`
        : undefined,
      fehler: errors,
    },
    hinweise: warnings,
    eingaben: [parentSection('A', input, jk), parentSection('B', input, jk), kinder, optionen],
    rechenweg,
    grundlagen,
  };
}
