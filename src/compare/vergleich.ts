import { leitlinienFuer } from '../config/leitlinien';
import { getJahresKonfiguration } from '../config';
import { calculate, fmt } from '../engine';
import { bereinigtesEinkommen } from '../engine/income';
import type { CalculationInput, CalculationResult, ParentId } from '../types';

/** Ein gemerkter Rechenstand */
export interface Szenario {
  id: string;
  name: string;
  input: CalculationInput;
}

export interface VergleichZeile {
  label: string;
  /** Anzeigewert je Szenario */
  werte: string[];
  /** Zahlenwert je Szenario für die Differenz zum ersten Szenario (fehlt = keine Differenz) */
  zahlen?: (number | null)[];
  ueberschrift?: boolean;
  betont?: boolean;
}

export interface Vergleich {
  spalten: string[];
  zeilen: VergleichZeile[];
}

const PARENTS: ParentId[] = ['A', 'B'];

function careText(s: Szenario, childId: string): string {
  const c = s.input.children.find((x) => x.id === childId);
  if (!c) return '–';
  if (c.eigenerHaushalt && (c.age.kind === 'stage' ? c.age.stage === 3 : true)) return 'eigener Haushalt';
  return c.care === 'wechsel' ? 'Wechselmodell' : `bei ${s.input.parents[c.care].label}`;
}

function flow(r: CalculationResult, payer: ParentId, payee: ParentId | 'Kind'): number {
  return r.summary.find((f) => f.payer === payer && f.payee === payee)?.amount ?? 0;
}

/** Vergleichstabelle mehrerer Szenarien; Differenzen beziehen sich auf das erste Szenario */
export function buildVergleich(szenarien: Szenario[]): Vergleich {
  const results = szenarien.map((s) => calculate(s.input));
  const name = (p: ParentId) => szenarien[0]?.input.parents[p].label ?? `Elternteil ${p}`;
  const zeilen: VergleichZeile[] = [];
  const zeile = (label: string, f: (s: Szenario, r: CalculationResult) => string, n?: (s: Szenario, r: CalculationResult) => number | null, betont = false) =>
    zeilen.push({
      label,
      werte: szenarien.map((s, i) => f(s, results[i])),
      zahlen: n ? szenarien.map((s, i) => (results[i].ok ? n(s, results[i]) : null)) : undefined,
      betont,
    });

  zeilen.push({ label: 'Grundlagen', werte: szenarien.map(() => ''), ueberschrift: true });
  zeile('Berechnungsjahr', (s) => {
    const jk = getJahresKonfiguration(s.input.jahr);
    return `${jk.jahr}${jk.status === 'vorlaeufig' ? ' (vorläufig)' : ''}`;
  });
  zeile('Status', (_, r) => (r.ok ? 'berechnet' : 'Eingaben fehlerhaft'));
  for (const p of PARENTS) {
    zeile(
      `Bereinigtes Einkommen ${name(p)}`,
      (s) => fmt(bereinigtesEinkommen(s.input.parents[p], getJahresKonfiguration(s.input.jahr), leitlinienFuer(s.input.options.leitlinien)).bereinigt),
      (s) => bereinigtesEinkommen(s.input.parents[p], getJahresKonfiguration(s.input.jahr), leitlinienFuer(s.input.options.leitlinien)).bereinigt,
    );
  }

  // Kinder (Vereinigung über alle Szenarien, Zuordnung über die ID)
  const kinder = new Map<string, string>();
  for (const s of szenarien) for (const c of s.input.children) kinder.set(c.id, c.label);
  zeilen.push({ label: 'Betreuung und Unterhalt je Kind (monatlich)', werte: szenarien.map(() => ''), ueberschrift: true });
  for (const [id, label] of kinder) {
    zeile(`${label}: Betreuung`, (s) => careText(s, id));
    zeile(`${label}: Unterhalt`, (s, r) => {
      if (!s.input.children.some((c) => c.id === id)) return '–';
      const z = r.payments.filter((p) => p.childId === id && p.art !== 'mehrbedarf' && p.payer && p.amount > 0);
      if (z.length === 0) return r.ok ? 'keine Zahlung' : '–';
      return z.map((p) => `${s.input.parents[p.payer!].label} → ${p.payee === 'Kind' ? 'Kind' : s.input.parents[p.payee as ParentId].label} ${fmt(p.amount)}`).join('; ');
    });
  }

  zeilen.push({ label: 'Ergebnis (monatlich)', werte: szenarien.map(() => ''), ueberschrift: true });
  zeile(`${name('A')} → ${name('B')}`, (_, r) => (r.ok ? fmt(flow(r, 'A', 'B')) : '–'), (_, r) => flow(r, 'A', 'B'), true);
  zeile(`${name('B')} → ${name('A')}`, (_, r) => (r.ok ? fmt(flow(r, 'B', 'A')) : '–'), (_, r) => flow(r, 'B', 'A'), true);
  if (results.some((r) => r.summary.some((f) => f.payee === 'Kind'))) {
    for (const p of PARENTS) {
      zeile(`${name(p)} → volljährige Kinder`, (_, r) => (r.ok ? fmt(flow(r, p, 'Kind')) : '–'), (_, r) => flow(r, p, 'Kind'));
    }
  }
  zeile(
    `Saldo (+ = ${name('A')} zahlt)`,
    (_, r) => (r.ok ? fmt(flow(r, 'A', 'B') - flow(r, 'B', 'A')) : '–'),
    (_, r) => flow(r, 'A', 'B') - flow(r, 'B', 'A'),
  );
  zeile(
    'davon Mehrbedarf',
    (_, r) => (r.ok ? fmt(r.payments.filter((p) => p.art === 'mehrbedarf').reduce((a, p) => a + p.amount, 0)) : '–'),
    (_, r) => r.payments.filter((p) => p.art === 'mehrbedarf').reduce((a, p) => a + p.amount, 0),
  );
  zeile(
    'davon Ehegattenunterhalt',
    (s, r) => (r.ok ? (r.ehegatte ? `${s.input.parents[r.ehegatte.payer].label} → ${fmt(r.ehegatte.amount)}` : fmt(0)) : '–'),
    (_, r) => (r.ehegatte ? (r.ehegatte.payer === 'A' ? r.ehegatte.amount : -r.ehegatte.amount) : 0),
  );
  zeile(
    'Einmalige Erstattungen (Sonderbedarf)',
    (_, r) => (r.ok ? fmt(r.einmalig.reduce((a, e) => a + e.betrag, 0)) : '–'),
    (_, r) => r.einmalig.reduce((a, e) => a + e.betrag, 0),
  );

  return { spalten: szenarien.map((s) => s.name), zeilen };
}

/** Differenz zum ersten Szenario als Text (leer bei 0 oder ohne Zahlen) */
export function differenz(z: VergleichZeile, index: number): string {
  if (!z.zahlen || index === 0) return '';
  const basis = z.zahlen[0];
  const wert = z.zahlen[index];
  if (basis === null || wert === null) return '';
  const d = Math.round((wert - basis) * 100) / 100;
  if (d === 0) return '';
  return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}`;
}
