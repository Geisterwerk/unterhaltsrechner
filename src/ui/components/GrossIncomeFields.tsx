import { fmt } from '../../engine';
import { nettoAusBrutto } from '../../engine/brutto';
import { effectiveGross } from '../../engine/tarif';
import type { GrossIncomeInput, Steuerklasse } from '../../types';
import { infoTexte } from '../infoTexte';
import { useJahr } from '../JahrContext';
import { Field, LabeledBlock, MoneyInput, Toggle } from './fields';
import { TarifFields } from './TarifFields';

interface Props {
  value: GrossIncomeInput;
  onChange: (v: GrossIncomeInput) => void;
  errorFor: (field: string) => string | undefined;
  /** Feldpräfix für Fehlermeldungen, z. B. "parents.A" */
  fieldPrefix: string;
}

const pctLabel = (v: number) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;

const STEUERKLASSEN: { v: Steuerklasse; label: string }[] = [
  { v: 1, label: 'I – ledig / getrennt lebend' },
  { v: 2, label: 'II – alleinerziehend' },
  { v: 3, label: 'III – verheiratet (Splitting)' },
  { v: 4, label: 'IV – verheiratet' },
  { v: 5, label: 'V – verheiratet' },
  { v: 6, label: 'VI – Zweitjob' },
];

