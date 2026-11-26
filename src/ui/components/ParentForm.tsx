import type { OtherChildInput, ParentId, ParentInput } from '../../types';
import { newOtherChild } from '../defaults';
import { infoTexte } from '../infoTexte';
import { useJahr } from '../JahrContext';
import { AgeField, Field, LabeledBlock, MoneyInput, NameInput } from './fields';
import { GrossIncomeFields } from './GrossIncomeFields';

interface Props {
  id: ParentId;
  value: ParentInput;
  onChange: (v: ParentInput) => void;
  errorFor: (field: string) => string | undefined;
  /** Rollen dieses Elternteils, abgeleitet aus dem Betreuungsmodell der Kinder */
  roles: string[];
  referenceDate: string;
}

export function ParentForm({ id, value, onChange, errorFor, roles, referenceDate }: Props) {
  const f = `parents.${id}`;
  const info = infoTexte(useJahr());
  const set = <K extends keyof ParentInput>(key: K, v: ParentInput[K]) => onChange({ ...value, [key]: v });
  const setDed = <K extends keyof ParentInput['deductions']>(key: K, v: ParentInput['deductions'][K]) =>
    onChange({ ...value, deductions: { ...value.deductions, [key]: v } });

  const updateOther = (index: number, patch: Partial<OtherChildInput>) =>
    set(
      'otherChildren',
      value.otherChildren.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );

  return (
    <section className="card space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor={`parent-name-${id}`}>
            Name / Bezeichnung
          </label>
          <NameInput
            id={`parent-name-${id}`}
            className="text-base font-semibold"
            value={value.label}
            placeholder={`Elternteil ${id}`}
            onChange={(v) => set('label', v)}
          />
        </div>
        <div className="flex max-w-[50%] shrink-0 flex-wrap justify-end gap-1 pt-6">
          {roles.map((r) => (
            <span
              key={r}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                r === 'betreuend'
                  ? 'bg-emerald-100 text-emerald-800'
                  : r === 'Wechselmodell'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledBlock label="Einkommensangabe" info={info.einkommensangabe} className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200 p-1" role="radiogroup" aria-label="Einkommensangabe">
            {(['netto', 'brutto'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={value.incomeMode === mode}
                onClick={() => set('incomeMode', mode)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  value.incomeMode === mode ? 'bg-white text-petrol-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'netto' ? 'Netto eingeben' : 'Brutto eingeben (Netto schätzen)'}
              </button>
            ))}
          </div>
        </LabeledBlock>
        {value.incomeMode === 'netto' ? (
          <Field label="Nettoeinkommen (monatlich)" error={errorFor(`${f}.netIncome`)} info={info.nettoeinkommen}>
            <MoneyInput
              value={value.netIncome}
              onChange={(v) => set('netIncome', v ?? 0)}
              error={!!errorFor(`${f}.netIncome`)}
            />
          </Field>
        ) : (
          <GrossIncomeFields
            value={value.gross}
            onChange={(g) => set('gross', g)}
            errorFor={errorFor}
            fieldPrefix={f}
          />
        )}
        <Field label="Erwerbsstatus" hint="bestimmt den notwendigen Selbstbehalt" info={info.erwerbsstatus}>
          <select
            className="input"
            value={value.employed ? 'ja' : 'nein'}
            onChange={(e) => set('employed', e.target.value === 'ja')}
          >
            <option value="ja">erwerbstätig</option>
            <option value="nein">nicht erwerbstätig</option>
          </select>
        </Field>
        <Field label="Berufsbedingte Aufwendungen" info={info.berufsbedingt}>
          <select
            className="input"
            value={value.deductions.berufsbedingtMode}
            onChange={(e) =>
              setDed('berufsbedingtMode', e.target.value as ParentInput['deductions']['berufsbedingtMode'])
            }
          >
            <option value="pauschal">5 %-Pauschale</option>
            <option value="konkret">konkret</option>
            <option value="keine">keine</option>
          </select>
        </Field>
        {value.deductions.berufsbedingtMode === 'konkret' && (
          <Field label="Berufsbedingt (konkret)" error={errorFor(`${f}.berufsbedingtKonkret`)} info={info.berufsbedingtKonkret}>
            <MoneyInput
              value={value.deductions.berufsbedingtKonkret}
              onChange={(v) => setDed('berufsbedingtKonkret', v ?? 0)}
              error={!!errorFor(`${f}.berufsbedingtKonkret`)}
            />
          </Field>
        )}
        <Field label="Altersvorsorge" error={errorFor(`${f}.altersvorsorge`)} info={info.altersvorsorge}>
          <MoneyInput value={value.deductions.altersvorsorge} onChange={(v) => setDed('altersvorsorge', v ?? 0)} />
        </Field>
        <Field label="Berücksichtigungsfähige Schulden" error={errorFor(`${f}.schulden`)} info={info.schulden}>
          <MoneyInput value={value.deductions.schulden} onChange={(v) => setDed('schulden', v ?? 0)} />
        </Field>
        <Field label="Sonstige Abzüge" error={errorFor(`${f}.sonstige`)} info={info.sonstigeAbzuege}>
          <MoneyInput value={value.deductions.sonstige} onChange={(v) => setDed('sonstige', v ?? 0)} />
        </Field>
        <Field
          label="Wohnvorteil (mietfreies Wohnen)"
          hint="wird dem Einkommen hinzugerechnet"
          error={errorFor(`${f}.wohnvorteil`)}
          info={info.wohnvorteil}
        >
          <MoneyInput value={value.deductions.wohnvorteil} onChange={(v) => setDed('wohnvorteil', v ?? 0)} />
        </Field>
        <Field
          label="Weitere Berechtigte (z. B. Ehegatte)"
          info={info.weitereBerechtigte}
          hint="zählt nur für die Zu-/Herabstufung"
          error={errorFor(`${f}.weitereBerechtigte`)}
        >
          <input
            type="number"
            min={0}
            step={1}
            className="input"
            value={value.weitereBerechtigte}
            onChange={(e) => set('weitereBerechtigte', Math.floor(Number(e.target.value) || 0))}
          />
        </Field>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <LabeledBlock
            label="Weitere unterhaltsberechtigte Kinder"
            info={info.weitereKinder}
            labelClassName="text-sm font-semibold text-slate-800"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => set('otherChildren', [...value.otherChildren, newOtherChild(value.otherChildren.length + 1)])}
          >
            + Kind
          </button>
        </div>
        {value.otherChildren.length === 0 && (
          <p className="text-xs text-slate-500">Keine Kinder aus anderen Beziehungen erfasst.</p>
        )}
        <div className="space-y-3">
          {value.otherChildren.map((c, i) => (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <NameInput
                  className="bg-white"
                  value={c.label}
                  onChange={(v) => updateOther(i, { label: v })}
                  ariaLabel="Bezeichnung des weiteren Kindes"
                />
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => set('otherChildren', value.otherChildren.filter((_, j) => j !== i))}
                >
                  Entfernen
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AgeField
                  value={c.age}
                  onChange={(age) => updateOther(i, { age })}
                  referenceDate={referenceDate}
                  info={info.alter}
                  error={errorFor(`${f}.otherChildren.${i}.age`)}
                />
                <Field label="Rang (falls volljährig)" info={info.rangVolljaehrig}>
                  <select
                    className="input"
                    value={c.adultRank}
                    onChange={(e) => updateOther(i, { adultRank: e.target.value as OtherChildInput['adultRank'] })}
                  >
                    <option value="privilegiert">privilegiert volljährig (Rang 1)</option>
                    <option value="sonstig">sonstig volljährig (Rang 4)</option>
                  </select>
                </Field>
                <Field label="Art des Unterhalts" info={info.artDesUnterhalts}>
                  <select
                    className="input"
                    value={c.care}
                    onChange={(e) => updateOther(i, { care: e.target.value as OtherChildInput['care'] })}
                  >
                    <option value="barunterhalt">Barunterhalt (Zahlung)</option>
                    <option value="haushalt">lebt im eigenen Haushalt</option>
                  </select>
                </Field>
                {c.care === 'barunterhalt' && (
                  <Field
                    label="Zahlbetrag (optional)"
                    info={info.zahlbetragWeiteresKind}
                    hint="leer = nach Tabelle"
                    error={errorFor(`${f}.otherChildren.${i}.fixedPayment`)}
                  >
                    <MoneyInput
                      value={c.fixedPayment}
                      nullable
                      placeholder="nach Tabelle"
                      onChange={(v) => updateOther(i, { fixedPayment: v })}
                    />
                  </Field>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
