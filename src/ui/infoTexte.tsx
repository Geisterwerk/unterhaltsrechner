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
          <strong>Pauschale</strong> ({Math.round(t.pauschale.rate * 100)} % des Nettoeinkommens): nach den Leitlinien NRW nur bei
          fiktivem Einkommen, nach den Süddeutschen Leitlinien bei entsprechenden Anhaltspunkten. Pauschale und Einzelkosten
          werden nicht kombiniert.
        </P>
        <P>
          <strong>Fahrtkosten</strong> (Leitlinien NRW 10.2.2): vorrangig Kosten öffentlicher Verkehrsmittel; mit dem Auto 0,42 € je
          <em> gefahrenem</em> Kilometer, ab dem 31. Entfernungskilometer meist 0,28 €. Daneben keine weiteren Autokosten.
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
        Monatliches Netto-Einkommen des Kindes, z. B. Ausbildungsvergütung. Wohnt das Kind bei einem Elternteil, werden
        {' '}{eur(t.ausbildungsbedingterMehrbedarf)} Ausbildungsaufwand abgezogen (bei eigenem Haushalt im festen Bedarf enthalten);
        bei Minderjährigen wird der Rest zur Hälfte angerechnet. Kindergeld nicht eintragen.
      </P>
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
