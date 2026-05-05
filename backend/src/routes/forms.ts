/**
 * routes/forms.ts
 * Form template endpoints (read-only for counselors).
 * Owner: Dennise / Meya (frontend consumption)
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';

export const formsRouter = Router();
formsRouter.use(authenticate);

const FORMS_DIR = path.join(process.cwd(), 'public', 'forms');

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

// GET /api/forms/:slug/pdf — stream the PDF template file for a form (matched by slug)
formsRouter.get('/:slug/pdf', async (req: Request, res: Response) => {
  try {
    const form = await prisma.formTemplate.findUnique({ where: { slug: req.params.slug } });
    if (!form || !form.pdfPath) {
      return res.status(404).json({ error: 'PDF not found for this form' });
    }
    const filePath = path.join(FORMS_DIR, form.pdfPath);
    const bytes = await fs.readFile(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${form.pdfPath}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(bytes);
  } catch {
    return res.status(404).json({ error: 'PDF file not found' });
  }
});

// GET /api/forms/:id — get a single form template by ID
formsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const form = await prisma.formTemplate.findUnique({ where: { id: req.params.id } });
    if (!form) return res.status(404).json({ error: 'Form template not found' });
    return res.json(form);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch form template' });
  }
});
