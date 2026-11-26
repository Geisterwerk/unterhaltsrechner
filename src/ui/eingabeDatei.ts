import { standardJahr, verfuegbareJahre } from '../config';
import { APP_VERSION } from '../config/changelog';
import type { Szenario } from '../compare/vergleich';
import type { AgeInput, AgeStage, BedarfsPosten, CalculationInput, ParentId } from '../types';
import { defaultInput, emptyParent, newCommonChild, newId, newOtherChild } from './defaults';

/**
 * Speichern und Laden der Eingaben als JSON-Datei. Die Datei bleibt beim Nutzer; es wird nichts
 * im Browser oder auf einem Server abgelegt.
 *
 * Beim Laden werden fehlende oder ungültige Felder mit Standardwerten ergänzt, sodass auch Dateien
 * älterer Versionen (ohne später hinzugekommene Felder) geladen werden können.
 */

export const DATEI_FORMAT = 'unterhaltsrechner-eingaben';
export const DATEI_FORMAT_VERSION = 1;

export interface EingabeDatei {
  format: typeof DATEI_FORMAT;
  formatVersion: number;
  appVersion: string;
  gespeichertAm: string;
  hinweis: string;
  input: CalculationInput;
  szenarien: { name: string; input: CalculationInput }[];
}

export interface GeladeneEingaben {
  input: CalculationInput;
  szenarien: Szenario[];
  /** Hinweise zur Übernahme, z. B. ersetztes Berechnungsjahr */
  hinweise: string[];
  appVersion: string | null;
  gespeichertAm: string | null;
}

export function dateinameFuer(datum: Date = new Date()): string {
  const d = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
  return `unterhalt-eingaben-${d}.json`;
}

export function eingabenAlsJson(input: CalculationInput, szenarien: Szenario[], jetzt: Date = new Date()): string {
  const datei: EingabeDatei = {
    format: DATEI_FORMAT,
    formatVersion: DATEI_FORMAT_VERSION,
    appVersion: APP_VERSION,
    gespeichertAm: jetzt.toISOString(),
    hinweis: 'Enthält persönliche Angaben (Einkommen, Kinder). Nur an Personen weitergeben, die sie sehen dürfen.',
    input,
    szenarien: szenarien.map((s) => ({ name: s.name, input: s.input })),
  };
  return JSON.stringify(datei, null, 2);
}

const istObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Übernimmt Werte aus `wert` in die Struktur von `vorlage`: nur bekannte Schlüssel, nur passende Typen.
 * Arrays werden unverändert übernommen (Elemente normalisiert der Aufrufer).
 */
function zusammenfuehren<T>(vorlage: T, wert: unknown): T {
  if (vorlage === null) {
    return (wert === null || typeof wert === 'number' ? wert : vorlage) as T;
  }
  if (Array.isArray(vorlage)) return (Array.isArray(wert) ? wert : vorlage) as T;
  if (istObjekt(vorlage)) {
    if (!istObjekt(wert)) return vorlage;
    const out: Record<string, unknown> = { ...vorlage };
    for (const k of Object.keys(vorlage)) {
      if (k in wert) out[k] = zusammenfuehren((vorlage as Record<string, unknown>)[k], wert[k]);
    }
    // Alters-Union: je nach Art andere Felder
    if (typeof wert.kind === 'string' && 'kind' in vorlage) {
      if (wert.kind === 'birthdate' && typeof wert.birthdate === 'string') return { kind: 'birthdate', birthdate: wert.birthdate } as T;
      if (wert.kind === 'stage' && typeof wert.stage === 'number') return { kind: 'stage', stage: wert.stage } as T;
    }
    return out as T;
  }
  if (typeof vorlage === 'number') return (typeof wert === 'number' && Number.isFinite(wert) ? wert : vorlage) as T;
  return (typeof wert === typeof vorlage ? wert : vorlage) as T;
}

/** Auswahlwerte prüfen: unbekannte Werte (z. B. aus manipulierten Dateien) durch den Standard ersetzen */
const erlaubt = <T extends string>(wert: T, werte: readonly T[], standard: T): T => (werte.includes(wert) ? wert : standard);
const ELTERN = ['A', 'B'] as const;
const alterPruefen = (a: AgeInput): AgeInput =>
  a.kind === 'stage'
    ? { kind: 'stage', stage: ([0, 1, 2, 3] as AgeStage[]).includes(a.stage) ? a.stage : 0 }
    : { kind: 'birthdate', birthdate: a.birthdate };

const idOder = (v: unknown, prefix: string) => (typeof v === 'string' && v.length > 0 ? v : newId(prefix));

