/**
 * routes/forms.ts
 * Form template endpoints (read-only for counselors).
 * Owner: Dennise / Meya (frontend consumption)
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';

export const formsRouter = Router();
formsRouter.use(authenticate);

// GET /api/forms — list all active form templates
formsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const forms = await prisma.formTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return res.json(forms);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch form templates' });
  }
});

// GET /api/forms/:id — get a single form template
formsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const form = await prisma.formTemplate.findUnique({ where: { id: req.params.id } });
    if (!form) return res.status(404).json({ error: 'Form template not found' });
    return res.json(form);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch form template' });
  }
});
