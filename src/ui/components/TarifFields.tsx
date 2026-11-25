import { fmt } from '../../engine';
import { ersteGueltigeStufe, findTarif, resolveTarif } from '../../engine/tarif';
import type { GrossIncomeInput, TarifInput, TarifTabelle } from '../../types';
import { infoTexte } from '../infoTexte';
import { useJahr } from '../JahrContext';
import { Field, MoneyInput, Toggle } from './fields';

interface Props {
  value: GrossIncomeInput;
  onChange: (v: GrossIncomeInput) => void;
  errorFor: (field: string) => string | undefined;
  fieldPrefix: string;
}

const datum = (iso: string) => iso.split('-').reverse().join('.');

/** Gültige Stufe in einer Gruppe sicherstellen (vorhandene Stufe beibehalten, sonst erste gültige) */
function normalize(t: TarifInput, tabelle: TarifTabelle | undefined): TarifInput {
  if (!tabelle) return t;
  const gruppe = tabelle.gruppen.find((g) => g.id === t.gruppe) ?? tabelle.gruppen[Math.floor(tabelle.gruppen.length / 2)];
  const stufe = gruppe.werte[t.stufe - 1] != null ? t.stufe : ersteGueltigeStufe(gruppe);
  return { ...t, gruppe: gruppe.id, stufe };
}

/** Auswahl von Tarifvertrag, Entgeltgruppe, Stufe und Arbeitszeit (Fragment im zweispaltigen Raster) */
export function TarifFields({ value, onChange, errorFor, fieldPrefix: f }: Props) {
  const jk = useJahr();
  const activeTarife = jk.tarife;
  const info = infoTexte(jk);
  const t = value.tarif;
  const tabelle = findTarif(activeTarife, t.tarifId);
  const gruppe = tabelle?.gruppen.find((g) => g.id === t.gruppe);
  const ergebnis = resolveTarif(value, activeTarife);

  const setTarif = (patch: Partial<TarifInput>) => {
    const next = { ...t, ...patch };
    // Zulagen gehören zum Tarifvertrag – bei Wechsel zurücksetzen
    if (patch.tarifId && patch.tarifId !== t.tarifId) next.zulagen = [];
    onChange({ ...value, tarif: normalize(next, findTarif(activeTarife, next.tarifId)) });
  };

  return (
    <>
      <Field label="Tarifvertrag" className="sm:col-span-2" error={errorFor(`${f}.tarif`)} info={info.tarifvertrag}>
        <select
          className="input"
          value={t.tarifId}
          onChange={(e) => setTarif({ tarifId: e.target.value })}
          aria-label="Tarifvertrag"
        >
          {activeTarife.tabellen.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.name} – gültig ab {datum(tab.gueltigAb)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tabelle?.gruppenLabel ?? 'Entgeltgruppe'} info={info.entgeltgruppe}>
        <select
          className="input"
          value={t.gruppe}
          onChange={(e) => setTarif({ gruppe: e.target.value })}
          aria-label={tabelle?.gruppenLabel ?? 'Entgeltgruppe'}
        >
          {tabelle?.gruppen.map((g) => (
            <option key={g.id} value={g.id}>
              {g.id}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tabelle?.stufenLabel ?? 'Stufe'} info={info.stufe}>
        <select
          className="input"
          value={t.stufe}
          onChange={(e) => setTarif({ stufe: Number(e.target.value) })}
          aria-label={tabelle?.stufenLabel ?? 'Stufe'}
        >
          {gruppe?.werte.map((w, i) => (
            <option key={i} value={i + 1} disabled={w === null}>
              {tabelle?.stufenLabel} {i + 1}
              {w === null ? ' – nicht vorhanden' : ` – ${fmt(w)}`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Arbeitszeit" hint="Anteil einer Vollzeitstelle" error={errorFor(`${f}.arbeitszeit`)} info={info.arbeitszeit}>
        <MoneyInput
          value={t.arbeitszeit}
          onChange={(v) => setTarif({ arbeitszeit: v ?? 0 })}
          suffix="%"
          step={1}
          error={!!errorFor(`${f}.arbeitszeit`)}
        />
      </Field>
      <div className="flex items-end pb-2">
        <Toggle
          checked={t.jahressonderzahlung}
          onChange={(v) => setTarif({ jahressonderzahlung: v })}
          label={`Jahressonderzahlung einrechnen${gruppe ? ` (${gruppe.jahressonderzahlung.toLocaleString('de-DE')} %)` : ''}`}
        />
      </div>

      {tabelle?.zulagen && tabelle.zulagen.length > 0 && gruppe && (
        <div className="space-y-2 sm:col-span-2">
          <span className="label">Zulagen</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {tabelle.zulagen.map((z) => {
              const betrag = z.betraege[gruppe.id];
              if (betrag === undefined) return null;
              const aktiv = (t.zulagen ?? []).includes(z.id);
              return (
                <Toggle
                  key={z.id}
                  checked={aktiv}
                  onChange={(v) =>
                    setTarif({ zulagen: v ? [...(t.zulagen ?? []), z.id] : (t.zulagen ?? []).filter((x) => x !== z.id) })
                  }
                  label={`${z.name} (${fmt(betrag)} bei Vollzeit)`}
                />
              );
            })}
          </div>
        </div>
      )}

      {ergebnis && (
        <div className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600 sm:col-span-2">
          <div className="flex flex-wrap justify-between gap-2">
            <span>
              Tabellenentgelt {fmt(ergebnis.tabellenentgelt)}
              {ergebnis.arbeitszeit < 100 ? ` × ${ergebnis.arbeitszeit} %` : ''}
              {ergebnis.zulagen.map((z) => ` + ${z.name} ${fmt(z.betrag)}`).join('')}
            </span>
            <span className="font-semibold text-slate-900">Brutto {fmt(ergebnis.bruttoMonatlich)} / Monat</span>
          </div>
          {ergebnis.jahressonderzahlung > 0 && (
            <div>Jahressonderzahlung {fmt(ergebnis.jahressonderzahlung)} (auf 12 Monate umgelegt)</div>
          )}
          {tabelle?.hinweis && <div className="mt-1 text-slate-500">Hinweis: {tabelle.hinweis}</div>}
          <div className="mt-1 text-slate-500">
            Ohne sonstige Zulagen und Leistungsentgelt · Quelle: oeffentlicher-dienst.info – bitte prüfen
          </div>
        </div>
      )}
    </>
  );
}
