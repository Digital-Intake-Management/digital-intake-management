/**
 * pages/AdminDashboardPage.tsx
 * Admin view — weekly activity chart + export report button.
 * Owner: Success / Anthony
 *
 * TODO: Fetch from GET /api/admin/stats and render the bar chart using recharts
 * matching the prototype (Forms Started vs Forms Completed by day of week).
 * Add "Export Weekly Status Report - CSV" button that calls reportsApi.downloadCsv().
 */

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { adminApi, reportsApi } from '@/services/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    recentSessions: { createdAt: string; status: string }[];
  } | null>(null);

  useEffect(() => {
    adminApi.getStats().then((r) => setStats(r.data));
  }, []);

  // Build chart data from recent sessions
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartData = days.map((day) => ({
    day,
    Started: Math.floor(Math.random() * 400) + 100, // TODO: replace with real data
    Completed: Math.floor(Math.random() * 300) + 50,
  }));

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
