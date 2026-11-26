import type { AgeInput, CalculationInput, JahresKonfiguration, ParentId, ValidationIssue } from '../types';
import { effectiveGross, resolveTarif } from './tarif';
import { ageInYears, isValidIsoDate } from './util';

function checkNonNegative(issues: ValidationIssue[], value: number, field: string, label: string) {
  if (!Number.isFinite(value)) {
    issues.push({ severity: 'error', field, message: `${label}: bitte eine gültige Zahl eingeben.` });
  } else if (value < 0) {
    issues.push({ severity: 'error', field, message: `${label} darf nicht negativ sein.` });
  }
}

function checkAge(
  issues: ValidationIssue[],
  age: AgeInput,
  referenceDate: string,
  field: string,
  label: string,
): number | null {
  if (age.kind === 'stage') return null;
  if (!age.birthdate) {
    issues.push({ severity: 'error', field, message: `${label}: Geburtsdatum fehlt.` });
    return null;
  }
  if (!isValidIsoDate(age.birthdate)) {
    issues.push({ severity: 'error', field, message: `${label}: Geburtsdatum ist ungültig.` });
    return null;
  }
  const years = ageInYears(age.birthdate, referenceDate);
  if (years !== null && years < 0) {
    issues.push({ severity: 'error', field, message: `${label}: Geburtsdatum liegt nach dem Stichtag.` });
    return null;
  }
  if (years !== null && years > 27) {
    issues.push({
      severity: 'warning',
      field,
      message: `${label}: Kind ist ${years} Jahre alt – Unterhaltsanspruch und Kindergeld bitte prüfen.`,
    });
  }
  return years;
}

