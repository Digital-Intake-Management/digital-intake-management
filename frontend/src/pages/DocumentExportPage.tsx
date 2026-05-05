/**
 * pages/DocumentExportPage.tsx
 * Generates PDFs from all completed forms and uploads them to SharePoint.
 *
 * Flow:
 *   1. Fetch the session (field values already saved during form completion)
 *   2. For each completed form, generate a PDF with pdf-lib (signatures embedded)
 *   3. Encode PDF as base64 and POST to the backend
 *   4. Backend writes the file to the per-patient SharePoint subfolder
 *   5. Navigate to MethaSoft linking step
 *
 * Owner: Anthony (PDF logic) / Dennise (UI)
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { sessionsApi } from '@/services/api';
import { generateFormPdf } from '@/services/pdfService';

export default function DocumentExportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [progress, setProgress] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);

    try {
      // Step 1: Load the full session — field values were saved by auto-save
      setProgress('Loading form data…');
      const { data: session } = await sessionsApi.get(sessionId!);

      const completedForms = (session.sessionForms ?? []).filter(
        (sf: any) => sf.status === 'COMPLETED',
      );

      if (completedForms.length === 0) {
        setExportError('No completed forms found. Please finish all required forms before exporting.');
        return;
      }

      // Step 2 & 3: Generate and upload each form PDF
      for (let i = 0; i < completedForms.length; i++) {
        const sessionForm = completedForms[i];
        const formName: string = sessionForm.formTemplate.name;

        setProgress(`Generating PDF ${i + 1} of ${completedForms.length}: ${formName}…`);

        // Flatten the fieldValues array into a plain object { fieldKey: value }
        const fieldValues: Record<string, string> = {};
        for (const fv of sessionForm.fieldValues ?? []) {
          fieldValues[fv.fieldKey] = fv.fieldValue;
        }

        // Signature fields are any value that is a PNG data URL — detected automatically
        const signatureDataUrls: Record<string, string> = {};
        for (const [key, value] of Object.entries(fieldValues)) {
          if (value?.startsWith('data:image/')) signatureDataUrls[key] = value;
        }

        // Generate the PDF — fills the real CareLink template, falls back to layout PDF
        const pdfBytes = await generateFormPdf({
          patientIdString: session.patientIdString,
          sessionCode: session.sessionCode,
          sessionForm,
          fieldValues,
          signatureDataUrls,
        });

        // Encode to base64 — use a loop instead of spread to avoid stack overflow
        // on large buffers (spread with Uint8Array can exhaust the call stack)
        let binary = '';
        for (let b = 0; b < pdfBytes.length; b++) {
          binary += String.fromCharCode(pdfBytes[b]);
        }
        const pdfBase64 = btoa(binary);

        setProgress(`Uploading ${formName} to SharePoint…`);
        await sessionsApi.exportPdf(sessionId!, session.patientIdString, formName, pdfBase64);
      }

      setExported(true);
    } catch (err: any) {
      const message = err?.response?.data?.error ?? 'Export failed. Please try again.';
      setExportError(message);
    } finally {
      setIsExporting(false);
      setProgress('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate(`/intake/${sessionId}`)}
        className="flex items-center gap-2 text-primary text-sm font-medium hover:underline">
        ← Back To Dashboard
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Document Export</h1>

      <div className="card flex flex-col items-center py-16 text-center">
        {exported ? (
          <>
            <div className="w-20 h-20 mb-6">
              <svg viewBox="0 0 80 80" fill="none">
                <rect width="60" height="70" x="10" y="5" rx="6" fill="#22c55e" opacity="0.15" />
                <rect width="60" height="70" x="10" y="5" rx="6" stroke="#22c55e" strokeWidth="3" />
                <path d="M25 40l12 12 18-20" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <rect width="20" height="15" x="50" y="50" rx="4" fill="#22c55e" />
                <path d="M55 58l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Export Complete!</h2>
            <p className="text-sm text-gray-400 mt-2">
              All forms have been saved to the secure SharePoint folder
            </p>
            <button
              onClick={() => navigate(`/intake/${sessionId}/methasoft`)}
              className="btn-primary mt-8"
            >
              Continue →
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mb-6 text-primary">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Ready to Export</h2>
            <p className="text-sm text-gray-400 mt-2 max-w-sm">
              All forms are complete. Click below to generate PDFs and save them to the secure SharePoint location.
            </p>

            {exportError && (
              <p className="mt-4 text-sm text-red-600 font-medium max-w-sm">{exportError}</p>
            )}

            {isExporting && progress && (
              <p className="mt-4 text-sm text-gray-500 animate-pulse">{progress}</p>
            )}

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn-primary mt-8"
            >
              {isExporting ? 'Exporting…' : 'Export All Forms'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
