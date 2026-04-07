/**
 * App.tsx
 * Root component — sets up all routes.
 *
 * Route structure mirrors the prototype screens:
 *   /                    → redirect based on role
 *   /login               → Login page
 *
 *   Counselor routes:
 *   /dashboard           → Intake Dashboard (session list)
 *   /intake/new          → Patient ID Verification
 *   /intake/:sessionId   → Intake Workflow (step tracker)
 *   /intake/:sessionId/forms          → Form Selection
 *   /intake/:sessionId/forms/:formId  → Form Completion (with embedded signatures)
 *   /intake/:sessionId/export         → Document Export
 *   /intake/:sessionId/methasoft      → MethaSoft Linking instructions
 *   /intake/:sessionId/complete       → Intake Complete summary
 *
 *   Admin routes:
 *   /admin               → Admin Dashboard (weekly activity chart)
 *   /admin/patients      → Patient ID management
 *   /admin/forms         → Form template management
 *   /admin/settings      → System config (SharePoint path, email)
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';

// Pages — Dennise & Meya own frontend pages
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import PatientVerificationPage from '@/pages/PatientVerificationPage';
import PatientConfirmPage from '@/pages/PatientConfirmPage';
import IntakeWorkflowPage from '@/pages/IntakeWorkflowPage';
import FormSelectionPage from '@/pages/FormSelectionPage';
import FormCompletionPage from '@/pages/FormCompletionPage';
import DocumentExportPage from '@/pages/DocumentExportPage';
import MethaSoftLinkPage from '@/pages/MethaSoftLinkPage';
import IntakeCompletePage from '@/pages/IntakeCompletePage';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import AdminPatientsPage from '@/pages/AdminPatientsPage';
import AdminFormsPage from '@/pages/AdminFormsPage';
import AdminSettingsPage from '@/pages/AdminSettingsPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Counselor routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/intake/new" element={<PatientVerificationPage />} />
          <Route path="/intake/new/confirm" element={<PatientConfirmPage />} />
          <Route path="/intake/:sessionId" element={<IntakeWorkflowPage />} />
          <Route path="/intake/:sessionId/forms" element={<FormSelectionPage />} />
          <Route path="/intake/:sessionId/forms/:formId" element={<FormCompletionPage />} />
          <Route path="/intake/:sessionId/export" element={<DocumentExportPage />} />
          <Route path="/intake/:sessionId/methasoft" element={<MethaSoftLinkPage />} />
          <Route path="/intake/:sessionId/complete" element={<IntakeCompletePage />} />
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute requiredRole="ADMIN" />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/patients" element={<AdminPatientsPage />} />
          <Route path="/admin/forms" element={<AdminFormsPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
        </Route>

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
