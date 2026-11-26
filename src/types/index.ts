/**
 * Datenmodelle des Unterhaltsrechners.
 * Keine Logik, keine UI-Abhängigkeiten.
 */

// ---------------------------------------------------------------------------
// Konfiguration (Düsseldorfer Tabelle & Rahmenwerte)
// ---------------------------------------------------------------------------

/** Altersstufe der Düsseldorfer Tabelle: 0 = 0–5, 1 = 6–11, 2 = 12–17, 3 = ab 18 */
export type AgeStage = 0 | 1 | 2 | 3;

export const AGE_STAGE_LABELS: Record<AgeStage, string> = {
  0: '0–5 Jahre',
  1: '6–11 Jahre',
  2: '12–17 Jahre',
  3: 'ab 18 Jahre',
};

export interface IncomeGroup {
  /** 1-basierte Gruppennummer */
  group: number;
  /** Untergrenze (inkl.) des bereinigten Nettoeinkommens in € */
  from: number;
  /** Obergrenze (inkl.) in €; null = offen */
  to: number | null;
  /** Prozentsatz des Mindestbedarfs */
  percent: number;
  /** Tabellenbeträge je Altersstufe [0–5, 6–11, 12–17, 18+] */
  amounts: [number, number, number, number];
  /** Bedarfskontrollbetrag (bei erwerbstätigem Pflichtigen) */
  bedarfskontrollbetrag: number;
  /** abweichender Bedarfskontrollbetrag bei nicht erwerbstätigem Pflichtigen (DT 2026: Gruppe 1 = 1.200 €) */
  bedarfskontrollbetragNichtErwerbstaetig?: number;
}

export interface EhegattenConfig {
  /** Quote auf Erwerbseinkünfte (Erwerbsanreiz 1/10 → 45 % der Differenz) */
  erwerbsquote: number;
  /** Quote auf sonstige Einkünfte (Halbteilung) */
  sonstigeQuote: number;
  /** Selbstbehalt des Pflichtigen gegenüber dem Ehegatten */
  selbstbehalt: { erwerbstaetig: number; nichtErwerbstaetig: number };
  /** Mindestbedarf (Existenzminimum) des berechtigten Ehegatten */
  mindestbedarf: { erwerbstaetig: number; nichtErwerbstaetig: number };
  /** bis zu diesem Familieneinkommen gilt die Quotenmethode (darüber konkrete Bedarfsbemessung) */
  quotenGrenzeFamilieneinkommen: number;
}

export interface SelbstbehaltConfig {
  /** notwendiger Selbstbehalt ggü. minderjährigen / privilegiert volljährigen Kindern – erwerbstätig */
  notwendigErwerbstaetig: number;
  /** notwendiger Selbstbehalt – nicht erwerbstätig */
  notwendigNichtErwerbstaetig: number;
  /** angemessener Selbstbehalt (ggü. sonstigen Volljährigen; Sockel der Haftungsquote) */
  angemessen: number;
}

export interface BerufsbedingtePauschale {
  /** z. B. 0.05 für 5 % */
  rate: number;
  /** Mindestbetrag (0 = keiner) */
  min: number;
  /** Höchstbetrag (null = keiner) */
  max: number | null;
}

