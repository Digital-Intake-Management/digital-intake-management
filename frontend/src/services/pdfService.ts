/**
 * services/pdfService.ts
 * Generates completed intake form PDFs with signatures embedded directly on the page.
 *
 * Flow:
 *   1. Build a PDF document from form field values and template metadata
 *   2. Draw signature images (PNG dataURLs from SignaturePad) onto the page
 *   3. Return the PDF as a Uint8Array for upload or download
 *
 * This replaces the separate "Signatures" step from the prototype — signatures
 * are captured during form completion and baked into the exported PDF.
 *
 * Owner: Anthony
 *
 * TODO (Anthony):
 *   - CareLink will provide their actual form PDFs. When they do, switch from
 *     generating a layout here to loading the existing PDF template and
 *     overlaying field values + signatures on top using pdf-lib's form filling.
 *   - Currently generates a clean layout PDF from scratch. This is a solid
 *     starting point that works without the official forms.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { SessionForm, FieldDefinition } from '@/types';

export interface PdfGenerationInput {
  patientIdString: string;
  sessionCode: string;
  sessionForm: SessionForm;
  fieldValues: Record<string, string>;
  // signatureDataUrls: { [fieldKey]: base64 PNG dataURL }
  signatureDataUrls: Record<string, string>;
}

/**
 * Generates a single form PDF with all field values and embedded signatures.
 * Returns the PDF bytes — caller is responsible for upload/download.
 */
export async function generateFormPdf(input: PdfGenerationInput): Promise<Uint8Array> {
  const { patientIdString, sessionCode, sessionForm, fieldValues, signatureDataUrls } = input;
  const template = sessionForm.formTemplate;
  const fields = template.fieldDefinitions as FieldDefinition[];

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const margin = 50;
  let y = height - margin;

  // ── Header ──────────────────────────────────────────────────────────────────
  page.drawText('CareLink of Georgia', {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.23, 0.31, 0.89), // primary blue
  });
  y -= 20;

  page.drawText('Digital Intake Management Platform', {
    x: margin,
    y,
    size: 9,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 24;

  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.88, 0.88, 0.92),
  });
  y -= 20;

  // Form name
  page.drawText(template.name.toUpperCase(), {
    x: margin,
    y,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.15),
  });
  y -= 14;

  // Meta row
  page.drawText(`Patient ID: ${patientIdString}   |   Session: ${sessionCode}   |   Date: ${new Date().toLocaleDateString()}`, {
    x: margin,
    y,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 24;

  // ── Fields ──────────────────────────────────────────────────────────────────
  for (const field of fields) {
    if (field.type === 'signature') continue; // signatures drawn separately below

    if (y < 120) {
      // Add new page if running out of space
      const newPage = pdfDoc.addPage([612, 792]);
      y = newPage.getSize().height - margin;
    }

    // Label
    page.drawText(`${field.label}${field.required ? ' *' : ''}`, {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.4),
    });
    y -= 14;

    // Value
    const value = fieldValues[field.key] || '_______________________________________________';
    const displayValue =
      field.type === 'checkbox' ? (value === 'true' ? '☑ Yes' : '☐ No') : value;

    page.drawText(displayValue, {
      x: margin + 10,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: width - margin * 2 - 10,
    });
    y -= 24;
  }

  // ── Signatures ───────────────────────────────────────────────────────────────
  const signatureFields = fields.filter((f) => f.type === 'signature');

  if (signatureFields.length > 0) {
    if (y < 180) {
      pdfDoc.addPage([612, 792]);
      y = 792 - margin;
    }

    // Signature section header
    y -= 10;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: rgb(0.88, 0.88, 0.92),
    });
    y -= 16;

    page.drawText('SIGNATURES', {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.4),
    });
    y -= 20;

    const sigWidth = (width - margin * 2 - 20) / Math.min(signatureFields.length, 2);
    const sigHeight = 80;

    for (let i = 0; i < signatureFields.length; i++) {
      const field = signatureFields[i];
      const xOffset = margin + (i % 2) * (sigWidth + 20);

      // If we have a captured signature image, embed it
      const dataUrl = signatureDataUrls[field.key];
      if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
        try {
          const base64 = dataUrl.split(',')[1];
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const img = await pdfDoc.embedPng(bytes);
          page.drawImage(img, {
            x: xOffset,
            y: y - sigHeight,
            width: sigWidth - 10,
            height: sigHeight,
          });
        } catch {
          // fallback: draw empty box
          page.drawRectangle({
            x: xOffset,
            y: y - sigHeight,
            width: sigWidth - 10,
            height: sigHeight,
            borderColor: rgb(0.8, 0.8, 0.85),
            borderWidth: 1,
          });
        }
      } else {
        // Empty signature box
        page.drawRectangle({
          x: xOffset,
          y: y - sigHeight,
          width: sigWidth - 10,
          height: sigHeight,
          borderColor: rgb(0.8, 0.8, 0.85),
          borderWidth: 1,
        });
      }

      // Label below signature box
      page.drawText(field.label, {
        x: xOffset,
        y: y - sigHeight - 12,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.5),
      });

      // Date line
      page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
        x: xOffset,
        y: y - sigHeight - 22,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.5),
      });
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawText(
      `Generated by CareLink Digital Intake Platform • ${new Date().toISOString()} • Page ${i + 1} of ${pages.length}`,
      {
        x: margin,
        y: 20,
        size: 7,
        font: fontRegular,
        color: rgb(0.65, 0.65, 0.7),
      }
    );
  }

  return pdfDoc.save();
}

/**
 * Generates the standard PDF filename per spec naming convention:
 * {PatientID}_{FormName}_{Date}.pdf
 */
export function getPdfFilename(patientIdString: string, formName: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const safeName = formName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${patientIdString}_${safeName}_${date}.pdf`;
}

/**
 * Triggers a browser download of the PDF bytes.
 * Used in DocumentExportPage for the counselor to save locally before uploading to SharePoint.
 */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
