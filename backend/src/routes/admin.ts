/**
 * routes/admin.ts
 * Admin-only endpoints: form template management, system config, user management.
 * Owner: Anthony / Success
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';

const FORMS_DIR = path.join(process.cwd(), 'public', 'forms');

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
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
  })),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

// POST /api/admin/forms — create a new form template
adminRouter.post('/forms', validate(formTemplateSchema), async (req: Request, res: Response) => {
  try {
    const form = await prisma.formTemplate.create({ data: req.body });
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

// DELETE /api/admin/forms/:id — deactivate a form template (soft delete)
adminRouter.delete('/forms/:id', async (req: Request, res: Response) => {
  try {
    await prisma.formTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    return res.json({ message: 'Form template deactivated' });
  } catch {
    return res.status(500).json({ error: 'Failed to deactivate form template' });
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
    await prisma.auditLog.deleteMany({ where: { sessionId: session.id } });
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
