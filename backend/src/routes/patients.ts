/**
 * routes/patients.ts
 * Patient ID management endpoints.
 * Owner: Sydney / Anthony
 *
 * NOTE: Per spec, NO patient demographics are stored here.
 * Only the Patient ID string (e.g. "PT-12345") is tracked.
 * Demographics live in MethaSoft and on exported PDFs only.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';

export const patientsRouter = Router();

// All patient routes require authentication
patientsRouter.use(authenticate);

// ── Validation ─────────────────────────────────────────────────────────────────
const patientIdSchema = z.object({
  patientIdString: z
    .string()
    .regex(/^PT-\d{5}$/, 'Patient ID must be in format PT-##### (e.g. PT-12345)'),
});

// ── GET /api/patients ──────────────────────────────────────────────────────────
// List all patient IDs (admin dashboard use)
patientsRouter.get('/', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const patients = await prisma.patientId.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { intakeSessions: true } },
        createdBy: { select: { username: true } },
      },
    });
    return res.json(patients);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// ── GET /api/patients/:id ──────────────────────────────────────────────────────
// Verify a patient ID exists (used before starting intake)
patientsRouter.get('/:patientIdString', async (req: Request, res: Response) => {
  try {
    const { patientIdString } = req.params;
    const patient = await prisma.patientId.findUnique({
      where: { patientIdString },
      include: {
        intakeSessions: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            sessionForms: {
              where: { status: 'COMPLETED' },
              select: { formTemplateId: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient ID not found', exists: false });
    }

    // Unique form template IDs completed in any prior session for this patient
    const completedFormTemplateIds = [
      ...new Set(
        patient.intakeSessions.flatMap((s) => s.sessionForms.map((sf) => sf.formTemplateId))
      ),
    ];

    return res.json({ ...patient, exists: true, completedFormTemplateIds });
  } catch {
    return res.status(500).json({ error: 'Failed to verify patient ID' });
  }
});

// ── POST /api/patients ─────────────────────────────────────────────────────────
// Create a new patient ID in the system (admin only)
patientsRouter.post('/', requireAdmin, validate(patientIdSchema), async (req: Request, res: Response) => {
  try {
    const { patientIdString } = req.body;
    const userId = (req as any).user.userId;

    const existing = await prisma.patientId.findUnique({ where: { patientIdString } });
    if (existing) {
      return res.status(409).json({ error: 'Patient ID already exists in system' });
    }

    const patient = await prisma.patientId.create({
      data: { patientIdString, createdByUserId: userId },
    });

    return res.status(201).json(patient);
  } catch {
    return res.status(500).json({ error: 'Failed to create patient ID' });
  }
});

// ── DELETE /api/patients/:id ───────────────────────────────────────────────────
// Admin only — delete a patient ID (only if no active sessions)
patientsRouter.delete('/:patientIdString', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { patientIdString } = req.params;

    const activeSessions = await prisma.intakeSession.count({
      where: {
        patientIdString,
        status: { in: ['IN_PROGRESS', 'NOT_STARTED'] },
      },
    });

    if (activeSessions > 0) {
      return res.status(400).json({
        error: 'Cannot delete patient ID with active intake sessions',
      });
    }

    await prisma.patientId.delete({ where: { patientIdString } });
    return res.json({ message: 'Patient ID deleted successfully' });
  } catch {
    return res.status(500).json({ error: 'Failed to delete patient ID' });
  }
});