/** Eingaben für die Brutto-Netto-Schätzung inkl. Live-Vorschau des Nettos */
export function GrossIncomeFields({ value, onChange, errorFor, fieldPrefix: f }: Props) {
  const jk = useJahr();
  const info = infoTexte(jk);
  const activeKrankenkassen = jk.krankenkassen;
  const activeLohnsteuer = jk.lohnsteuer;
  const activeTarife = jk.tarife;
  const activeZusatzversorgung = jk.zusatzversorgung;
  const set = <K extends keyof GrossIncomeInput>(key: K, v: GrossIncomeInput[K]) => onChange({ ...value, [key]: v });
  const effektiv = effectiveGross(value, activeTarife).gross;
  const r = nettoAusBrutto(effektiv, activeLohnsteuer, activeZusatzversorgung);
  const teilzeit = value.quelle !== 'tarif' && (value.arbeitszeit ?? 100) < 100;

  const zv = value.zusatzversorgung;
  const zvKasse = activeZusatzversorgung.kassen.find((k) => k.id === zv.kasse);
  const setZv = (patch: Partial<GrossIncomeInput['zusatzversorgung']>) =>
    onChange({ ...value, zusatzversorgung: { ...zv, ...patch } });

  /** Zusatzversorgung wählen: übernimmt die Sätze der Kasse; 'manuell' behält die Werte zum Bearbeiten */
  const selectZv = (id: string) => {
    const k = activeZusatzversorgung.kassen.find((x) => x.id === id);
    if (id === 'keine') setZv({ kasse: id, anProzent: 0, agUmlageProzent: 0, anSteuerfrei: false, agBeitragProzent: 0 });
    else if (k)
      setZv({
        kasse: id,
        anProzent: k.anProzent,
        agUmlageProzent: k.agUmlageProzent,
        anSteuerfrei: k.anSteuerfrei,
        agBeitragProzent: k.agBeitragProzent,
      });
    else setZv({ kasse: id });
  };

  /** Beim Wechsel auf Tarif ist i. d. R. eine Zusatzversorgung vorhanden – VBL West vorbelegen */
  const selectQuelle = (q: GrossIncomeInput['quelle']) => {
    const vbl = activeZusatzversorgung.kassen[0];
    const zusatzversorgung =
      q === 'tarif' && zv.kasse === 'keine' && vbl
        ? {
            kasse: vbl.id,
            anProzent: vbl.anProzent,
            agUmlageProzent: vbl.agUmlageProzent,
            anSteuerfrei: vbl.anSteuerfrei,
            agBeitragProzent: vbl.agBeitragProzent,
          }
        : zv;
    onChange({ ...value, quelle: q, zusatzversorgung });
  };

  /** Kasse auswählen: übernimmt deren Zusatzbeitrag; 'manuell' behält den aktuellen Wert zum Bearbeiten */
  const selectKasse = (id: string) => {
    const kasse = activeKrankenkassen.kassen.find((k) => k.id === id);
    const rate =
      id === 'durchschnitt'
        ? activeLohnsteuer.sv.kvZusatzbeitragDurchschnitt
        : kasse
          ? kasse.zusatzbeitrag
          : value.kvZusatzbeitrag;
    onChange({ ...value, krankenkasse: id, kvZusatzbeitrag: rate });
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
      <LabeledBlock label="Bruttolohn" info={info.bruttoQuelle}>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200 p-1" role="radiogroup" aria-label="Quelle des Bruttolohns">
          {(['manuell', 'tarif'] as const).map((q) => (
            <button
              key={q}
              type="button"
              role="radio"
              aria-checked={value.quelle === q}
              onClick={() => selectQuelle(q)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                value.quelle === q ? 'bg-white text-petrol-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {q === 'manuell' ? 'Betrag eingeben' : 'Tarifvertrag öffentlicher Dienst'}
            </button>
          ))}
        </div>
      </LabeledBlock>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {value.quelle === 'tarif' ? (
          <TarifFields value={value} onChange={onChange} errorFor={errorFor} fieldPrefix={f} />
        ) : (
          <>
            <Field
              label={teilzeit ? 'Bruttolohn bei Vollzeit (monatlich)' : 'Bruttolohn (monatlich)'}
              error={errorFor(`${f}.bruttoMonatlich`)}
              info={info.bruttolohn}
              hint={teilzeit ? `bei ${pctLabel(value.arbeitszeit)}: ${fmt(effektiv.bruttoMonatlich)} / Monat` : undefined}
            >
              <MoneyInput
                value={value.bruttoMonatlich}
                onChange={(v) => set('bruttoMonatlich', v ?? 0)}
                error={!!errorFor(`${f}.bruttoMonatlich`)}
              />
            </Field>
            <Field
              label="Arbeitszeit"
              info={info.bruttoArbeitszeit}
              hint="Anteil einer Vollzeitstelle"
              error={errorFor(`${f}.bruttoArbeitszeit`)}
            >
              <MoneyInput
                value={value.arbeitszeit}
                onChange={(v) => set('arbeitszeit', v ?? 0)}
                suffix="%"
                step={1}
                error={!!errorFor(`${f}.bruttoArbeitszeit`)}
              />
            </Field>
            <Field
              label={teilzeit ? 'Sonderzahlungen bei Vollzeit (pro Jahr)' : 'Sonderzahlungen (pro Jahr)'}
              info={info.sonderzahlungen}
              hint={
                teilzeit && value.sonderzahlungenJahr > 0
                  ? `bei ${pctLabel(value.arbeitszeit)}: ${fmt(effektiv.sonderzahlungenJahr)} / Jahr – auf 12 Monate umgelegt`
                  : 'Weihnachts-/Urlaubsgeld – auf 12 Monate umgelegt'
              }
              error={errorFor(`${f}.sonderzahlungenJahr`)}
            >
              <MoneyInput value={value.sonderzahlungenJahr} onChange={(v) => set('sonderzahlungenJahr', v ?? 0)} />
            </Field>
            <div className="hidden sm:block" />
          </>
        )}
        <Field label="Steuerklasse" info={info.steuerklasse}>
          <select
            className="input"
            value={value.steuerklasse}
            onChange={(e) => set('steuerklasse', Number(e.target.value) as Steuerklasse)}
          >
            {STEUERKLASSEN.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kirchensteuer" info={info.kirchensteuer}>
          <select
            className="input"
            value={value.kirchensteuerSatz}
            onChange={(e) => set('kirchensteuerSatz', Number(e.target.value) as GrossIncomeInput['kirchensteuerSatz'])}
          >
            <option value={0}>keine</option>
            <option value={8}>8 % (Bayern, Baden-Württemberg)</option>
            <option value={9}>9 % (übrige Länder)</option>
          </select>
        </Field>
        <Field
          label="Kinderfreibeträge (Zähler)"
          info={info.kinderfreibetraege}
          hint="laut Lohnabrechnung, z. B. 0,5 oder 1,0 je Kind"
          error={errorFor(`${f}.kinderfreibetraege`)}
        >
          <input
            type="number"
            min={0}
            step={0.5}
            className="input"
            value={value.kinderfreibetraege}
            onChange={(e) => set('kinderfreibetraege', Number(e.target.value) || 0)}
          />
        </Field>
        <Field
          label="Kinder unter 25 (Pflegeversicherung)"
          info={info.pvKinder}
          hint="0 = Kinderlosenzuschlag; ab dem 2. Kind Beitragsabschlag"
          error={errorFor(`${f}.pvKinder`)}
        >
          <input
            type="number"
            min={0}
            step={1}
            className="input"
            value={value.pvKinder}
            onChange={(e) => set('pvKinder', Math.floor(Number(e.target.value) || 0))}
          />
        </Field>
        <Field
          label="Krankenkasse"
          info={info.krankenkasse}
          hint={
            activeKrankenkassen.kassen.find((k) => k.id === value.krankenkasse)?.hinweis ??
            `Zusatzbeiträge Stand ${activeKrankenkassen.stand} – bitte bei der Kasse prüfen`
          }
        >
          <select
            className="input"
            value={value.krankenkasse}
            onChange={(e) => selectKasse(e.target.value)}
            aria-label="Krankenkasse"
          >
            <option value="durchschnitt">
              Durchschnitt {jk.jahr} ({pctLabel(activeLohnsteuer.sv.kvZusatzbeitragDurchschnitt)})
            </option>
            <optgroup label="Die 10 größten Krankenkassen">
              {activeKrankenkassen.kassen.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({pctLabel(k.zusatzbeitrag)})
                </option>
              ))}
            </optgroup>
            <option value="manuell">Andere Kasse – Zusatzbeitrag selbst eingeben</option>
          </select>
        </Field>
        {value.krankenkasse === 'manuell' ? (
          <Field label="Zusatzbeitrag der Krankenkasse" error={errorFor(`${f}.kvZusatzbeitrag`)}>
            <MoneyInput value={value.kvZusatzbeitrag} onChange={(v) => set('kvZusatzbeitrag', v ?? 0)} suffix="%" />
          </Field>
        ) : (
          <Field label="Zusatzbeitrag der Krankenkasse">
            <div className="input bg-slate-100 text-slate-600">{pctLabel(value.kvZusatzbeitrag)}</div>
          </Field>
        )}
        <Field
          label="Zusatzversorgung (VBL o. Ä.)"
          info={info.zusatzversorgung}
          hint={zvKasse?.hinweis ?? (zv.kasse === 'keine' ? 'z. B. im öffentlichen Dienst' : undefined)}
        >
          <select
            className="input"
            value={zv.kasse}
            onChange={(e) => selectZv(e.target.value)}
            aria-label="Zusatzversorgung"
          >
            <option value="keine">keine</option>
            {activeZusatzversorgung.kassen.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} – Arbeitnehmeranteil {pctLabel(k.anProzent)}
              </option>
            ))}
            <option value="manuell">Andere Kasse (z. B. kommunale ZVK) – Sätze eingeben</option>
          </select>
        </Field>
        {zv.kasse === 'manuell' ? (
          <>
            <Field label="Arbeitnehmeranteil Zusatzversorgung" error={errorFor(`${f}.zv.anProzent`)}>
              <MoneyInput value={zv.anProzent} onChange={(v) => setZv({ anProzent: v ?? 0 })} suffix="%" />
            </Field>
            <Field
              label="Umlage des Arbeitgebers"
              hint="für den SV-pflichtigen Teil der Umlage; 0, wenn unbekannt"
              error={errorFor(`${f}.zv.agUmlageProzent`)}
            >
              <MoneyInput value={zv.agUmlageProzent} onChange={(v) => setZv({ agUmlageProzent: v ?? 0 })} suffix="%" />
            </Field>
            <div className="sm:col-span-2">
              <Toggle
                checked={zv.anSteuerfrei}
                onChange={(v) => setZv({ anSteuerfrei: v })}
                label="Arbeitnehmeranteil ist steuerfrei (Kapitaldeckung, § 3 Nr. 63 EStG)"
                hint="nur bei kapitalgedeckter Zusatzversorgung – Umlage-Anteile werden aus versteuertem Entgelt gezahlt"
              />
            </div>
          </>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200 pt-2 text-sm">
        <span className="text-slate-600">Geschätztes Netto (⌀ monatlich)</span>
        <span className="font-semibold tabular-nums text-slate-900">{fmt(r.nettoMonat)}</span>
        <span className="w-full text-xs text-slate-500">
          Lohnsteuer {fmt(r.lohnsteuer / 12)} · Soli {fmt(r.soli / 12)} · KiSt {fmt(r.kirchensteuer / 12)} · SV{' '}
          {fmt(r.sozialversicherung / 12)}
          {r.zusatzversorgungAn > 0 ? ` · Zusatzversorgung ${fmt(r.zusatzversorgungAn / 12)}` : ''} pro Monat – gesetzlich versichert, ohne individuelle Freibeträge
        </span>
      </div>
    </div>
  );
}
