import { useId, useState, type ReactNode } from 'react';
import type { AgeInput, AgeStage } from '../../types';
import { AGE_STAGE_LABELS } from '../../types';
import { ageInYears, isValidIsoDate, stageFromAge } from '../../engine/util';

interface InfoButtonProps {
  open: boolean;
  onToggle: () => void;
  controls: string;
  /** Bezeichnung des Feldes für Screenreader */
  label: string;
}

/** Kleines „i"-Symbol, das eine Erläuterung auf- und zuklappt */
export function InfoButton({ open, onToggle, controls, label }: InfoButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`Erklärung: ${label}`}
      title="Erklärung anzeigen"
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold italic leading-none transition-colors ${
        open
          ? 'border-petrol-600 bg-petrol-600 text-white'
          : 'border-slate-300 text-slate-500 hover:border-petrol-400 hover:text-petrol-600'
      }`}
    >
      i
    </button>
  );
}

export function InfoPanel({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div
      id={id}
      className={`mt-1.5 space-y-1.5 rounded-md border border-petrol-100 bg-petrol-50/60 p-2.5 text-xs leading-relaxed text-slate-700 ${className}`}
    >
      {children}
    </div>
  );
}

/** Zustand für ein aufklappbares Info-Feld */
export function useInfo() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return { open, toggle: () => setOpen((o) => !o), id };
}

/** Beschriftung mit optionalem Info-Symbol */
export function FieldLabel({ label, info, infoState }: { label: string; info?: ReactNode; infoState: ReturnType<typeof useInfo> }) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {info && <InfoButton open={infoState.open} onToggle={infoState.toggle} controls={infoState.id} label={label} />}
    </div>
  );
}

/** Freie Beschriftung (z. B. über Umschaltern oder als Abschnittstitel) mit Info-Symbol und aufklappbarer Erläuterung */
export function LabeledBlock({
  label,
  info,
  children,
  className,
  labelClassName = 'text-xs font-medium text-slate-600',
  actions,
}: {
  label: string;
  info: ReactNode;
  children?: ReactNode;
  className?: string;
  labelClassName?: string;
  /** Elemente rechts neben der Beschriftung (z. B. Buttons) */
  actions?: ReactNode;
}) {
  const s = useInfo();
  return (
    <div className={className}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={labelClassName}>{label}</span>
          <InfoButton open={s.open} onToggle={s.toggle} controls={s.id} label={label} />
        </div>
        {actions}
      </div>
      {s.open && (
        <InfoPanel id={s.id} className="mb-2">
          {info}
        </InfoPanel>
      )}
      {children}
    </div>
  );
}

/** Eingabefeld für frei wählbare Namen (Eltern, Kinder) mit Stift-Symbol als Hinweis auf Bearbeitbarkeit */
export function NameInput({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <input
        id={id}
        className={`input pr-8 ${className}`}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      >
        <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
      </svg>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  /** Erläuterung, die über ein Info-Symbol neben der Beschriftung aufgeklappt wird */
  info?: ReactNode;
  children: ReactNode;
}

export function Field({ label, hint, error, className, info, children }: FieldProps) {
  const infoState = useInfo();
  return (
    <div className={className}>
      <FieldLabel label={label} info={info} infoState={infoState} />
      {children}
      {info && infoState.open && <InfoPanel id={infoState.id}>{info}</InfoPanel>}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface MoneyInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  /** leere Eingabe erlaubt (→ null) */
  nullable?: boolean;
  placeholder?: string;
  error?: boolean;
  suffix?: string;
  /** Schrittweite der Pfeiltasten/Spinner (Standard 0,01) */
  step?: number;
}

export function MoneyInput({ value, onChange, nullable, placeholder, error, suffix = '€', step = 0.01 }: MoneyInputProps) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        className={`input pr-8 ${error ? 'input-error' : ''}`}
        value={value === null || Number.isNaN(value) ? '' : value}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') onChange(nullable ? null : 0);
          else onChange(Number(raw));
        }}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
        {suffix}
      </span>
    </div>
  );
}

interface AgeFieldProps {
  value: AgeInput;
  onChange: (v: AgeInput) => void;
  /** Stichtag für die Anzeige der ermittelten Altersstufe */
  referenceDate: string;
  error?: string;
  info?: ReactNode;
}

/** Ermittelte Altersstufe zum Geburtsdatum (oder null bei ungültiger Eingabe) */
function derivedStage(birthdate: string, referenceDate: string): { years: number; stage: AgeStage } | null {
  if (!isValidIsoDate(birthdate)) return null;
  const years = ageInYears(birthdate, referenceDate);
  if (years === null || years < 0) return null;
  return { years, stage: stageFromAge(years) };
}

/** Altersangabe – nimmt in einem zweispaltigen Raster die volle Breite ein */
export function AgeField({ value, onChange, referenceDate, error, info }: AgeFieldProps) {
  const derived = value.kind === 'birthdate' ? derivedStage(value.birthdate, referenceDate) : null;
  const hint =
    value.kind === 'birthdate' ? (
      derived ? (
        <>
          Altersstufe: <strong className="text-slate-700">{AGE_STAGE_LABELS[derived.stage]}</strong> ({derived.years}{' '}
          {derived.years === 1 ? 'Jahr' : 'Jahre'} zum Stichtag)
        </>
      ) : (
        'Geburtsdatum eingeben – die Altersstufe wird automatisch ermittelt'
      )
    ) : undefined;

  return (
    <Field label="Alter" error={error} hint={hint} info={info} className="sm:col-span-2">
      <div className="flex gap-2">
        <select
          className="input w-40 shrink-0"
          value={value.kind}
          onChange={(e) =>
            onChange(
              e.target.value === 'stage'
                ? { kind: 'stage', stage: derived?.stage ?? 0 }
                : { kind: 'birthdate', birthdate: '' },
            )
          }
          aria-label="Art der Altersangabe"
        >
          <option value="stage">Altersstufe</option>
          <option value="birthdate">Geburtsdatum</option>
        </select>
        {value.kind === 'stage' ? (
          <select
            className="input min-w-0 flex-1"
            value={value.stage}
            onChange={(e) => onChange({ kind: 'stage', stage: Number(e.target.value) as AgeStage })}
            aria-label="Altersstufe"
          >
            {([0, 1, 2, 3] as AgeStage[]).map((s) => (
              <option key={s} value={s}>
                {AGE_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="date"
            className={`input min-w-0 flex-1 ${error ? 'input-error' : ''}`}
            value={value.birthdate}
            onChange={(e) => onChange({ kind: 'birthdate', birthdate: e.target.value })}
            aria-label="Geburtsdatum"
          />
        )}
      </div>
    </Field>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  /** Erläuterung, die über ein Info-Symbol aufgeklappt wird */
  info?: ReactNode;
}

export function Toggle({ checked, onChange, label, hint, info }: ToggleProps) {
  const { open, toggle, id: infoId } = useInfo();

  return (
    <div>
      <div className="flex items-start gap-2">
        <label className="flex flex-1 cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-slate-300 accent-petrol-600 focus:ring-petrol-500"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            {label}
            {hint && <span className="block text-xs text-slate-500">{hint}</span>}
          </span>
        </label>
        {info && (
          <span className="mt-0.5">
            <InfoButton open={open} onToggle={toggle} controls={infoId} label={label} />
          </span>
        )}
      </div>
      {info && open && (
        <InfoPanel id={infoId} className="ml-6">
          {info}
        </InfoPanel>
      )}
    </div>
  );
}
