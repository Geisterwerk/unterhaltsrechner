# Kindesunterhaltsrechner

React + TypeScript + Tailwind. Bildet das Residenzmodell, das paritätische Wechselmodell und weitere
unterhaltsberechtigte Kinder aus anderen Beziehungen ab.

**Online nutzen:** <https://geisterwerk.github.io/unterhaltsrechner/>. Jeder Push auf `main` wird nach
bestandenen Tests automatisch per GitHub Actions veröffentlicht. Die Berechnung läuft vollständig im Browser,
eingegebene Daten werden nicht übertragen.

> **Hinweis:** Die Berechnung ist eine unverbindliche Orientierung. Sie ersetzt keine familienrechtliche
> Beratung. Die Werte 2026 wurden am 20.11.2026 mit den amtlichen Quellen abgeglichen (siehe „Datenstand“);
> Ergebnisse sind vor einer Weiterverwendung fachlich zu prüfen.

## Start (Docker, kein lokales Node.js nötig)

```bash
docker compose up              # Dev-Server auf http://localhost:5173
docker compose run --rm app npm test
docker compose run --rm app npm run build
```

## Aufbau

| Ordner        | Inhalt |
|---------------|--------|
| `src/types`   | Datenmodelle (Eingaben, Konfiguration, Ergebnisse) |
| `src/config`  | Düsseldorfer Tabelle, Selbstbehalte, Kindergeld, Pauschale, Stufungsregeln. Neues Jahr = neue Datei + Eintrag in `config/index.ts` |
| `src/engine`  | Reine, zustandslose Berechnung: `calculate(input, cfg)` → Ergebnis mit Zahlungen, Rechenweg (6 Schritte) und Hinweisen |
| `src/ui`      | React-Komponenten |

### Engine-Module

- `income.ts` – bereinigtes Nettoeinkommen (Pauschale 5 % oder konkret; Wohnvorteil, Altersvorsorge max. 4 % Brutto, Schulden)
- `table.ts` – Gruppenermittlung, Zu-/Herabstufung, Tabellenbeträge, Kindergeldanrechnung
- `children.ts` – Rang (§ 1609 BGB), weitere Kinder, Haftungsanteile volljähriger Kinder
- `residenz.ts` – Residenzmodell inkl. Bedarfskontrollbetrag, Selbstbehalt, Mangelfall, Rang 4
- `wechsel.ts` – Wechselmodell inkl. Vorwegabzug, Haftungsquoten, Kindergeldausgleich, Spitzenausgleich
- `validate.ts` – Fehler (blockieren) und Warnungen

## Brutto-Eingabe

Je Elternteil kann statt des Nettos der Bruttolohn eingegeben werden. `engine/brutto.ts` schätzt daraus das
Netto nach dem Programmablaufplan Lohnsteuer 2026 (Tarif, Steuerklassen I–VI, Vorsorgepauschale, Soli,
Kirchensteuer) und den SV-Rechengrößen 2026 – Werte in `src/config/lohnsteuer2026.ts`. Sonderzahlungen werden
auf 12 Monate umgelegt. Annahmen: gesetzlich versichert, keine individuellen Freibeträge, keine
Steuererstattungen; bei Steuerklasse III/V kann unterhaltsrechtlich eine fiktive Steuerlast maßgeblich sein.

### Tarifverträge öffentlicher Dienst

Statt eines Betrags kann der Bruttolohn aus einer Entgelttabelle gewählt werden (TVöD VKA, TVöD Bund, TV-L,
TVöD SuE, TV-BA): Tarif, Entgeltgruppe/Tätigkeitsebene, Stufe, Arbeitszeit in % und optional die
Jahressonderzahlung. Tabellen in `src/config/tarifvertraege2026.ts` (Quelle: oeffentlicher-dienst.info – vor
Verwendung mit dem Tariftext abgleichen); Logik in `engine/tarif.ts`. TV-BA: Funktionsstufe 1 und 2 wählbar
(TE I–IV 226,16 € / 452,31 €, TE V–VIII 83,06 € / 166,11 €; unabhängig von der Stufe, bei Teilzeit anteilig, in
der Jahressonderzahlung enthalten). Weitere Zulagen lassen sich je Tarif über `zulagen` in der Konfiguration
ergänzen. Nicht berücksichtigt: sonstige Zulagen und Leistungsentgelt.

### Zusatzversorgung (VBL)

Auswahl VBL West (AN 1,81 %), VBL Ost (AN 4,25 %) oder eine andere Kasse mit manuellen Sätzen
(`src/config/zusatzversorgung2026.ts`, Quelle: VBL-Rechengrößen 2026).
- **Umlage (VBL West):** Der Arbeitnehmeranteil wird aus versteuertem und verbeitragtem Entgelt gezahlt, also
  nur vom Netto abgezogen.
