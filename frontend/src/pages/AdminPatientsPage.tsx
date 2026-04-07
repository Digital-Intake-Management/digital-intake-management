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
import { patientsApi } from '@/services/api';

interface PatientRow {
  id: string;
  patientIdString: string;
  createdAt: string;
  isActive: boolean;
  createdBy: { username: string };
  _count: { intakeSessions: number };
}

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [newId, setNewId] = useState('PT-');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const load = () => patientsApi.list().then((r) => setPatients(r.data));

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

  const handleDelete = async (patientIdString: string) => {
    if (!window.confirm(`Delete patient ID ${patientIdString}? This cannot be undone.`)) return;
    try {
      await patientsApi.delete(patientIdString);
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Cannot delete — active sessions exist');
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
                    onClick={() => handleDelete(p.patientIdString)}
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
    </div>
  );
}
