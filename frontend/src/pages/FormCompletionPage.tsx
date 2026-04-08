/**
 * pages/FormCompletionPage.tsx
 * Renders a single form with all its fields + embedded signature pads.
 * On submit: saves fields, flattens signatures onto PDF, exports.
 *
 * Owner: Dennise / Meya (form UI) + Anthony (PDF + signature flatten logic)
 */

import { SignaturePad } from '@/components/forms/SignaturePad';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { sessionsApi } from '@/services/api';
import type { IntakeSession, SessionForm, FieldDefinition } from '@/types';

export default function FormCompletionPage() {
  const { sessionId, formId } = useParams<{ sessionId: string; formId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionForm | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { register, handleSubmit: rhfHandleSubmit, formState: { errors } } = useForm();
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    sessionsApi.get(sessionId).then((r) => {
      const sess: IntakeSession = r.data;
      setSession(sess);
      const sf = sess.sessionForms.find((f) => f.id === formId);
      setSessionForm(sf ?? null);
      const existing: Record<string, string> = {};
      sf?.fieldValues?.forEach((fv) => { existing[fv.fieldKey] = fv.fieldValue; });
      setFieldValues(existing);
    });
  }, [sessionId, formId]);

  const triggerAutoSave = (values: Record<string, string>) => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (sessionId && formId) {
        sessionsApi.saveFields(sessionId, formId, values).catch(console.error);
      }
    }, 30_000);
  };

  const handleFieldChange = (key: string, value: string) => {
    const updated = { ...fieldValues, [key]: value };
    setFieldValues(updated);
    triggerAutoSave(updated);
  };

  const handleSubmit = async () => {
    if (!sessionId || !formId) return;
    setIsSaving(true);
    try {
      await sessionsApi.saveFields(sessionId, formId, fieldValues);
      await sessionsApi.completeForm(sessionId, formId);
      navigate(`/intake/${sessionId}/forms`);
    } catch {
      alert('Failed to save form. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!session || !sessionForm) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fields = sessionForm.formTemplate.fieldDefinitions as FieldDefinition[];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(`/intake/${sessionId}/forms`)}
        className="flex items-center gap-2 text-primary text-sm font-medium hover:underline">
        ← Back To Dashboard
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Completion</h1>
          <p className="text-sm text-gray-400 mt-0.5">Patient ID: {session.patientIdString}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Session ID</p>
          <p className="text-sm font-semibold text-gray-700">{session.sessionCode}</p>
        </div>
      </div>

      <form onSubmit={rhfHandleSubmit(handleSubmit)} className="card space-y-6">
        <h2 className="font-semibold text-gray-900 text-lg border-b border-gray-100 pb-4">
          {sessionForm.formTemplate.name}
        </h2>

        {fields.map((field) => {
          // Signature fields — two pads side by side
          if (field.type === 'signature') {
            return (
              <div key={field.key} className="grid grid-cols-2 gap-6">
                <SignaturePad
                  label="Patient Signature"
                  required={field.required}
                  defaultValue={fieldValues[`${field.key}_patient`]}
                  onCapture={(dataUrl) => handleFieldChange(`${field.key}_patient`, dataUrl)}
                />
                <SignaturePad
                  label="Counselor Signature"
                  required={field.required}
                  defaultValue={fieldValues[`${field.key}_counselor`]}
                  onCapture={(dataUrl) => handleFieldChange(`${field.key}_counselor`, dataUrl)}
                />
              </div>
            );
          }

          // Checkbox fields
          if (field.type === 'checkbox') {
            return (
              <label key={field.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldValues[field.key] === 'true'}
                  onChange={(e) => handleFieldChange(field.key, e.target.checked ? 'true' : 'false')}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </span>
              </label>
            );
          }

          // Text and date fields with react-hook-form validation
          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              <input
                type={field.type === 'date' ? 'date' : 'text'}
                {...register(field.key, { required: field.required ? `${field.label} is required` : false })}
                value={fieldValues[field.key] ?? ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="input"
              />
              {errors[field.key] && (
                <p className="text-xs text-red-500 mt-1">{errors[field.key]?.message as string}</p>
              )}
            </div>
          );
        })}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate(`/intake/${sessionId}/forms`)}
            className="btn-ghost"
          >
            Save & Exit
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </form>
    </div>
  );
}