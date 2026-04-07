/**
 * routes/admin.ts
 * Admin-only endpoints: form template management, system config, user management.
 * Owner: Anthony / Success
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';

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