- **Kapitaldeckung (VBL Ost):** Der Arbeitnehmerbeitrag ist nach § 3 Nr. 63 EStG steuerfrei (BFH VI R 57/08),
  zusammen mit dem AG-Beitrag bis 8 % der BBG RV, und mindert den steuerpflichtigen Arbeitslohn vor der
  Lohnsteuer. Beitragsfreiheit nach § 1 Abs. 1 Satz 1 Nr. 9 SvEV bis 4 % der BBG RV ist angenommen (eine
  Bestätigung der SV-Träger wurde nicht gefunden).
- Der Teil der Arbeitgeberumlage über 2,5 % abzüglich 13,30 €/Monat wird als SV-pflichtig hinzugerechnet
  (§ 1 Abs. 1 Satz 3 und 4 SvEV). Beim Wechsel auf „Tarifvertrag“ wird VBL West vorbelegt.

## Ausfüllhilfen

Jedes Eingabefeld hat ein Info-Symbol („i“) mit einer Erklärung, was einzutragen ist. Die Texte stehen zentral in
`src/ui/infoTexte.tsx`; Beträge (Selbstbehalte, Pauschale, Bedarf bei eigenem Haushalt) kommen aus dem gewählten
Berechnungsjahr.

## Mehr- und Sonderbedarf

Je Kind lassen sich Positionen erfassen: **Mehrbedarf** (monatlich, z. B. Kita, Nachhilfe) und **Sonderbedarf**
(einmalig, z. B. Klassenfahrt, Kieferorthopädie). Beide Eltern haften anteilig (BGH FamRZ 2009, 962): Quote nach
bereinigtem Einkommen abzüglich des geschuldeten Kindesunterhalts (gemeinsame und weitere Kinder) und des
angemessenen Selbstbehalts. Der Elternteil, der die Kosten nicht bezahlt, erstattet seinen Anteil. Mehrbedarf
fließt in die Monatsbeträge ein, Sonderbedarf erscheint als einmalige Erstattung (Rechenweg Schritt 7,
`engine/mehrbedarf.ts`).

## Ehegattenunterhalt (optional)

Trennungs- oder nachehelicher Unterhalt zwischen den Eltern nach der Quotenmethode (`engine/ehegatte.ts`,
Rechenweg Schritt 8; DT 2026 Teil B, Leitlinien NRW 15 und 21.4):

1. Prägendes Einkommen = bereinigtes Einkommen − Kindesunterhalt (Zahlbeträge, Kinder sind vorrangig)
2. 45 % der Differenz der Erwerbseinkommen (Erwerbsanreiz 1/10), 50 % bei sonstigen Einkünften
3. Mindestbedarf des Berechtigten 1.450 € (erwerbstätig) / 1.200 €
4. Leistungsfähigkeit: Selbstbehalt gegenüber dem Ehegatten 1.600 € / 1.475 €
5. Der Ehegatte zählt beim Pflichtigen als weiterer Berechtigter für die Zu-/Herabstufung (zweiter Rechendurchlauf)

Nicht berücksichtigt: Vorsorgeunterhalt, Wohnvorteil, trennungsbedingter Mehrbedarf, Erwerbsobliegenheit und
Herabsetzung/Befristung nach § 1578b BGB; Familieneinkommen über 11.200 € erfordert eine konkrete Bedarfsbemessung.

## Volljährige mit eigenem Haushalt

Checkbox bei volljährigen Kindern: fester Bedarf laut Tabelle (2026: 990 € inkl. 440 € Warmmiete) statt Bedarf
nach zusammengerechnetem Elterneinkommen; das Kind ist nicht privilegiert (Rang 4), Zahlung nur aus Einkommen
über dem angemessenen Selbstbehalt.

## Eingaben speichern und laden

Oben rechts: **Eingaben speichern** lädt eine JSON-Datei (`unterhalt-eingaben-JJJJ-MM-TT.json`) mit allen Eingaben und
gemerkten Szenarien herunter; **Eingaben laden** öffnet sie wieder. Die Datei bleibt auf dem Gerät, nichts wird
hochgeladen oder im Browser gespeichert. Format und Migration: `src/ui/eingabeDatei.ts` (`formatVersion` 1). Beim
Laden werden fehlende Felder älterer Dateien mit Standardwerten ergänzt und ungültige Werte ersetzt. Bei
inkompatiblen Änderungen am Eingabemodell `DATEI_FORMAT_VERSION` erhöhen und eine Migration ergänzen.

