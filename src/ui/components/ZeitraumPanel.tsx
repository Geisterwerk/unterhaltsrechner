import { fmt } from '../../engine/format';
import type { CalculationInput, ParentId } from '../../types';
import { AGE_STAGE_LABELS } from '../../types';
import {
  einkommensart,
  MAX_MONATE,
  monateZwischen,
  monatText,
  type EinkommensAenderung,
  type MonatsZahlung,
  type ZeitraumEinstellung,
  type ZeitraumErgebnis,
} from '../../zeitraum/zeitraum';
import { newId } from '../defaults';
import { infoTexte } from '../infoTexte';
import { useJahr } from '../JahrContext';
import { Field, LabeledBlock, MoneyInput, Toggle } from './fields';

interface Props {
  input: CalculationInput;
  einstellung: ZeitraumEinstellung;
  onChange: (e: ZeitraumEinstellung) => void;
  ergebnis: ZeitraumErgebnis | null;
}

/** Fehlermeldung zur Monatsauswahl (null = gültig) */
export function zeitraumFehler(e: Pick<ZeitraumEinstellung, 'von' | 'bis'>): string | null {
  const anzahl = monateZwischen(e.von, e.bis).length;
  if (anzahl === 0) return 'Der letzte Monat liegt vor dem ersten.';
  if (anzahl > MAX_MONATE) return `Höchstens ${MAX_MONATE} Monate.`;
  return null;
}

