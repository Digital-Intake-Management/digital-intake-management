/**
 * routes/reports.ts
 * Weekly report generation and CSV export.
 * Owner: Success
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';
import { requireAdmin } from '../middleware/requireAdmin';

export const reportsRouter = Router();
reportsRouter.use(authenticate, requireAdmin);

// GET /api/reports/weekly — get weekly report data (JSON)
reportsRouter.get('/weekly', async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sessions = await prisma.intakeSession.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      include: {
        sessionForms: { include: { formTemplate: { select: { name: true } } } },
      },
    });

    const incompleteSessions = sessions.filter(
      (s) => s.status !== 'LINKED_IN_METHASOFT'
    );

    // Tally missing forms by type
    const missingFormCounts: Record<string, number> = {};
    incompleteSessions.forEach((session) => {
      session.sessionForms
        .filter((sf) => sf.status !== 'COMPLETED')
        .forEach((sf) => {
          const name = sf.formTemplate.name;
          missingFormCounts[name] = (missingFormCounts[name] || 0) + 1;
        });
    });

    // Average completion time (only for completed sessions)
    const completedSessions = sessions.filter((s) => s.completedAt);
    const avgCompletionMs =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => {
            return sum + (s.completedAt!.getTime() - s.createdAt.getTime());
          }, 0) / completedSessions.length
        : 0;
    const avgCompletionMinutes = Math.round(avgCompletionMs / 60000);

    return res.json({
      generatedAt: new Date().toISOString(),
      period: { from: sevenDaysAgo, to: new Date() },
      totalSessions: sessions.length,
      incompleteSessions: incompleteSessions.length,
      missingFormsByType: missingFormCounts,
      averageCompletionTimeMinutes: avgCompletionMinutes,
      incompletePatientIds: incompleteSessions.map((s) => s.patientIdString),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/weekly/csv — download report as CSV
reportsRouter.get('/weekly/csv', async (_req: Request, res: Response) => {
  // TODO: implement CSV generation using the same data as /weekly
  // Use a library like 'csv-stringify' or build manually
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=weekly-report.csv');
  res.send('patient_id,status,forms_completed,forms_missing\n'); // placeholder
});