export interface UnterhaltsTabelleConfig {
  /** Bezeichnung, z. B. „Düsseldorfer Tabelle 2026" */
  name: string;
  /** Gültig ab (ISO-Datum) */
  validFrom: string;
  /** Hinweis zur Datenquelle / Prüfstatus */
  sourceNote: string;
  incomeGroups: IncomeGroup[];
  selbstbehalt: SelbstbehaltConfig;
  /** Kindergeld je Kind und Monat */
  kindergeld: number;
  pauschale: BerufsbedingtePauschale;
  /** Ausbildungsbedingter Mehrbedarf, der vom Kindeseinkommen abgezogen wird */
  ausbildungsbedingterMehrbedarf: number;
  /** Fester Bedarf eines volljährigen Kindes mit eigenem Haushalt (z. B. Studierende) */
  bedarfVolljaehrigEigenerHaushalt: number;
  /** darin enthaltener Anteil für Warmmiete (nur Information) */
  wohnkostenanteilEigenerHaushalt: number;
  /** Anteil der Wohnkosten im Tabellenbetrag Minderjähriger (Faustwert 20 %) – Basis für Wohnmehrbedarf im Wechselmodell */
  wohnkostenanteilTabelle: number;
  /** Ehegattenunterhalt (DT Teil B, Leitlinien NRW 15 und 21.4) */
  ehegatte: EhegattenConfig;
  /**
   * Zu-/Herabstufung nach Anzahl der Unterhaltsberechtigten.
   * Die Tabelle ist auf `standardBerechtigte` (2) zugeschnitten.
   */
  stufung: {
    standardBerechtigte: number;
    /** Gruppen höher bei genau einem Berechtigten */
    hoeherstufungBeiEinem: number;
    /** Gruppen tiefer je Berechtigtem über dem Standard */
    herabstufungJeWeiterem: number;
    /** maximale Herabstufung insgesamt */
    maxHerabstufung: number;
  };
}

/** Lohnsteuer- und Sozialversicherungsparameter für die Brutto-Netto-Schätzung */
export interface LohnsteuerConfig {
  name: string;
  validFrom: string;
  sourceNote: string;
  /** Einkommensteuertarif § 32a EStG */
  tarif: {
    grundfreibetrag: number;
    /** Beginn Zone 2 (X < zone2Start → Zone 1) */
    zone2Start: number;
    zone3Start: number;
    zone4Start: number;
    zone1: { a: number; b: number };
    zone2: { a: number; b: number; c: number };
    zone3: { rate: number; abzug: number };
    zone4: { rate: number; abzug: number };
    /** optionale weitere Zone (ab 2027: 47 %) */
    zone5?: { start: number; rate: number; abzug: number };
  };
  /** Steuerklassen V/VI (§ 39b Abs. 2 Satz 7 EStG) */
  /** w3: ab hier Satz der Zone 4; w4 (optional): ab hier Satz der Zone 5 */
  stkl56: { w1: number; w2: number; w3: number; w4?: number; mindestsatz: number };
  arbeitnehmerPauschbetrag: number;
  sonderausgabenPauschbetrag: number;
  entlastungsbetragAlleinerziehende: number;
  /** Kinderfreibetrag je Zähler 1,0 (Steuerklassen I–III); in IV die Hälfte */
  kinderfreibetragJeZaehler: number;
  soli: { freigrenze: number; satz: number; milderungssatz: number };
  sv: {
    bbgRvAvJahr: number;
    bbgKvPvJahr: number;
    rvAn: number;
    avAn: number;
    /** allgemeiner Beitragssatz AN-Anteil (7,3 %) */
    kvAn: number;
    /** ermäßigter Beitragssatz AN-Anteil für die Vorsorgepauschale (7,0 %) */
    kvAnVorsorge: number;
    /** durchschnittlicher Zusatzbeitrag in Prozent (Vorbelegung) */
    kvZusatzbeitragDurchschnitt: number;
    pvAn: number;
    pvKinderlosZuschlag: number;
    pvAbschlagJeKind: number;
    /** Abschlag ab dem 2. bis zu diesem Kind */
    pvAbschlagBisKind: number;
  };
  /** Höchstbetrag für KV/PV + AV in der Vorsorgepauschale (Günstigerprüfung) */
  vorsorgeHoechstbetrag: number;
}

export interface Krankenkasse {
  id: string;
  name: string;
  /** kassenindividueller Zusatzbeitrag in Prozent */
  zusatzbeitrag: number;
  /** z. B. unterjährige Änderung */
  hinweis?: string;
}

