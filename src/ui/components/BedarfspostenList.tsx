import type { BedarfsPosten, ParentId, ParentInput } from '../../types';
import { newId } from '../defaults';
import { infoTexte } from '../infoTexte';
import { useJahr } from '../JahrContext';
import { LabeledBlock, MoneyInput } from './fields';

interface Props {
  value: BedarfsPosten[];
  onChange: (v: BedarfsPosten[]) => void;
  parents: Record<ParentId, ParentInput>;
  /** Vorbelegung „bezahlt von" für neue Positionen */
  standardZahler: ParentId;
  errorFor: (index: number) => string | undefined;
}

const ART_LABEL: Record<BedarfsPosten['art'], { titel: string; betrag: string; beispiel: string }> = {
  mehrbedarf: { titel: 'Mehrbedarf', betrag: 'monatlich', beispiel: 'z. B. Kita, Nachhilfe' },
  sonderbedarf: { titel: 'Sonderbedarf', betrag: 'einmalig', beispiel: 'z. B. Klassenfahrt, Zahnspange' },
};

/** Liste von Mehr- und Sonderbedarf eines Kindes */
export function BedarfspostenList({ value, onChange, parents, standardZahler, errorFor }: Props) {
  const posten = value ?? [];
  const info = infoTexte(useJahr());
  const update = (index: number, patch: Partial<BedarfsPosten>) =>
    onChange(posten.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const add = (art: BedarfsPosten['art']) =>
    onChange([...posten, { id: newId('bedarf'), bezeichnung: '', art, betrag: 0, verauslagt: standardZahler }]);

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <LabeledBlock
        label="Mehr- und Sonderbedarf"
        info={info.mehrSonderbedarf}
        labelClassName="text-xs font-semibold text-slate-700"
        className="mb-2"
        actions={
          <div className="flex gap-1">
            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => add('mehrbedarf')}>
              + Mehrbedarf
            </button>
            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => add('sonderbedarf')}>
              + Sonderbedarf
            </button>
          </div>
        }
      />
      {posten.length === 0 ? (
        <p className="text-xs text-slate-500">
          Kosten außerhalb des Tabellenunterhalts (z. B. Kita, Nachhilfe, Klassenfahrt) – werden nach Einkommen auf
          beide Eltern verteilt.
        </p>
      ) : (
        <div className="space-y-2">
          {posten.map((p, i) => {
            const a = ART_LABEL[p.art];
            return (
              <div key={p.id} className="rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.art === 'mehrbedarf' ? 'bg-petrol-100 text-petrol-800' : 'bg-fuchsia-100 text-fuchsia-800'
                    }`}
                  >
                    {a.titel} ({a.betrag})
                  </span>
                  <button
                    type="button"
                    className="btn-danger px-2 py-0.5 text-xs"
                    onClick={() => onChange(posten.filter((_, j) => j !== i))}
                    aria-label={`${a.titel} entfernen`}
                  >
                    Entfernen
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    className="input"
                    placeholder={a.beispiel}
                    value={p.bezeichnung}
                    onChange={(e) => update(i, { bezeichnung: e.target.value })}
                    aria-label={`Bezeichnung ${a.titel}`}
                  />
                  <div>
                    <MoneyInput value={p.betrag} onChange={(v) => update(i, { betrag: v ?? 0 })} error={!!errorFor(i)} />
                    {errorFor(i) && <p className="mt-1 text-xs text-red-600">{errorFor(i)}</p>}
                  </div>
                  <select
                    className="input"
                    value={p.verauslagt}
                    onChange={(e) => update(i, { verauslagt: e.target.value as ParentId })}
                    aria-label="bezahlt von"
                    title="Wer bezahlt die Kosten? Der andere Elternteil erstattet seinen Anteil."
                  >
                    <option value="A">bezahlt von {parents.A.label}</option>
                    <option value="B">bezahlt von {parents.B.label}</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
