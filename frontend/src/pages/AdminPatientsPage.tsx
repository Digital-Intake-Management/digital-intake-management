/**
 * pages/AdminPatientsPage.tsx
 * Admin — view, add, and delete patient IDs.
 * Owner: Success / Anthony
 *
 * TODO: Fetch from GET /api/patients (admin), render table.
 * Add patient form: input for PT-##### → POST /api/patients
 * Delete button: DELETE /api/patients/:id (blocked if active sessions)
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { patientsApi, adminApi } from '@/services/api';

interface ImportResult {
  added: string[];
  duplicates: string[];
  errors: { raw: string; reason: string }[];
}

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
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').toLowerCase();
  const filteredPatients = q
    ? patients.filter((p) => p.patientIdString.toLowerCase().includes(q))
    : patients;
  const filteredSessions = q
    ? sessions.filter(
        (s) => s.patientIdString.toLowerCase().includes(q) || s.sessionCode.toLowerCase().includes(q)
      )
    : sessions;

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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const r = await adminApi.importPatients(file);
      setImportResult(r.data);
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Import failed');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900">Add Patient ID</h2>

        {/* Single add */}
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

        {/* Bulk import */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Bulk Import from Excel / CSV</p>
              <p className="text-xs text-gray-400 mt-0.5">
                First column should contain patient IDs. Both <code className="bg-gray-100 px-1 rounded">PT-12345</code> and <code className="bg-gray-100 px-1 rounded">12345</code> formats are accepted.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImport}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="btn-ghost text-sm whitespace-nowrap"
              >
                {isImporting ? 'Importing…' : 'Upload File'}
              </button>
            </div>
          </div>

          {/* Import results */}
          {importResult && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex gap-4 flex-wrap">
                <span className="text-green-600 font-medium">✓ {importResult.added.length} added</span>
                {importResult.duplicates.length > 0 && (
                  <span className="text-gray-400">{importResult.duplicates.length} already existed (skipped)</span>
                )}
                {importResult.errors.length > 0 && (
                  <span className="text-red-500 font-medium">⚠ {importResult.errors.length} could not be added</span>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-red-600 mb-2">Entries that failed:</p>
                  {importResult.errors.map((e, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <code className="text-red-700 font-mono">{e.raw || '(empty)'}</code>
                      <span className="text-red-400">— {e.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {importResult.duplicates.length > 0 && (
                <details className="text-xs text-gray-400">
                  <summary className="cursor-pointer hover:text-gray-600">Show skipped duplicates</summary>
                  <div className="mt-1 flex flex-wrap gap-1 pt-1">
                    {importResult.duplicates.map((d) => (
                      <code key={d} className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{d}</code>
                    ))}
                  </div>
                </details>
              )}

              <button
                onClick={() => setImportResult(null)}
                className="text-xs text-gray-300 hover:text-gray-500"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* Patient table */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient IDs</span>
          {q && (
            <span className="text-xs text-gray-400">
              {filteredPatients.length} result{filteredPatients.length !== 1 ? 's' : ''} for "{q}"
            </span>
          )}
        </div>
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
            {filteredPatients.map((p) => (
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
            {patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                  No patient IDs yet.
                </td>
              </tr>
            ) : filteredPatients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                  No patient IDs match "{q}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Sessions panel ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-lg font-bold text-gray-900">Intake Sessions</h2>
        {q && (
          <span className="text-xs text-gray-400">
            {filteredSessions.length} result{filteredSessions.length !== 1 ? 's' : ''} for "{q}"
          </span>
        )}
      </div>

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
            {filteredSessions.map((s) => (
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
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400">
                  No sessions yet.
                </td>
              </tr>
            ) : filteredSessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-400">
                  No sessions match "{q}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
