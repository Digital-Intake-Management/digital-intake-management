/**
 * pages/AdminDashboardPage.tsx
 * Admin view — weekly activity chart + export report button.
 * Owner: Success / Anthony
 */

import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { adminApi, reportsApi } from '@/services/api';
import type { AdminStats } from '@/types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    adminApi.getStats().then((r) => setStats(r.data));
  }, []);

  // Group recentSessions by day-of-week into chart data
  const chartData = useMemo(() => {
    return DAY_LABELS.map((day, dayIndex) => {
      const daySessions = (stats?.recentSessions ?? []).filter(
        (s) => new Date(s.createdAt).getDay() === dayIndex
      );
      return {
        day,
        Started: daySessions.length,
        Completed: daySessions.filter((s) => s.status === 'LINKED_IN_METHASOFT').length,
      };
    });
  }, [stats]);

  const handleExportCsv = async () => {
    const response = await reportsApi.downloadCsv();
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `carelink-weekly-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-primary">{stats.totalSessions}</p>
            <p className="text-sm text-gray-500 mt-1">Total Sessions</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-yellow-500">{stats.activeSessions}</p>
            <p className="text-sm text-gray-500 mt-1">Active</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-teal-500">{stats.completedSessions}</p>
            <p className="text-sm text-gray-500 mt-1">Completed</p>
          </div>
        </div>
      )}

      {/* Export card */}
      <div className="card">
        <button onClick={handleExportCsv} className="btn-primary mb-4">
          Export Weekly Status Report - CSV
        </button>
        <p className="text-sm font-semibold text-gray-700 mb-2">Weekly Status Report includes</p>
        <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
          <li>Types of missing forms</li>
          <li>Patients with incomplete form work</li>
          <li>Average form completion time</li>
        </ul>
      </div>

      {/* Weekly activity chart */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-6">Weekly Activity</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barGap={4}>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Started" fill="#3b4fe4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Completed" fill="#06d6a0" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
