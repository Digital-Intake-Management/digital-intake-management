/**
 * pages/IntakeCompletePage.tsx
 * Final screen — shows session summary after MethaSoft confirmation.
 * Owner: Dennise / Meya
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { sessionsApi } from '@/services/api';
import type { IntakeSession } from '@/types';
import { useAuth } from '@/hooks/useAuth';

export default function IntakeCompletePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<IntakeSession | null>(null);

  useEffect(() => {
    if (sessionId) sessionsApi.get(sessionId).then((r) => setSession(r.data));
  }, [sessionId]);

  if (!session) return null;

  const completedForms = session.sessionForms.filter((f) => f.status === 'COMPLETED').length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-primary text-sm font-medium hover:underline">
        ← Back To Dashboard
      </button>

      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-gray-900">Intake Complete!</h1>
        <p className="text-gray-500 mt-1">Patient intake has been successfully completed and documented</p>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Session Summary</h2>
        <div className="divide-y divide-gray-100">
          {[
            { label: 'Patient ID', value: session.patientIdString },
            { label: 'Session ID', value: session.sessionCode },
            { label: 'Counselor', value: user?.username ?? '—' },
            { label: 'Forms Completed', value: `${completedForms}/${session.sessionForms.length}` },
            { label: 'Status', value: null },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-3">
              <span className="text-sm text-gray-500">{row.label}</span>
              {row.value ? (
                <span className="text-sm font-semibold text-gray-900">{row.value}</span>
              ) : (
                <span className="badge-linked">✓ Linked in MethaSoft</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <button onClick={() => navigate('/dashboard')} className="btn-primary px-10">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
