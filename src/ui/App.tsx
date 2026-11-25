import { useMemo, useState } from 'react';
import { getJahresKonfiguration, JAHRE } from '../config';
import { calculate } from '../engine';
import type { CalculationInput, JahresKonfiguration, ParentId, ParentInput } from '../types';
import { ChildrenForm } from './components/ChildrenForm';
import { Field, Toggle } from './components/fields';
import { ParentForm } from './components/ParentForm';
import { ResultPanel } from './components/ResultPanel';
import { SpousePanel } from './components/SpousePanel';
import { MAX_SZENARIEN, ScenarioPanel } from './components/ScenarioPanel';
import type { Szenario } from '../compare/vergleich';
import { defaultInput, newId } from './defaults';
import { infoTexte } from './infoTexte';
import { JahrContext } from './JahrContext';

/**
 * Beim Jahreswechsel die aus Listen gewählten Sätze (Krankenkasse, Zusatzversorgung) auf die Werte des
 * neuen Jahres setzen; manuell eingegebene Sätze bleiben unverändert.
 */
function syncParentToYear(p: ParentInput, jk: JahresKonfiguration): ParentInput {
  const g = p.gross;
  const kasse = jk.krankenkassen.kassen.find((k) => k.id === g.krankenkasse);
  const kvZusatzbeitrag =
    g.krankenkasse === 'durchschnitt' ? jk.lohnsteuer.sv.kvZusatzbeitragDurchschnitt : kasse ? kasse.zusatzbeitrag : g.kvZusatzbeitrag;
  const zvKasse = jk.zusatzversorgung.kassen.find((k) => k.id === g.zusatzversorgung.kasse);
  const zusatzversorgung = zvKasse
    ? {
        kasse: zvKasse.id,
        anProzent: zvKasse.anProzent,
        agUmlageProzent: zvKasse.agUmlageProzent,
        anSteuerfrei: zvKasse.anSteuerfrei,
        agBeitragProzent: zvKasse.agBeitragProzent,
      }
    : g.zusatzversorgung;
  return { ...p, gross: { ...g, kvZusatzbeitrag, zusatzversorgung } };
}

/** Rollen eines Elternteils aus dem Betreuungsmodell der gemeinsamen Kinder ableiten */
function rolesOf(p: ParentId, input: CalculationInput): string[] {
  const roles: string[] = [];
  if (input.children.some((c) => c.care === p)) roles.push('betreuend');
  if (input.children.some((c) => c.care !== p && c.care !== 'wechsel')) roles.push('barunterhaltspflichtig');
  if (input.children.some((c) => c.care === 'wechsel')) roles.push('Wechselmodell');
  return roles;
}

