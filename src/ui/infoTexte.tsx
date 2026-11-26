import type { ReactNode } from 'react';
import type { JahresKonfiguration } from '../types';

/**
 * Erläuterungen zu den Eingabefeldern (Info-Symbol „i“). Beträge stammen aus dem gewählten Berechnungsjahr.
 * Die Texte geben allgemeine Hinweise und ersetzen keine Beratung im Einzelfall.
 */
export function infoTexte(jk: JahresKonfiguration) {
  const t = jk.tabelle;
  const eur = (v: number) => `${v.toLocaleString('de-DE')} €`;
  const P = ({ children }: { children: ReactNode }) => <p>{children}</p>;

  return {
    // ------------------------------------------------------------------ Allgemein
    berechnungsjahr: (
      <>
        <P>Das Jahr, für das der Unterhalt berechnet wird. Davon hängen Düsseldorfer Tabelle, Kindergeld, Selbstbehalte, Steuer- und Sozialversicherungswerte sowie die Tariftabellen ab.</P>
        <P>„Vorläufig“ heißt: Für dieses Jahr sind noch nicht alle Werte amtlich veröffentlicht.</P>
      </>
    ),
    stichtag: (
      <P>
        Datum, zu dem das Alter der Kinder bestimmt wird. Die höhere Altersstufe gilt ab dem Monat, in dem das Kind 6, 12
        bzw. 18 Jahre alt wird. Für eine laufende Zahlung meist der aktuelle Monat.
      </P>
    ),

    // ------------------------------------------------------------------ Elternteil
    elternName: <P>Frei wählbare Bezeichnung, z. B. „Vater“, „Mutter“ oder ein Vorname. Erscheint in Ergebnis und Bericht.</P>,
    einkommensangabe: (
      <>
        <P><strong>Netto eingeben</strong>, wenn eine Gehaltsabrechnung oder ein Steuerbescheid vorliegt – das ist am genauesten.</P>
        <P><strong>Brutto eingeben</strong>, wenn nur das Bruttogehalt oder die Tarifeingruppierung bekannt ist; das Netto wird dann geschätzt.</P>
      </>
    ),
    nettoeinkommen: (
      <>
        <P>Durchschnittliches monatliches Nettoeinkommen nach Steuern und Sozialabgaben („Auszahlungsbetrag“ vor privaten Abzügen).</P>
        <P>
          Am besten das Jahresnetto inkl. Weihnachts- und Urlaubsgeld, Überstunden und Steuererstattung durch 12 teilen.
          Kindergeld nicht mitrechnen.
        </P>
      </>
    ),
    erwerbsstatus: (
      <P>
        Bestimmt den notwendigen Selbstbehalt gegenüber minderjährigen Kindern: erwerbstätig {eur(t.selbstbehalt.notwendigErwerbstaetig)},
        nicht erwerbstätig {eur(t.selbstbehalt.notwendigNichtErwerbstaetig)}. Ohne Erwerbstätigkeit werden keine berufsbedingten
        Aufwendungen abgezogen.
      </P>
    ),
    berufsbedingt: (
      <>
        <P>
          Notwendige Kosten der Arbeit, die der Arbeitgeber nicht erstattet. Sie sind in der Regel <strong>konkret</strong>
          nachzuweisen.
        </P>
        <P>
          <strong>Pauschale</strong> (5 % des Nettoeinkommens) – je nach gewählten Leitlinien:
        </P>
        <ul className="list-inside list-disc space-y-0.5">
          <li>NRW (10.2.1): in der Regel nur bei fiktivem Erwerbseinkommen, sonst Kosten konkret darlegen; keine Grenzen.</li>
          <li>Süddeutsche (10.2.1): bei entsprechenden Anhaltspunkten, nur für nichtselbständige Arbeit; keine Grenzen.</li>
          <li>Niedersachsen (10.2.1): für nichtselbständige Arbeit, bei Vollzeit mindestens 50 €, höchstens 150 €.</li>
          <li>Berlin (10.2.1): für nichtselbständige Arbeit ohne Nachweis, mindestens 50 €, höchstens 150 €.</li>
        </ul>
        <P>Pauschale und Einzelkosten werden nicht kombiniert.</P>
        <P>
          <strong>Fahrtkosten</strong> (10.2.2): vorrangig Kosten öffentlicher Verkehrsmittel; mit dem Auto 0,42 € je
          <em> gefahrenem</em> Kilometer, für längere Strecken meist 0,28 € (NRW ab dem 31. Entfernungskilometer, Süddeutsche ab
          etwa 30 km, Niedersachsen ab dem 61. km der täglichen Gesamtstrecke). Daneben keine weiteren Autokosten.
        </P>
      </>
    ),
    berufsbedingtKonkret: (
      <P>
        Monatlicher Betrag der nachgewiesenen Kosten (Jahresbetrag ÷ 12). Beispiel Auto, 38 km einfach, 220 Arbeitstage:
        2 × (30 × 0,42 € + 8 × 0,28 €) × 220 ÷ 12 ≈ 544 €.
      </P>
    ),
    altersvorsorge: (
      <>
        <P>Zusätzliche private Altersvorsorge pro Monat, z. B. Riester-Vertrag oder private Rentenversicherung.</P>
        <P>
          Anerkannt werden in der Regel bis zu 4 % des Bruttoeinkommens zusätzlich zur gesetzlichen Rente – beim Kindesunterhalt
          aber nur, wenn der Mindestbedarf der minderjährigen Kinder gedeckt ist. Pflichtbeiträge zur Rentenversicherung hier
          <strong> nicht</strong> eintragen – sie sind im Netto bereits abgezogen.
        </P>
        <P>
          Bei Brutto-Eingabe kürzt der Rechner einen höheren Betrag automatisch auf 4 % des Bruttos (inkl. Sonderzahlungen,
          umgerechnet auf den Monat). Bei Netto-Eingabe ist das Brutto unbekannt – dann bitte selbst auf die Grenze achten.
        </P>
      </>
    ),
    schulden: (
      <>
        <P>Monatliche Kreditraten, die berücksichtigt werden können – vor allem Schulden, die schon während des Zusammenlebens bestanden oder unvermeidbar waren.</P>
        <P>Gegenüber minderjährigen Kindern werden Schulden nur eingeschränkt anerkannt (Abwägung im Einzelfall).</P>
      </>
    ),
    leitlinien: (
      <>
        <P>
          Die Oberlandesgerichte haben eigene Leitlinien, die die Düsseldorfer Tabelle ergänzen. Maßgeblich sind in der Regel
          die Leitlinien des Oberlandesgerichts, in dessen Bezirk das Kind wohnt. Tabellenbeträge und Selbstbehalte sind
          überall gleich.
        </P>
        <P>Der Rechner berücksichtigt diese Unterschiede (Stand 01.01.2026):</P>
        <ul className="list-inside list-disc space-y-0.5">
          <li>5 %-Pauschale für berufsbedingte Aufwendungen: Voraussetzungen und Mindest-/Höchstbetrag (Niedersachsen und Berlin 50–150 €)</li>
          <li>Ausbildungsaufwand des Kindes (100 €): in NRW nur, wenn das Kind bei einem Elternteil wohnt; in Berlin keine Pauschale, nur nachgewiesene Kosten</li>
          <li>Altersvorsorge: NRW, Niedersachsen und Berlin 4 % des Bruttos zusätzlich, Süddeutsche insgesamt 23 % einschließlich gesetzlicher Rentenversicherung</li>
          <li>Bei fiktivem Einkommen setzt der Rechner die Pauschale nur nach den Leitlinien NRW automatisch an.</li>
        </ul>
        <P>
          NRW: OLG Düsseldorf, Hamm, Köln · Süddeutsche: OLG Bamberg, Karlsruhe, München, Nürnberg, Stuttgart, Zweibrücken ·
          Niedersachsen: OLG Braunschweig, Celle, Oldenburg · Berlin: Kammergericht. Andere Bezirke (z. B. Brandenburg,
          Hamburg, Frankfurt) haben eigene Leitlinien, die hier nicht abgebildet sind.
        </P>
      </>
    ),
    zusammenleben: (
      <>
        <P>
          Wer mit einem neuen Partner zusammenlebt, spart Wohn- und Haushaltskosten. Deshalb kann der Selbstbehalt herabgesetzt
          werden – nach allen vier hier wählbaren Leitlinien in der Regel um 10 % (Ziff. 21.5), z. B. von
          {' '}{eur(t.selbstbehalt.notwendigErwerbstaetig)} auf {eur(Math.round(t.selbstbehalt.notwendigErwerbstaetig * 0.9))}.
        </P>
        <P>
          Voraussetzung: Der Partner ist leistungsfähig, verfügt also selbst über ein Einkommen mindestens in Höhe des notwendigen
          Selbstbehalts eines Nichterwerbstätigen abzüglich 10 % (rund {eur(Math.round(t.selbstbehalt.notwendigNichtErwerbstaetig * 0.9))};
          Leitlinien Berlin und Niedersachsen, BGH FamRZ 2025, 1105). Der Rechner senkt den notwendigen Selbstbehalt gegenüber
          Kindern und den Selbstbehalt beim Ehegattenunterhalt.
        </P>
      </>
    ),
    fiktiv: (
      <>
        <P>
          Wer gegenüber minderjährigen Kindern zu wenig verdient, weil er sich nicht ausreichend um Arbeit bemüht, muss sich ein
          erzielbares Einkommen anrechnen lassen (gesteigerte Erwerbsobliegenheit, § 1603 Abs. 2 BGB; Leitlinien Ziff. 9).
          Voraussetzung ist eine reale Chance, eine solche Stelle zu finden.
        </P>
        <P>
          Das erzielbare Netto ersetzt dann ein geringeres tatsächliches Einkommen; der Elternteil gilt als erwerbstätig
          (Selbstbehalt {eur(t.selbstbehalt.notwendigErwerbstaetig)}). Nach den Leitlinien NRW wird die 5 %-Pauschale gerade bei fiktivem
          Einkommen angesetzt.
        </P>
      </>
    ),
    fiktivNetto: (
      <P>
        Monatliches Nettoeinkommen, das bei zumutbarer Vollzeitarbeit realistisch erzielbar wäre – Ausbildung, Berufserfahrung,
        Alter und Arbeitsmarkt berücksichtigen. Fehlt eine besondere Qualifikation, setzen Gerichte häufig eine Vollzeitstelle zum
        gesetzlichen Mindestlohn an (BGH, Beschluss vom 26.03.2025 – XII ZB 388/24: 176 Stunden im Monat). Den Bruttolohn dafür
        mit der Brutto-Eingabe in ein Netto umrechnen und hier eintragen.
      </P>
    ),
    pkvEltern: (
      <>
        <P>
          Nur für privat Versicherte: der monatliche Beitrag zur eigenen Kranken- und Pflegeversicherung. Angemessene Beiträge
          werden vom Einkommen abgezogen (Leitlinien 10.1). Beiträge für Zusatzversicherungen gehören nicht dazu, solange der
          Mindestunterhalt der Kinder nicht gedeckt ist (BGH XII ZR 158/10).
        </P>
        <P>
          Zahlt der Arbeitgeber einen Zuschuss mit dem Gehalt aus, ist dieser im Netto enthalten – dann den vollen Beitrag
          eintragen. Die Brutto-Netto-Schätzung rechnet mit gesetzlicher Versicherung; privat Versicherte geben besser das Netto
          laut Abrechnung ein.
        </P>
      </>
    ),
    kvKind: (
      <>
        <P>
          Nur wenn das Kind nicht beitragsfrei familienversichert ist (z. B. privat versichert): der monatliche Beitrag zur
          Kranken- und Pflegeversicherung, bei Beihilfe nur der verbleibende Teil. Er ist im Tabellenbetrag nicht enthalten
          (Düsseldorfer Tabelle Anm. A. V).
        </P>
        <P>
          Lebt das minderjährige Kind bei einem Elternteil, trägt der andere den Beitrag zusätzlich zum Tabellenunterhalt; sein
          Einkommen wird vorher um den Beitrag bereinigt (Leitlinien Ziff. 11.1; BGH XII ZB 338/17). Im Wechselmodell und bei
          volljährigen Kindern erhöht der Beitrag den Bedarf und wird nach Haftungsquote verteilt.
        </P>
      </>
    ),
    kvZahler: (
      <P>
        Wer den Beitrag an die Versicherung überweist. Im Wechselmodell zählt die Zahlung als Leistung in natura dieses
        Elternteils und wird beim Ausgleich angerechnet.
      </P>
    ),
    wohnvorteil: (
      <>
        <P>
          Wer mietfrei im eigenen Haus oder in der eigenen Wohnung wohnt, spart Miete. Dieser Vorteil zählt unterhaltsrechtlich
          als Einkommen und wird hinzugerechnet.
        </P>
        <P>
          Anzusetzen ist der Mietwert der Wohnung – nach der Trennung zunächst meist nur eine angemessene Miete für eine kleinere
          Wohnung – abzüglich Kreditzinsen und nicht umlagefähiger Nebenkosten. Tilgung ist je nach Leitlinien und Einzelfall
          ganz oder teilweise abziehbar. Ergibt sich ein negativer Wert, hier 0 eintragen und die Belastung ggf. unter
          „Berücksichtigungsfähige Schulden“ erfassen.
        </P>
      </>
    ),
    sonstigeAbzuege: (
      <P>
        Weitere anerkannte Abzüge pro Monat, z. B. Kranken- und Pflegeversicherung bei privat Versicherten oder hohe Umgangskosten.
        Nicht eintragen: Miete und allgemeine Lebenshaltung – diese sind im Selbstbehalt enthalten.
      </P>
    ),
    weitereBerechtigte: (
      <P>
        Unterhaltsberechtigte Personen, die keine Kinder sind, z. B. ein (früherer) Ehegatte. Sie zählen nur für die Zu- und
        Herabstufung in der Tabelle. Kinder aus anderen Beziehungen bitte unten bei „Weitere unterhaltsberechtigte Kinder“ erfassen.
      </P>
    ),
    weitereKinder: (
      <P>
        Eigene Kinder dieses Elternteils aus anderen Beziehungen, die ebenfalls Unterhalt bekommen – egal ob sie im eigenen
        Haushalt leben oder ob Barunterhalt gezahlt wird. Sie verringern den für die gemeinsamen Kinder verfügbaren Betrag.
      </P>
    ),
    rangVolljaehrig: (
      <>
        <P>Nur für Kinder ab 18 relevant.</P>
        <P>
          <strong>Privilegiert</strong>: unter 21, unverheiratet, besucht eine allgemeinbildende Schule und lebt bei einem
          Elternteil – gleichrangig mit minderjährigen Kindern. <strong>Sonstig</strong>: alle anderen Volljährigen (z. B. Studium,
          Ausbildung) – sie sind nachrangig.
        </P>
      </>
    ),
    artDesUnterhalts: (
      <P>
        <strong>Barunterhalt</strong>: Das Kind lebt beim anderen Elternteil, dieser Elternteil zahlt. <strong>Eigener Haushalt</strong>:
        Das Kind lebt bei diesem Elternteil und wird dort versorgt.
      </P>
    ),
    zahlbetragWeiteresKind: (
      <P>
        Tatsächlich gezahlter oder titulierter Monatsbetrag (Zahlbetrag nach Abzug des Kindergeldanteils). Leer lassen, um den
        Betrag nach der Tabelle zu berechnen.
      </P>
    ),

    // ------------------------------------------------------------------ Brutto
    bruttoQuelle: (
      <P>
        <strong>Betrag eingeben</strong>: Bruttogehalt laut Abrechnung. <strong>Tarifvertrag</strong>: Bei Beschäftigten im
        öffentlichen Dienst das Gehalt aus Entgeltgruppe und Stufe übernehmen.
      </P>
    ),
    bruttolohn: (
      <P>
        Monatliches Bruttogehalt laut Arbeitsvertrag oder Gehaltsabrechnung – ohne Einmalzahlungen. Bei Teilzeit (Arbeitszeit
        unter 100 %) hier das Gehalt einer Vollzeitstelle eintragen; der Teilzeitanteil wird berechnet.
      </P>
    ),
    bruttoArbeitszeit: (
      <>
        <P>Anteil an einer Vollzeitstelle, z. B. 75 % bei 30 von 40 Wochenstunden.</P>
        <P>
          Unter 100 % gelten Bruttolohn und Sonderzahlungen als <strong>Vollzeitwerte</strong> und werden anteilig gekürzt. Wer
          das tatsächliche Teilzeitgehalt schon kennt, lässt 100 % stehen und trägt es direkt ein.
        </P>
      </>
    ),
    sonderzahlungen: (
      <P>Einmalzahlungen pro Jahr, z. B. Weihnachts- und Urlaubsgeld oder Prämien (Summe für das ganze Jahr). Sie werden auf 12 Monate verteilt.</P>
    ),
    steuerklasse: (
      <>
        <P>Laut Gehaltsabrechnung. Nach der Trennung gilt in der Regel ab dem Folgejahr Klasse I bzw. II (alleinerziehend mit Kind im Haushalt).</P>
        <P>Bei Klasse III oder V kann unterhaltsrechtlich eine fiktive Steuerlast angesetzt werden.</P>
      </>
    ),
    kirchensteuer: <P>Nur bei Kirchenmitgliedschaft: 8 % in Bayern und Baden-Württemberg, sonst 9 %.</P>,
    kinderfreibetraege: (
      <P>
        Zahl der Kinderfreibeträge laut Gehaltsabrechnung (Lohnsteuermerkmale): je Kind meist 0,5 bei getrennt lebenden Eltern
        oder 1,0. Wirkt nur auf Solidaritätszuschlag und Kirchensteuer.
      </P>
    ),
    pvKinder: (
      <P>
        Anzahl der eigenen Kinder unter 25 Jahren, auch aus anderen Beziehungen. 0 bedeutet Kinderlosenzuschlag; ab dem
        zweiten Kind sinkt der Pflegeversicherungsbeitrag.
      </P>
    ),
    krankenkasse: (
      <P>
        Gesetzliche Krankenkasse auswählen – ihr Zusatzbeitrag wird übernommen. Steht die Kasse nicht in der Liste, „Andere
        Kasse“ wählen und den Zusatzbeitrag von der Abrechnung übernehmen. Privat Versicherte geben besser direkt das Netto ein.
      </P>
    ),
    zusatzversorgung: (
      <>
        <P>Betriebliche Altersversorgung im öffentlichen Dienst (z. B. VBL). Auf der Gehaltsabrechnung als „Umlage“ oder „ZV-Beitrag“ zu finden.</P>
        <P>Kommunal Beschäftigte sind oft bei einer kommunalen Kasse – dann „Andere Kasse“ wählen und die Sätze eintragen.</P>
      </>
    ),

    // ------------------------------------------------------------------ Tarif
    tarifvertrag: (
      <P>
        Tarifvertrag aus dem Arbeitsvertrag: Städte/Gemeinden/Kreise → TVöD VKA, Bundesbehörden → TVöD Bund, Landesbehörden und
        Unis → TV-L, Kitas und Sozialarbeit → TVöD SuE, Bundesagentur für Arbeit → TV-BA.
      </P>
    ),
    entgeltgruppe: <P>Entgeltgruppe bzw. Tätigkeitsebene laut Arbeitsvertrag oder Gehaltsabrechnung (z. B. „E 9b“ oder „TE V“).</P>,
    stufe: <P>Stufe laut Gehaltsabrechnung. Sie steigt mit der Dauer der Beschäftigung.</P>,
    arbeitszeit: <P>Anteil an einer Vollzeitstelle, z. B. 50 % bei halber Stelle oder 75 % bei 29,25 von 39 Wochenstunden.</P>,

    // ------------------------------------------------------------------ Kinder
    betreuungsmodell: (
      <>
        <P>Bei wem lebt das Kind überwiegend? Der andere Elternteil zahlt dann Barunterhalt.</P>
        <P>Das <strong>Wechselmodell</strong> gilt nur bei annähernd gleicher Betreuung (etwa 50 : 50). Ein großzügiges Umgangsrecht ist noch kein Wechselmodell.</P>
      </>
    ),
    alter: (
      <P>
        Altersstufe direkt wählen oder Geburtsdatum eingeben – dann wird die Altersstufe zum Stichtag ermittelt. Kinder ab 18 sind
        volljährig; dann zahlen in der Regel beide Eltern anteilig.
      </P>
    ),
    kindergeldEmpfaenger: (
      <P>Elternteil, an den die Familienkasse das Kindergeld auszahlt – meist der Elternteil, bei dem das Kind lebt.</P>
    ),
    eigenesEinkommen: (
      <P>
        Monatliches Netto-Einkommen des Kindes, z. B. Ausbildungsvergütung. Davon werden pauschal
        {' '}{eur(t.ausbildungsbedingterMehrbedarf)} Ausbildungsaufwand abgezogen – nach den Leitlinien NRW nur, wenn das Kind bei einem
        Elternteil wohnt; nach den Berliner Leitlinien gar nicht (nur nachgewiesene Kosten, hier vorher abziehen);
        bei Minderjährigen wird der Rest zur Hälfte angerechnet. Kindergeld nicht eintragen.
      </P>
    ),
    zeitraum: (
      <>
        <P>
          Rechnet den Unterhalt für jeden Monat des Zeitraums einzeln: Kinder mit Geburtsdatum wechseln automatisch in die
          höhere Altersstufe – ab dem Monat, in dem sie 6, 12 oder 18 werden (§ 1612a Abs. 3 BGB). Für jeden Monat gelten
          Tabelle, Kindergeld und Selbstbehalte des jeweiligen Jahres. Ändert sich ein Einkommen, unter
          „Einkommensänderungen“ den neuen Betrag ab dem jeweiligen Monat erfassen; alle übrigen Eingaben bleiben gleich.
        </P>
        <P>
          Der Rückstand ist die Summe der monatlichen Ausgleichsbeträge zwischen den Eltern abzüglich der tatsächlich
          gezahlten Beträge. Einmaliger Sonderbedarf und Zahlungen direkt an volljährige Kinder sind darin nicht enthalten.
        </P>
        <P>
          Für die Vergangenheit kann Unterhalt grundsätzlich erst ab dem Monat verlangt werden, in dem zur Auskunft oder
          Zahlung aufgefordert wurde (§ 1613 BGB); Ansprüche verjähren nach drei Jahren. Ob und ab wann ein Rückstand geltend
          gemacht werden kann, bitte fachlich prüfen lassen.
        </P>
      </>
    ),
    zeitraumZahlungen: (
      <>
        <P>
          Was tatsächlich an den anderen Elternteil gezahlt wurde – je Zeile ein gleichbleibender Monatsbetrag von … bis. Bei
          wechselnden Beträgen mehrere Zeilen anlegen (z. B. Januar–März 400 €, ab Mai 450 €; Monate ohne Zahlung einfach
          auslassen). Ohne „Bis“ gilt der Betrag bis zum Ende des Zeitraums.
        </P>
        <P>
          Zahlungen in beide Richtungen werden verrechnet. Ergebnis ist der Rückstand (zu wenig gezahlt) oder die
          Überzahlung (zu viel gezahlt) des unterhaltspflichtigen Elternteils.
        </P>
      </>
    ),
    zeitraumBetreuung: (
      <P>
        Ab dem angegebenen Monat gilt für das Kind ein anderes Betreuungsmodell – z. B. Umzug zum anderen Elternteil oder
        Beginn eines Wechselmodells. Es gilt bis zu einem späteren Wechsel oder bis zum Ende des Zeitraums.
      </P>
    ),
    zeitraumAenderungen: (
      <>
        <P>
          Ab dem angegebenen Monat gilt für den Elternteil das neue Einkommen – bis zu einer späteren Änderung oder bis zum
          Ende des Zeitraums. Der Betrag gilt in der Einkommensart, die oben beim Elternteil gewählt ist: bei „Netto
          eingeben“ das monatliche Nettoeinkommen, bei Brutto-Eingabe der monatliche Bruttolohn (Abzüge, Steuerklasse usw.
          bleiben gleich).
        </P>
        <P>Bei Auswahl eines Tarifvertrags sind Änderungen hier nicht möglich – dafür den Bruttolohn manuell eingeben.</P>
      </>
    ),
    kinderzuschlag: (
      <>
        <P>
          Kinderzuschlag nach § 6a BKGG, den ein Elternteil für dieses Kind tatsächlich von der Familienkasse erhält (Bescheid).
          Er wird zusätzlich zum Kindergeld an Familien mit kleinem Einkommen gezahlt.
        </P>
        <P>
          Unterhaltsrechtlich ist er Einkommen des Kindes und mindert den Barbedarf in voller Höhe – anders als eigenes
          Erwerbseinkommen, das bei Minderjährigen nur zur Hälfte angerechnet wird (BGH, Beschluss vom 28.10.2020 – XII ZB 512/19).
          Weil sich der Kinderzuschlag wiederum nach dem gezahlten Unterhalt richtet, die Werte aus dem aktuellen Bescheid nehmen.
        </P>
      </>
    ),
    wechselMehrkosten: (
      <P>
        Weitere monatliche Kosten, weil das Kind in zwei Haushalten lebt, z. B. Fahrtkosten zwischen den Wohnungen oder doppelt
        angeschaffte Ausstattung. Wohnkosten nicht hier, sondern in den Feldern „Wohnkosten des Kindes“ eintragen – sonst werden sie
        doppelt gezählt. Wird nach Haftungsquote auf beide Eltern verteilt.
      </P>
    ),
    wechselWohnkosten: (
      <>
        <P>
          Die tatsächlichen monatlichen Wohnkosten, die in diesem Haushalt auf das Kind entfallen – üblich ist die anteilige
          Warmmiete nach Fläche: Kinderzimmer voll plus ein Anteil an Küche, Bad und Flur. Beispiel: Warmmiete 1.200 € für
          80 m², Kinderzimmer 12 m² plus ¼ von 20 m² Gemeinschaftsfläche = 17 m² → 1.200 € × 17/80 ≈ 255 €.
        </P>
        <P>
          Im Tabellenbetrag sind bereits rund {Math.round(t.wohnkostenanteilTabelle * 100)} % für Wohnen enthalten. Nur was beide
          Haushalte zusammen darüber hinaus kosten, ist Wohnmehrbedarf; er erhöht den Bedarf und wird nach Haftungsquote verteilt.
          Die Wohnkosten zählt jeder Elternteil als eigene Leistung in natura. Eine Aufteilung der Miete nach Köpfen wird von
          Gerichten meist nicht anerkannt.
        </P>
      </>
    ),
    eigenerHaushalt: (
      <P>
        Für volljährige Kinder, die nicht mehr bei einem Elternteil wohnen (z. B. Studium). Dann gilt ein fester Bedarf von
        {' '}{eur(t.bedarfVolljaehrigEigenerHaushalt)} (darin {eur(t.wohnkostenanteilEigenerHaushalt)} Warmmiete), abzüglich Kindergeld
        und eigenem Einkommen.
      </P>
    ),
    ehegatte: (
      <>
        <P>
          Unterhalt zwischen den (getrennten oder geschiedenen) Eltern. Kindesunterhalt geht vor: Er wird zuerst vom Einkommen
          abgezogen.
        </P>
        <P>
          Berechnung nach der Quotenmethode: {Math.round(t.ehegatte.erwerbsquote * 100)} % der Differenz der Erwerbseinkommen
          (Erwerbsanreiz 1/10), bei sonstigen Einkünften wie Rente 50 %. Mindestbedarf des Berechtigten
          {' '}{eur(t.ehegatte.mindestbedarf.erwerbstaetig)} (erwerbstätig) bzw. {eur(t.ehegatte.mindestbedarf.nichtErwerbstaetig)};
          dem Zahlenden bleiben mindestens {eur(t.ehegatte.selbstbehalt.erwerbstaetig)} bzw. {eur(t.ehegatte.selbstbehalt.nichtErwerbstaetig)}.
        </P>
        <P>
          Nicht enthalten: Vorsorgeunterhalt (Alter, Krankheit), Wohnvorteil, Erwerbsobliegenheit, Befristung. Der Ehegatte zählt
          automatisch als weiterer Berechtigter – bei „Weitere Berechtigte“ nicht zusätzlich eintragen.
        </P>
      </>
    ),
    ehegatteArt: (
      <>
        <P><strong>Trennungsunterhalt</strong>: vom Auszug bis zur rechtskräftigen Scheidung.</P>
        <P>
          <strong>Nachehelicher Unterhalt</strong>: nach der Scheidung nur bei einem Unterhaltstatbestand (z. B. Betreuung kleiner
          Kinder, Alter, Krankheit, Aufstockung). Er kann herabgesetzt oder befristet werden (§ 1578b BGB) – das prüft der
          Rechner nicht.
        </P>
      </>
    ),
    mehrSonderbedarf: (
      <>
        <P>
          <strong>Mehrbedarf</strong>: regelmäßige Kosten, die über den normalen Bedarf hinausgehen – z. B. Kita-Beitrag (ohne
          Verpflegung), Nachhilfe, Kosten wegen Krankheit. Betrag pro Monat.
        </P>
        <P>
          <strong>Sonderbedarf</strong>: einmalige, unerwartet hohe Kosten – z. B. Klassenfahrt, Kieferorthopädie, Erstausstattung.
          Gesamtbetrag eintragen.
        </P>
        <P><strong>Bezahlt von</strong>: wer die Rechnung bezahlt. Der andere Elternteil erstattet seinen Anteil nach Einkommen.</P>
      </>
    ),
  };
}

export type InfoTexte = ReturnType<typeof infoTexte>;