export interface Zusatzversorgungskasse {
  id: string;
  name: string;
  /** Arbeitnehmeranteil (Umlage bzw. Beitrag) in Prozent des zusatzversorgungspflichtigen Entgelts */
  anProzent: number;
  /** Umlage des Arbeitgebers in Prozent (relevant für die SV-Hinzurechnung) */
  agUmlageProzent: number;
  /** Arbeitnehmeranteil ist steuerfrei nach § 3 Nr. 63 EStG (Kapitaldeckung, z. B. VBL Ost) */
  anSteuerfrei: boolean;
  /** Arbeitgeberbeitrag zur Kapitaldeckung in Prozent (zählt auf die Freibeträge an) */
  agBeitragProzent: number;
  hinweis?: string;
}

export interface ZusatzversorgungConfig {
  stand: string;
  sourceNote: string;
  kassen: Zusatzversorgungskasse[];
  /** SvEV § 1 Abs. 1 Satz 3/4: AG-Umlage ist beitragspflichtig, soweit sie diesen Prozentsatz übersteigt … */
  hinzurechnungFreiProzent: number;
  /** … vermindert um diesen Monatsbetrag */
  hinzurechnungAbzugMonat: number;
  /** Steuerfreiheit nach § 3 Nr. 63 EStG bis zu diesem Prozentsatz der BBG RV (AG- und AN-Beitrag zusammen) */
  steuerfreiProzentBbg: number;
  /** Beitragsfreiheit nach § 1 Abs. 1 Satz 1 Nr. 9 SvEV bis zu diesem Prozentsatz der BBG RV */
  svFreiProzentBbg: number;
}

export interface KrankenkassenConfig {
  stand: string;
  sourceNote: string;
  kassen: Krankenkasse[];
}

/** Entgeltgruppe einer Tariftabelle */
export interface TarifGruppe {
  id: string;
  /** Monatliches Tabellenentgelt je Stufe (Index 0 = Stufe 1); null = Stufe existiert nicht */
  werte: (number | null)[];
  /** Jahressonderzahlung in Prozent des monatlichen Tabellenentgelts */
  jahressonderzahlung: number;
}

/** Monatliche tarifliche Zulage (z. B. Funktionsstufe im TV-BA), Betrag je Gruppe bei Vollzeit */
export interface TarifZulage {
  id: string;
  name: string;
  /** Betrag je Gruppen-ID; Gruppen ohne Eintrag erhalten die Zulage nicht */
  betraege: Record<string, number>;
  /** fließt in die Bemessung der Jahressonderzahlung ein */
  jahressonderzahlungRelevant: boolean;
}

export interface TarifTabelle {
  id: string;
  name: string;
  gueltigAb: string;
  quelle: string;
  hinweis?: string;
  /** Bezeichnung der Gruppen bzw. Stufen, z. B. „Entgeltgruppe" / „Tätigkeitsebene" */
  gruppenLabel: string;
  stufenLabel: string;
  gruppen: TarifGruppe[];
  /** auswählbare monatliche Zulagen */
  zulagen?: TarifZulage[];
}

export interface TarifConfig {
  sourceNote: string;
  tabellen: TarifTabelle[];
}

/** Alle jahresabhängigen Werte eines Berechnungsjahres */
export interface JahresKonfiguration {
  jahr: number;
  /** 'vorlaeufig': noch nicht alle Werte amtlich veröffentlicht */
  status: 'endgueltig' | 'vorlaeufig';
  /** Erläuterung, welche Werte vorläufig oder aus dem Vorjahr übernommen sind */
  hinweise: string[];
  tabelle: UnterhaltsTabelleConfig;
  lohnsteuer: LohnsteuerConfig;
  krankenkassen: KrankenkassenConfig;
  tarife: TarifConfig;
  zusatzversorgung: ZusatzversorgungConfig;
}

// ---------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------

export type Steuerklasse = 1 | 2 | 3 | 4 | 5 | 6;

/** Angaben für die Schätzung des Nettoeinkommens aus dem Bruttolohn (Arbeitnehmer, gesetzlich versichert) */
/** Auswahl eines Tarifentgelts als Quelle des Bruttolohns */
export interface TarifInput {
  tarifId: string;
  gruppe: string;
  /** 1-basierte Stufe */
  stufe: number;
  /** Arbeitszeit in Prozent einer Vollzeitstelle */
  arbeitszeit: number;
  /** Jahressonderzahlung laut Tarif einrechnen */
  jahressonderzahlung: boolean;
  /** IDs der gewählten Zulagen (z. B. Funktionsstufen) */
  zulagen: string[];
}

