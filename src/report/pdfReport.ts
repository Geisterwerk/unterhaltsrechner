import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import type { ReportModel } from './reportModel';

/**
 * Erzeugt den PDF-Bericht vollständig im Browser (keine Übermittlung an einen Server).
 */

const RAND = 15;
const FARBE_PRIMAER: [number, number, number] = [0, 125, 125]; // Petrol #007D7D
const FARBE_TEXT: [number, number, number] = [30, 41, 59];
const FARBE_GRAU: [number, number, number] = [100, 116, 139];

/**
 * Die Standardschriften von PDF unterstützen nur WinAnsi (Windows-1252).
 * Zeichen außerhalb davon werden durch gleichwertige Zeichen ersetzt.
 */
export function pdfText(text: string): string {
  return text
    .replace(/−/g, '-') // Minuszeichen
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/⌀/g, 'Ø') // Durchschnittszeichen
    .replace(/ | /g, ' ') // schmale Leerzeichen (toLocaleString)
    .replace(/[^\u0000-ÿ€–—‘’‚“”„•…ŒœŠšŸŽžƒˆ˜†‡‰‹›™]/g, '?');
}

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? RAND;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 20) {
    doc.addPage();
    return RAND + 5;
  }
  return y;
}

function heading(doc: jsPDF, text: string, y: number): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...FARBE_PRIMAER);
  doc.text(pdfText(text), RAND, y);
  doc.setDrawColor(...FARBE_PRIMAER);
  doc.setLineWidth(0.3);
  doc.line(RAND, y + 1.5, doc.internal.pageSize.getWidth() - RAND, y + 1.5);
  doc.setTextColor(...FARBE_TEXT);
  return y + 6;
}

function paragraph(doc: jsPDF, text: string, y: number, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}): number {
  const width = doc.internal.pageSize.getWidth() - 2 * RAND;
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size ?? 9.5);
  doc.setTextColor(...(opts.color ?? FARBE_TEXT));
  const lines = doc.splitTextToSize(pdfText(text), width) as string[];
  const lh = (opts.size ?? 9.5) * 0.45;
  for (const line of lines) {
    y = ensureSpace(doc, y, lh + 1);
    doc.text(line, RAND, y);
    y += lh;
  }
  doc.setTextColor(...FARBE_TEXT);
  return y + 1.5;
}

const tableBase = {
  margin: { left: RAND, right: RAND, top: RAND + 5, bottom: 20 },
  styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, textColor: FARBE_TEXT, overflow: 'linebreak' as const },
  headStyles: { fillColor: FARBE_PRIMAER, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
  alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
};

