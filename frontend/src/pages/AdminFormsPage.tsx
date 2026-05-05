/**
 * pages/AdminFormsPage.tsx
 * Admin — view, create, edit, and deactivate form templates.
 * Owner: Success / Anthony
 */

import { useEffect, useState } from 'react';
import { formsApi, adminApi } from '@/services/api';
import type { FormTemplate, FieldDefinition, FieldType } from '@/types';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'signature', label: 'Signature' },
];

interface FormEditorState {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  fieldDefinitions: FieldDefinition[];
}

const blankField = (): FieldDefinition => ({
  key: `field_${Date.now()}`,
  label: '',
  type: 'text',
  required: false,
});

const toSlug = (name: string) =>
  name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export default function AdminFormsPage() {
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<FormEditorState>({
    name: '',
    slug: '',
    description: '',
    sortOrder: 99,
    fieldDefinitions: [blankField()],
  });

  const load = () => formsApi.list().then((r) => setForms(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingForm(null);
    setEditor({ name: '', slug: '', description: '', sortOrder: forms.length + 1, fieldDefinitions: [blankField()] });
    setModalOpen(true);
  };

  const openEdit = (form: FormTemplate) => {
    setEditingForm(form);
    setEditor({
      name: form.name,
      slug: form.slug,
      description: form.description ?? '',
      sortOrder: form.sortOrder,
      fieldDefinitions: (form.fieldDefinitions as FieldDefinition[]).length > 0
        ? (form.fieldDefinitions as FieldDefinition[])
        : [blankField()],
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditingForm(null); };

  const handleNameChange = (name: string) => {
    setEditor((e) => ({ ...e, name, slug: editingForm ? e.slug : toSlug(name) }));
  };

  const addField = () => {
    setEditor((e) => ({ ...e, fieldDefinitions: [...e.fieldDefinitions, blankField()] }));
  };

  const removeField = (idx: number) => {
    setEditor((e) => ({ ...e, fieldDefinitions: e.fieldDefinitions.filter((_, i) => i !== idx) }));
  };

  const updateField = (idx: number, patch: Partial<FieldDefinition>) => {
    setEditor((e) => ({
      ...e,
      fieldDefinitions: e.fieldDefinitions.map((f, i) =>
        i === idx ? { ...f, ...patch } : f
      ),
    }));
  };

  const handleSave = async () => {
    if (!editor.name.trim() || !editor.slug.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: editor.name.trim(),
        slug: editor.slug.trim(),
        description: editor.description.trim() || undefined,
        sortOrder: editor.sortOrder,
        fieldDefinitions: editor.fieldDefinitions.filter((f) => f.label.trim()),
      };

      if (editingForm) {
        await adminApi.updateForm(editingForm.id, payload);
      } else {
        await adminApi.createForm(payload);
      }

      closeModal();
      load();
    } catch {
      alert('Failed to save form template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (form: FormTemplate) => {
    await adminApi.updateForm(form.id, { isActive: !form.isActive });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Form Template Management</h1>
        <button className="btn-primary" onClick={openCreate}>+ New Form Template</button>
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
                    <button
                      onClick={() => openEdit(form)}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Edit
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

      {/* Form Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingForm ? 'Edit Form Template' : 'New Form Template'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Form Name *</label>
                <input
                  type="text"
                  value={editor.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Assessment Disclosure"
                  className="input w-full"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Slug *</label>
                <input
                  type="text"
                  value={editor.slug}
                  onChange={(e) => setEditor((ed) => ({ ...ed, slug: e.target.value }))}
                  placeholder="e.g. assessment-disclosure"
                  className="input w-full font-mono text-sm"
                />
              </div>

              {/* Description + Sort Order */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                  <input
                    type="text"
                    value={editor.description}
                    onChange={(e) => setEditor((ed) => ({ ...ed, description: e.target.value }))}
                    placeholder="Optional short description"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={editor.sortOrder}
                    onChange={(e) => setEditor((ed) => ({ ...ed, sortOrder: Number(e.target.value) }))}
                    className="input w-full"
                    min={1}
                  />
                </div>
              </div>

              {/* Field Definitions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-600">Field Definitions</label>
                  <button
                    onClick={addField}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    + Add Field
                  </button>
                </div>

                <div className="space-y-2">
                  {editor.fieldDefinitions.map((field, idx) => (
                    <div key={field.key} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      {/* Label */}
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(idx, { label: e.target.value })}
                        placeholder="Field label"
                        className="input flex-1 text-sm"
                      />

                      {/* Type */}
                      <select
                        value={field.type}
                        onChange={(e) => updateField(idx, { type: e.target.value as FieldType })}
                        className="input text-sm w-32"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>

                      {/* Required */}
                      <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(idx, { required: e.target.checked })}
                          className="rounded"
                        />
                        Req.
                      </label>

                      {/* Remove */}
                      <button
                        onClick={() => removeField(idx)}
                        disabled={editor.fieldDefinitions.length === 1}
                        className="text-gray-300 hover:text-red-400 disabled:opacity-30 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editor.name.trim() || !editor.slug.trim()}
                className="btn-primary"
              >
                {saving ? 'Saving...' : editingForm ? 'Save Changes' : 'Create Form'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