export interface GrossIncomeInput {
  /** Bruttolohn direkt eingeben oder aus einer Tariftabelle ableiten */
  quelle: 'manuell' | 'tarif';
  tarif: TarifInput;
  bruttoMonatlich: number;
  /** Weihnachts-/Urlaubsgeld u. Ä. pro Jahr – wird auf 12 Monate umgelegt */
  sonderzahlungenJahr: number;
  /**
   * Nur bei Quelle 'manuell': Arbeitszeit in Prozent einer Vollzeitstelle. Bei weniger als 100 % gelten
   * Bruttolohn und Sonderzahlungen als Vollzeitwerte und werden anteilig gekürzt.
   */
  arbeitszeit: number;
  steuerklasse: Steuerklasse;
  /** Zahl der Kinderfreibeträge laut Lohnsteuerabzugsmerkmalen (z. B. 0,5 / 1,0) */
  kinderfreibetraege: number;
  /** Kirchensteuersatz in Prozent (0 = keine) */
  kirchensteuerSatz: 0 | 8 | 9;
  /**
   * Auswahl der Krankenkasse: Kassen-ID aus der Konfiguration, 'durchschnitt' oder 'manuell'.
   * Steuert nur die Vorbelegung von `kvZusatzbeitrag`.
   */
  krankenkasse: string;
  /** kassenindividueller Zusatzbeitrag in Prozent (maßgeblich für die Berechnung) */
  kvZusatzbeitrag: number;
  /** Kinder unter 25 für die Pflegeversicherung (0 = Kinderlosenzuschlag) */
  pvKinder: number;
  /** Zusatzversorgung des öffentlichen Dienstes (VBL o. Ä.) */
  zusatzversorgung: ZusatzversorgungInput;
}

export interface ZusatzversorgungInput {
  /** 'keine', Kassen-ID aus der Konfiguration oder 'manuell' */
  kasse: string;
  /** Arbeitnehmeranteil in Prozent (maßgeblich für die Berechnung) */
  anProzent: number;
  /** Arbeitgeberumlage in Prozent (für die SV-Hinzurechnung; 0 = keine) */
  agUmlageProzent: number;
  /** Arbeitnehmeranteil steuerfrei nach § 3 Nr. 63 EStG (Kapitaldeckung) */
  anSteuerfrei: boolean;
  /** Arbeitgeberbeitrag zur Kapitaldeckung in Prozent (für die Freibetragsgrenzen) */
  agBeitragProzent: number;
}

export type ParentId = 'A' | 'B';

/**
 * Betreuungsmodell je gemeinsamem Kind:
 * 'A' / 'B'   = Residenzmodell, Kind lebt überwiegend bei diesem Elternteil
 * 'wechsel'   = paritätisches Wechselmodell (50 : 50)
 * Erweiterungspunkt: asymmetrisches Wechselmodell / erweiterter Umgang
 */
export type ChildCare = ParentId | 'wechsel';

export const CHILD_CARE_LABELS: Record<ChildCare, string> = {
  A: 'lebt bei Elternteil A',
  B: 'lebt bei Elternteil B',
  wechsel: 'Wechselmodell 50 : 50',
};

export type AgeInput =
  | { kind: 'stage'; stage: AgeStage }
  | { kind: 'birthdate'; birthdate: string };

export interface DeductionsInput {
  /** 'pauschal' = 5 %-Pauschale (min/max laut Konfiguration), 'konkret' = Einzelnachweis */
  berufsbedingtMode: 'pauschal' | 'konkret' | 'keine';
  berufsbedingtKonkret: number;
  /** zusätzliche Altersvorsorge; bei Brutto-Eingabe auf 4 % des Bruttoeinkommens begrenzt */
  altersvorsorge: number;
  schulden: number;
  sonstige: number;
  /** Wohnvorteil (mietfreies Wohnen im Eigentum, nach Abzug von Zins/Tilgung) – wird hinzugerechnet */
  wohnvorteil: number;
}

