import type {
  AdultRank,
  AgeStage,
  CalculationInput,
  ChildCare,
  CommonChildInput,
  OtherChildInput,
  ParentId,
  UnterhaltsTabelleConfig,
} from '../types';
import { findIncomeGroup, kindergeldCredit, tableAmount, tableZahlbetrag } from './table';
import { resolveStage, round2 } from './util';

/** Rang nach § 1609 BGB: 1 = minderjährig / privilegiert volljährig, 4 = sonstige Volljährige */
export type Rang = 1 | 4;

export function rangOf(stage: AgeStage, adultRank: AdultRank): Rang {
  if (stage < 3) return 1;
  return adultRank === 'privilegiert' ? 1 : 4;
}

export interface ResolvedOtherChild {
  input: OtherChildInput;
  stage: AgeStage;
  rang: Rang;
}

export function resolveOtherChildren(children: OtherChildInput[], referenceDate: string): ResolvedOtherChild[] {
  return children.map((c) => {
    const stage = resolveStage(c.age, referenceDate);
    return { input: c, stage, rang: rangOf(stage, c.adultRank) };
  });
}

/**
 * Zahlbetrag eines weiteren Kindes in der angegebenen Einkommensgruppe.
 * Konkreter Zahlbetrag hat Vorrang (nur bei Barunterhalt).
 */
export function otherChildZahlbetrag(
  child: ResolvedOtherChild,
  group: number,
  cfg: UnterhaltsTabelleConfig,
): number {
  if (child.input.care === 'barunterhalt' && child.input.fixedPayment !== null) {
    return Math.max(0, child.input.fixedPayment);
  }
  return tableZahlbetrag(group, child.stage, cfg);
}

export interface ResolvedCommonChild {
  input: CommonChildInput;
  care: ChildCare;
  stage: AgeStage;
  rang: Rang;
  /** Eigenes Einkommen abzüglich ausbildungsbedingtem Mehrbedarf */
  ownIncomeNet: number;
}

export function resolveCommonChildren(input: CalculationInput, cfg: UnterhaltsTabelleConfig): ResolvedCommonChild[] {
  return input.children.map((c) => {
    const stage = resolveStage(c.age, input.referenceDate);
    // pauschaler Ausbildungsaufwand nur bei Wohnen im Elternhaushalt (Leitlinien NRW 10.2.3); bei eigenem
    // Haushalt sind ausbildungsbedingte Aufwendungen bis 100 € im festen Bedarf enthalten (Leitlinien NRW 13.1 Abs. 2)
    const imElternhaushalt = !(stage === 3 && c.eigenerHaushalt);
    const abzug = imElternhaushalt ? cfg.ausbildungsbedingterMehrbedarf : 0;
    const ownIncomeNet = c.ownIncome > 0 ? Math.max(0, c.ownIncome - abzug) : 0;
    // Volljährige mit eigenem Haushalt sind nicht privilegiert (§ 1603 Abs. 2 S. 2 BGB setzt Elternhaushalt voraus)
    const eigenerHaushalt = stage === 3 && c.eigenerHaushalt;
    const rang: Rang = eigenerHaushalt ? 4 : rangOf(stage, c.adultRank);
    return { input: c, care: c.care, stage, rang, ownIncomeNet };
  });
}

/**
 * Anrechnung eigenen Kindeseinkommens beim Minderjährigen:
 * hälftig auf den Barunterhalt (andere Hälfte entlastet den Betreuungsunterhalt).
 */
export function minorOwnIncomeCredit(child: ResolvedCommonChild): number {
  return child.stage < 3 ? child.ownIncomeNet / 2 : child.ownIncomeNet;
}

/** Zahlbetrag eines gemeinsamen minderjährigen Kindes in Gruppe g */
export function commonMinorZahlbetrag(
  child: ResolvedCommonChild,
  group: number,
  cfg: UnterhaltsTabelleConfig,
): number {
  return round2(
    Math.max(0, tableAmount(group, child.stage, cfg) - kindergeldCredit(child.stage, cfg) - minorOwnIncomeCredit(child)),
  );
}

// ---------------------------------------------------------------------------
// Volljährige gemeinsame Kinder: Barunterhaltspflicht beider Eltern nach Haftungsquote
// ---------------------------------------------------------------------------

export interface AdultShare {
  childId: string;
  label: string;
  care: ChildCare;
  rang: Rang;
  combinedIncome: number;
  group: number;
  aboveTable: boolean;
  /** fester Bedarf wegen eigenem Haushalt */
  eigenerHaushalt: boolean;
  bedarf: number;
  kindergeld: number;
  ownIncomeNet: number;
  restbedarf: number;
  available: Record<ParentId, number>;
  quote: Record<ParentId, number>;
  share: Record<ParentId, number>;
  /** verwendeter Sockelbetrag für die Haftungsquote (Erläuterung im Rechenweg) */
  sockel: string;
  /** Obergrenze je Elternteil nach Leitlinien NRW 13.1 Abs. 1 (Unterhalt nur nach eigenem Einkommen) */
  obergrenze: Record<ParentId, number | null>;
}

