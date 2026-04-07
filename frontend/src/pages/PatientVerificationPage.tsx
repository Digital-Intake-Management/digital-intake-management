/**
 * pages/PatientVerificationPage.tsx
 * Step 1 of intake — counselor enters a Patient ID to verify or create.
 * Owner: Dennise / Meya
 *
 * TODO: Implement the form matching the prototype's "Patient ID Verification" screen.
 * On submit, call patientsApi.verify(patientIdString).
 * - If found → navigate to /intake/new/confirm with patientId in state
 * - If 404 → offer to create the ID, then navigate to confirm
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientsApi } from '@/services/api';

export default function PatientVerificationPage() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState('PT-');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotFound(false);
    setIsLoading(true);

    try {
      await patientsApi.verify(patientId);
      // Patient found — go to confirm screen
      navigate('/intake/new/confirm', { state: { patientIdString: patientId, isNew: false } });
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } }).response?.status;
      if (status === 404) {
        setNotFound(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      await patientsApi.create(patientId);
      navigate('/intake/new/confirm', { state: { patientIdString: patientId, isNew: true } });
    } catch {
      setError('Failed to create patient ID. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Patient ID Verification</h1>

      {/* Before you begin banner */}
      <div className="bg-primary rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-2">Before you begin</h2>
            <p className="text-white/80 text-sm mb-1">Please note that:</p>
            <ul className="list-disc list-inside text-sm text-white/90 space-y-1">
              <li>The Patient ID must exist in MethaSoft</li>
              <li>Patient ID must be created before starting intake</li>
              <li>Only one active intake session allowed per patient</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Input card */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">MethaSoft Patient ID</h2>
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <input
              type="text"
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value.toUpperCase());
                setNotFound(false);
                setError('');
              }}
              placeholder="PT-#####"
              className="input"
              pattern="PT-\d{5}"
              required
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Format: PT- followed by 5 digits (e.g., PT-12345)
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Not found — offer to create */}
          {notFound && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm text-yellow-800 font-medium">
                Patient ID <strong>{patientId}</strong> was not found in the system.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Make sure this ID exists in MethaSoft first, then add it here.
              </p>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isLoading}
                className="mt-3 btn-primary text-sm py-2"
              >
                Add {patientId} to system
              </button>
            </div>
          )}

          {!notFound && (
            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? 'Verifying...' : 'Verify and Start Intake'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
