/**
 * routes/admin.ts
 * Admin-only endpoints: form template management, system config, user management.
 * Owner: Anthony / Success
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';
import { createNotification, notifyAllCounselors } from '../services/notifications';
import { passwordSchema } from './auth';

const FORMS_DIR = path.join(process.cwd(), 'public', 'forms');

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  },
});

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for spreadsheets
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
    ];
    cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith('.csv'));
  },
});

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

// ── Form Template Management ───────────────────────────────────────────────────

const formTemplateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  fieldDefinitions: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'checkbox', 'radio', 'date', 'signature']),
    required: z.boolean(),
    requiredGroup: z.string().optional(),
  })),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

// GET /api/admin/forms — list ALL form templates including inactive ones
adminRouter.get('/forms', async (_req: Request, res: Response) => {
  try {
    const forms = await prisma.formTemplate.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return res.json(forms);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch form templates' });
  }
});

// POST /api/admin/forms — create a new form template
adminRouter.post('/forms', validate(formTemplateSchema), async (req: Request, res: Response) => {
  try {
    const form = await prisma.formTemplate.create({ data: req.body });
    await notifyAllCounselors(
      'FORM_ADDED',
      `A new form is now available for future intakes: "${form.name}"`,
      { formId: form.id, formName: form.name }
    );
    return res.status(201).json(form);
  } catch {
    return res.status(500).json({ error: 'Failed to create form template' });
  }
});

// PATCH /api/admin/forms/:id — edit a form template
adminRouter.patch('/forms/:id', async (req: Request, res: Response) => {
  try {
    const form = await prisma.formTemplate.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return res.json(form);
  } catch {
    return res.status(500).json({ error: 'Failed to update form template' });
  }
});

// DELETE /api/admin/forms/:id — deactivate (soft) or permanently delete a form template.
// Permanent delete (?permanent=true) is only allowed if the form has never been used
// in any session. If it has session history, the request is rejected to protect records.
adminRouter.delete('/forms/:id', async (req: Request, res: Response) => {
  try {
    const permanent = req.query.permanent === 'true';
    const form = await prisma.formTemplate.findUnique({ where: { id: req.params.id } });
    if (!form) return res.status(404).json({ error: 'Form template not found' });

    if (permanent) {
      const usageCount = await prisma.sessionForm.count({ where: { formTemplateId: req.params.id } });
      if (usageCount > 0) {
        return res.status(409).json({
          error: `Cannot permanently delete "${form.name}" — it has been used in ${usageCount} session(s). Deactivate it instead to hide it from future intakes while preserving the session history.`,
        });
      }
      await prisma.formTemplate.delete({ where: { id: req.params.id } });
      return res.json({ message: 'Form template permanently deleted' });
    }

    // Soft delete — notify counselors with active sessions using this form
    const affected = await prisma.sessionForm.findMany({
      where: {
        formTemplateId: req.params.id,
        session: { status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } },
      },
      select: { session: { select: { counselorId: true } } },
    });

    await prisma.formTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    const uniqueCounselorIds = [...new Set(affected.map((sf) => sf.session.counselorId))];
    await Promise.all(
      uniqueCounselorIds.map((id) =>
        createNotification(
          id,
          'FORM_DEACTIVATED',
          `"${form.name}" was deactivated by an admin and removed from active sessions.`,
          { formId: form.id, formName: form.name }
        )
      )
    );

    return res.json({ message: 'Form template deactivated' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete form template' });
  }
});

// ── System Config ──────────────────────────────────────────────────────────────

// GET /api/admin/config — get all system config values
adminRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.systemConfig.findMany();
    return res.json(configs);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// POST /api/admin/patients/import — bulk-import patient IDs from an Excel or CSV file
// Accepts both "PT-12345" and "12345" (normalises to PT-XXXXX).
// Returns: { added, duplicates, errors } arrays so the admin can see exactly what happened.
adminRouter.post('/patients/import', excelUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Collect every non-empty cell value from the first column, skipping a header
    // row if it doesn't look like a patient ID.
    const rawValues: string[] = [];
    for (const row of rows) {
      const cell = row[0];
      if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
        rawValues.push(String(cell).trim());
      }
    }

    const added: string[] = [];
    const duplicates: string[] = [];
    const errors: { raw: string; reason: string }[] = [];

    const createdByUserId = (req as any).user.userId;

    for (const raw of rawValues) {
      // Normalise: strip whitespace, uppercase, handle "12345" → "PT-12345"
      let normalised = raw.toUpperCase().replace(/\s+/g, '');
      if (/^\d{5}$/.test(normalised)) normalised = `PT-${normalised}`;

      // Skip obvious header rows
      if (normalised === 'PATIENTID' || normalised === 'PATIENT ID' || normalised === 'PT-#####') {
        continue;
      }

      if (!/^PT-\d{5}$/.test(normalised)) {
        errors.push({ raw, reason: 'Invalid format — expected PT-##### or a 5-digit number' });
        continue;
      }

      const existing = await prisma.patientId.findUnique({ where: { patientIdString: normalised } });
      if (existing) {
        duplicates.push(normalised);
        continue;
      }

      await prisma.patientId.create({ data: { patientIdString: normalised, createdByUserId } });
      added.push(normalised);
    }

    return res.json({ added, duplicates, errors });
  } catch {
    return res.status(500).json({ error: 'Failed to process file' });
  }
});

// POST /api/admin/forms/:id/pdf — upload a new PDF template for a form
// Replaces the existing PDF; new sessions will use the new version.
// In-progress sessions are unaffected (they saved field values, not PDF bytes).
adminRouter.post('/forms/:id/pdf', pdfUpload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });

    const form = await prisma.formTemplate.findUnique({ where: { id: req.params.id } });
    if (!form) return res.status(404).json({ error: 'Form template not found' });

    // Use a safe filename: slug + .pdf
    const filename = `${form.slug}.pdf`;
    await fs.mkdir(FORMS_DIR, { recursive: true });
    await fs.writeFile(path.join(FORMS_DIR, filename), req.file.buffer);

    await prisma.formTemplate.update({
      where: { id: req.params.id },
      data: { pdfPath: filename },
    });

    return res.json({ message: 'PDF updated', pdfPath: filename });
  } catch {
    return res.status(500).json({ error: 'Failed to upload PDF' });
  }
});

// GET /api/admin/sessions — list all sessions for the admin sessions panel
adminRouter.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.intakeSession.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sessionCode: true,
        patientIdString: true,
        status: true,
        createdAt: true,
        counselor: { select: { username: true } },
        _count: { select: { sessionForms: true } },
      },
    });
    return res.json(sessions);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /api/admin/sessions/:id — permanently delete a session and all its data
adminRouter.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const session = await prisma.intakeSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Delete child records in dependency order before removing the session
    const sessionForms = await prisma.sessionForm.findMany({ where: { sessionId: session.id } });
    const sessionFormIds = sessionForms.map((sf) => sf.id);

    await prisma.formFieldValue.deleteMany({ where: { sessionFormId: { in: sessionFormIds } } });
    await prisma.sessionForm.deleteMany({ where: { sessionId: session.id } });
    // Preserve audit logs — null out the sessionId rather than deleting records.
    // The immutable audit trail must survive session deletion per HIPAA requirements.
    await prisma.auditLog.updateMany({
      where: { sessionId: session.id },
      data: { sessionId: null },
    });
    await prisma.intakeSession.delete({ where: { id: session.id } });

    return res.json({ message: 'Session deleted' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete session' });
  }
});

// PATCH /api/admin/config/:key — update a config value
adminRouter.patch('/config/:key', async (req: Request, res: Response) => {
  try {
    const config = await prisma.systemConfig.upsert({
      where: { configKey: req.params.key },
      update: { configValue: req.body.value },
      create: { configKey: req.params.key, configValue: req.body.value },
    });
    return res.json(config);
  } catch {
    return res.status(500).json({ error: 'Failed to update config' });
  }
});

// ── Dashboard Stats ────────────────────────────────────────────────────────────

// GET /api/admin/stats — weekly activity data for the admin dashboard chart
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalSessions, activeSessions, completedSessions, recentSessions] = await Promise.all([
      prisma.intakeSession.count(),
      prisma.intakeSession.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.intakeSession.count({ where: { status: 'LINKED_IN_METHASOFT' } }),
      prisma.intakeSession.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true, status: true },
      }),
    ]);

    return res.json({ totalSessions, activeSessions, completedSessions, recentSessions });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── User Management ────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: passwordSchema,
  role: z.enum(['COUNSELOR', 'ADMIN']).default('COUNSELOR'),
});

const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['COUNSELOR', 'ADMIN']).optional(),
});

const USER_SELECT = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
  _count: { select: { intakeSessions: true } },
} as const;

// GET /api/admin/users — list all users
adminRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: USER_SELECT,
    });
    return res.json(users);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users — create a new counselor or admin account
adminRouter.post('/users', validate(createUserSchema), async (req: Request, res: Response) => {
  try {
    const { username, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(409).json({ error: 'Username is already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, passwordHash, role, mustChangePassword: true },
      select: USER_SELECT,
    });
    return res.status(201).json(user);
  } catch {
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/admin/users/:id — toggle active status or change role
adminRouter.patch('/users/:id', validate(updateUserSchema), async (req: Request, res: Response) => {
  try {
    const { isActive, role } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(role ? { role } : {}),
      },
      select: USER_SELECT,
    });
    return res.json(user);
  } catch {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/admin/users/:id/reset-password — generate a temp password and return it to the admin
adminRouter.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  try {
    // Exclude visually similar characters (0/O, 1/I/l) to reduce transcription errors
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from(
      { length: 10 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash, mustChangePassword: true },
    });

    return res.json({ tempPassword });
  } catch {
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});