## Abhängigkeiten und Workflow

`.github/dependabot.yml` prüft wöchentlich npm-Pakete (Minor/Patch gebündelt) und monatlich die GitHub Actions.
Updates kommen als Pull Request; der Workflow testet und baut Pull Requests, veröffentlicht aber nur Pushes auf `main`.

## Szenarienvergleich

„Aktuellen Stand merken“ speichert bis zu 5 Szenarien im Arbeitsspeicher (nicht im Browser-Speicher, gehen beim
Neuladen verloren). Die Tabelle stellt sie der aktuellen Eingabe gegenüber, mit Differenzen zum ersten Szenario;
„Laden“ übernimmt ein Szenario in die Eingaben (`src/compare/vergleich.ts`).

## Berechnungsjahre

Alle jahresabhängigen Werte (Düsseldorfer Tabelle, Lohnsteuer/SV, Krankenkassen, Tarifverträge,
Zusatzversorgung) sind je Jahr in `src/config/*<jahr>.ts` hinterlegt und in `src/config/index.ts` im Register
`JAHRE` eingetragen. Das Berechnungsjahr wird in der App gewählt (Standard: aktuelles Kalenderjahr).

- **2026:** endgültig.
- **2027:** vorläufig (Stand 20.11.2026). Düsseldorfer Tabelle/Selbstbehalte aus 2026 übernommen; Kindergeld,
  Steuertarif (inkl. 47 %-Zone), Kinderfreibetrag und Steuerklassen V/VI laut Regierungsentwurf
  BT-Drs. 21/8235; BBG laut Kabinettsbeschluss; TV-L ab 01.03.2027 +2 %; übrige Tarife und Kassensätze aus
  2026. App und PDF weisen das deutlich aus.

**Werte 2027 nachtragen**, sobald veröffentlicht: Werte in den 2027-Dateien ersetzen, die betroffenen Punkte aus
`hinweise` in `src/config/index.ts` entfernen und – wenn alles amtlich ist – `status: 'endgueltig'` setzen.

## PDF-Bericht

Button „PDF-Bericht“ im Ergebnisbereich. Der Bericht wird vollständig im Browser erzeugt (keine Übermittlung
an einen Server) und enthält Ergebnis, Hinweise, alle Eingaben, den Rechenweg sowie Grundlagen/Quellen und
den rechtlichen Hinweis. Inhalt: `src/report/reportModel.ts` (reine Funktion, getestet), Layout:
`src/report/pdfReport.ts` (jsPDF + jspdf-autotable, nur bei Bedarf geladen). Beispiel: `docs/Beispielbericht.pdf`.

## Änderungsprotokoll und Version

Die Seite zeigt im Kopf „Version x.y.z · Was ist neu?“; der Dialog liest `src/config/changelog.ts`.
Bei jeder Veröffentlichung oben einen Eintrag ergänzen (`neu` / `geaendert` / `korrigiert`) und `version` in
`package.json` angleichen. Geänderte Rechenergebnisse immer als `geaendert` vermerken.

## Betreuungsmodell je Kind

Jedes gemeinsame Kind hat ein eigenes Betreuungsmodell: *lebt bei A*, *lebt bei B* oder *Wechselmodell*.
Gemischte Konstellationen werden in dieser Reihenfolge berechnet (`engine/index.ts`):

1. **Barunterhalt je Elternteil** (`barunterhalt.ts`) für Kinder, die beim anderen Elternteil leben, sowie der
   Haftungsanteil für volljährige Kinder. Kinder im eigenen Haushalt und im Wechselmodell zählen für die Stufung
   und gehen (Option) mit fiktivem Betrag in Bedarfskontrolle und Mangelfall ein.
2. **Wechselmodell** (`wechsel.ts`) für alle Wechselmodell-Kinder; der unter 1. ermittelte Barunterhalt jedes
   Elternteils ist dabei gleichrangiger Vorwegabzug.
3. **Zusammenfassung** je Zahlungsrichtung; zahlen beide Eltern einander (z. B. Geschwistertrennung), wird
   zusätzlich ein Saldo ausgewiesen (nur bei einvernehmlicher Verrechnung).

## Fachliche Annahmen (prüfen!)

- **Stufung:** 2 Berechtigte = Standard; 1 → +1 Gruppe; je weiterem −1 (max. −3). Gezählt werden gemeinsame
  Kinder, alle weiteren Kinder des Pflichtigen und „weitere Berechtigte“ (z. B. Ehegatte).