export function App() {
  const [input, setInput] = useState<CalculationInput>(defaultInput);
  // Szenarien nur im Arbeitsspeicher (persönliche Daten werden nicht gespeichert)
  const [szenarien, setSzenarien] = useState<Szenario[]>([]);
  const szenarioMerken = (name: string) =>
    setSzenarien((prev) =>
      prev.length >= MAX_SZENARIEN ? prev : [...prev, { id: newId('szenario'), name, input: structuredClone(input) }],
    );
  const jk = getJahresKonfiguration(input.jahr);
  const activeTable = jk.tabelle;
  const info = infoTexte(jk);
  const result = useMemo(() => calculate(input), [input]);

  /** Berechnungsjahr wechseln; Stichtag wandert in das neue Jahr (gleicher Tag/Monat) */
  const setJahr = (jahr: number) =>
    setInput((prev) => {
      const neu = getJahresKonfiguration(jahr);
      const stichtag = /^\d{4}-/.test(prev.referenceDate) ? `${jahr}${prev.referenceDate.slice(4)}` : prev.referenceDate;
      return {
        ...prev,
        jahr,
        referenceDate: stichtag.endsWith('-02-29') ? `${jahr}-02-28` : stichtag,
        parents: { A: syncParentToYear(prev.parents.A, neu), B: syncParentToYear(prev.parents.B, neu) },
      };
    });

  const errorFor = (field: string) =>
    result.issues.find((i) => i.severity === 'error' && i.field === field)?.message;

  const set = <K extends keyof CalculationInput>(key: K, v: CalculationInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: v }));
  const setOption = <K extends keyof CalculationInput['options']>(key: K, v: CalculationInput['options'][K]) =>
    setInput((prev) => ({ ...prev, options: { ...prev.options, [key]: v } }));

  return (
    <JahrContext.Provider value={jk}>
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Kindesunterhaltsrechner</h1>
        <p className="text-sm text-slate-600">
          Residenz- und Wechselmodell inkl. weiterer unterhaltsberechtigter Kinder · {activeTable.name}
        </p>
      </header>

      <LegalNotice />
      {jk.status === 'vorlaeufig' && <VorlaeufigNotice jk={jk} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <section className="card space-y-4">
            <p className="text-sm text-slate-600">
              Das Betreuungsmodell (Residenz bei A, Residenz bei B oder Wechselmodell) wird <strong>je Kind</strong>{' '}
              festgelegt. Gemischte Konstellationen und Geschwistertrennung werden gemeinsam berechnet.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Berechnungsjahr"
                info={info.berechnungsjahr}
                hint="bestimmt Düsseldorfer Tabelle, Kindergeld, Steuer- und Sozialversicherungswerte sowie Tariftabellen"
              >
                <select
                  className="input"
                  value={input.jahr}
                  onChange={(e) => setJahr(Number(e.target.value))}
                  aria-label="Berechnungsjahr"
                >
                  {JAHRE.map((j) => (
                    <option key={j.jahr} value={j.jahr}>
                      {j.jahr}
                      {j.status === 'vorlaeufig' ? ' (vorläufig)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stichtag (Altersberechnung)" error={errorFor('referenceDate')} info={info.stichtag}>
                <input
                  type="date"
                  className="input"
                  value={input.referenceDate}
                  onChange={(e) => set('referenceDate', e.target.value)}
                />
              </Field>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Berechnungsoptionen</h3>
              <Toggle
                checked={input.options.haushaltskinderEinbeziehen}
                onChange={(v) => setOption('haushaltskinderEinbeziehen', v)}
                label="Selbst betreute Kinder beim Zahlenden berücksichtigen"
                info={
                  <>
                    <p>
                      Betrifft den Elternteil, der Barunterhalt zahlt. Gemeint sind Kinder, die er selbst versorgt:
                      gemeinsame Kinder in seinem Haushalt (z. B. bei Geschwistertrennung), gemeinsame Kinder im
                      Wechselmodell und eigene Kinder aus anderen Beziehungen in seinem Haushalt.
                    </p>
                    <p>
                      <strong>An:</strong> Diese Kinder gehen mit einem fiktiven Betrag (Tabellenbetrag abzüglich
                      hälftigem Kindergeld) in Bedarfskontrolle, Selbstbehaltsprüfung und Mangelfall ein – er muss sie
                      vom selben Einkommen unterhalten. Folge: eher Herabstufung; im Mangelfall wird die
                      Verteilungsmasse auf mehr Kinder verteilt.
                    </p>
                    <p>
                      <strong>Aus:</strong> Sie zählen nur bei der Zu-/Herabstufung nach der Anzahl der Berechtigten.
                    </p>
                  </>
                }
              />
              <Toggle
                checked={input.options.wechselNaturalunterhaltAbzug}
                onChange={(v) => setOption('wechselNaturalunterhaltAbzug', v)}
                label="Wechselmodell: weitere Kinder im eigenen Haushalt vom Einkommen abziehen"
                info={
                  <>
                    <p>
                      Gilt nur für Kinder im Wechselmodell. Bevor die Einkommen beider Eltern zusammengerechnet werden,
                      wird bei jedem Elternteil der Unterhalt für gleichrangige weitere Kinder abgezogen.
                    </p>
                    <p>
                      Kinder, für die ein Elternteil <strong>Barunterhalt zahlt</strong>, werden immer abgezogen. Bei
                      eigenen Kindern aus anderen Beziehungen, die <strong>im Haushalt leben</strong>, wird nur bei
                      aktivierter Option ein fiktiver Zahlbetrag aus der eigenen Einkommensgruppe abgezogen.
                    </p>
                    <p>
                      Folge: Das maßgebliche Einkommen dieses Elternteils sinkt – das Gesamteinkommen kann in eine
                      niedrigere Gruppe fallen, und die Haftungsquote verschiebt sich zum anderen Elternteil.
                    </p>
                  </>
                }
              />
              <Toggle
                checked={input.options.wechselStufung}
                onChange={(v) => setOption('wechselStufung', v)}
                label="Wechselmodell: Zu-/Herabstufung nach Kinderzahl"
                info={
                  <>
                    <p>
                      Im Wechselmodell ergibt sich die Tabellengruppe aus dem zusammengerechneten Einkommen beider
                      Eltern.
                    </p>
                    <p>
                      <strong>Aus</strong> (üblich): Die Gruppe des Gesamteinkommens gilt unverändert.
                    </p>
                    <p>
                      <strong>An:</strong> Die Gruppe wird wie im Residenzmodell nach der Anzahl der gemeinsamen Kinder
                      angepasst – bei einem Kind eine Gruppe höher, ab drei Kindern je weiterem Kind eine Gruppe tiefer.
                    </p>
                  </>
                }
              />
              <p className="text-xs text-slate-500">
                Welche Einstellung zutrifft, hängt von den Leitlinien des zuständigen Oberlandesgerichts ab.
              </p>
            </div>
          </section>

          <div className="space-y-4">
            {(['A', 'B'] as ParentId[]).map((p) => (
              <ParentForm
                key={p}
                id={p}
                value={input.parents[p]}
                onChange={(v) => set('parents', { ...input.parents, [p]: v })}
                errorFor={errorFor}
                roles={rolesOf(p, input)}
                referenceDate={input.referenceDate}
              />
            ))}
          </div>

          <ChildrenForm
            value={input.children}
            onChange={(v) => set('children', v)}
            parents={input.parents}
            errorFor={errorFor}
            referenceDate={input.referenceDate}
          />

          <SpousePanel
            value={input.ehegatte ?? { aktiv: false, art: 'trennung' }}
            onChange={(v) => set('ehegatte', v)}
          />

          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={() => setInput(defaultInput())}>
              Eingaben zurücksetzen
            </button>
          </div>
        </div>

        <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
          <ResultPanel input={input} result={result} parents={input.parents} tableName={activeTable.name} />
        </div>
      </div>

      <ScenarioPanel
        input={input}
        szenarien={szenarien}
        onSave={szenarioMerken}
        onLoad={(s) => setInput(structuredClone(s.input))}
        onRemove={(id) => setSzenarien((prev) => prev.filter((s) => s.id !== id))}
      />

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
        {activeTable.sourceNote} Kindergeld: {activeTable.kindergeld} € · Selbstbehalt notwendig{' '}
        {activeTable.selbstbehalt.notwendigErwerbstaetig} € / {activeTable.selbstbehalt.notwendigNichtErwerbstaetig} € ·
        angemessen {activeTable.selbstbehalt.angemessen} €
      </footer>
    </div>
    </JahrContext.Provider>
  );
}

function VorlaeufigNotice({ jk }: { jk: JahresKonfiguration }) {
  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
      <strong>Vorläufige Berechnung für {jk.jahr}:</strong> Nicht alle Werte sind bereits amtlich veröffentlicht. Die
      Ergebnisse können sich noch ändern.
      <ul className="mt-2 list-inside list-disc space-y-0.5">
        {jk.hinweise.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}

function LegalNotice() {
  return (
    <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900" role="note">
      <strong>Rechtlicher Hinweis:</strong> Die Berechnung ist eine unverbindliche Orientierung auf Basis
      vereinfachter Annahmen. Sie ersetzt keine familienrechtliche Beratung im Einzelfall und ist nicht für
      rechtsverbindliche Entscheidungen bestimmt. Abweichende Leitlinien der Oberlandesgerichte sowie
      Besonderheiten des Einzelfalls (z. B. Mehr- und Sonderbedarf, Erwerbsobliegenheit, Wohnvorteil) bleiben
      unberücksichtigt.
    </div>
  );
}
