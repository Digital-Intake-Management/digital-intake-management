/**
 * pages/DocumentExportPage.tsx
 * Fetches session data, generates one PDF per completed form via pdfService,
 * triggers browser downloads, then records the export in the backend.
 * Owner: Anthony (PDF logic) / Dennise (UI)
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { sessionsApi } from '@/services/api';
import { generateFormPdf, getPdfFilename, downloadPdf } from '@/services/pdfService';
import type { IntakeSession, FormFieldValue } from '@/types';

export default function DocumentExportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data: session } = await sessionsApi.get(sessionId!) as { data: IntakeSession };

      for (const sessionForm of session.sessionForms) {
        const fieldValues: Record<string, string> = {};
        const signatureDataUrls: Record<string, string> = {};

        for (const fv of (sessionForm.fieldValues ?? []) as FormFieldValue[]) {
          if (fv.fieldValue.startsWith('data:image/')) {
            signatureDataUrls[fv.fieldKey] = fv.fieldValue;
          } else {
            fieldValues[fv.fieldKey] = fv.fieldValue;
          }
        }

        const pdfBytes = await generateFormPdf({
          patientIdString: session.patientIdString,
          sessionCode: session.sessionCode,
          sessionForm,
          fieldValues,
          signatureDataUrls,
        });

        downloadPdf(pdfBytes, getPdfFilename(session.patientIdString, sessionForm.formTemplate.name));
      }

      const exportPath = `/secure/carelink/intake-forms/${session.sessionCode}/`;
      await sessionsApi.recordExport(sessionId!, exportPath);
      setExported(true);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
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
            <p className="text-sm text-gray-400 mt-2">All forms have been successfully exported</p>
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
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn-primary mt-8"
            >
              {isExporting ? 'Exporting...' : 'Export All Forms'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