/** Unterhalt Monat für Monat über einen Zeitraum, mit Altersstufenwechseln, Einkommensänderungen und Rückstand */
export function ZeitraumPanel({ input, einstellung: e, onChange, ergebnis }: Props) {
  const info = infoTexte(useJahr());
  const set = <K extends keyof ZeitraumEinstellung>(k: K, v: ZeitraumEinstellung[K]) => onChange({ ...e, [k]: v });
  const fehler = zeitraumFehler(e);
  const name = (p: ParentId | 'Kind' | null) => (p === 'Kind' ? 'Kind' : p ? input.parents[p].label : '');
  const zeile = (z: MonatsZahlung) =>
    `${z.label}${z.stage !== null ? ` (${AGE_STAGE_LABELS[z.stage]})` : ''}: ${name(z.payer)} → ${name(z.payee)} ${fmt(z.amount)}`;
  const artText = (p: ParentId) => {
    const art = einkommensart(input.parents[p]);
    return art === 'netto' ? 'Nettoeinkommen' : art === 'brutto' ? 'Bruttolohn' : null;
  };

  const aenderungSetzen = (i: number, patch: Partial<EinkommensAenderung>) =>
    set('aenderungen', e.aenderungen.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  /** aktuelles Einkommen in der gewählten Einkommensart – Startwert für eine neue Änderung */
  const aktuellesEinkommen = (p: ParentId) => {
    const art = einkommensart(input.parents[p]);
    return art === 'netto' ? input.parents[p].netIncome : art === 'brutto' ? input.parents[p].gross.bruttoMonatlich : 0;
  };
  const aenderungNeu = () =>
    set('aenderungen', [...e.aenderungen, { id: newId('aenderung'), ab: e.bis, elternteil: 'A', betrag: aktuellesEinkommen('A') }]);

  return (
    <section className="card mt-6 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <LabeledBlock label="Zeitraum und Rückstand" info={info.zeitraum} labelClassName="text-lg font-semibold text-slate-900">
          <p className="text-xs text-slate-500">
            Unterhalt Monat für Monat – mit Altersstufenwechseln, Einkommensänderungen, Jahreswerten und Abzug bereits
            gezahlter Beträge.
          </p>
        </LabeledBlock>
        <button type="button" className="btn-secondary" aria-expanded={e.aktiv} onClick={() => set('aktiv', !e.aktiv)}>
          {e.aktiv ? 'Ausblenden' : 'Zeitraum berechnen'}
        </button>
      </div>

      {e.aktiv && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Von (Monat)" error={fehler && monateZwischen(e.von, e.bis).length === 0 ? fehler : undefined}>
              <input type="month" className="input" value={e.von} onChange={(ev) => set('von', ev.target.value)} aria-label="Erster Monat" />
            </Field>
            <Field label="Bis einschließlich (Monat)" error={fehler && monateZwischen(e.von, e.bis).length > 0 ? fehler : undefined}>
              <input type="month" className="input" value={e.bis} onChange={(ev) => set('bis', ev.target.value)} aria-label="Letzter Monat" />
            </Field>
          </div>

          <LabeledBlock
            label="Einkommensänderungen"
            info={info.zeitraumAenderungen}
            actions={
              <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={aenderungNeu}>
                + Einkommensänderung
              </button>
            }
          >
            {e.aenderungen.length === 0 ? (
              <p className="text-xs text-slate-500">Keine – das eingegebene Einkommen gilt für den ganzen Zeitraum.</p>
            ) : (
              <div className="space-y-2">
                {e.aenderungen.map((a, i) => {
                  const art = artText(a.elternteil);
                  return (
                    <div key={a.id} className="grid grid-cols-1 items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <Field label="Ab (Monat)">
                        <input
                          type="month"
                          className="input bg-white"
                          value={a.ab}
                          onChange={(ev) => aenderungSetzen(i, { ab: ev.target.value })}
                          aria-label={`Einkommensänderung ${i + 1}: ab Monat`}
                        />
                      </Field>
                      <Field label="Elternteil">
                        <select
                          className="input bg-white"
                          value={a.elternteil}
                          onChange={(ev) => {
                            const p = ev.target.value as ParentId;
                            // unveränderten Startwert auf das Einkommen des anderen Elternteils umstellen
                            const unveraendert = a.betrag === aktuellesEinkommen(a.elternteil);
                            aenderungSetzen(i, { elternteil: p, ...(unveraendert ? { betrag: aktuellesEinkommen(p) } : {}) });
                          }}
                          aria-label={`Einkommensänderung ${i + 1}: Elternteil`}
                        >
                          <option value="A">{input.parents.A.label}</option>
                          <option value="B">{input.parents.B.label}</option>
                        </select>
                      </Field>
                      <Field label={art ? `Neues ${art}` : 'Neues Einkommen'} error={art ? undefined : 'bei Tarif-Eingabe nicht möglich'}>
                        <MoneyInput value={a.betrag} onChange={(v) => aenderungSetzen(i, { betrag: v ?? 0 })} />
                      </Field>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => set('aenderungen', e.aenderungen.filter((_, j) => j !== i))}
                        aria-label={`Einkommensänderung ${i + 1} entfernen`}
                      >
                        Entfernen
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </LabeledBlock>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Toggle
                checked={e.mitGezahlt}
                onChange={(v) => set('mitGezahlt', v)}
                label="Bereits gezahlte Beträge abziehen"
                hint="monatlich gleicher Betrag an den anderen Elternteil"
              />
            </div>
            {e.mitGezahlt && (
              <>
                <Field label="Gezahlt von">
                  <select className="input" value={e.zahler} onChange={(ev) => set('zahler', ev.target.value as ParentId)}>
                    <option value="A">{input.parents.A.label}</option>
                    <option value="B">{input.parents.B.label}</option>
                  </select>
                </Field>
                <Field label="Gezahlt je Monat">
                  <MoneyInput value={e.betragMonatlich} onChange={(v) => set('betragMonatlich', v ?? 0)} />
                </Field>
              </>
            )}
          </div>

          {ergebnis && (
            <div className="space-y-3">
              {ergebnis.abschnitte.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="py-1.5 pr-3 font-medium">Zeitraum</th>
                        <th className="py-1.5 pr-3 font-medium">Monatlich</th>
                        <th className="py-1.5 text-right font-medium">Summe Ausgleich</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ergebnis.abschnitte.map((a) => (
                        <tr key={a.von} className="border-b border-slate-100 align-top">
                          <td className="py-1.5 pr-3 whitespace-nowrap">
                            {monatText(a.von)}
                            {a.bis !== a.von && `–${monatText(a.bis)}`}
                            <span className="block text-xs text-slate-500">
                              {a.monate} {a.monate === 1 ? 'Monat' : 'Monate'}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-xs text-slate-700">
                            {(['A', 'B'] as ParentId[])
                              .filter((p) => a.einkommen[p] !== undefined)
                              .map((p) => (
                                <div key={p} className="text-petrol-700">
                                  {artText(p)} {name(p)}: {fmt(a.einkommen[p]!)}
                                </div>
                              ))}
                            {a.zahlungen.length === 0 ? 'keine Zahlung' : a.zahlungen.map((z) => <div key={zeile(z)}>{zeile(z)}</div>)}
                          </td>
                          <td className="py-1.5 text-right whitespace-nowrap">
                            {a.nettoAB === 0
                              ? '–'
                              : `${name(a.nettoAB > 0 ? 'A' : 'B')} → ${name(a.nettoAB > 0 ? 'B' : 'A')} ${fmt(Math.abs(a.nettoAB) * a.monate)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-slate-600">Ausgleich zwischen den Eltern gesamt</dt>
                <dd className="font-medium sm:text-right">
                  {ergebnis.summeNettoAB === 0
                    ? '0,00 €'
                    : `${name(ergebnis.summeNettoAB > 0 ? 'A' : 'B')} → ${name(ergebnis.summeNettoAB > 0 ? 'B' : 'A')} ${fmt(Math.abs(ergebnis.summeNettoAB))}`}
                </dd>
                {e.mitGezahlt && (
                  <>
                    <dt className="text-slate-600">Bereits gezahlt von {name(e.zahler)}</dt>
                    <dd className="font-medium sm:text-right">− {fmt(ergebnis.gezahltGesamt)}</dd>
                  </>
                )}
                {ergebnis.rueckstand && (
                  <>
                    <dt className="font-semibold text-slate-900">
                      {!e.mitGezahlt
                        ? `Offen, wenn nichts gezahlt wurde (${name(ergebnis.rueckstand.zahler)})`
                        : `${ergebnis.rueckstand.betrag >= 0 ? 'Rückstand' : 'Überzahlung'} ${name(ergebnis.rueckstand.zahler)}`}
                    </dt>
                    <dd className="font-semibold text-petrol-700 sm:text-right">{fmt(Math.abs(ergebnis.rueckstand.betrag))}</dd>
                  </>
                )}
              </dl>

              {ergebnis.hinweise.length > 0 && (
                <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-800">
                  {ergebnis.hinweise.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-slate-500">
                Der Zeitraum erscheint auch im PDF-Bericht und wird beim Speichern der Eingaben mitgespeichert. Für die
                Vergangenheit kann Unterhalt nur eingeschränkt verlangt werden (siehe Info).
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
