import type { AgeStage, IncomeGroup, UnterhaltsTabelleConfig } from '../types';
import { clamp } from './util';

export interface GroupLookup {
  group: number;
  /** Einkommen liegt über der höchsten Tabellengruppe */
  aboveTable: boolean;
}

/** Einkommensgruppe zum (bereinigten) Einkommen ermitteln */
export function findIncomeGroup(income: number, cfg: UnterhaltsTabelleConfig): GroupLookup {
  const groups = cfg.incomeGroups;
  const rounded = Math.floor(Math.max(0, income));
  for (const g of groups) {
    if (rounded >= g.from && (g.to === null || rounded <= g.to)) {
      return { group: g.group, aboveTable: false };
    }
  }
  const last = groups[groups.length - 1];
  return { group: last.group, aboveTable: true };
}

export function getGroup(group: number, cfg: UnterhaltsTabelleConfig): IncomeGroup {
  const g = cfg.incomeGroups.find((x) => x.group === group);
  if (!g) throw new Error(`Einkommensgruppe ${group} nicht in Konfiguration vorhanden`);
  return g;
}

export function maxGroup(cfg: UnterhaltsTabelleConfig): number {
  return cfg.incomeGroups[cfg.incomeGroups.length - 1].group;
}

/** Tabellenbetrag (Bedarf) für Gruppe und Altersstufe */
export function tableAmount(group: number, stage: AgeStage, cfg: UnterhaltsTabelleConfig): number {
  return getGroup(group, cfg).amounts[stage];
}

/**
 * Anrechenbares Kindergeld: hälftig bei Minderjährigen (§ 1612b Abs. 1 Nr. 1 BGB),
 * voll bei Volljährigen (§ 1612b Abs. 1 Nr. 2 BGB).
 */
export function kindergeldCredit(stage: AgeStage, cfg: UnterhaltsTabelleConfig): number {
  return stage === 3 ? cfg.kindergeld : cfg.kindergeld / 2;
}

/** Zahlbetrag nach Tabelle = Tabellenbetrag − anrechenbares Kindergeld (nicht negativ) */
export function tableZahlbetrag(group: number, stage: AgeStage, cfg: UnterhaltsTabelleConfig): number {
  return Math.max(0, tableAmount(group, stage, cfg) - kindergeldCredit(stage, cfg));
}

/**
 * Verschiebung der Einkommensgruppe nach Anzahl der Unterhaltsberechtigten.
 * Standard 2 Berechtigte → 0; 1 → Höherstufung; ≥ 3 → Herabstufung je weiterem Berechtigten.
 */
export function stufungShift(anzahlBerechtigte: number, cfg: UnterhaltsTabelleConfig): number {
  const s = cfg.stufung;
  if (anzahlBerechtigte <= 0) return 0;
  if (anzahlBerechtigte < s.standardBerechtigte) return s.hoeherstufungBeiEinem;
  if (anzahlBerechtigte === s.standardBerechtigte) return 0;
  const down = (anzahlBerechtigte - s.standardBerechtigte) * s.herabstufungJeWeiterem;
  return -Math.min(down, s.maxHerabstufung);
}

export function applyStufung(baseGroup: number, shift: number, cfg: UnterhaltsTabelleConfig): number {
  return clamp(baseGroup + shift, 1, maxGroup(cfg));
}

/** Gruppe inkl. Zu-/Herabstufung in einem Schritt */
export function groupWithStufung(
  income: number,
  anzahlBerechtigte: number,
  cfg: UnterhaltsTabelleConfig,
): { base: GroupLookup; shift: number; group: number } {
  const base = findIncomeGroup(income, cfg);
  const shift = stufungShift(anzahlBerechtigte, cfg);
  return { base, shift, group: applyStufung(base.group, shift, cfg) };
}
