import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { adminToken, counselorToken } from './helpers';

jest.mock('../config/database', () => ({
  prisma: {
    intakeSession: {
      findMany: jest.fn(),
    },
  },
}));

const makeSession = (overrides: Partial<{
  id: string;
  patientIdString: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  sessionForms: unknown[];
}> = {}) => ({
  id: 'session-1',
  patientIdString: 'PT-00001',
  status: 'IN_PROGRESS',
  createdAt: new Date(),
  completedAt: null,
  sessionForms: [
    { status: 'COMPLETED', formTemplate: { name: 'Assessment Disclosure' } },
    { status: 'NOT_STARTED', formTemplate: { name: 'Client Information' } },
  ],
  ...overrides,
});

describe('GET /api/reports/weekly', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/reports/weekly')
      .set('Authorization', `Bearer ${counselorToken()}`);
    expect(res.status).toBe(403);
  });

  it('returns weekly report JSON for admin', async () => {
    (prisma.intakeSession.findMany as jest.Mock).mockResolvedValue([makeSession()]);

    const res = await request(app)
      .get('/api/reports/weekly')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalSessions', 1);
    expect(res.body).toHaveProperty('incompleteSessions', 1);
    expect(res.body).toHaveProperty('missingFormsByType');
    expect(res.body.missingFormsByType['Client Information']).toBe(1);
    expect(res.body).toHaveProperty('averageCompletionTimeMinutes');
    expect(res.body).toHaveProperty('incompletePatientIds');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/reports/weekly');
    expect(res.status).toBe(401);
  });

  it('calculates average completion time for completed sessions', async () => {
    const createdAt = new Date('2026-01-01T09:00:00Z');
    const completedAt = new Date('2026-01-01T09:30:00Z'); // 30 min later
    (prisma.intakeSession.findMany as jest.Mock).mockResolvedValue([
      makeSession({ status: 'LINKED_IN_METHASOFT', createdAt, completedAt }),
    ]);

    const res = await request(app)
      .get('/api/reports/weekly')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.averageCompletionTimeMinutes).toBe(30);
  });
});

describe('GET /api/reports/weekly/csv', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/reports/weekly/csv')
      .set('Authorization', `Bearer ${counselorToken()}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/reports/weekly/csv');
    expect(res.status).toBe(401);
  });

  it('returns CSV content-type', async () => {
    (prisma.intakeSession.findMany as jest.Mock).mockResolvedValue([makeSession()]);

    const res = await request(app)
      .get('/api/reports/weekly/csv')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.csv/);
  });

  it('CSV contains header row and session data', async () => {
    (prisma.intakeSession.findMany as jest.Mock).mockResolvedValue([makeSession()]);

    const res = await request(app)
      .get('/api/reports/weekly/csv')
      .set('Authorization', `Bearer ${adminToken()}`);

    const lines = res.text.split('\n');
    expect(lines[0]).toContain('patient_id');
    expect(lines[0]).toContain('status');
    expect(lines[0]).toContain('forms_completed');
    expect(lines[1]).toContain('PT-00001');
    expect(lines[1]).toContain('IN_PROGRESS');
  });

  it('returns CSV with correct completion counts', async () => {
    (prisma.intakeSession.findMany as jest.Mock).mockResolvedValue([
      makeSession({ patientIdString: 'PT-00002' }),
    ]);

    const res = await request(app)
      .get('/api/reports/weekly/csv')
      .set('Authorization', `Bearer ${adminToken()}`);

    const dataLine = res.text.split('\n')[1];
    expect(dataLine).toContain('PT-00002');
    // 1 form completed, 1 missing
    expect(dataLine).toContain('1');
  });

  it('returns empty CSV body (header only) when no sessions', async () => {
    (prisma.intakeSession.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/reports/weekly/csv')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const lines = res.text.trim().split('\n');
    expect(lines).toHaveLength(1); // only header
  });
});
