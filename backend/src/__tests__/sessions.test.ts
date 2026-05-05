import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { counselorToken } from './helpers';

jest.mock('../config/database', () => ({
  prisma: {
    intakeSession: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sessionForm: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    formFieldValue: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

const mockSession = {
  id: 'session-1',
  sessionCode: 'intake-001',
  patientIdString: 'PT-00001',
  counselorId: 'counselor-id',
  status: 'IN_PROGRESS',
  pdfExportPath: null,
  methasoftLinkedAt: null,
  createdAt: new Date().toISOString(),
  completedAt: null,
  sessionForms: [
    {
      id: 'sf-1',
      formTemplateId: 'form-1',
      status: 'NOT_STARTED',
      formTemplate: { name: 'Assessment Disclosure' },
    },
  ],
};

describe('GET /api/sessions', () => {
  it('returns list of sessions', async () => {
    (prisma.intakeSession.findMany as jest.Mock).mockResolvedValue([mockSession]);

    const res = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].sessionCode).toBe('intake-001');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/sessions/:id', () => {
  it('returns session detail by id', async () => {
    (prisma.intakeSession.findUnique as jest.Mock).mockResolvedValue(mockSession);

    const res = await request(app)
      .get('/api/sessions/session-1')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('session-1');
    expect(res.body.patientIdString).toBe('PT-00001');
  });

  it('returns 404 when session not found', async () => {
    (prisma.intakeSession.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/sessions/nonexistent')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/sessions', () => {
  it('creates a new session', async () => {
    (prisma.intakeSession.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.intakeSession.count as jest.Mock).mockResolvedValue(0);
    (prisma.intakeSession.create as jest.Mock).mockResolvedValue(mockSession);
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ patientIdString: 'PT-00001', formTemplateIds: ['form-1'] });

    expect(res.status).toBe(201);
    expect(res.body.patientIdString).toBe('PT-00001');
  });

  it('returns 409 when active session already exists for patient', async () => {
    (prisma.intakeSession.findFirst as jest.Mock).mockResolvedValue(mockSession);

    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ patientIdString: 'PT-00001', formTemplateIds: ['form-1'] });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('existingSessionId');
  });

  it('returns 400 for invalid patient ID format', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ patientIdString: 'INVALID', formTemplateIds: ['form-1'] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when no form templates selected', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ patientIdString: 'PT-00001', formTemplateIds: [] });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/sessions/:id/forms/:formId/fields', () => {
  it('saves form field values', async () => {
    (prisma.formFieldValue.upsert as jest.Mock).mockResolvedValue({});
    (prisma.sessionForm.updateMany as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .patch('/api/sessions/session-1/forms/sf-1/fields')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ fields: { client_name: 'John Doe', dob: '1990-01-01' } });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/saved/i);
  });

  it('returns 400 when fields key is missing', async () => {
    const res = await request(app)
      .patch('/api/sessions/session-1/forms/sf-1/fields')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/sessions/:id/forms/:formId/complete', () => {
  it('marks a form as completed', async () => {
    (prisma.sessionForm.update as jest.Mock).mockResolvedValue({ status: 'COMPLETED' });

    const res = await request(app)
      .patch('/api/sessions/session-1/forms/sf-1/complete')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/complete/i);
  });
});

describe('POST /api/sessions/:id/export', () => {
  it('records the PDF export path', async () => {
    (prisma.intakeSession.update as jest.Mock).mockResolvedValue({});
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .post('/api/sessions/session-1/export')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ exportPath: '/secure/carelink/intake-001/' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/recorded/i);
  });
});

describe('POST /api/sessions/:id/confirm-methasoft', () => {
  it('completes the session and deletes field values', async () => {
    (prisma.intakeSession.findUnique as jest.Mock).mockResolvedValue({
      ...mockSession,
      sessionForms: [{ id: 'sf-1' }, { id: 'sf-2' }],
    });
    (prisma.formFieldValue.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });
    (prisma.intakeSession.update as jest.Mock).mockResolvedValue({});
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

    const res = await request(app)
      .post('/api/sessions/session-1/confirm-methasoft')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(prisma.formFieldValue.deleteMany).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'METHASOFT_LINKED_CONFIRMED' }) })
    );
  });

  it('returns 404 when session not found', async () => {
    (prisma.intakeSession.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/sessions/nonexistent/confirm-methasoft')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({});

    expect(res.status).toBe(404);
  });
});
