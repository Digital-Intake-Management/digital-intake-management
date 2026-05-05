import { useEffect, useState } from 'react';
import { adminUsersApi, type AdminUser } from '@/services/api';

type Role = 'COUNSELOR' | 'ADMIN';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add-user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('COUNSELOR');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Temp password reveal: maps userId → tempPassword
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [resettingId, setResettingId] = useState<string | null>(null);

  // Per-row action loading
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = () =>
    adminUsersApi.list().then((r) => {
      setUsers(r.data);
      setIsLoading(false);
    });

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setIsAdding(true);
    try {
      await adminUsersApi.create({ username: newUsername, password: newPassword, role: newRole });
      setNewUsername('');
      setNewPassword('');
      setNewRole('COUNSELOR');
      load();
    } catch (err: unknown) {
      setAddError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to create user'
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    setUpdatingId(user.id);
    try {
      await adminUsersApi.update(user.id, { isActive: !user.isActive });
      load();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleChangeRole = async (user: AdminUser, role: Role) => {
    setUpdatingId(user.id);
    try {
      await adminUsersApi.update(user.id, { role });
      load();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    if (
      !window.confirm(
        `Reset password for ${user.username}? A new temporary password will be generated. The current password will stop working immediately.`
      )
    )
      return;
    setResettingId(user.id);
    try {
      const r = await adminUsersApi.resetPassword(user.id);
      setTempPasswords((prev) => ({ ...prev, [user.id]: r.data.tempPassword }));
    } finally {
      setResettingId(null);
    }
  };

  const dismissTempPassword = (userId: string) =>
    setTempPasswords((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">User Management</h1>

      {/* Add user */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Add Account</h2>
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Username"
            required
            minLength={2}
            pattern="^[a-zA-Z0-9_]+$"
            title="Letters, numbers, and underscores only"
            className="input flex-1 min-w-36"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Initial password"
            required
            minLength={6}
            className="input flex-1 min-w-36"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            className="input w-36"
          >
            <option value="COUNSELOR">Counselor</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button type="submit" disabled={isAdding} className="btn-primary whitespace-nowrap">
            {isAdding ? 'Adding...' : '+ Add Account'}
          </button>
        </form>
        {addError && <p className="text-sm text-red-500 mt-2">{addError}</p>}
      </div>

      {/* Users table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Username</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Sessions</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Created</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isBusy = updatingId === u.id || resettingId === u.id;
              const temp = tempPasswords[u.id];

              return (
                <>
                  <tr
                    key={u.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${!u.isActive ? 'opacity-50' : ''}`}
                  >
                    <td className="px-6 py-3 font-semibold text-gray-900">{u.username}</td>

                    {/* Role — inline selector */}
                    <td className="px-6 py-3">
                      <select
                        value={u.role}
                        disabled={isBusy}
                        onChange={(e) => handleChangeRole(u, e.target.value as Role)}
                        className={`text-xs font-medium rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        <option value="COUNSELOR">Counselor</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          u.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Session count — only meaningful for counselors */}
                    <td className="px-6 py-3 text-center text-gray-500">
                      {u.role === 'COUNSELOR' ? u._count.intakeSessions : '—'}
                    </td>

                    <td className="px-6 py-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <button
                          onClick={() => handleResetPassword(u)}
                          disabled={isBusy}
                          className="text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors disabled:opacity-40"
                        >
                          {resettingId === u.id ? 'Resetting…' : 'Reset Password'}
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={isBusy}
                          className={`text-xs font-medium transition-colors disabled:opacity-40 ${
                            u.isActive
                              ? 'text-red-400 hover:text-red-600'
                              : 'text-green-500 hover:text-green-700'
                          }`}
                        >
                          {updatingId === u.id ? '…' : u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Temp password reveal row */}
                  {temp && (
                    <tr key={`${u.id}-temp`} className="bg-amber-50 border-b border-amber-100">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs text-amber-700 font-medium">
                            Temporary password for {u.username}:
                          </span>
                          <code className="text-sm font-mono bg-white border border-amber-200 rounded px-3 py-1 text-gray-900 tracking-widest select-all">
                            {temp}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(temp)}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                          >
                            Copy
                          </button>
                          <span className="text-xs text-amber-600">
                            Share this with {u.username} — it won't be shown again.
                          </span>
                          <button
                            onClick={() => dismissTempPassword(u.id)}
                            className="ml-auto text-xs text-amber-500 hover:text-amber-700"
                          >
                            Dismiss ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}

            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