/**
 * Rang eines volljährigen Kindes. Minderjährige haben immer Rang 1.
 * - privilegiert: bis 21, unverheiratet, allgemeine Schulausbildung, Haushalt eines Elternteils (§ 1603 Abs. 2 S. 2 BGB)
 * - sonstig: übrige Volljährige (§ 1609 Nr. 4 BGB)
 */
export type AdultRank = 'privilegiert' | 'sonstig';

/** Weiteres unterhaltsberechtigtes Kind eines Elternteils aus einer anderen Beziehung */
export interface OtherChildInput {
  id: string;
  label: string;
  age: AgeInput;
  /** nur relevant ab 18 */
  adultRank: AdultRank;
  /**
   * 'barunterhalt' = Elternteil zahlt Barunterhalt an das Kind
   * 'haushalt'     = Kind lebt im Haushalt des Elternteils (Naturalunterhalt)
   */
  care: 'barunterhalt' | 'haushalt';
  /** Konkreter (z. B. titulierter) Zahlbetrag; null = aus Tabelle ableiten */
  fixedPayment: number | null;
}

export interface ParentInput {
  label: string;
  /** Eingabe als Netto (direkt) oder als Brutto (Netto wird geschätzt) */
  incomeMode: 'netto' | 'brutto';
  netIncome: number;
  gross: GrossIncomeInput;
  employed: boolean;
  deductions: DeductionsInput;
  otherChildren: OtherChildInput[];
  /** Weitere Unterhaltsberechtigte für die Zu-/Herabstufung (z. B. Ehegatte) */
  weitereBerechtigte: number;
}

/**
 * Mehrbedarf (regelmäßig, monatlich – z. B. Kita, Nachhilfe) oder Sonderbedarf (einmalig – z. B. Klassenfahrt,
 * Kieferorthopädie). Wird außerhalb der Tabelle nach Haftungsquoten auf beide Eltern verteilt.
 */
export interface BedarfsPosten {
  id: string;
  bezeichnung: string;
  art: 'mehrbedarf' | 'sonderbedarf';
  /** Mehrbedarf: Monatsbetrag; Sonderbedarf: Gesamtbetrag */
  betrag: number;
  /** Elternteil, der die Kosten bezahlt (verauslagt); der andere erstattet seinen Anteil */
  verauslagt: ParentId;
}

export interface CommonChildInput {
  id: string;
  label: string;
  age: AgeInput;
  /** Betreuungsmodell für dieses Kind */
  care: ChildCare;
  adultRank: AdultRank;
  /** eigenes Nettoeinkommen, z. B. Ausbildungsvergütung */
  ownIncome: number;
  /** tatsächlich bezogener Kinderzuschlag (§ 6a BKGG) je Monat – mindert den Bedarf voll (BGH XII ZB 512/19) */
  kinderzuschlag: number;
  /** wer erhält das Kindergeld */
  kindergeldRecipient: ParentId;
  /** Wechselmodell: sonstiger Mehrbedarf je Kind (z. B. Fahrtkosten); Wohnkosten separat in `wechselWohnkosten` */
  wechselMehrkosten: number;
  /**
   * Wechselmodell: tatsächliche monatliche Wohnkosten des Kindes im Haushalt von A bzw. B (anteilige Warmmiete,
   * z. B. nach Quadratmetern). Übersteigt die Summe den Wohnanteil im Tabellenbetrag, entsteht Wohnmehrbedarf.
   */
  wechselWohnkosten: Record<ParentId, number>;
  /** nur volljährig: lebt im eigenen Haushalt (z. B. Studium) – fester Bedarf statt Bedarf nach Elterneinkommen */
  eigenerHaushalt: boolean;
  /** Mehr- und Sonderbedarf */
  bedarfsposten: BedarfsPosten[];
}