const PARENT_IDS: ParentId[] = ['A', 'B'];

/**
 * Volljährige Kinder: Bedarf aus der 4. Altersstufe nach dem zusammengerechneten Einkommen beider Eltern
 * (ohne Höher-/Herabstufung) bzw. fester Bedarf bei eigenem Haushalt, abzüglich vollem Kindergeld und eigenem
 * Einkommen.
 *
 * Haftungsquote (Leitlinien NRW 13.3): Einkommen nach Vorwegabzug der Barunterhaltslasten für Minderjährige
 * minus Sockelbetrag. Sockel ist der angemessene Selbstbehalt; bei privilegierten Volljährigen wird er bis zum
 * notwendigen Selbstbehalt herabgesetzt, wenn der Bedarf sonst nicht gedeckt werden kann. Ist auch dann kein
 * Elternteil leistungsfähig, entfällt der Vorwegabzug (gleichrangige Kinder teilen sich im Mangelfall die
 * Verteilungsmasse, DT 2026 Anm. C).
 * Obergrenze (Leitlinien NRW 13.1 Abs. 1): höchstens der Betrag, der sich allein nach dem eigenen Einkommen ergibt.
 */
export function computeAdultShares(
  adults: ResolvedCommonChild[],
  income: Record<ParentId, number>,
  vorwegabzug: Record<ParentId, number>,
  cfg: UnterhaltsTabelleConfig,
  notwendigerSelbstbehalt: Record<ParentId, number>,
): AdultShare[] {
  return adults.map((c) => {
    const combinedIncome = round2(income.A + income.B);
    const { group, aboveTable: ueber } = findIncomeGroup(combinedIncome, cfg);
    // eigener Haushalt: fester Bedarf laut Tabelle statt Bedarf nach zusammengerechnetem Elterneinkommen
    const eigenerHaushalt = c.input.eigenerHaushalt;
    const bedarf = eigenerHaushalt ? cfg.bedarfVolljaehrigEigenerHaushalt : tableAmount(group, 3, cfg);
    const aboveTable = eigenerHaushalt ? false : ueber;
    const kindergeld = cfg.kindergeld;
    const restbedarf = round2(Math.max(0, bedarf - kindergeld - c.ownIncomeNet));

    const verfuegbar = (sockel: Record<ParentId, number>, mitVorweg: boolean) => ({
      A: round2(Math.max(0, income.A - (mitVorweg ? vorwegabzug.A : 0) - sockel.A)),
      B: round2(Math.max(0, income.B - (mitVorweg ? vorwegabzug.B : 0) - sockel.B)),
    });
    const summe = (v: Record<ParentId, number>) => v.A + v.B;
    const angemessen = { A: cfg.selbstbehalt.angemessen, B: cfg.selbstbehalt.angemessen };

    let available = verfuegbar(angemessen, true);
    let sockel = `angemessener Selbstbehalt ${cfg.selbstbehalt.angemessen.toLocaleString('de-DE')} €`;
    let begrenzen = true;
    if (c.rang === 1 && summe(available) < restbedarf) {
      const notwendig = verfuegbar(notwendigerSelbstbehalt, true);
      if (summe(notwendig) > summe(available)) {
        available = notwendig;
        sockel = 'notwendiger Selbstbehalt (Bedarf sonst nicht gedeckt)';
        begrenzen = false;
      }
      if (summe(available) === 0) {
        const ohneVorweg = verfuegbar(notwendigerSelbstbehalt, false);
        if (summe(ohneVorweg) > 0) {
          available = ohneVorweg;
          sockel = 'notwendiger Selbstbehalt ohne Vorwegabzug (Verteilung im Mangelfall)';
          begrenzen = false;
        }
      }
    }
    const total = summe(available);
    const quote = total > 0 ? { A: available.A / total, B: available.B / total } : { A: 0, B: 0 };

    // Obergrenze: Unterhalt allein nach eigenem Einkommen (nicht bei festem Bedarf des eigenen Haushalts)
    const obergrenze: Record<ParentId, number | null> = { A: null, B: null };
    const share: Record<ParentId, number> = { A: 0, B: 0 };
    for (const p of PARENT_IDS) {
      let s = restbedarf * quote[p];
      if (begrenzen) s = Math.min(s, available[p]);
      if (!eigenerHaushalt) {
        const eigeneGruppe = findIncomeGroup(income[p], cfg).group;
        obergrenze[p] = round2(Math.max(0, tableAmount(eigeneGruppe, 3, cfg) - kindergeld - c.ownIncomeNet));
        s = Math.min(s, obergrenze[p]!);
      }
      share[p] = round2(s);
    }
    return {
      childId: c.input.id,
      label: c.input.label,
      care: c.care,
      rang: c.rang,
      combinedIncome,
      group,
      aboveTable,
      eigenerHaushalt,
      bedarf,
      kindergeld,
      ownIncomeNet: c.ownIncomeNet,
      restbedarf,
      available,
      quote,
      share,
      sockel,
      obergrenze,
    };
  });
}
