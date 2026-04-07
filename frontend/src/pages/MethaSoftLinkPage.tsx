/**
 * pages/MethaSoftLinkPage.tsx
 * Step-by-step instructions for the counselor to link documents in MethaSoft.
 * Counselor must check the confirmation box before continuing.
 * Owner: Dennise / Meya
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { sessionsApi } from '@/services/api';

export default function MethaSoftLinkPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleContinue = async () => {
    if (!confirmed) { setShowWarning(true); return; }
    setIsLoading(true);
    try {
      await sessionsApi.confirmMethasoft(sessionId!);
      navigate(`/intake/${sessionId}/complete`);
    } catch {
      alert('Failed to confirm. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    {
      n: 1,
      title: 'Open MethaSoft',
      detail: 'Launch MethaSoft and navigate to the Document Manager module',
      extra: <a href="#" className="text-primary text-sm underline mt-1 block">Open MethaSoft (External)</a>,
    },
    { n: 2, title: 'Locate Patient Record', detail: 'Search for the Patient ID in MethaSoft Document Manager' },
    { n: 3, title: 'Use "Link Document" Feature', detail: 'In Document Manager, click "Link Document" and browse to the secure folder', code: '/secure/carelink/intake-forms/' },
    { n: 4, title: 'Select PDF File', detail: 'Find and link the exported intake forms PDF file' },
    { n: 5, title: 'Verify and Save', detail: 'Confirm the document is linked to the correct Patient ID and save in MethaSoft' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(`/intake/${sessionId}`)}
        className="flex items-center gap-2 text-primary text-sm font-medium hover:underline">
        ← Back to Workflow
      </button>

      <h1 className="text-2xl font-bold text-gray-900">MethaSoft Document Linking</h1>

      <div className="card space-y-6">
        <h2 className="font-semibold text-gray-900">Step-by-Step Instructions</h2>

        <div className="space-y-5">
          {steps.map((step) => (
            <div key={step.n} className="flex gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-primary text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0 mt-0.5">
                {step.n}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{step.detail}</p>
                {step.code && (
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block text-gray-600">
                    {step.code}
                  </code>
                )}
                {step.extra}
              </div>
            </div>
          ))}
        </div>

        {/* Confirmation checkbox */}
        <div className="bg-gray-50 rounded-xl p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => { setConfirmed(e.target.checked); setShowWarning(false); }}
              className="w-4 h-4 accent-primary mt-0.5 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                ✅ I confirm that I have successfully linked the documents in MethaSoft Document Manager
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                The PDF file has been associated with the correct Patient ID
              </p>
            </div>
          </label>
        </div>

        {showWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
            ⚠️ You must confirm document linking before continuing
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={handleContinue} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}
