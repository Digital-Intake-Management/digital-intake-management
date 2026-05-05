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

// GET /api/reports/weekly/csv — download weekly report as CSV
reportsRouter.get('/weekly/csv', async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sessions = await prisma.intakeSession.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      include: {
        sessionForms: { include: { formTemplate: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'patient_id,status,forms_completed,forms_missing,missing_form_names,created_date';
    const rows = sessions.map((s) => {
      const completed = s.sessionForms.filter((sf) => sf.status === 'COMPLETED').length;
      const missingForms = s.sessionForms
        .filter((sf) => sf.status !== 'COMPLETED')
        .map((sf) => sf.formTemplate.name);
      return [
        s.patientIdString,
        s.status,
        String(completed),
        String(s.sessionForms.length - completed),
        missingForms.length > 0 ? `"${missingForms.join('; ')}"` : 'None',
        s.createdAt.toISOString().split('T')[0],
      ].join(',');
    });

    const filename = `weekly-report-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    return res.send([header, ...rows].join('\n'));
  } catch {
    return res.status(500).json({ error: 'Failed to generate CSV report' });
  }
});
