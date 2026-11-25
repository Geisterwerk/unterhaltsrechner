import type { CalculationInput, CalculationStep, ParentId, StepLine } from '../types';
import type { BereinigtesEinkommen } from './income';

/** Schritt 1 (Einkommensbereinigung) – für beide Modelle gleich */
export function incomeStep(
  input: CalculationInput,
  inc: Record<ParentId, BereinigtesEinkommen>,
): CalculationStep {
  const lines: StepLine[] = [];
  for (const p of ['A', 'B'] as ParentId[]) {
    const i = inc[p];
    const l = input.parents[p].label;
    const b = i.brutto;
    if (b) {
      const t = i.tarif;
      if (t) {
        lines.push({
          label: `${l}: ${t.tabelle.name}`,
          value: `${t.gruppe.id}, ${t.tabelle.stufenLabel} ${t.stufe}`,
          note: `Tabellenentgelt ${fmt(t.tabellenentgelt)} (gültig ab ${t.tabelle.gueltigAb.split('-').reverse().join('.')})${
            t.arbeitszeit < 100 ? ` × ${t.arbeitszeit} % Arbeitszeit` : ''
          }${t.zulagen.length > 0 ? ` + ${t.zulagen.map((z) => `${z.name} ${fmt(z.betrag)}`).join(' + ')}` : ''}`,
        });
      }
      const tz = i.teilzeit;
      if (tz) {
        lines.push({
          label: `${l}: Bruttolohn bei Vollzeit`,
          value: tz.vollzeitMonatlich,
          money: true,
          note: `Teilzeit ${tz.arbeitszeit.toLocaleString('de-DE')} %${
            tz.vollzeitSonderzahlungen > 0 ? ` – Sonderzahlungen bei Vollzeit ${fmt(tz.vollzeitSonderzahlungen)}` : ''
          }`,
        });
      }
      lines.push(
        { label: `${l}: Bruttolohn monatlich${tz ? ` (${tz.arbeitszeit.toLocaleString('de-DE')} % Teilzeit)` : ''}`, value: b.bruttoMonatlich, money: true },
        ...(b.sonderzahlungenJahr > 0
          ? [
              {
                label: t ? '  + Jahressonderzahlung' : '  + Sonderzahlungen (Jahr)',
                value: b.sonderzahlungenJahr,
                money: true,
                note: t ? `${t.jahressonderzahlungProzent.toLocaleString('de-DE')} % des Monatsentgelts` : undefined,
              },
            ]
          : []),
        { label: '  Jahresbrutto', value: b.jahresbrutto, money: true },
        ...(b.zusatzversorgungSteuerfrei > 0
          ? [
              {
                label: '  Steuerpflichtiger Arbeitslohn',
                value: b.steuerpflichtigerArbeitslohn,
                money: true,
                note: `Jahresbrutto − steuerfreier Zusatzversorgungsbeitrag ${fmt(b.zusatzversorgungSteuerfrei)} (§ 3 Nr. 63 EStG)`,
              },
            ]
          : []),
        {
          label: '  − Lohnsteuer (Jahr)',
          value: b.lohnsteuer,
          money: true,
          note: `zu versteuerndes Einkommen ${fmt(b.zvE)}, Vorsorgepauschale ${fmt(b.vorsorgepauschale)}`,
        },
        { label: '  − Solidaritätszuschlag (Jahr)', value: b.soli, money: true },
        { label: '  − Kirchensteuer (Jahr)', value: b.kirchensteuer, money: true },
        {
          label: '  − Sozialversicherung (Jahr)',
          value: b.sozialversicherung,
          money: true,
          note: `RV ${fmt(b.rv)} · AV ${fmt(b.av)} · KV ${fmt(b.kv)} (Zusatzbeitrag ${b.kvZusatzbeitrag.toLocaleString('de-DE')} %) · PV ${fmt(b.pv)}${
            b.zusatzversorgungHinzurechnung > 0
              ? ` – inkl. SV-pflichtiger AG-Umlage ${fmt(b.zusatzversorgungHinzurechnung)}`
              : ''
          }`,
        },
        ...(b.zusatzversorgungAn > 0
          ? [
              {
                label: '  − Zusatzversorgung Arbeitnehmeranteil (Jahr)',
                value: b.zusatzversorgungAn,
                money: true,
                note: `${b.zusatzversorgungAnProzent.toLocaleString('de-DE')} % des zusatzversorgungspflichtigen Entgelts${
                  b.zusatzversorgungSteuerfrei > 0
                    ? ` – steuerfrei ${fmt(b.zusatzversorgungSteuerfrei)}, beitragsfrei ${fmt(b.zusatzversorgungSvFrei)}`
                    : ' – aus versteuertem Entgelt'
                }`,
              },
            ]
          : []),
        { label: '  Nettojahreseinkommen', value: b.nettoJahr, money: true },
      );
    }
    lines.push(
      {
        label: `${l}: Nettoeinkommen${b ? ' (geschätzt, ⌀ monatlich)' : ''}`,
        value: i.netto,
        money: true,
        note: b ? 'Jahresnetto / 12' : undefined,
      },
      { label: `  − berufsbedingte Aufwendungen`, value: i.berufsbedingt, money: true, note: i.berufsbedingtHinweis },
      { label: `  − Altersvorsorge`, value: i.altersvorsorge, money: true },
      { label: `  − berücksichtigungsfähige Schulden`, value: i.schulden, money: true },
      { label: `  − sonstige Abzüge`, value: i.sonstige, money: true },
      { label: `${l}: bereinigtes Nettoeinkommen`, value: i.bereinigt, money: true, emphasis: true },
    );
  }
  return { id: 1, title: 'Bereinigtes Nettoeinkommen', lines };
}

export function fmt(v: number): string {
  return `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function pct(v: number): string {
  return `${(v * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}
