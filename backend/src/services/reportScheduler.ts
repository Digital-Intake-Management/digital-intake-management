/**
 * services/reportScheduler.ts
 * Cron job that runs every Monday at 8am and emails the weekly report.
 * Owner: Success
 */

import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { prisma } from '../config/database';

export const startWeeklyReportJob = () => {
  // Every Monday at 8:00 AM
  cron.schedule('0 8 * * 1', async () => {
    console.log('[REPORT] Running weekly report job...');
    try {
      const config = await prisma.systemConfig.findMany({
        where: { configKey: { in: ['weekly_report_email'] } },
      });
      const emailConfig = config.find((c) => c.configKey === 'weekly_report_email');
      if (!emailConfig) {
        console.warn('[REPORT] No recipient email configured — skipping');
        return;
      }
      await sendWeeklyReport(emailConfig.configValue);
      console.log(`[REPORT] Weekly report sent to ${emailConfig.configValue}`);
    } catch (err) {
      console.error('[REPORT] Failed to send weekly report:', err);
    }
  });
};

async function sendWeeklyReport(recipientEmail: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const sessions = await prisma.intakeSession.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    include: {
      sessionForms: { include: { formTemplate: { select: { name: true } } } },
    },
  });

  const incompleteSessions = sessions.filter((s) => s.status !== 'LINKED_IN_METHASOFT');
  const missingFormCounts: Record<string, number> = {};
  incompleteSessions.forEach((session) => {
    session.sessionForms
      .filter((sf) => sf.status !== 'COMPLETED')
      .forEach((sf) => {
        const name = sf.formTemplate.name;
        missingFormCounts[name] = (missingFormCounts[name] || 0) + 1;
      });
  });

  const completedSessions = sessions.filter((s) => s.completedAt);
  const avgMs =
    completedSessions.length > 0
      ? completedSessions.reduce(
          (sum, s) => sum + (s.completedAt!.getTime() - s.createdAt.getTime()),
          0
        ) / completedSessions.length
      : 0;

  const htmlBody = `
    <h2>CareLink of Georgia — Weekly Intake Report</h2>
    <p>Period: ${sevenDaysAgo.toDateString()} to ${new Date().toDateString()}</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse;">
      <tr><td><strong>Total sessions</strong></td><td>${sessions.length}</td></tr>
      <tr><td><strong>Incomplete sessions</strong></td><td>${incompleteSessions.length}</td></tr>
      <tr><td><strong>Avg completion time</strong></td><td>${Math.round(avgMs / 60000)} minutes</td></tr>
    </table>
    <h3>Missing Forms by Type</h3>
    <ul>
      ${Object.entries(missingFormCounts)
        .map(([form, count]) => `<li>${form}: ${count} missing</li>`)
        .join('')}
    </ul>
    <h3>Patients with Incomplete Paperwork</h3>
    <ul>
      ${incompleteSessions.map((s) => `<li>${s.patientIdString}</li>`).join('')}
    </ul>
  `;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"CareLink Intake System" <${process.env.SMTP_USER}>`,
    to: recipientEmail,
    subject: `CareLink Weekly Intake Report — ${new Date().toDateString()}`,
    html: htmlBody,
  });
}
