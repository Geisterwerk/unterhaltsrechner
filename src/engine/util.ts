import type { AgeInput, AgeStage, ParentId } from '../types';

/** Kaufmännisch auf Cent runden */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function otherParent(p: ParentId): ParentId {
  return p === 'A' ? 'B' : 'A';
}

/**
 * Alter in Jahren nach § 1612a Abs. 3 BGB: Die höhere Altersstufe gilt ab Beginn
 * des Monats, in dem das Kind das Alter vollendet – maßgeblich ist daher der Monat.
 */
export function ageInYears(birthdate: string, referenceDate: string): number | null {
  const b = parseIsoDate(birthdate);
  const r = parseIsoDate(referenceDate);
  if (!b || !r) return null;
  let age = r.year - b.year;
  if (r.month < b.month) age -= 1;
  return age;
}

export function stageFromAge(age: number): AgeStage {
  if (age < 6) return 0;
  if (age < 12) return 1;
  if (age < 18) return 2;
  return 3;
}

/** Altersstufe aus Eingabe ermitteln (Fallback 0 bei ungültigem Datum – Validierung meldet den Fehler) */
export function resolveStage(age: AgeInput, referenceDate: string): AgeStage {
  if (age.kind === 'stage') return age.stage;
  const years = ageInYears(age.birthdate, referenceDate);
  return years === null || years < 0 ? 0 : stageFromAge(years);
}

export function isMinor(stage: AgeStage): boolean {
  return stage < 3;
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}
