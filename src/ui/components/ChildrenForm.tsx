import type { ChildCare, CommonChildInput, ParentId, ParentInput } from '../../types';
import { resolveStage } from '../../engine/util';
import { newCommonChild } from '../defaults';
import { infoTexte } from '../infoTexte';
import { useJahr } from '../JahrContext';
import { BedarfspostenList } from './BedarfspostenList';
import { AgeField, Field, LabeledBlock, MoneyInput, NameInput, Toggle } from './fields';

interface Props {
  value: CommonChildInput[];
  onChange: (v: CommonChildInput[]) => void;
  parents: Record<ParentId, ParentInput>;
  errorFor: (field: string) => string | undefined;
  referenceDate: string;
}

export function careLabel(care: ChildCare, parents: Record<ParentId, ParentInput>): string {
  return care === 'wechsel' ? 'Wechselmodell 50 : 50' : `lebt bei ${parents[care].label}`;
}

const CARE_OPTIONS: ChildCare[] = ['A', 'B', 'wechsel'];

export function ChildrenForm({ value, onChange, parents, errorFor, referenceDate }: Props) {
  const update = (index: number, patch: Partial<CommonChildInput>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const setAll = (care: ChildCare) => onChange(value.map((c) => ({ ...c, care })));
  const jk = useJahr();
  const info = infoTexte(jk);
  const fmtEuro = (v: number) => `${v.toLocaleString('de-DE')} €`;

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Gemeinsame Kinder</h2>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const c = newCommonChild(value.length + 1);
            // neues Kind übernimmt das Betreuungsmodell des letzten Kindes
            onChange([...value, value.length > 0 ? { ...c, care: value[value.length - 1].care } : c]);
          }}
        >
          + Kind hinzufügen
        </button>
      </div>

      {value.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>Alle Kinder:</span>
          {CARE_OPTIONS.map((care) => (
            <button key={care} type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setAll(care)}>
              {careLabel(care, parents)}
            </button>
          ))}
        </div>
      )}

      {errorFor('children') && <p className="text-sm text-red-600">{errorFor('children')}</p>}
      <div className="space-y-3">
        {value.map((c, i) => {
          const volljaehrig = resolveStage(c.age, referenceDate) === 3;
          const eigenerHaushalt = volljaehrig && c.eigenerHaushalt;
          return (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <NameInput
                className="bg-white font-medium"
                value={c.label}
                onChange={(v) => update(i, { label: v })}
                ariaLabel="Bezeichnung des Kindes"
              />
              <button type="button" className="btn-danger" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                Entfernen
              </button>
            </div>

            {eigenerHaushalt ? (
              <div className="mb-3 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600">
                <span className="font-medium text-slate-800">Eigener Haushalt</span> – fester Bedarf{' '}
                {fmtEuro(jk.tabelle.bedarfVolljaehrigEigenerHaushalt)} (darin {fmtEuro(jk.tabelle.wohnkostenanteilEigenerHaushalt)}{' '}
                Warmmiete); beide Eltern zahlen anteilig an das Kind.
              </div>
            ) : (
            <LabeledBlock label="Betreuungsmodell" info={info.betreuungsmodell} className="mb-3">
            <div role="radiogroup" aria-label={`Betreuungsmodell ${c.label}`}>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200 p-1">
                {CARE_OPTIONS.map((care) => (
                  <button
                    key={care}
                    type="button"
                    role="radio"
                    aria-checked={c.care === care}
                    onClick={() => update(i, { care })}
                    className={`truncate rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                      c.care === care ? 'bg-white text-petrol-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={careLabel(care, parents)}
                  >
                    {care === 'wechsel' ? 'Wechselmodell' : `bei ${parents[care].label}`}
                  </button>
                ))}
              </div>
            </div>
            </LabeledBlock>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AgeField
                value={c.age}
                onChange={(age) => update(i, { age })}
                referenceDate={referenceDate}
                info={info.alter}
                error={errorFor(`children.${i}.age`)}
              />
              <Field label="Kindergeld erhält" info={info.kindergeldEmpfaenger}>
                <select
                  className="input"
                  value={c.kindergeldRecipient}
                  onChange={(e) => update(i, { kindergeldRecipient: e.target.value as ParentId })}
                >
                  <option value="A">{parents.A.label}</option>
                  <option value="B">{parents.B.label}</option>
                </select>
              </Field>
              <Field
                label="Eigenes Einkommen (netto)"
                info={info.eigenesEinkommen}
                hint="z. B. Ausbildungsvergütung"
                error={errorFor(`children.${i}.ownIncome`)}
              >
                <MoneyInput value={c.ownIncome} onChange={(v) => update(i, { ownIncome: v ?? 0 })} />
              </Field>
              <Field label="Rang (falls volljährig)" info={info.rangVolljaehrig}>
                <select
                  className="input"
                  value={c.adultRank}
                  onChange={(e) => update(i, { adultRank: e.target.value as CommonChildInput['adultRank'] })}
                >
                  <option value="privilegiert">privilegiert (Schule, ≤ 20 J., im Elternhaushalt)</option>
                  <option value="sonstig">sonstig volljährig</option>
                </select>
              </Field>
              {volljaehrig && (
                <div className="sm:col-span-2">
                  <Toggle
                    checked={c.eigenerHaushalt}
                    onChange={(v) => update(i, { eigenerHaushalt: v })}
                    label="Lebt im eigenen Haushalt (z. B. Studium, Ausbildung)"
                    info={info.eigenerHaushalt}
                    hint={`fester Bedarf ${fmtEuro(jk.tabelle.bedarfVolljaehrigEigenerHaushalt)} statt Bedarf nach Elterneinkommen; nicht privilegiert`}
                  />
                </div>
              )}
              {c.care === 'wechsel' && (
                <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
                  {(['A', 'B'] as const).map((p) => (
                    <Field
                      key={p}
                      label={`Wohnkosten des Kindes bei ${parents[p].label}`}
                      info={info.wechselWohnkosten}
                      hint="anteilige Warmmiete pro Monat, z. B. nach m²"
                      error={errorFor(`children.${i}.wechselWohnkosten.${p}`)}
                    >
                      <MoneyInput
                        value={c.wechselWohnkosten?.[p] ?? 0}
                        onChange={(v) =>
                          update(i, { wechselWohnkosten: { ...(c.wechselWohnkosten ?? { A: 0, B: 0 }), [p]: v ?? 0 } })
                        }
                      />
                    </Field>
                  ))}
                  <Field
                    label="Sonstige Wechselmodell-Mehrkosten"
                    info={info.wechselMehrkosten}
                    hint="z. B. Fahrtkosten – Wohnkosten oben eintragen"
                    error={errorFor(`children.${i}.wechselMehrkosten`)}
                  >
                    <MoneyInput value={c.wechselMehrkosten} onChange={(v) => update(i, { wechselMehrkosten: v ?? 0 })} />
                  </Field>
                </div>
              )}
            </div>

            <BedarfspostenList
              value={c.bedarfsposten}
              onChange={(bedarfsposten) => update(i, { bedarfsposten })}
              parents={parents}
              standardZahler={c.care === 'wechsel' || eigenerHaushalt ? c.kindergeldRecipient : c.care}
              errorFor={(j) => errorFor(`children.${i}.bedarfsposten.${j}.betrag`)}
            />
          </div>
          );
        })}
      </div>
    </section>
  );
}
