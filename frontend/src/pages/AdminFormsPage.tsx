/**
 * pages/AdminFormsPage.tsx
 * Admin — view, add, edit, and deactivate form templates.
 * Owner: Success / Anthony
 *
 * TODO: Full form template editor UI — name, field definitions (add/remove fields),
 * sort order, active/inactive toggle. Calls adminApi.createForm / updateForm / deleteForm.
 */

import { useEffect, useState } from 'react';
import { formsApi, adminApi } from '@/services/api';
import type { FormTemplate } from '@/types';

export default function AdminFormsPage() {
  const [forms, setForms] = useState<FormTemplate[]>([]);

  const load = () => formsApi.list().then((r) => setForms(r.data));
  useEffect(() => { load(); }, []);

  const handleToggleActive = async (form: FormTemplate) => {
    await adminApi.updateForm(form.id, { isActive: !form.isActive });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Form Template Management</h1>
        {/* TODO: Open modal/drawer to create new form */}
        <button className="btn-primary">+ New Form Template</button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Form Name</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Fields</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500">Order</th>
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
                </td>
                <td className="px-6 py-3 text-center text-gray-500">
                  {(form.fieldDefinitions as unknown[]).length}
                </td>
                <td className="px-6 py-3 text-center text-gray-500">{form.sortOrder}</td>
                <td className="px-6 py-3 text-center">
                  <span className={form.isActive ? 'badge-completed' : 'badge-not-started'}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {/* TODO: edit button — opens form editor */}
                    <button className="text-xs text-primary font-medium hover:underline">Edit</button>
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
    </div>
  );
}
