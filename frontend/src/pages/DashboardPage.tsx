/**
 * pages/DashboardPage.tsx
 * Counselor Intake Dashboard — shows session list with progress.
 * Owner: Dennise / Meya
 *
 * TODO: Fetch sessions from GET /api/sessions and render the session cards
 * matching the prototype (Total Sessions, Active Sessions, Completed stats,
 * + Intake Sessions list with progress bars and Resume/View Details buttons).
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sessionsApi } from '@/services/api';
import type { IntakeSession } from '@/types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').toLowerCase();

  useEffect(() => {
    sessionsApi.list().then((r) => {
      setSessions(r.data);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const filtered = q
    ? sessions.filter(
        (s) =>
          s.patientIdString.toLowerCase().includes(q) ||
          s.sessionCode.toLowerCase().includes(q),
      )
    : sessions;

  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === 'IN_PROGRESS').length;
  const completedSessions = sessions.filter((s) => s.status === 'LINKED_IN_METHASOFT').length;

  const getProgressPercent = (session: IntakeSession) => {
    if (!session.sessionForms?.length) return 0;
    const completed = session.sessionForms.filter((f) => f.status === 'COMPLETED').length;
    return Math.round((completed / session.sessionForms.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Intake Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Manage patient intake sessions</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sessions', value: totalSessions, color: 'text-gray-900' },
          { label: 'Active Sessions', value: activeSessions, color: 'text-yellow-600' },
          { label: 'Completed', value: completedSessions, color: 'text-green-600' },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Start new intake */}
      <button
        onClick={() => navigate('/intake/new')}
        className="btn-primary flex items-center gap-2"
      >
        <span className="text-lg leading-none">+</span>
        Start New Intake
      </button>

      {/* Session list */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Intake Sessions</h2>
          {q && (
            <p className="text-xs text-gray-400">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{q}"
            </p>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            No intake sessions yet. Start one above.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            No sessions match "{q}".
          </p>
        ) : (
          filtered.map((session) => {
            const progress = getProgressPercent(session);
            const isActive = session.status === 'IN_PROGRESS';
            const isComplete = session.status === 'LINKED_IN_METHASOFT';

            return (
              <div key={session.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">
                        Patient ID: {session.patientIdString}
                      </span>
                      {isComplete && <span className="badge-completed">✓ Completed</span>}
                      {isActive && <span className="badge-in-progress">⏳ In Progress</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Created: {new Date(session.createdAt).toLocaleDateString()} &nbsp;|&nbsp;
                      Forms: {session.sessionForms?.filter((f) => f.status === 'COMPLETED').length ?? 0} / {session.sessionForms?.length ?? 0}
                    </p>
                  </div>

                  {isActive ? (
                    <button
                      onClick={() => navigate(`/intake/${session.id}`)}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/intake/${session.id}/complete`)}
                      className="btn-ghost text-sm"
                    >
                      View Details
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
