/**
 * pages/IntakeWorkflowPage.tsx
 * The main step-tracker screen showing progress through the 5 workflow stages.
 * Owner: Dennise / Meya
 *
 * Matches prototype: progress bar + step list (Patient Verified, Form Selection,
 * Form Completion, Signatures [removed — now embedded in forms], Export PDF,
 * MethaSoft Link, Complete)
 *
 * Each step shows: green check (done), active highlight + Start button (current),
 * or grey check (not yet reached).
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { sessionsApi, formsApi } from '@/services/api';
import type { IntakeSession, FormTemplate } from '@/types';
import clsx from 'clsx';

type StepStatus = 'complete' | 'active' | 'pending';

interface WorkflowStep {
  id: string;
  label: string;
  status: StepStatus;
  route?: string;
}

function deriveSteps(session: IntakeSession): WorkflowStep[] {
  const formsComplete =
    session.sessionForms?.length > 0 &&
    session.sessionForms.every((f) => f.status === 'COMPLETED');

  const exported = !!session.pdfExportPath;
  const linked = session.status === 'LINKED_IN_METHASOFT';

  const steps: WorkflowStep[] = [
    { id: 'verify', label: 'Patient Verified', status: 'complete' },
    {
      id: 'forms-select',
      label: 'Form Selection',
      status: 'complete',
      route: `/intake/${session.id}/forms`,
    },
    {
      id: 'forms-complete',
      label: 'Form Completion',
      status: formsComplete ? 'complete' : 'active',
      route: `/intake/${session.id}/forms`,
    },
    {
      id: 'export',
      label: 'Export PDF',
      status: formsComplete ? (exported ? 'complete' : 'active') : 'pending',
      route: `/intake/${session.id}/export`,
    },
    {
      id: 'methasoft',
      label: 'MethaSoft Link',
      status: exported ? (linked ? 'complete' : 'active') : 'pending',
      route: `/intake/${session.id}/methasoft`,
    },
    {
      id: 'complete',
      label: 'Complete',
      status: linked ? 'active' : 'pending',
      route: `/intake/${session.id}/complete`,
    },
  ];

  return steps;
}

function progressPercent(steps: WorkflowStep[]): number {
  const done = steps.filter((s) => s.status === 'complete').length;
  return Math.round((done / steps.length) * 100);
}

export default function IntakeWorkflowPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForms, setShowAddForms] = useState(false);
  const [availableForms, setAvailableForms] = useState<FormTemplate[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [isAddingForms, setIsAddingForms] = useState(false);

  const loadSession = () => {
    if (!sessionId) return;
    sessionsApi.get(sessionId).then((r) => {
      setSession(r.data);
      setIsLoading(false);
    });
  };

  useEffect(() => { loadSession(); }, [sessionId]);

  const openAddForms = async () => {
    const [allForms] = await Promise.all([formsApi.list()]);
    const existingIds = new Set(session?.sessionForms?.map((sf) => sf.formTemplateId) ?? []);
    setAvailableForms(allForms.data.filter((f: FormTemplate) => !existingIds.has(f.id)));
    setSelectedToAdd(new Set());
    setShowAddForms(true);
  };

  const handleAddForms = async () => {
    if (!sessionId || selectedToAdd.size === 0) return;
    setIsAddingForms(true);
    try {
      await sessionsApi.addForms(sessionId, [...selectedToAdd]);
      setShowAddForms(false);
      loadSession();
    } finally {
      setIsAddingForms(false);
    }
  };

  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const steps = deriveSteps(session);
  const progress = progressPercent(steps);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-primary text-sm font-medium hover:underline"
      >
        ← Back To Dashboard
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intake Workflow</h1>
          <p className="text-sm text-gray-400 mt-0.5">Patient ID: {session.patientIdString}</p>
        </div>
        <div className="text-right space-y-2">
          <div>
            <p className="text-xs text-gray-400">Session ID</p>
            <p className="text-sm font-semibold text-gray-700">{session.sessionCode}</p>
          </div>
          {session.status === 'IN_PROGRESS' && (
            <button onClick={openAddForms} className="btn-ghost text-xs">
              + Add Forms
            </button>
          )}
        </div>
      </div>

      {/* Step tracker card */}
      <div className="bg-gray-100 rounded-2xl p-6">
        <div className="card">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Overall Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={clsx(
                  'flex items-center justify-between p-4 rounded-xl transition-colors',
                  step.status === 'active' && 'bg-primary-50 border border-primary-200'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  {step.status === 'complete' ? (
                    <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                      step.status === 'active' ? 'bg-primary' : 'bg-gray-300'
                    )}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <span className={clsx(
                    'font-medium text-sm',
                    step.status === 'pending' ? 'text-gray-400' : 'text-gray-900'
                  )}>
                    {step.label}
                  </span>
                </div>

                {/* Start button for active step */}
                {step.status === 'active' && step.route && (
                  <button
                    onClick={() => navigate(step.route!)}
                    className="btn-primary text-sm py-2 px-5"
                  >
                    Start
                  </button>
                )}

                {/* View summary for complete step */}
                {step.id === 'complete' && step.status === 'active' && (
                  <button
                    onClick={() => navigate(step.route!)}
                    className="btn-primary text-sm py-2 px-5"
                  >
                    View Summary
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Forms modal */}
      {showAddForms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Add Forms to Session</h2>
              <button onClick={() => setShowAddForms(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {availableForms.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">All available forms are already in this session.</p>
              ) : (
                availableForms.map((f) => {
                  const checked = selectedToAdd.has(f.id);
                  return (
                    <label key={f.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedToAdd((prev) => {
                            const next = new Set(prev);
                            checked ? next.delete(f.id) : next.add(f.id);
                            return next;
                          });
                        }}
                        className="mt-0.5 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{f.name}</p>
                        {f.description && <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAddForms(false)} className="btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleAddForms}
                disabled={selectedToAdd.size === 0 || isAddingForms}
                className="btn-primary text-sm"
              >
                {isAddingForms ? 'Adding…' : `Add ${selectedToAdd.size > 0 ? selectedToAdd.size : ''} Form${selectedToAdd.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
