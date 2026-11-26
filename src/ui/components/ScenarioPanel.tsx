import { useMemo, useState } from 'react';
import { buildVergleich, differenz, type Szenario } from '../../compare/vergleich';
import type { CalculationInput } from '../../types';

interface Props {
  input: CalculationInput;
  szenarien: Szenario[];
  onSave: (name: string) => void;
  onLoad: (s: Szenario) => void;
  onRemove: (id: string) => void;
}

export const MAX_SZENARIEN = 5;

/**
 * Szenarien merken und nebeneinander vergleichen. Die Szenarien liegen nur im Arbeitsspeicher
 * (keine Speicherung im Browser oder auf einem Server) und gehen beim Neuladen verloren.
 */
export function ScenarioPanel({ input, szenarien, onSave, onLoad, onRemove }: Props) {
  const [name, setName] = useState('');
  const voll = szenarien.length >= MAX_SZENARIEN;

  const vergleich = useMemo(
    () =>
      szenarien.length > 0
        ? buildVergleich([...szenarien, { id: 'aktuell', name: 'Aktuelle Eingabe', input }])
        : null,
    [szenarien, input],
  );

  const speichern = () => {
    onSave(name.trim() || `Szenario ${szenarien.length + 1}`);
    setName('');
  };

  return (
    <section className="card mt-6 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Szenarien vergleichen</h2>
          <p className="text-xs text-slate-500">
            Aktuellen Stand merken, Eingaben ändern und die Ergebnisse nebeneinander vergleichen. Szenarien bleiben nur
            in diesem Browserfenster und gehen beim Neuladen verloren – außer, die Eingaben werden oben als Datei gespeichert.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <input
            className="input min-w-0 flex-1 sm:w-56 sm:flex-none"
            placeholder={`Szenario ${szenarien.length + 1}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !voll && speichern()}
            aria-label="Name des Szenarios"
            disabled={voll}
          />
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={speichern} disabled={voll}>
            Aktuellen Stand merken
          </button>
        </div>
      </div>
      {voll && <p className="text-xs text-amber-700">Maximal {MAX_SZENARIEN} Szenarien – bitte eines entfernen.</p>}

      {vergleich && (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Vergleichstabelle der Szenarien">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left align-bottom">
                <th className="py-2 pr-3 text-xs font-medium text-slate-500">Position</th>
                {vergleich.spalten.map((sp, i) => {
                  const s = szenarien[i];
                  return (
                    <th key={i} className="py-2 pr-3 text-right">
                      <span className={`block text-sm font-semibold ${s ? 'text-slate-900' : 'text-petrol-700'}`}>{sp}</span>
                      {i === 0 && <span className="block text-[11px] font-normal text-slate-500">Basis für Differenzen</span>}
                      {s && (
                        <span className="mt-1 flex justify-end gap-1">
                          <button type="button" className="btn-secondary px-2 py-0.5 text-xs" onClick={() => onLoad(s)}>
                            Laden
                          </button>
                          <button type="button" className="btn-danger px-2 py-0.5 text-xs" onClick={() => onRemove(s.id)}>
                            Entfernen
                          </button>
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {vergleich.zeilen.map((z, zi) =>
                z.ueberschrift ? (
                  <tr key={zi}>
                    <td
                      colSpan={vergleich.spalten.length + 1}
                      className="bg-slate-50 px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {z.label}
                    </td>
                  </tr>
                ) : (
                  <tr key={zi} className={`border-b border-slate-100 align-top ${z.betont ? 'font-semibold' : ''}`}>
                    <td className="py-1.5 pr-3 text-slate-700">{z.label}</td>
                    {z.werte.map((w, i) => {
                      const d = differenz(z, i);
                      return (
                        <td key={i} className="py-1.5 pr-3 text-right tabular-nums">
                          {w}
                          {d && (
                            <span className="block text-xs font-normal text-slate-500">{d}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
