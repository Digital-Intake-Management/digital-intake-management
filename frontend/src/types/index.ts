/**
 * types/index.ts
 * Shared TypeScript types for the entire frontend.
 * Keep these in sync with the Prisma schema and API responses.
 */

// ── Auth ───────────────────────────────────────────────────────────────────────
export type UserRole = 'COUNSELOR' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

// ── Sessions ───────────────────────────────────────────────────────────────────
export type SessionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'LINKED_IN_METHASOFT';
export type FormStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface IntakeSession {
  id: string;
  sessionCode: string;
  patientIdString: string;
  counselorId: string;
  status: SessionStatus;
  methasoftLinkedAt: string | null;
  pdfExportPath: string | null;
  createdAt: string;
  completedAt: string | null;
  sessionForms: SessionForm[];
}

export interface SessionForm {
  id: string;
  sessionId: string;
  formTemplateId: string;
  status: FormStatus;
  startedAt: string | null;
  completedAt: string | null;
  formTemplate: FormTemplate;
  fieldValues?: FormFieldValue[];
}

// ── Forms ─────────────────────────────────────────────────────────────────────
export type FieldType = 'text' | 'checkbox' | 'radio' | 'date' | 'signature';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // for radio fields
}

export interface FormTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  fieldDefinitions: FieldDefinition[];
  pdfPath: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface FormFieldValue {
  id: string;
  sessionFormId: string;
  fieldKey: string;
  fieldValue: string;
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export interface SystemConfig {
  id: string;
  configKey: string;
  configValue: string;
}

export interface AdminStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  recentSessions: { createdAt: string; status: SessionStatus }[];
}

// ── Reports ───────────────────────────────────────────────────────────────────
export interface WeeklyReport {
  generatedAt: string;
  period: { from: string; to: string };
  totalSessions: number;
  incompleteSessions: number;
  missingFormsByType: Record<string, number>;
  averageCompletionTimeMinutes: number;
  incompletePatientIds: string[];
}
