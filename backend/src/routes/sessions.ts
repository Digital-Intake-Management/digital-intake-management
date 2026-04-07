/**
 * routes/sessions.ts
 * Intake session management — the core of the application.
 * Owner: Anthony / Success
 *
 * An intake session tracks one patient's full intake event:
 * Patient Verified → Form Selection → Form Completion → PDF Export → MethaSoft Link → Complete
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';

export const sessionsRouter = Router();
sessionsRouter.use(authenticate);

// ── Validation ─────────────────────────────────────────────────────────────────
const createSessionSchema = z.object({
  patientIdString: z.string().regex(/^PT-\d{5}$/),
  formTemplateIds: z.array(z.string()).min(1, 'At least one form must be selected'),
});

const updateFieldsSchema = z.object({
  fields: z.record(z.string()), // { fieldKey: fieldValue }
});

// ── GET /api/sessions ──────────────────────────────────────────────────────────
// List all sessions (dashboard)
sessionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.intakeSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sessionForms: {
          include: { formTemplate: { select: { name: true } } },
        },
      },
    });
    return res.json(sessions);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ── GET /api/sessions/:id ──────────────────────────────────────────────────────
// Get a single session with full detail
sessionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const session = await prisma.intakeSession.findUnique({
      where: { id: req.params.id },
      include: {
        sessionForms: {
          include: {
            formTemplate: true,
            fieldValues: true,
          },
        },
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// ── POST /api/sessions ─────────────────────────────────────────────────────────
// Create a new intake session
sessionsRouter.post('/', validate(createSessionSchema), async (req: Request, res: Response) => {
  try {
    const { patientIdString, formTemplateIds } = req.body;
    const counselorId = (req as any).user.userId;

    // Block duplicate active sessions for same patient
    const activeSession = await prisma.intakeSession.findFirst({
      where: {
        patientIdString,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      },
    });

    if (activeSession) {
      return res.status(409).json({
        error: 'An active intake session already exists for this patient',
        existingSessionId: activeSession.id,
      });
    }

    // Generate a human-readable session code
    const sessionCount = await prisma.intakeSession.count();
    const sessionCode = `intake-${String(sessionCount + 1).padStart(3, '0')}`;

    const session = await prisma.intakeSession.create({
      data: {
        sessionCode,
        patientIdString,
        counselorId,
        status: 'IN_PROGRESS',
        sessionForms: {
          create: formTemplateIds.map((formTemplateId: string) => ({ formTemplateId })),
        },
      },
      include: { sessionForms: { include: { formTemplate: true } } },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        sessionId: session.id,
        action: 'SESSION_CREATED',
        performedById: counselorId,
        metadata: { patientIdString, formCount: formTemplateIds.length },
      },
    });

    return res.status(201).json(session);
  } catch {
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

// ── PATCH /api/sessions/:id/forms/:formId/fields ───────────────────────────────
// Save form field values (auto-save during session)
sessionsRouter.patch(
  '/:id/forms/:formId/fields',
  validate(updateFieldsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id: sessionId, formId: sessionFormId } = req.params;
      const { fields } = req.body;

      // Upsert each field value
      await Promise.all(
        Object.entries(fields).map(([fieldKey, fieldValue]) =>
          prisma.formFieldValue.upsert({
            where: { sessionFormId_fieldKey: { sessionFormId, fieldKey } },
            update: { fieldValue: String(fieldValue) },
            create: { sessionFormId, fieldKey, fieldValue: String(fieldValue) },
          })
        )
      );

      // Mark form as in progress if not already
      await prisma.sessionForm.updateMany({
        where: { id: sessionFormId, status: 'NOT_STARTED' },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });

      return res.json({ message: 'Fields saved' });
    } catch {
      return res.status(500).json({ error: 'Failed to save fields' });
    }
  }
);

// ── PATCH /api/sessions/:id/forms/:formId/complete ────────────────────────────
// Mark a form as completed
sessionsRouter.patch('/:id/forms/:formId/complete', async (req: Request, res: Response) => {
  try {
    const { formId: sessionFormId } = req.params;
    await prisma.sessionForm.update({
      where: { id: sessionFormId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    return res.json({ message: 'Form marked complete' });
  } catch {
    return res.status(500).json({ error: 'Failed to complete form' });
  }
});

// ── POST /api/sessions/:id/export ─────────────────────────────────────────────
// Record that PDFs were exported to SharePoint
sessionsRouter.post('/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exportPath } = req.body;
    const performedById = (req as any).user.userId;

    await prisma.intakeSession.update({
      where: { id },
      data: { pdfExportPath: exportPath },
    });

    await prisma.auditLog.create({
      data: {
        sessionId: id,
        action: 'PDF_EXPORTED',
        performedById,
        metadata: { exportPath },
      },
    });

    return res.json({ message: 'Export recorded' });
  } catch {
    return res.status(500).json({ error: 'Failed to record export' });
  }
});

// ── POST /api/sessions/:id/confirm-methasoft ──────────────────────────────────
// Counselor confirms they linked documents in MethaSoft.
// Per spec: this triggers deletion of temp data and marks session complete.
sessionsRouter.post('/:id/confirm-methasoft', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const performedById = (req as any).user.userId;

    const session = await prisma.intakeSession.findUnique({
      where: { id },
      include: { sessionForms: true },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Delete temporary field values per spec requirement
    const sessionFormIds = session.sessionForms.map((sf) => sf.id);
    await prisma.formFieldValue.deleteMany({
      where: { sessionFormId: { in: sessionFormIds } },
    });

    // Mark session complete
    await prisma.intakeSession.update({
      where: { id },
      data: {
        status: 'LINKED_IN_METHASOFT',
        methasoftLinkedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Immutable audit log
    await prisma.auditLog.create({
      data: {
        sessionId: id,
        action: 'METHASOFT_LINKED_CONFIRMED',
        performedById,
        metadata: { fieldValuesDeleted: true },
      },
    });

    return res.json({ message: 'Intake session completed and documented' });
  } catch {
    return res.status(500).json({ error: 'Failed to confirm MethaSoft linking' });
  }
});