export interface CalculationOptions {
  /**
   * Barunterhalt: Kinder im Haushalt des Pflichtigen (eigene oder gemeinsame) und gemeinsame Kinder
   * im Wechselmodell werden mit fiktivem Einsatzbetrag in Bedarfskontroll-, Selbstbehalts- und
   * Mangelfallprüfung einbezogen.
   */
  haushaltskinderEinbeziehen: boolean;
  /** Wechselmodell: fiktiver Naturalunterhalt für Kinder im eigenen Haushalt als Vorwegabzug */
  wechselNaturalunterhaltAbzug: boolean;
  /** Wechselmodell: Zu-/Herabstufung nach Anzahl der Berechtigten anwenden */
  wechselStufung: boolean;
}

export interface EhegattenInput {
  /** Ehegattenunterhalt mitberechnen */
  aktiv: boolean;
  /** Trennungsunterhalt (bis zur Scheidung) oder nachehelicher Unterhalt */
  art: 'trennung' | 'nachehelich';
}

export interface CalculationInput {
  /** Ehegattenunterhalt zwischen den Eltern (optional) */
  ehegatte?: EhegattenInput;
  /** Berechnungsjahr – bestimmt Tabelle, Steuer-, SV- und Tarifwerte */
  jahr: number;
  /** Stichtag für die Altersberechnung (ISO-Datum) */
  referenceDate: string;
  parents: Record<ParentId, ParentInput>;
  children: CommonChildInput[];
  options: CalculationOptions;
}

// ---------------------------------------------------------------------------
// Ergebnisse
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  severity: 'error' | 'warning';
  field?: string;
  message: string;
}

export interface StepLine {
  label: string;
  value?: number | string;
  /** true = Betrag in € formatieren */
  money?: boolean;
  /** Zwischenüberschrift eines Teilabschnitts */
  heading?: boolean;
  note?: string;
  emphasis?: boolean;
}

export interface CalculationStep {
  id: number;
  title: string;
  lines: StepLine[];
}

export type Payee = ParentId | 'Kind';

export interface ChildPayment {
  childId: string;
  label: string;
  stage: AgeStage;
  care: ChildCare;
  /** zahlender Elternteil (null = keine Zahlung) */
  payer: ParentId | null;
  payee: Payee | null;
  amount: number;
  /** Erläuterung (z. B. „Mangelfall: 72,3 %") */
  note?: string;
  /** 'unterhalt' (Tabellenunterhalt) oder 'mehrbedarf' (Anteil am laufenden Mehrbedarf) */
  art?: 'unterhalt' | 'mehrbedarf';
}

export interface EhegattenErgebnis {
  art: EhegattenInput['art'];
  payer: ParentId;
  payee: ParentId;
  /** monatlicher Ehegattenunterhalt */
  amount: number;
  /** Unterhalt nach der Quote vor Mindestbedarf und Leistungsfähigkeit */
  quotenunterhalt: number;
  /** durch Leistungsfähigkeit gekürzt (Mangelfall) */
  gekuerzt: boolean;
}

/** Einmalige Erstattung eines Sonderbedarfs */
export interface EinmalZahlung {
  childId: string;
  label: string;
  bezeichnung: string;
  gesamtbetrag: number;
  payer: ParentId;
  payee: ParentId;
  /** Anteil, den der zahlende Elternteil erstattet */
  betrag: number;
  note?: string;
}

export interface PaymentFlow {
  payer: ParentId;
  payee: Payee;
  amount: number;
}

export interface CalculationResult {
  issues: ValidationIssue[];
  /** false, wenn Validierungsfehler die Berechnung verhindern */
  ok: boolean;
  payments: ChildPayment[];
  /** zusammengefasste Zahlungen je Richtung (brutto) */
  summary: PaymentFlow[];
  /** Saldo, falls beide Eltern einander zahlen (z. B. Geschwistertrennung) */
  saldo: PaymentFlow | null;
  /** einmalige Erstattungen für Sonderbedarf (nicht in den Monatsbeträgen enthalten) */
  einmalig: EinmalZahlung[];
  /** Ehegattenunterhalt (in `summary` bereits enthalten) */
  ehegatte: EhegattenErgebnis | null;
  steps: CalculationStep[];
}
