import { useMemo, useState } from 'react';
import { fmt } from '../../engine/format';
import type { CalculationInput, ParentId } from '../../types';
import { AGE_STAGE_LABELS } from '../../types';
import { berechneZeitraum, MAX_MONATE, monateZwischen, monatText, type MonatsZahlung } from '../../zeitraum/zeitraum';
import { infoTexte } from '../infoTexte';
import { useJahr } from '../JahrContext';
import { Field, LabeledBlock, MoneyInput, Toggle } from './fields';

interface Props {
  input: CalculationInput;
}

function aktuellerMonat(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Unterhalt Monat für Monat über einen Zeitraum, mit Altersstufenwechseln und Rückstand */
export function ZeitraumPanel({ input }: Props) {
  const info = infoTexte(useJahr());
  const [offen, setOffen] = useState(false);
  const [von, setVon] = useState(`${new Date().getFullYear()}-01`);
  const [bis, setBis] = useState(aktuellerMonat());
  const [mitGezahlt, setMitGezahlt] = useState(false);
  const [zahler, setZahler] = useState<ParentId>('A');
  const [betrag, setBetrag] = useState(0);

  const anzahl = monateZwischen(von, bis).length;
  const fehler = anzahl === 0 ? 'Der letzte Monat liegt vor dem ersten.' : anzahl > MAX_MONATE ? `Höchstens ${MAX_MONATE} Monate.` : null;

  const ergebnis = useMemo(
    () =>
      offen && !fehler
        ? berechneZeitraum(input, { von, bis, gezahlt: mitGezahlt ? { zahler, betragMonatlich: betrag } : null })
        : null,
    [offen, fehler, input, von, bis, mitGezahlt, zahler, betrag],
  );
  const name = (p: ParentId | 'Kind' | null) => (p === 'Kind' ? 'Kind' : p ? input.parents[p].label : '');
  const zeile = (z: MonatsZahlung) =>
    `${z.label}${z.stage !== null ? ` (${AGE_STAGE_LABELS[z.stage]})` : ''}: ${name(z.payer)} → ${name(z.payee)} ${fmt(z.amount)}`;

  return (
    <section className="card mt-6 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <LabeledBlock
          label="Zeitraum und Rückstand"
          info={info.zeitraum}
          labelClassName="text-lg font-semibold text-slate-900"
        >
          <p className="text-xs text-slate-500">
            Unterhalt Monat für Monat – mit Altersstufenwechseln, Jahreswerten und Abzug bereits gezahlter Beträge.
          </p>
        </LabeledBlock>
        <button type="button" className="btn-secondary" aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
          {offen ? 'Ausblenden' : 'Zeitraum berechnen'}
        </button>
      </div>

      {offen && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Von (Monat)" error={fehler && anzahl === 0 ? fehler : undefined}>
              <input type="month" className="input" value={von} onChange={(e) => setVon(e.target.value)} aria-label="Erster Monat" />
            </Field>
            <Field label="Bis einschließlich (Monat)" error={fehler && anzahl > 0 ? fehler : undefined}>
              <input type="month" className="input" value={bis} onChange={(e) => setBis(e.target.value)} aria-label="Letzter Monat" />
            </Field>
            <div className="sm:col-span-2">
              <Toggle
                checked={mitGezahlt}
                onChange={setMitGezahlt}
                label="Bereits gezahlte Beträge abziehen"
                hint="monatlich gleicher Betrag an den anderen Elternteil"
              />
            </div>
            {mitGezahlt && (
              <>
                <Field label="Gezahlt von">
                  <select className="input" value={zahler} onChange={(e) => setZahler(e.target.value as ParentId)}>
                    <option value="A">{input.parents.A.label}</option>
                    <option value="B">{input.parents.B.label}</option>
                  </select>
                </Field>
                <Field label="Gezahlt je Monat">
                  <MoneyInput value={betrag} onChange={(v) => setBetrag(v ?? 0)} />
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
                {mitGezahlt && (
                  <>
                    <dt className="text-slate-600">Bereits gezahlt von {name(zahler)}</dt>
                    <dd className="font-medium sm:text-right">− {fmt(ergebnis.gezahltGesamt)}</dd>
                  </>
                )}
                {ergebnis.rueckstand && (
                  <>
                    <dt className="font-semibold text-slate-900">
                      {!mitGezahlt
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
                Einkommen und übrige Eingaben gelten für den ganzen Zeitraum. Für die Vergangenheit kann Unterhalt nur
                eingeschränkt verlangt werden (siehe Info).
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
