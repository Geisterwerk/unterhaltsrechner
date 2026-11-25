import type { EhegattenInput } from '../../types';
import { infoTexte } from '../infoTexte';
import { useJahr } from '../JahrContext';
import { Field, Toggle } from './fields';

interface Props {
  value: EhegattenInput;
  onChange: (v: EhegattenInput) => void;
}

/** Optionaler Ehegattenunterhalt zwischen den Eltern */
export function SpousePanel({ value, onChange }: Props) {
  const jk = useJahr();
  const info = infoTexte(jk);
  const e = jk.tabelle.ehegatte;
  const eur = (v: number) => `${v.toLocaleString('de-DE')} €`;

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Ehegattenunterhalt</h2>
      <Toggle
        checked={value.aktiv}
        onChange={(aktiv) => onChange({ ...value, aktiv })}
        label="Ehegattenunterhalt zwischen den Eltern mitberechnen"
        hint={`Quotenmethode: ${Math.round(e.erwerbsquote * 100)} % der Differenz der Erwerbseinkommen nach Kindesunterhalt; Selbstbehalt ${eur(
          e.selbstbehalt.erwerbstaetig,
        )} / ${eur(e.selbstbehalt.nichtErwerbstaetig)}`}
        info={info.ehegatte}
      />
      {value.aktiv && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Art des Unterhalts" info={info.ehegatteArt}>
            <select
              className="input"
              value={value.art}
              onChange={(ev) => onChange({ ...value, art: ev.target.value as EhegattenInput['art'] })}
              aria-label="Art des Ehegattenunterhalts"
            >
              <option value="trennung">Trennungsunterhalt (bis zur Scheidung)</option>
              <option value="nachehelich">nachehelicher Unterhalt (nach der Scheidung)</option>
            </select>
          </Field>
        </div>
      )}
    </section>
  );
}
