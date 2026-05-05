/**
 * pages/AdminPatientsPage.tsx
 * Admin — view, add, and delete patient IDs.
 * Owner: Success / Anthony
 *
 * TODO: Fetch from GET /api/patients (admin), render table.
 * Add patient form: input for PT-##### → POST /api/patients
 * Delete button: DELETE /api/patients/:id (blocked if active sessions)
 */

import { useEffect, useState } from 'react';
import { patientsApi, adminApi } from '@/services/api';

interface SessionRow {
  id: string;
  sessionCode: string;
  patientIdString: string;
  status: string;
  createdAt: string;
  counselor: { username: string };
  _count: { sessionForms: number };
}

interface PatientRow {
  id: string;
  patientIdString: string;
  createdAt: string;
  isActive: boolean;
  createdBy: { username: string };
  _count: { intakeSessions: number };
}

const STATUS_BADGE: Record<string, string> = {
  NOT_STARTED: 'badge-not-started',
  IN_PROGRESS: 'badge-in-progress',
  COMPLETED: 'badge-completed',
  LINKED_IN_METHASOFT: 'badge-completed',
};

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [newId, setNewId] = useState('PT-');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    patientsApi.list().then((r) => setPatients(r.data));
    adminApi.getSessions().then((r) => setSessions(r.data));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAdding(true);
    try {
      await patientsApi.create(newId);
      setNewId('PT-');
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to add');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeletePatient = async (patientIdString: string) => {
    if (!window.confirm(`Delete patient ID ${patientIdString}? This cannot be undone.`)) return;
    try {
      await patientsApi.delete(patientIdString);
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Cannot delete — active sessions exist');
    }
  };

  const handleDeleteSession = async (session: SessionRow) => {
    if (!window.confirm(`Delete session ${session.sessionCode} for patient ${session.patientIdString}? All saved form data will be lost.`)) return;
    try {
      await adminApi.deleteSession(session.id);
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to delete session');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Patient ID Management</h1>

      {/* Add patient */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Add Patient ID</h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value.toUpperCase())}
            placeholder="PT-#####"
            pattern="PT-\d{5}"
            required
            className="input flex-1"
          />
          <button type="submit" disabled={isAdding} className="btn-primary whitespace-nowrap">
            {isAdding ? 'Adding...' : '+ Add Patient ID'}
          </button>
        </form>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      {/* Patient table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Patient ID</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Added By</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Created</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Sessions</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900">{p.patientIdString}</td>
                <td className="px-6 py-3 text-gray-500">{p.createdBy.username}</td>
                <td className="px-6 py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-3 text-center text-gray-500">{p._count.intakeSessions}</td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleDeletePatient(p.patientIdString)}
                    className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                  No patient IDs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Sessions panel ───────────────────────────────────────────────────── */}
      <h2 className="text-lg font-bold text-gray-900 pt-2">Intake Sessions</h2>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Session</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Patient ID</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Counselor</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Forms</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Created</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900">{s.sessionCode}</td>
                <td className="px-6 py-3 text-gray-700">{s.patientIdString}</td>
                <td className="px-6 py-3 text-gray-500">{s.counselor.username}</td>
                <td className="px-6 py-3 text-center text-gray-500">{s._count.sessionForms}</td>
                <td className="px-6 py-3 text-center">
                  <span className={STATUS_BADGE[s.status] ?? 'badge-not-started'}>
                    {s.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => handleDeleteSession(s)}
                    className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400">
                  No sessions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
