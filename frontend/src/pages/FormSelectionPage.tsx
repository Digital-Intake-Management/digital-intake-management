/**
 * pages/FormSelectionPage.tsx
 * Shows all forms for the session with their status and Begin/Continue/Review buttons.
 * Owner: Dennise / Meya
 *
 * TODO: Fetch session by ID, display form list matching the prototype table.
 * Each row: Form Name | Fields count | Status badge | Action button
 * Action button label depends on status: Not Started → "Begin", In Progress → "Continue", Completed → "Review"
 * Footer shows total fields completed (e.g. "1/24 Complete")
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { sessionsApi } from '@/services/api';
import type { IntakeSession, SessionForm } from '@/types';
import clsx from 'clsx';

export default function FormSelectionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<IntakeSession | null>(null);

  useEffect(() => {
    if (sessionId) sessionsApi.get(sessionId).then((r) => setSession(r.data));
  }, [sessionId]);

  if (!session) {
    return <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  const totalFields = session.sessionForms.reduce(
    (sum, sf) => sum + (sf.formTemplate.fieldDefinitions as unknown[]).length, 0
  );
  const completedFields = session.sessionForms
    .filter((sf) => sf.status === 'COMPLETED')
    .reduce((sum, sf) => sum + (sf.formTemplate.fieldDefinitions as unknown[]).length, 0);

  const getActionLabel = (sf: SessionForm) => {
    if (sf.status === 'COMPLETED') return 'Review';
    if (sf.status === 'IN_PROGRESS') return 'Continue';
    return 'Begin';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate(`/intake/${sessionId}`)}
        className="flex items-center gap-2 text-primary text-sm font-medium hover:underline">
        ← Back To Workflow
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Selection</h1>
          <p className="text-sm text-gray-400 mt-0.5">Patient ID: {session.patientIdString}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Session ID</p>
          <p className="text-sm font-semibold text-gray-700">{session.sessionCode}</p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-4 text-xs font-semibold text-primary tracking-wide">Form Name</th>
              <th className="text-center px-6 py-4 text-xs font-semibold text-primary tracking-wide">Fields</th>
              <th className="text-center px-6 py-4 text-xs font-semibold text-primary tracking-wide">Status</th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody>
            {session.sessionForms.map((sf) => (
              <tr key={sf.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{sf.formTemplate.name}</td>
                <td className="px-6 py-4 text-center text-gray-500">
                  {(sf.formTemplate.fieldDefinitions as unknown[]).length}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={clsx(
                    sf.status === 'COMPLETED' && 'badge-completed',
                    sf.status === 'IN_PROGRESS' && 'badge-in-progress',
                    sf.status === 'NOT_STARTED' && 'badge-not-started',
                  )}>
                    {sf.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => navigate(`/intake/${sessionId}/forms/${sf.id}`)}
                    className="btn-outline text-sm py-1.5 px-4"
                  >
                    {getActionLabel(sf)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="px-6 py-3 text-xs font-semibold text-primary">Total</td>
              <td colSpan={3} className="px-6 py-3 text-right">
                <span className={clsx(
                  'text-xs font-semibold',
                  completedFields === totalFields ? 'text-green-600' : 'text-primary'
                )}>
                  {completedFields}/{totalFields} Complete
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