/** Eingaben prüfen. Fehler verhindern die Berechnung, Warnungen werden angezeigt. */
export function validateInput(input: CalculationInput, jk: Pick<JahresKonfiguration, 'jahr' | 'tarife'>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activeTarife = jk.tarife;

  if (!isValidIsoDate(input.referenceDate)) {
    issues.push({ severity: 'error', field: 'referenceDate', message: 'Stichtag ist ungültig.' });
  } else if (Number(input.referenceDate.slice(0, 4)) !== jk.jahr) {
    issues.push({
      severity: 'warning',
      field: 'referenceDate',
      message: `Der Stichtag liegt nicht im Berechnungsjahr ${jk.jahr} – Altersstufen werden zum Stichtag ermittelt.`,
    });
  }

  for (const p of ['A', 'B'] as ParentId[]) {
    const parent = input.parents[p];
    const name = parent.label || `Elternteil ${p}`;
    const f = `parents.${p}`;
    if (parent.incomeMode === 'brutto') {
      const g = parent.gross;
      if (g.quelle === 'tarif') {
        if (!resolveTarif(g, activeTarife)) {
          issues.push({
            severity: 'error',
            field: `${f}.tarif`,
            message: `${name}: Tarif, Entgeltgruppe oder Stufe ungültig – bitte eine vorhandene Stufe wählen.`,
          });
        }
        if (!(g.tarif.arbeitszeit > 0 && g.tarif.arbeitszeit <= 100)) {
          issues.push({
            severity: 'error',
            field: `${f}.arbeitszeit`,
            message: `${name}: Arbeitszeit muss zwischen 1 und 100 % liegen.`,
          });
        }
      }
      if (g.zusatzversorgung.kasse === 'manuell') {
        for (const [key, lbl] of [
          ['anProzent', 'Zusatzversorgung Arbeitnehmeranteil'],
          ['agUmlageProzent', 'Zusatzversorgung Arbeitgeberumlage'],
        ] as const) {
          const v = g.zusatzversorgung[key];
          checkNonNegative(issues, v, `${f}.zv.${key}`, `${name}: ${lbl}`);
          if (v > 15) {
            issues.push({ severity: 'error', field: `${f}.zv.${key}`, message: `${name}: ${lbl} bitte in Prozent angeben.` });
          }
        }
      }
      if (g.quelle !== 'tarif' && !(g.arbeitszeit > 0 && g.arbeitszeit <= 100)) {
        issues.push({
          severity: 'error',
          field: `${f}.bruttoArbeitszeit`,
          message: `${name}: Arbeitszeit muss zwischen 1 und 100 % liegen.`,
        });
      }
      checkNonNegative(issues, g.bruttoMonatlich, `${f}.bruttoMonatlich`, `${name}: Bruttolohn`);
      checkNonNegative(issues, g.sonderzahlungenJahr, `${f}.sonderzahlungenJahr`, `${name}: Sonderzahlungen`);
      checkNonNegative(issues, g.kinderfreibetraege, `${f}.kinderfreibetraege`, `${name}: Kinderfreibeträge`);
      checkNonNegative(issues, g.pvKinder, `${f}.pvKinder`, `${name}: Kinder (Pflegeversicherung)`);
      checkNonNegative(issues, g.kvZusatzbeitrag, `${f}.kvZusatzbeitrag`, `${name}: Zusatzbeitrag`);
      if (g.kvZusatzbeitrag > 10) {
        issues.push({
          severity: 'error',
          field: `${f}.kvZusatzbeitrag`,
          message: `${name}: Zusatzbeitrag bitte in Prozent angeben (z. B. 2,9).`,
        });
      }
      if (![1, 2, 3, 4, 5, 6].includes(g.steuerklasse)) {
        issues.push({ severity: 'error', field: `${f}.steuerklasse`, message: `${name}: Steuerklasse ungültig.` });
      }
      if (!parent.employed && effectiveGross(g, activeTarife).gross.bruttoMonatlich > 0) {
        issues.push({
          severity: 'warning',
          message: `${name}: Bruttolohn angegeben, aber als nicht erwerbstätig erfasst.`,
        });
      }
      if (effectiveGross(g, activeTarife).gross.bruttoMonatlich > 0) {
        issues.push({
          severity: 'warning',
          message: `${name}: Nettoeinkommen aus dem Bruttolohn geschätzt (gesetzlich versichert, ohne individuelle Freibeträge und Steuererstattungen).${
            g.steuerklasse === 5 || g.steuerklasse === 3
              ? ' Bei Steuerklasse III/V kann unterhaltsrechtlich eine fiktive Steuerlast maßgeblich sein.'
              : ''
          }`,
        });
      }
    } else {
      checkNonNegative(issues, parent.netIncome, `${f}.netIncome`, `${name}: Nettoeinkommen`);
    }
    checkNonNegative(issues, parent.deductions.altersvorsorge, `${f}.altersvorsorge`, `${name}: Altersvorsorge`);
    checkNonNegative(issues, parent.deductions.schulden, `${f}.schulden`, `${name}: Schulden`);
    checkNonNegative(issues, parent.deductions.sonstige, `${f}.sonstige`, `${name}: Sonstige Abzüge`);
    checkNonNegative(issues, parent.deductions.wohnvorteil ?? 0, `${f}.wohnvorteil`, `${name}: Wohnvorteil`);
    checkNonNegative(issues, parent.weitereBerechtigte, `${f}.weitereBerechtigte`, `${name}: Weitere Berechtigte`);
    if (parent.deductions.berufsbedingtMode === 'konkret') {
      checkNonNegative(
        issues,
        parent.deductions.berufsbedingtKonkret,
        `${f}.berufsbedingtKonkret`,
        `${name}: Berufsbedingte Aufwendungen`,
      );
    }
    if (!parent.employed && parent.deductions.berufsbedingtMode !== 'keine') {
      issues.push({
        severity: 'warning',
        field: `${f}.employed`,
        message: `${name} ist nicht erwerbstätig – berufsbedingte Aufwendungen werden nicht abgezogen.`,
      });
    }
    const d = parent.deductions;
    const totalDeductions = d.altersvorsorge + d.schulden + d.sonstige;
    if (parent.incomeMode === 'netto' && parent.netIncome > 0 && totalDeductions > parent.netIncome) {
      issues.push({
        severity: 'warning',
        field: `${f}.deductions`,
        message: `${name}: Abzüge übersteigen das Nettoeinkommen – bereinigtes Einkommen wird mit 0 € angesetzt.`,
      });
    }
    // bei Tarifauswahl ergibt sich der Bruttolohn aus der Tabelle, nicht aus dem Eingabefeld
    const incomeValue =
      parent.incomeMode === 'brutto' ? effectiveGross(parent.gross, activeTarife).gross.bruttoMonatlich : parent.netIncome;
    if (parent.employed && incomeValue === 0) {
      issues.push({
        severity: 'warning',
        field: `${f}.netIncome`,
        message: `${name} ist als erwerbstätig erfasst, hat aber kein Einkommen angegeben.`,
      });
    }

    parent.otherChildren.forEach((c, i) => {
      const cl = `${name}, weiteres Kind ${c.label || i + 1}`;
      checkAge(issues, c.age, input.referenceDate, `${f}.otherChildren.${i}.age`, cl);
      if (c.fixedPayment !== null) {
        checkNonNegative(issues, c.fixedPayment, `${f}.otherChildren.${i}.fixedPayment`, `${cl}: Zahlbetrag`);
        if (c.care === 'haushalt') {
          issues.push({
            severity: 'warning',
            message: `${cl}: Kind lebt im Haushalt – der angegebene Zahlbetrag wird ignoriert.`,
          });
        }
      }
    });
  }

  if (input.ehegatte?.aktiv && (input.parents.A.weitereBerechtigte > 0 || input.parents.B.weitereBerechtigte > 0)) {
    issues.push({
      severity: 'warning',
      message:
        'Ehegattenunterhalt ist aktiv: Der Ehegatte wird automatisch als weiterer Berechtigter gezählt – bei „Weitere Berechtigte“ bitte nur andere Personen eintragen.',
    });
  }

  if (input.children.length === 0) {
    issues.push({ severity: 'error', field: 'children', message: 'Bitte mindestens ein gemeinsames Kind erfassen.' });
  }

  input.children.forEach((c, i) => {
    const cl = `Gemeinsames Kind ${c.label || i + 1}`;
    const years = checkAge(issues, c.age, input.referenceDate, `children.${i}.age`, cl);
    checkNonNegative(issues, c.ownIncome, `children.${i}.ownIncome`, `${cl}: Eigenes Einkommen`);
    checkNonNegative(issues, c.wechselMehrkosten, `children.${i}.wechselMehrkosten`, `${cl}: Mehrkosten`);
    if (c.care !== 'A' && c.care !== 'B' && c.care !== 'wechsel') {
      issues.push({ severity: 'error', field: `children.${i}.care`, message: `${cl}: Betreuungsmodell fehlt.` });
    }
    const isAdult = c.age.kind === 'stage' ? c.age.stage === 3 : years !== null && years >= 18;
    if (isAdult && c.adultRank === 'privilegiert' && years !== null && years >= 21) {
      issues.push({
        severity: 'warning',
        message: `${cl}: Privilegierung gilt nur bis zur Vollendung des 21. Lebensjahres.`,
      });
    }
    if (isAdult && c.care === 'wechsel') {
      issues.push({
        severity: 'warning',
        message: `${cl}: Volljährige Kinder werden nicht mehr betreut – Wechselmodell entfällt, beide Eltern schulden anteiligen Barunterhalt.`,
      });
    }
    if (!isAdult && c.ownIncome > 0) {
      issues.push({
        severity: 'warning',
        message: `${cl}: Eigenes Einkommen eines minderjährigen Kindes wird hälftig auf den Barunterhalt angerechnet.`,
      });
    }
    (c.bedarfsposten ?? []).forEach((bp, j) => {
      checkNonNegative(issues, bp.betrag, `children.${i}.bedarfsposten.${j}.betrag`, `${cl}: ${bp.bezeichnung || 'Mehr-/Sonderbedarf'}`);
      if (bp.betrag > 0 && !bp.bezeichnung.trim()) {
        issues.push({ severity: 'warning', message: `${cl}: Bitte eine Bezeichnung für den Mehr-/Sonderbedarf angeben.` });
      }
    });
    if (c.eigenerHaushalt && isAdult && c.adultRank === 'privilegiert') {
      issues.push({
        severity: 'warning',
        message: `${cl}: Mit eigenem Haushalt ist ein volljähriges Kind nicht privilegiert – es wird mit Rang 4 gerechnet.`,
      });
    }
    if (c.eigenerHaushalt && !isAdult) {
      issues.push({
        severity: 'warning',
        message: `${cl}: „Eigener Haushalt“ gilt nur für volljährige Kinder und wird hier ignoriert.`,
      });
    }
    if (c.care !== 'wechsel' && c.wechselMehrkosten > 0) {
      issues.push({
        severity: 'warning',
        message: `${cl}: Wechselmodell-Mehrkosten werden nur bei Betreuung im Wechselmodell berücksichtigt.`,
      });
    }
  });

  return issues;
}