- **Bedarfskontrolle:** Gruppe wird gesenkt, bis Einkommen − Zahlbeträge aller Rang-1-Kinder ≥ BKB
  (Gruppe 1: 1.200 € nicht erwerbstätig / 1.450 € erwerbstätig).
- **Mangelfall:** Einsatzbeträge = Zahlbeträge der 1. Gruppe; Verteilungsmasse = Einkommen − notwendiger SB.
  Kinder im Haushalt des Pflichtigen gehen optional mit fiktivem Betrag ein.
- **Volljährige** (Leitlinien NRW 13.1/13.3): Bedarf aus dem zusammengerechneten Einkommen beider Eltern
  (4. Altersstufe, ohne Stufung), volles Kindergeld und Eigeneinkommen werden abgezogen (100 € Ausbildungsaufwand
  nur bei Wohnen im Elternhaushalt). Haftung nach Einkommen über dem angemessenen SB; bei privilegierten
  Volljährigen wird der Sockel auf den notwendigen SB gesenkt, wenn der Bedarf sonst nicht gedeckt ist. Jeder
  Elternteil zahlt höchstens den Betrag nach seinem eigenen Einkommen. Sonstige Volljährige (Rang 4) nur aus
  Einkommen über dem angemessenen SB.
- **Berufsbedingte Aufwendungen** (Leitlinien NRW 10.2): grundsätzlich konkret; Pauschale 5 % ohne
  Mindest-/Höchstbetrag nur auf Auswahl.
- **Altersvorsorge:** zusätzliche Vorsorge bis 4 % des Bruttoeinkommens (BGH XII ZR 149/01). Bei Brutto-Eingabe
  wird ein höherer Betrag automatisch gekürzt; bei Netto-Eingabe ist das Brutto unbekannt (nur Hinweis).
- **Wohnvorteil:** mietfreies Wohnen im Eigentum wird als Einkommen hinzugerechnet (Betrag nach Abzug von
  Zins/Tilgung wird eingegeben, nicht berechnet).
- **Eigeneinkommen Minderjähriger:** hälftig auf den Barunterhalt angerechnet.
- **Wechselmodell:** Haftungsquote nach Einkommen über dem angemessenen SB; Ausgleich = ½ Differenz der
  Haftungsanteile; Kindergeld: ½ (Barteil) nach Quote, ½ (Betreuungsteil) hälftig. Keine Bedarfskontrolle.
  Der Haftungsanteil jedes Elternteils ist auf den Tabellenbetrag nach seinem eigenen Einkommen begrenzt
  (zzgl. Quotenanteil an Mehrkosten; BGH XII ZB 565/15 Rn. 26 f.) – das greift bei deutlich unterschiedlichen
  Einkommen regelmäßig.
- **Wohnmehrbedarf im Wechselmodell:** Eingabe der tatsächlichen Wohnkosten des Kindes je Haushalt (z. B. anteilige
  Warmmiete nach m²). Wohnmehrbedarf = Summe − Wohnanteil im Tabellenbetrag (Faustwert 20 %, `wohnkostenanteilTabelle`).
  Er erhöht den Bedarf; jeder Elternteil leistet in natura seine eigenen Wohnkosten + ½ des übrigen Bedarfs, der
  Barausgleich ist die halbe Differenz von (Haftungsanteil − Naturalleistung).

## Datenstand (Prüfung vom 20.11.2026)

| Datensatz | Quelle | Ergebnis |
|---|---|---|
| Düsseldorfer Tabelle 2026 | amtliches PDF OLG Düsseldorf (Stand 01.01.2026) | alle Tabellenwerte bestätigt; BKB Gruppe 1 ergänzt (1.200/1.450 €); amtliches Mangelfallbeispiel als Test |
| Pauschale, Ausbildungsaufwand, Fahrtkosten | Leitlinien NRW 2026 | Pauschale ohne Min/Max, nur auf Auswahl; 100 € nur im Elternhaushalt; 0,42 €/0,28 € je km |
| Lohnsteuer/SV 2026 | BMF-Programmablaufplan 2026, Rechengrößen | bestätigt |
| Krankenkassen 2026 | krankenkassen.de, gegengeprüft mit krankenkasseninfo.de | alle 10 bestätigt; IKK classic 3,85 % seit 01.08.2026 |
| Tarifverträge 2026 | oeffentlicher-dienst.info (Tabellen, Gehaltsrechner) | bestätigt inkl. Jahressonderzahlung TV-L |
| VBL 2026 | VBL-Rechengrößen 2026 | bestätigt |
| 2027 | Gesetzentwurf BT-Drs. 21/8235 (noch im Ausschuss), Kabinettsbeschluss BBG | weiterhin vorläufig; DT 2027 noch nicht veröffentlicht |
