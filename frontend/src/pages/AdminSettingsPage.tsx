/**
 * pages/AdminSettingsPage.tsx
 * Admin — configure SharePoint path and report email.
 * Owner: Success / Anthony
 */

import { useEffect, useState } from 'react';
import { adminApi } from '@/services/api';

export default function AdminSettingsPage() {
  const [sharepointPath, setSharepointPath] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getConfig().then((r) => {
      const configs: { configKey: string; configValue: string }[] = r.data;
      setSharepointPath(configs.find((c) => c.configKey === 'sharepoint_folder_path')?.configValue ?? '');
      setReportEmail(configs.find((c) => c.configKey === 'weekly_report_email')?.configValue ?? '');
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await Promise.all([
        adminApi.updateConfig('sharepoint_folder_path', sharepointPath),
        adminApi.updateConfig('weekly_report_email', reportEmail),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>

      <form onSubmit={handleSave} className="card space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            SharePoint Document Folder Path
          </label>
          <input
            type="text"
            value={sharepointPath}
            onChange={(e) => setSharepointPath(e.target.value)}
            placeholder="/secure/carelink/intake-forms/"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            The network or cloud path where exported PDFs will be saved
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Weekly Report Recipient Email
          </label>
          <input
            type="email"
            value={reportEmail}
            onChange={(e) => setReportEmail(e.target.value)}
            placeholder="admin@carelink-georgia.org"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            Weekly reports will be emailed here every Monday at 8:00 AM
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {saved && <p className="text-sm text-green-600 font-medium">✓ Settings saved</p>}
          <div className="ml-auto">
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
