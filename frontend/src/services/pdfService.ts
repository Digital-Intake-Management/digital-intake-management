/**
 * services/pdfService.ts
 * Generates completed intake form PDFs.
 *
 * Primary path  — fetch the real CareLink PDF template, fill its AcroForm fields
 *                 with saved values, embed signature images, then flatten.
 * Fallback path — if the template can't be fetched, generate a plain layout
 *                 PDF from scratch (legacy behavior).
 *
 * Owner: Anthony
 */

import { PDFDocument, PDFTextField, PDFCheckBox, rgb, StandardFonts } from 'pdf-lib';
import type { SessionForm } from '@/types';

export interface PdfGenerationInput {
  patientIdString: string;
  sessionCode: string;
  sessionForm: SessionForm;
  fieldValues: Record<string, string>;
  signatureDataUrls: Record<string, string>;
}

/**
 * Generates a single completed PDF.
 * Tries to fill the real template first; falls back to a generated layout.
 */
export async function generateFormPdf(input: PdfGenerationInput): Promise<Uint8Array> {
  const { sessionForm, fieldValues, signatureDataUrls } = input;
  const slug = sessionForm.formTemplate.slug;

  try {
    const token = localStorage.getItem('carelink_token') ?? '';
    const res = await fetch(`/api/forms/${slug}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('template not found');

    const templateBytes = new Uint8Array(await res.arrayBuffer());
    return await fillPdfTemplate(templateBytes, fieldValues, signatureDataUrls);
  } catch {
    // Fallback: generated layout PDF
    return generateFallbackPdf(input);
  }
}

/**
 * Fills all AcroForm fields in the PDF template with saved values,
 * embeds signature images at signature field positions, then flattens.
 */
async function fillPdfTemplate(
  templateBytes: Uint8Array,
  fieldValues: Record<string, string>,
  signatureDataUrls: Record<string, string>,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();

  // ── Fill text and checkbox fields ────────────────────────────────────────────
  for (const [key, value] of Object.entries(fieldValues)) {
    if (!value) continue;
    // Skip data URLs — those are signature images, handled below
    if (value.startsWith('data:')) continue;
    try {
      const field = form.getField(key);
      if (field instanceof PDFTextField) {
        field.setText(value);
      } else if (field instanceof PDFCheckBox) {
        if (value === 'Yes' || value === 'true' || value === 'On') {
          field.check();
        } else {
          field.uncheck();
        }
      }
    } catch { /* field may not exist in this PDF version — skip */ }
  }

  // ── Embed signatures at their AcroForm field positions ─────────────────────
  // Collect both explicitly passed signatureDataUrls and inline data: values
  const allSigs = { ...signatureDataUrls };
  for (const [key, value] of Object.entries(fieldValues)) {
    if (value?.startsWith('data:image/png;base64,')) allSigs[key] = value;
  }

  for (const [key, dataUrl] of Object.entries(allSigs)) {
    if (!dataUrl?.startsWith('data:image/png;base64,')) continue;
    try {
      const base64 = dataUrl.split(',')[1];
      const sigBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const sigImage = await pdfDoc.embedPng(sigBytes);

      // Find the signature widget for this field to get its exact position
      const fields = form.getFields();
      let placed = false;
      for (const field of fields) {
        if (field.getName() !== key) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const widgets: any[] = (field as any).acroField?.getWidgets?.() ?? [];
        for (const widget of widgets) {
          const rect = widget.getRectangle?.() as
            | { x: number; y: number; width: number; height: number }
            | undefined;
          if (!rect) continue;

          // Determine page
          let pageIndex = 0;
          try {
            const pageRef = widget.P?.();
            if (pageRef) {
              const pi = pages.findIndex(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (p) => (p as any).ref.toString() === pageRef.toString(),
              );
              if (pi >= 0) pageIndex = pi;
            }
          } catch { /* default page 0 */ }

          pages[pageIndex].drawImage(sigImage, {
            x: rect.x + 2,
            y: rect.y + 2,
            width: rect.width - 4,
            height: rect.height - 4,
          });
          placed = true;
          break;
        }
        if (placed) break;
      }
    } catch { /* skip signature that can't be embedded */ }
  }

  form.flatten();
  return pdfDoc.save();
}

/**
 * Fallback: generate a plain-layout PDF from field values when the
 * original template can't be fetched.
 */
async function generateFallbackPdf(input: PdfGenerationInput): Promise<Uint8Array> {
  const { patientIdString, sessionCode, sessionForm, fieldValues, signatureDataUrls } = input;
  const template = sessionForm.formTemplate;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  let y = height - margin;

  page.drawText('CareLink of Georgia', { x: margin, y, size: 16, font: fontBold, color: rgb(0.23, 0.31, 0.89) });
  y -= 20;
  page.drawText('Digital Intake Management Platform', { x: margin, y, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
  y -= 24;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.88, 0.88, 0.92) });
  y -= 20;
  page.drawText(template.name.toUpperCase(), { x: margin, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
  y -= 14;
  page.drawText(`Patient ID: ${patientIdString}   |   Session: ${sessionCode}   |   Date: ${new Date().toLocaleDateString()}`, { x: margin, y, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
  y -= 24;

  for (const [key, value] of Object.entries(fieldValues)) {
    if (!value || value.startsWith('data:')) continue;
    if (y < 80) break;
    page.drawText(key, { x: margin, y, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
    y -= 14;
    page.drawText(value, { x: margin + 10, y, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.1), maxWidth: width - margin * 2 - 10 });
    y -= 24;
  }

  // Embed signatures
  const sigWidth = (width - margin * 2 - 20) / 2;
  const sigEntries = Object.entries(signatureDataUrls).filter(([, v]) => v?.startsWith('data:image/png;base64,'));
  if (sigEntries.length > 0 && y > 160) {
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.88, 0.88, 0.92) });
    y -= 30;
    for (let i = 0; i < sigEntries.length; i++) {
      const [key, dataUrl] = sigEntries[i];
      const xOff = margin + (i % 2) * (sigWidth + 20);
      try {
        const base64 = dataUrl.split(',')[1];
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const img = await pdfDoc.embedPng(bytes);
        page.drawImage(img, { x: xOff, y: y - 60, width: sigWidth - 10, height: 60 });
      } catch {
        page.drawRectangle({ x: xOff, y: y - 60, width: sigWidth - 10, height: 60, borderColor: rgb(0.8, 0.8, 0.85), borderWidth: 1 });
      }
      page.drawText(key, { x: xOff, y: y - 74, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.5) });
    }
  }

  const generatedPages = pdfDoc.getPages();
  for (let i = 0; i < generatedPages.length; i++) {
    generatedPages[i].drawText(`Generated by CareLink • ${new Date().toISOString()} • Page ${i + 1}/${generatedPages.length}`, { x: margin, y: 20, size: 7, font: fontRegular, color: rgb(0.65, 0.65, 0.7) });
  }

  return pdfDoc.save();
}

/** Builds the standard PDF filename: {PatientID}_{FormName}_{Date}.pdf */
export function getPdfFilename(patientIdString: string, formName: string): string {
  const date = new Date().toISOString().split('T')[0];
  const safeName = formName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${patientIdString}_${safeName}_${date}.pdf`;
}

/** Triggers a browser download of the PDF bytes. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
