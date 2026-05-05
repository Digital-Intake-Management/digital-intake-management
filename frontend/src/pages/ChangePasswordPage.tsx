/**
 * pages/ChangePasswordPage.tsx
 * Shown automatically after login when mustChangePassword is true.
 * Also reachable voluntarily for any logged-in user.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'At least one uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least one number', test: (p: string) => /[0-9]/.test(p) },
];

export default function ChangePasswordPage() {
  const { user, updateSession, logout } = useAuth();
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isForced = user?.mustChangePassword ?? false;
  const rulesPass = RULES.every((r) => r.test(next));
  const matches = next === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulesPass) return;
    if (!matches) { setError('Passwords do not match'); return; }

    setError('');
    setIsLoading(true);
    try {
      const res = await authApi.changePassword(current, next);
      updateSession(res.data.token, res.data.user as any);
      navigate(user?.role === 'ADMIN' ? '/admin' : '/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'Failed to change password'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="card w-full max-w-md shadow-card-lg space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isForced ? 'Set Your Password' : 'Change Password'}
          </h1>
          {isForced && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3 mt-3">
              Your account was set up with a temporary password. Please create a new password before continuing.
            </p>
          )}
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 mt-2">
            Don't know your current password? You cannot reset it yourself — contact your admin and ask them to reset it for you from the Users page.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {isForced ? 'Temporary password' : 'Current password'}
            </label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              autoComplete="new-password"
              className="input w-full"
            />
            {/* Live rule checklist */}
            {next.length > 0 && (
              <ul className="mt-2 space-y-1">
                {RULES.map((r) => (
                  <li key={r.label} className="flex items-center gap-2 text-xs">
                    <span className={r.test(next) ? 'text-green-500' : 'text-gray-300'}>
                      {r.test(next) ? '✓' : '○'}
                    </span>
                    <span className={r.test(next) ? 'text-green-600' : 'text-gray-400'}>
                      {r.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="input w-full"
            />
            {confirm.length > 0 && !matches && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !rulesPass || !matches || !current}
            className="btn-primary w-full"
          >
            {isLoading ? 'Saving…' : 'Set New Password'}
          </button>
        </form>

        {/* Only show cancel/logout if not forced */}
        {!isForced ? (
          <button
            onClick={() => navigate(-1)}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={() => logout()}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
          >
            Sign out instead
          </button>
        )}
      </div>
    </div>
  );
}
