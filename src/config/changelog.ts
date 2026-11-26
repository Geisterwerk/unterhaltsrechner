/**
 * Änderungsprotokoll der Anwendung (neueste Version zuerst).
 * Bei jeder Veröffentlichung einen Eintrag oben ergänzen und `version` in package.json angleichen.
 */

export type ChangelogArt = 'neu' | 'geaendert' | 'korrigiert';

export interface ChangelogEintrag {
  version: string;
  /** ISO-Datum der Veröffentlichung */
  datum: string;
  aenderungen: { art: ChangelogArt; text: string }[];
}

export const CHANGELOG_ART_LABEL: Record<ChangelogArt, string> = {
  neu: 'Neu',
  geaendert: 'Geändert',
  korrigiert: 'Korrigiert',
};

export const CHANGELOG: ChangelogEintrag[] = [
  {
    version: '1.7.0',
    datum: '2026-11-26',
    aenderungen: [
      {
        art: 'neu',
        text: 'Selbstbehalt bei Zusammenleben mit einem leistungsfähigen Partner: um 10 % herabgesetzt (Haushaltsersparnis, Leitlinien 21.5) – gegenüber Kindern und beim Ehegattenunterhalt.',
      },
      {
        art: 'geaendert',
        text: 'Fundstellen im Rechenweg und in den Hinweisen nennen jetzt die gewählten Leitlinien (z. B. „Leitlinien KG Berlin 11.1“) statt immer die Leitlinien NRW.',
      },
    ],
  },
  {
    version: '1.6.0',
    datum: '2026-11-26',
    aenderungen: [
      {
        art: 'neu',
        text: 'Leitlinien wählbar: Berlin (Kammergericht), NRW, Süddeutsche oder Niedersachsen – mit den jeweiligen Regeln zur 5 %-Pauschale, zum Ausbildungsaufwand und zur Altersvorsorge.',
      },
      {
        art: 'geaendert',
        text: 'Standard sind jetzt die Leitlinien des Kammergerichts Berlin (bisher wurde nach den Leitlinien NRW gerechnet). Gespeicherte Eingaben älterer Versionen werden mit den Berliner Leitlinien geladen; bei Bedarf oben umstellen.',
      },
      {
        art: 'neu',
        text: 'Fiktives Einkommen bei Verletzung der Erwerbsobliegenheit: erzielbares Netto statt des tatsächlichen Einkommens.',
      },
      {
        art: 'neu',
        text: 'Private Kranken- und Pflegeversicherung für Eltern (Abzug vom Einkommen) und Kinder (zusätzlich zum Tabellenunterhalt bzw. als Teil des Bedarfs).',
      },
      {
        art: 'neu',
        text: 'Zeitraum: tatsächliche Zahlungen mit wechselnden Beträgen (auch Monate ohne Zahlung) und Betreuungswechsel ab einem Monat.',
      },
      {
        art: 'neu',
        text: 'Barrierefreiheit: Eingabefelder sind für Screenreader beschriftet, Umschalter per Pfeiltasten bedienbar, sichtbarer Tastaturfokus; automatische Prüfung nach WCAG 2.1.',
      },
      {
        art: 'korrigiert',
        text: 'Hinweis zur 5 %-Pauschale nach Leitlinien NRW: sie gilt in der Regel nur bei fiktivem Erwerbseinkommen (nicht „bei Anhaltspunkten“).',
      },
      {
        art: 'geaendert',
        text: 'Zeitraum: Der feste Monatsbetrag „bereits gezahlt“ ist durch eine Liste tatsächlicher Zahlungen ersetzt; ältere Speicherdateien werden automatisch umgewandelt.',
      },
    ],
  },
  {
    version: '1.5.0',
    datum: '2026-11-26',
    aenderungen: [
      {
        art: 'neu',
        text: 'Zeitraum: Einkommensänderungen ab einem Monat erfassen (z. B. neuer Job ab September) – der Unterhalt wird ab dann mit dem neuen Einkommen berechnet.',
      },
      { art: 'neu', text: 'Zeitraum und Rückstand erscheinen im PDF-Bericht und werden beim Speichern der Eingaben mitgespeichert.' },
    ],
  },
  {
    version: '1.4.0',
    datum: '2026-11-26',
    aenderungen: [
      {
        art: 'neu',
        text: 'Zeitraum und Rückstand: Unterhalt Monat für Monat über einen Zeitraum berechnen – mit automatischem Altersstufenwechsel ab dem Geburtstagsmonat, den Werten des jeweiligen Jahres und Abzug bereits gezahlter Beträge.',
      },
      {
        art: 'neu',
        text: 'Kinderzuschlag (§ 6a BKGG) je Kind erfassen; er mindert den Bedarf in voller Höhe (BGH XII ZB 512/19).',
      },
      { art: 'neu', text: 'Automatische Browser-Tests (Desktop und Smartphone) vor jeder Veröffentlichung.' },
    ],
  },
  {
    version: '1.3.1',
    datum: '2026-11-26',
    aenderungen: [
      {
        art: 'geaendert',
        text: 'Technische Aktualisierung auf React 19, Vite 8 und Tailwind CSS 4. Keine Änderung an den Berechnungen.',
      },
    ],
  },
  {
    version: '1.3.0',
    datum: '2026-11-26',
    aenderungen: [
      {
        art: 'neu',
        text: 'Eingaben speichern und laden: Alle Eingaben einschließlich gemerkter Szenarien als Datei auf dem eigenen Gerät sichern und später wieder öffnen. Es wird nichts hochgeladen.',
      },
    ],
  },
  {
    version: '1.2.0',
    datum: '2026-11-26',
    aenderungen: [
      {
        art: 'neu',
        text: 'Wechselmodell: Wohnkosten des Kindes in beiden Haushalten eingeben. Was über den Wohnanteil im Tabellenbetrag (rund 20 %) hinausgeht, wird als Wohnmehrbedarf nach Haftungsquote verteilt; die eigenen Wohnkosten zählen als Leistung in natura.',
      },
      {
        art: 'geaendert',
        text: 'Das Feld „Wechselmodell-Mehrkosten“ heißt jetzt „Sonstige Wechselmodell-Mehrkosten“ (z. B. Fahrtkosten). Bisher dort eingetragene Wohnkosten bitte in die neuen Felder übertragen.',
      },
    ],
  },
  {
    version: '1.1.0',
    datum: '2026-11-26',
    aenderungen: [
      {
        art: 'geaendert',
        text:
          'Wechselmodell: Der Haftungsanteil jedes Elternteils ist auf den Tabellenbetrag nach seinem eigenen Einkommen begrenzt (BGH XII ZB 565/15). Bei deutlich unterschiedlichen Einkommen fällt der Ausgleich dadurch niedriger aus als bisher.',
      },
      {
        art: 'geaendert',
        text: 'Zusätzliche Altersvorsorge wird bei Brutto- oder Tarif-Eingabe automatisch auf 4 % des Bruttoeinkommens begrenzt.',
      },
      { art: 'neu', text: 'Eingabefeld „Wohnvorteil“ für mietfreies Wohnen im Eigentum; wird dem Einkommen hinzugerechnet.' },
      { art: 'neu', text: 'Änderungsprotokoll („Was ist neu?“) mit Versionsnummer.' },
      { art: 'korrigiert', text: 'Auf schmalen Bildschirmen (Smartphone) ragte das Szenario-Feld über den Rand – die Seite ließ sich seitlich verschieben.' },
      { art: 'korrigiert', text: 'Rechtlicher Hinweis aktualisiert: Mehr-/Sonderbedarf und Wohnvorteil werden inzwischen berücksichtigt.' },
    ],
  },
  {
    version: '1.0.0',
    datum: '2026-11-25',
    aenderungen: [
      {
        art: 'neu',
        text: 'Erste Veröffentlichung: Residenz- und Wechselmodell je Kind, Patchwork mit weiteren Kindern, Mangelfall, Bedarfskontrolle, Zu-/Herabstufung und nachvollziehbarer Rechenweg nach Düsseldorfer Tabelle 2026.',
      },
      {
        art: 'neu',
        text: 'Brutto-Netto-Schätzung (Lohnsteuer 2026), Tarifverträge des öffentlichen Dienstes (TVöD, TV-L, TV-BA, SuE) mit Zusatzversorgung und Auswahl der größten Krankenkassen.',
      },
      {
        art: 'neu',
        text: 'Mehr- und Sonderbedarf, volljährige Kinder mit eigenem Haushalt, optionaler Ehegattenunterhalt, Szenarienvergleich und PDF-Bericht.',
      },
      { art: 'neu', text: 'Berechnungsjahr 2027 als vorläufige Fassung.' },
    ],
  },
];

/** aktuelle Version der Anwendung */
export const APP_VERSION = CHANGELOG[0].version;
