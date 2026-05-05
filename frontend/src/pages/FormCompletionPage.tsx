/**
 * pages/FormCompletionPage.tsx
 * Renders the actual PDF form in the browser with interactive field overlays.
 * Counselors type directly on the rendered PDF; signatures appear at the bottom.
 *
 * Owner: Dennise / Meya
 */

import PdfFormViewer from '@/components/forms/PdfFormViewer';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { sessionsApi } from '@/services/api';
import type { IntakeSession, SessionForm } from '@/types';

export default function FormCompletionPage() {
  const { sessionId, formId } = useParams<{ sessionId: string; formId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionForm | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    sessionsApi.get(sessionId).then((r) => {
      const sess: IntakeSession = r.data;
      setSession(sess);
      const sf = sess.sessionForms.find((f) => f.id === formId);
      setSessionForm(sf ?? null);
      // Restore any previously saved values
      const existing: Record<string, string> = {};
      sf?.fieldValues?.forEach((fv) => { existing[fv.fieldKey] = fv.fieldValue; });
      setFieldValues(existing);
    });
  }, [sessionId, formId]);

  const triggerAutoSave = useCallback(
    (values: Record<string, string>) => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        if (sessionId && formId) {
          sessionsApi.saveFields(sessionId, formId, values).catch(console.error);
        }
      }, 10_000); // auto-save after 10 s of inactivity
    },
    [sessionId, formId],
  );

  const handleFieldChange = useCallback(
    (key: string, value: string) => {
      setFieldValues((prev) => {
        const updated = { ...prev, [key]: value };
        triggerAutoSave(updated);
        return updated;
      });
    },
    [triggerAutoSave],
  );

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

  const slug = sessionForm.formTemplate.slug;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate(`/intake/${sessionId}/forms`)}
        className="flex items-center gap-2 text-primary text-sm font-medium hover:underline"
      >
        ← Back To Dashboard
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {sessionForm.formTemplate.name}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Patient ID: {session.patientIdString}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Session</p>
          <p className="text-sm font-semibold text-gray-700">{session.sessionCode}</p>
        </div>
      </div>

      {/* PDF viewer — fills fields directly on the rendered form */}
      <PdfFormViewer
        slug={slug}
        initialValues={fieldValues}
        onChange={handleFieldChange}
      />

      {/* Action bar */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 sticky bottom-0 bg-white pb-4">
        <button
          type="button"
          onClick={() => navigate(`/intake/${sessionId}/forms`)}
          className="btn-ghost"
        >
          Save & Exit
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="btn-primary"
        >
          {isSaving ? 'Saving…' : 'Mark Complete →'}
        </button>
      </div>
    </div>
  );
}
