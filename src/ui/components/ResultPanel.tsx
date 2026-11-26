import { useState } from 'react';
import { fmt } from '../../engine';
import { buildReportModel } from '../../report/reportModel';
import type { ZeitraumEinstellung, ZeitraumErgebnis } from '../../zeitraum/zeitraum';
import type { CalculationInput, CalculationResult, ParentId, ParentInput, Payee, StepLine } from '../../types';
import { AGE_STAGE_LABELS } from '../../types';
import { careLabel } from './ChildrenForm';

interface Props {
  input: CalculationInput;
  result: CalculationResult;
  parents: Record<ParentId, ParentInput>;
  tableName: string;
  /** Zeitraumberechnung, falls im Zeitraum-Bereich aktiv – erscheint im PDF */
  zeitraum: { einstellung: ZeitraumEinstellung; ergebnis: ZeitraumErgebnis } | null;
}

export function ResultPanel({ input, result, parents, tableName, zeitraum }: Props) {
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'error'>('idle');

  /** PDF im Browser erzeugen – die PDF-Bibliothek wird erst bei Bedarf geladen */
  const createPdf = async () => {
    setPdfState('busy');
    try {
      const { downloadReportPdf } = await import('../../report/pdfReport');
      downloadReportPdf(buildReportModel(input, result, new Date(), zeitraum));
      setPdfState('idle');
    } catch (e) {
      console.error(e);
      setPdfState('error');
    }
  };

  const name = (p: Payee) => (p === 'Kind' ? 'das Kind' : parents[p].label);
  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const betreuung = (p: { childId: string; care: Parameters<typeof careLabel>[0]; stage: number }) =>
    p.stage === 3 && input.children.find((c) => c.id === p.childId)?.eigenerHaushalt
      ? 'eigener Haushalt'
      : careLabel(p.care, parents);

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Ergebnis</h2>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={createPdf}
            disabled={!result.ok || pdfState === 'busy'}
            title={result.ok ? 'Bericht mit Ergebnis, Eingaben und Rechenweg als PDF herunterladen' : 'Erst Eingaben korrigieren'}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.53 8.72a.75.75 0 0 0-1.06 1.06l4 4a.75.75 0 0 0 1.06 0l4-4a.75.75 0 1 0-1.06-1.06l-2.72 2.72V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            {pdfState === 'busy' ? 'Wird erstellt …' : 'PDF-Bericht'}
          </button>
        </div>
        {pdfState === 'error' && (
          <p className="mb-2 text-xs text-red-600">Der PDF-Bericht konnte nicht erstellt werden.</p>
        )}
        {!result.ok ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            <p className="mb-1 font-medium">Berechnung nicht möglich – bitte Eingaben korrigieren:</p>
            <ul className="list-inside list-disc space-y-0.5">
              {errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {result.summary.length === 0 ? (
              <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">Es ergibt sich keine Zahlungspflicht.</p>
            ) : (
              <div className="space-y-2">
                {result.summary.map((s) => (
                  <div key={`${s.payer}-${s.payee}`} className="rounded-lg bg-petrol-50 p-3">
                    <p className="text-sm text-petrol-900">
                      <strong>{parents[s.payer].label}</strong> zahlt an <strong>{name(s.payee)}</strong>
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-petrol-700">
                      {fmt(s.amount)} <span className="text-sm font-normal">monatlich</span>
                    </p>
                  </div>
                ))}
                {result.saldo && (
                  <div className="rounded-lg border border-petrol-200 bg-white p-3">
                    <p className="text-sm text-slate-700">
                      Saldo bei Verrechnung:{' '}
                      {result.saldo.amount === 0 ? (
                        <strong>beide Zahlungen heben sich auf</strong>
                      ) : (
                        <>
                          <strong>{parents[result.saldo.payer].label}</strong> →{' '}
                          <strong>{name(result.saldo.payee)}</strong>{' '}
                          <span className="font-bold tabular-nums text-petrol-700">{fmt(result.saldo.amount)}</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Die Unterhaltsansprüche stehen den einzelnen Kindern zu; eine Verrechnung ist nur einvernehmlich
                      möglich.
                    </p>
                  </div>
                )}
              </div>
            )}

            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1 font-medium">Kind</th>
                  <th className="py-1 font-medium">Zahlung</th>
                  <th className="py-1 text-right font-medium">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {result.payments.map((p, i) => (
                  <tr key={`${p.childId}-${i}`} className="border-b border-slate-100 align-top">
                    <td className="py-1.5">
                      {p.label}
                      <span className="block text-xs text-slate-500">
                        {AGE_STAGE_LABELS[p.stage]} · {betreuung(p)}
                      </span>
                    </td>
                    <td className="py-1.5">
                      {p.payer && p.payee ? `${parents[p.payer].label} → ${name(p.payee)}` : '–'}
                      {p.note && <span className="block text-xs text-slate-500">{p.note}</span>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {result.ehegatte && (
              <div className="mt-4 rounded-md border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    Ehegattenunterhalt ({result.ehegatte.art === 'trennung' ? 'Trennungsunterhalt' : 'nachehelich'})
                  </span>
                  <span className="tabular-nums font-semibold">{fmt(result.ehegatte.amount)}</span>
                </div>
                <p className="text-slate-600">
                  {parents[result.ehegatte.payer].label} → {parents[result.ehegatte.payee].label}
                  {result.ehegatte.gekuerzt ? ` · gekürzt (Leistungsfähigkeit), Quote ${fmt(result.ehegatte.quotenunterhalt)}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">In den Monatsbeträgen oben enthalten.</p>
              </div>
            )}

            {result.einmalig.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-1 text-sm font-semibold text-slate-800">Einmalige Erstattungen (Sonderbedarf)</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {result.einmalig.map((e, i) => (
                      <tr key={`${e.childId}-${i}`} className="border-b border-slate-100 align-top">
                        <td className="py-1.5">
                          {e.label} – {e.bezeichnung}
                          <span className="block text-xs text-slate-500">Gesamtkosten {fmt(e.gesamtbetrag)}</span>
                        </td>
                        <td className="py-1.5">
                          {parents[e.payer].label} → {parents[e.payee].label}
                          {e.note && <span className="block text-xs text-slate-500">{e.note}</span>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{fmt(e.betrag)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-slate-500">Einmalbeträge sind in den Monatsbeträgen oben nicht enthalten.</p>
              </div>
            )}
          </>
        )}
      </section>

      {warnings.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h3 className="mb-1 font-semibold">Hinweise</h3>
          <ul className="list-inside list-disc space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}

      {result.ok && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Rechenweg</h2>
          <div className="space-y-2">
            {result.steps.map((s) => (
              <StepView key={s.id} id={s.id} title={s.title} lines={s.lines} />
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Grundlage: {tableName}</p>
        </section>
      )}
    </div>
  );
}

function StepView({ id, title, lines }: { id: number; title: string; lines: StepLine[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>
          {id}. {title}
        </span>
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <dl className="border-t border-slate-100 px-3 py-2 text-sm">
          {lines.map((l, i) =>
            l.heading ? (
              <div
                key={i}
                className="-mx-3 mb-1 mt-2 border-y border-slate-100 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 first:mt-0"
              >
                {l.label}
              </div>
            ) : (
            <div
              key={i}
              className={`flex flex-col gap-0.5 py-1 sm:flex-row sm:justify-between sm:gap-4 ${
                l.emphasis ? 'font-semibold text-slate-900' : 'text-slate-700'
              }`}
            >
              <dt className="whitespace-pre-wrap">{l.label}</dt>
              <dd className="text-left tabular-nums sm:text-right">
                {l.value === undefined ? '' : l.money && typeof l.value === 'number' ? fmt(l.value) : String(l.value)}
                {l.note && <span className="block text-xs font-normal text-slate-500">{l.note}</span>}
              </dd>
            </div>
            ),
          )}
        </dl>
      )}
    </div>
  );
}
