import type {
  CalculationInput,
  ChildPayment,
  ParentId,
  StepLine,
  UnterhaltsTabelleConfig,
  ValidationIssue,
} from '../types';
import type { AdultShare, ResolvedCommonChild, ResolvedOtherChild } from './children';
import type { BereinigtesEinkommen } from './income';

/** Gemeinsamer, bereits aufgelöster Berechnungskontext (nur lesend) */
export interface EngineContext {
  input: CalculationInput;
  cfg: UnterhaltsTabelleConfig;
  inc: Record<ParentId, BereinigtesEinkommen>;
  common: ResolvedCommonChild[];
  others: Record<ParentId, ResolvedOtherChild[]>;
  adultShares: AdultShare[];
  label: (p: ParentId) => string;
}

/** Schritt-IDs 2–6 des Rechenwegs; Teilberechnungen liefern je Schritt Zeilen */
export type StepId = 2 | 3 | 4 | 5 | 6;

export class StepSections {
  readonly lines: Record<StepId, StepLine[]> = { 2: [], 3: [], 4: [], 5: [], 6: [] };

  constructor(private readonly heading?: string) {}

  add(step: StepId, ...lines: StepLine[]) {
    if (this.heading && this.lines[step].length === 0 && lines.length > 0) {
      this.lines[step].push({ label: this.heading, heading: true });
    }
    this.lines[step].push(...lines);
  }

  merge(other: StepSections) {
    for (const id of [2, 3, 4, 5, 6] as StepId[]) {
      this.lines[id].push(...other.lines[id]);
    }
  }
}

export interface PartialResult {
  sections: StepSections;
  payments: ChildPayment[];
  issues: ValidationIssue[];
}