function normalisiereInput(roh: unknown, hinweise: string[]): CalculationInput {
  const basis = defaultInput();
  const r = istObjekt(roh) ? roh : {};
  const input = zusammenfuehren(basis, r);

  const rohParents = istObjekt(r.parents) ? r.parents : {};
  for (const p of ['A', 'B'] as ParentId[]) {
    const rp = istObjekt(rohParents[p]) ? rohParents[p] : {};
    const parent = zusammenfuehren(emptyParent(basis.parents[p].label, 0), rp);
    parent.incomeMode = erlaubt(parent.incomeMode, ['netto', 'brutto'], 'netto');
    parent.deductions.berufsbedingtMode = erlaubt(parent.deductions.berufsbedingtMode, ['pauschal', 'konkret', 'keine'], 'keine');
    parent.otherChildren = (Array.isArray(rp.otherChildren) ? rp.otherChildren : []).map((c, i) => {
      const k = zusammenfuehren(newOtherChild(i + 1), c);
      return {
        ...k,
        id: idOder(istObjekt(c) ? c.id : undefined, 'weiteres'),
        age: alterPruefen(k.age),
        adultRank: erlaubt(k.adultRank, ['privilegiert', 'sonstig'], 'privilegiert'),
        care: erlaubt(k.care, ['barunterhalt', 'haushalt'], 'barunterhalt'),
      };
    });
    input.parents[p] = parent;
  }

  input.children = (Array.isArray(r.children) ? r.children : []).map((c, i) => {
    const k = zusammenfuehren(newCommonChild(i + 1), c);
    const rc = istObjekt(c) ? c : {};
    const posten: BedarfsPosten[] = (Array.isArray(rc.bedarfsposten) ? rc.bedarfsposten : []).map((b) => {
      const bp = zusammenfuehren<BedarfsPosten>({ id: newId('posten'), bezeichnung: '', art: 'mehrbedarf', betrag: 0, verauslagt: 'A' }, b);
      return {
        ...bp,
        art: erlaubt(bp.art, ['mehrbedarf', 'sonderbedarf'], 'mehrbedarf'),
        verauslagt: erlaubt(bp.verauslagt, ELTERN, 'A'),
      };
    });
    return {
      ...k,
      id: idOder(rc.id, 'kind'),
      age: alterPruefen(k.age),
      care: erlaubt(k.care, ['A', 'B', 'wechsel'], 'B'),
      kindergeldRecipient: erlaubt(k.kindergeldRecipient, ELTERN, 'B'),
      adultRank: erlaubt(k.adultRank, ['privilegiert', 'sonstig'], 'privilegiert'),
      bedarfsposten: posten,
    };
  });

  if (input.ehegatte) input.ehegatte.art = erlaubt(input.ehegatte.art, ['trennung', 'nachehelich'], 'trennung');
  if (!verfuegbareJahre.includes(input.jahr)) {
    const ersatz = standardJahr();
    hinweise.push(`Das Berechnungsjahr ${input.jahr} ist in dieser Version nicht verfügbar – es wurde ${ersatz} verwendet.`);
    input.jahr = ersatz;
  }
  return input;
}

/** Liest eine gespeicherte Datei; wirft einen Fehler mit verständlicher Meldung, wenn sie nicht passt. */
export function eingabenAusJson(text: string): GeladeneEingaben {
  let daten: unknown;
  try {
    daten = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist keine gültige JSON-Datei.');
  }
  if (!istObjekt(daten) || daten.format !== DATEI_FORMAT) {
    throw new Error('Die Datei stammt nicht aus dem Unterhaltsrechner.');
  }
  if (typeof daten.formatVersion !== 'number' || daten.formatVersion > DATEI_FORMAT_VERSION) {
    throw new Error('Die Datei wurde mit einer neueren Version gespeichert – bitte die Seite neu laden.');
  }
  const hinweise: string[] = [];
  const input = normalisiereInput(daten.input, hinweise);
  const szenarien: Szenario[] = (Array.isArray(daten.szenarien) ? daten.szenarien : []).map((s, i) => {
    const rs = istObjekt(s) ? s : {};
    return {
      id: newId('szenario'),
      name: typeof rs.name === 'string' && rs.name.trim() ? rs.name : `Szenario ${i + 1}`,
      input: normalisiereInput(rs.input, hinweise),
    };
  });
  return {
    input,
    szenarien,
    hinweise: [...new Set(hinweise)],
    appVersion: typeof daten.appVersion === 'string' ? daten.appVersion : null,
    gespeichertAm: typeof daten.gespeichertAm === 'string' ? daten.gespeichertAm : null,
  };
}
