/**
 * pages/AdminFormsPage.tsx
 * Admin — view, activate/deactivate, and upload replacement PDFs for form templates.
 * Owner: Success / Anthony
 */

import { useEffect, useRef, useState } from 'react';
import { formsApi, adminApi } from '@/services/api';
import type { FormTemplate } from '@/types';

export default function AdminFormsPage() {
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFormId = useRef<string | null>(null);

  const load = () => formsApi.list().then((r) => setForms(r.data));
  useEffect(() => { load(); }, []);

  const handleToggleActive = async (form: FormTemplate) => {
    await adminApi.updateForm(form.id, { isActive: !form.isActive });
    load();
  };

  const openFilePicker = (formId: string) => {
    pendingFormId.current = formId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = pendingFormId.current;
    if (!file || !id) return;

    // Reset input so the same file can be re-selected later
    e.target.value = '';

    if (file.type !== 'application/pdf') {
      setUploadMessage({ id, text: 'Only PDF files are accepted.', ok: false });
      return;
    }

    setUploadingId(id);
    setUploadMessage(null);
    try {
      await adminApi.uploadFormPdf(id, file);
      setUploadMessage({ id, text: 'PDF updated — new sessions will use this version.', ok: true });
      load();
    } catch {
      setUploadMessage({ id, text: 'Upload failed. Please try again.', ok: false });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden file input shared across all rows */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Form Template Management</h1>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Form Name</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Order</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">PDF</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr key={form.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-3">
                  <p className="font-medium text-gray-900">{form.name}</p>
                  {form.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{form.description}</p>
                  )}
                  {uploadMessage?.id === form.id && (
                    <p className={`text-xs mt-1 font-medium ${uploadMessage.ok ? 'text-green-600' : 'text-red-500'}`}>
                      {uploadMessage.text}
                    </p>
                  )}
                </td>
                <td className="px-6 py-3 text-center text-gray-500">{form.sortOrder}</td>
                <td className="px-6 py-3 text-center">
                  {form.pdfPath ? (
                    <span className="text-xs text-green-600 font-medium">✓ Linked</span>
                  ) : (
                    <span className="text-xs text-amber-500 font-medium">No PDF</span>
                  )}
                </td>
                <td className="px-6 py-3 text-center">
                  <span className={form.isActive ? 'badge-completed' : 'badge-not-started'}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => openFilePicker(form.id)}
                      disabled={uploadingId === form.id}
                      className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
                    >
                      {uploadingId === form.id ? 'Uploading…' : 'Replace PDF'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(form)}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                    >
                      {form.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        "Replace PDF" uploads a new template. In-progress counselor sessions are not affected — they will export using the version that was active when they started.
      </p>
    </div>
  );
}