export function createReportPdf(model: ReportModel, opts: { compress?: boolean } = {}): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: opts.compress ?? true });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setProperties({ title: pdfText(model.titel), subject: 'Unverbindliche Orientierung', creator: 'Kindesunterhaltsrechner' });

  // Kopf
  let y = RAND + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...FARBE_TEXT);
  doc.text(pdfText(model.titel), RAND, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...FARBE_GRAU);
  doc.text(
    pdfText(`Berechnungsjahr ${model.jahr}${model.vorlaeufig.length > 0 ? ' (vorläufig)' : ''} · Stichtag ${model.stichtag} · erstellt am ${model.erstelltAm}`),
    RAND,
    y,
  );
  y += 6;

  // Rechtlicher Hinweis (Kasten)
  const width = pageW - 2 * RAND;
  doc.setFontSize(8.5);
  const hinweis = doc.splitTextToSize(pdfText(`Rechtlicher Hinweis: ${model.rechtlicherHinweis}`), width - 6) as string[];
  const boxH = hinweis.length * 3.8 + 4;
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  doc.roundedRect(RAND, y, width, boxH, 1.5, 1.5, 'FD');
  doc.setTextColor(12, 74, 110);
  doc.text(hinweis, RAND + 3, y + 4.5);
  y += boxH + 4;

  // Vorläufige Werte (Kasten)
  if (model.vorlaeufig.length > 0) {
    const zeilen = [
      `Vorläufige Berechnung für ${model.jahr}: Nicht alle Werte sind amtlich veröffentlicht.`,
      ...model.vorlaeufig.map((h) => `• ${h}`),
    ].flatMap((t) => doc.splitTextToSize(pdfText(t), width - 6) as string[]);
    const h = zeilen.length * 3.8 + 4;
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.roundedRect(RAND, y, width, h, 1.5, 1.5, 'FD');
    doc.setTextColor(120, 53, 15);
    doc.text(zeilen, RAND + 3, y + 4.5);
    y += h + 4;
  }
  y += 3;

  // Ergebnis
  y = heading(doc, 'Ergebnis', y);
  if (!model.ergebnis.ok) {
    y = paragraph(doc, 'Die Berechnung war aufgrund unvollständiger oder fehlerhafter Angaben nicht möglich:', y, { bold: true });
    for (const f of model.ergebnis.fehler) y = paragraph(doc, `• ${f}`, y);
  } else {
    for (const z of model.ergebnis.zusammenfassung) y = paragraph(doc, z, y, { size: 11, bold: true });
    if (model.ergebnis.ehegatte) y = paragraph(doc, model.ergebnis.ehegatte, y);
    if (model.ergebnis.saldo) y = paragraph(doc, model.ergebnis.saldo, y);
    autoTable(doc, {
      ...tableBase,
      startY: y + 1,
      head: [['Kind', 'Altersstufe', 'Betreuung', 'Zahlung', 'Betrag', 'Hinweis']],
      body: model.ergebnis.zahlungen.map((p) => [p.kind, p.alter, p.betreuung, p.zahlung, p.betrag, p.hinweis].map(pdfText)),
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }, 5: { textColor: FARBE_GRAU, fontSize: 7.5 } },
    });
    y = lastY(doc) + 7;
    if (model.ergebnis.einmalig.length > 0) {
      y = paragraph(doc, 'Einmalige Erstattungen (Sonderbedarf) – nicht in den Monatsbeträgen enthalten:', y, { bold: true });
      autoTable(doc, {
        ...tableBase,
        startY: y,
        head: [['Sonderbedarf', 'Zahlung', 'Betrag', 'Hinweis']],
        body: model.ergebnis.einmalig.map((e) => [e.posten, e.zahlung, e.betrag, e.hinweis].map(pdfText)),
        columnStyles: { 2: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }, 3: { textColor: FARBE_GRAU, fontSize: 7.5 } },
      });
      y = lastY(doc) + 7;
    }
  }

  // Zeitraum und Rückstand
  if (model.zeitraum) {
    const z = model.zeitraum;
    y = ensureSpace(doc, y, 30);
    y = heading(doc, `Zeitraum und Rückstand – ${z.titel}`, y);
    if (z.aenderungen.length > 0) {
      y = paragraph(doc, 'Einkommensänderungen:', y, { bold: true, size: 8.5 });
      for (const a of z.aenderungen) y = paragraph(doc, `• ${a}`, y, { size: 8.5 });
    }
    autoTable(doc, {
      ...tableBase,
      startY: y + 1,
      head: [['Zeitraum', 'Monatlich', 'Summe Ausgleich']],
      body: z.abschnitte.map((a) => [a.zeitraum, a.monatlich, a.summe].map(pdfText)),
      columnStyles: { 0: { cellWidth: 38 }, 2: { halign: 'right', cellWidth: 48 } },
    });
    y = lastY(doc) + 2;
    autoTable(doc, {
      ...tableBase,
      startY: y,
      body: z.summen.map(([k, v], i) => [
        { content: pdfText(k), styles: i === z.summen.length - 1 ? { fontStyle: 'bold' } : {} },
        { content: pdfText(v), styles: { halign: 'right', fontStyle: i === z.summen.length - 1 ? 'bold' : 'normal' } },
      ]),
    });
    y = lastY(doc) + 3;
    for (const h of z.hinweise) y = paragraph(doc, `• ${h}`, y, { size: 8 });
    y += 4;
  }

  // Hinweise
  if (model.hinweise.length > 0) {
    y = heading(doc, 'Hinweise', y);
    for (const h of model.hinweise) y = paragraph(doc, `• ${h}`, y, { size: 8.5 });
    y += 4;
  }

  // Eingaben
  y = heading(doc, 'Eingaben', y);
  for (const s of model.eingaben) {
    y = ensureSpace(doc, y, 18);
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [[{ content: pdfText(s.titel), colSpan: 2 }]],
      body: s.zeilen.length > 0 ? s.zeilen.map(([k, v]) => [pdfText(k), pdfText(v)]) : [['–', '']],
      columnStyles: { 0: { cellWidth: 70, textColor: FARBE_GRAU } },
    });
    y = lastY(doc) + 4;
  }

  // Rechenweg
  y += 3;
  y = heading(doc, 'Rechenweg', y);
  for (const step of model.rechenweg) {
    y = ensureSpace(doc, y, 18);
    const body: RowInput[] = step.zeilen.map((z) =>
      z.ueberschrift
        ? [
            {
              content: pdfText(z.label),
              colSpan: 3,
              styles: { fontStyle: 'bold', fillColor: [226, 232, 240], textColor: FARBE_TEXT },
            },
          ]
        : [
            { content: pdfText(z.label), styles: z.betont ? { fontStyle: 'bold' } : {} },
            { content: pdfText(z.wert), styles: { halign: 'right', ...(z.betont ? { fontStyle: 'bold' } : {}) } },
            { content: pdfText(z.hinweis ?? ''), styles: { textColor: FARBE_GRAU, fontSize: 7.5 } },
          ],
    );
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [[{ content: pdfText(step.titel), colSpan: 3 }]],
      body,
      columnStyles: { 0: { cellWidth: 72 }, 1: { cellWidth: 48 } },
    });
    y = lastY(doc) + 4;
  }

  // Grundlagen
  y += 3;
  y = heading(doc, 'Grundlagen und Quellen', y);
  for (const g of model.grundlagen) y = paragraph(doc, `• ${g}`, y, { size: 8.5 });

  // Fußzeile auf allen Seiten
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...FARBE_GRAU);
    doc.text(pdfText('Unverbindliche Orientierung – ersetzt keine familienrechtliche Beratung.'), RAND, h - 10);
    doc.text(`Seite ${i} von ${pages}`, pageW - RAND, h - 10, { align: 'right' });
  }
  return doc;
}

export function reportFilename(date: Date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `Unterhaltsberechnung_${d}.pdf`;
}

/** Bericht erzeugen und im Browser herunterladen */
export function downloadReportPdf(model: ReportModel): void {
  createReportPdf(model).save(reportFilename());
}
