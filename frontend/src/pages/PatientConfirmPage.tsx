/**
 * pages/PatientConfirmPage.tsx
 * Step 2 — Shows patient info pulled from the system and asks counselor to confirm.
 * Owner: Dennise / Meya
 *
 * Receives { patientIdString, isNew } from router location state (set by PatientVerificationPage).
 *
 * TODO:
 * - Display the "Unknown Patient / PT-#####" card matching the prototype
 * - Show DEMOGRAPHICS, CONTACT INFORMATION, EMERGENCY CONTACT/INSURANCE sections
 *   (all N/A in this system — remind counselor these live in MethaSoft)
 * - "Confirm & Continue →" calls sessionsApi.create() with selected form template IDs
 *   then navigates to /intake/:newSessionId
 *
 * NOTE: Per spec, we do NOT store demographics here. The N/A fields are intentional
 * and match the prototype exactly. The counselor verifies verbally with the patient.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { sessionsApi, formsApi } from '@/services/api';
import type { FormTemplate } from '@/types';
import { useEffect } from 'react';

export default function PatientConfirmPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { patientIdString } = (location.state as { patientIdString: string }) ?? {};
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!patientIdString) {
      navigate('/intake/new');
      return;
    }
    formsApi.list().then((r) => {
      setForms(r.data);
      // Default: nothing selected — counselor picks only what's needed this session
      setSelectedFormIds([]);
    });
  }, [patientIdString, navigate]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const { data: session } = await sessionsApi.create(patientIdString, selectedFormIds);
      navigate(`/intake/${session.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      alert(msg ?? 'Failed to start session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!patientIdString) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/intake/new')}
        className="flex items-center gap-2 text-primary text-sm font-medium hover:underline"
      >
        ← Back To Dashboard
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Verified</h1>
          <p className="text-sm text-gray-400 mt-0.5">Patient ID: {patientIdString}</p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <p className="text-xs text-gray-400">Session ID</p>
          <p className="text-sm font-semibold text-gray-400">—</p>
        </div>
      </div>

      {/* Patient card */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Unknown Patient</p>
            <p className="text-sm text-gray-500">Patient ID: {patientIdString}</p>
          </div>
        </div>
      </div>

      {/* HIPAA note */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-amber-800">
          Only select the forms that you wish to complete during this session. You must complete
          all forms selected in this session in order to download them.
        </p>
      </div>

      {/* Form selection */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 tracking-wider">
            SELECT FORMS FOR THIS INTAKE
          </p>
          <button
            type="button"
            onClick={() =>
              setSelectedFormIds(
                selectedFormIds.length === forms.length ? [] : forms.map((f) => f.id)
              )
            }
            className="text-xs font-medium text-primary hover:underline"
          >
            {selectedFormIds.length === forms.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="space-y-2">
          {forms.map((form) => (
            <label key={form.id} className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={selectedFormIds.includes(form.id)}
                onChange={(e) =>
                  setSelectedFormIds((prev) =>
                    e.target.checked
                      ? [...prev, form.id]
                      : prev.filter((id) => id !== form.id)
                  )
                }
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-gray-700 flex-1">{form.name}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {selectedFormIds.length} of {forms.length} forms selected
          </p>
          <button
            onClick={handleConfirm}
            disabled={isLoading || selectedFormIds.length === 0}
            className="btn-primary"
          >
            {isLoading ? 'Creating session...' : 'Confirm & Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
