import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { counselorToken, adminToken } from './helpers';

jest.mock('../config/database', () => ({
  prisma: {
    patientId: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    intakeSession: {
      count: jest.fn(),
    },
  },
}));

const mockPatient = {
  id: 'pat-1',
  patientIdString: 'PT-00001',
  createdByUserId: 'user-1',
  isActive: true,
  createdAt: new Date().toISOString(),
};

describe('GET /api/patients', () => {
  it('requires admin — counselor gets 403', async () => {
    const res = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${counselorToken()}`);
    expect(res.status).toBe(403);
  });

  it('returns patient list for admin', async () => {
    (prisma.patientId.findMany as jest.Mock).mockResolvedValue([mockPatient]);

    const res = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/patients/:patientIdString', () => {
  it('returns patient when found', async () => {
    (prisma.patientId.findUnique as jest.Mock).mockResolvedValue({
      ...mockPatient,
      intakeSessions: [],
    });

    const res = await request(app)
      .get('/api/patients/PT-00001')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.patientIdString).toBe('PT-00001');
    expect(res.body.exists).toBe(true);
  });

  it('returns 404 when patient does not exist', async () => {
    (prisma.patientId.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/patients/PT-99999')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.exists).toBe(false);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/patients/PT-00001');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/patients', () => {
  it('creates a new patient ID', async () => {
    (prisma.patientId.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.patientId.create as jest.Mock).mockResolvedValue(mockPatient);

    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ patientIdString: 'PT-00001' });

    expect(res.status).toBe(201);
    expect(res.body.patientIdString).toBe('PT-00001');
  });

  it('returns 409 when patient ID already exists', async () => {
    (prisma.patientId.findUnique as jest.Mock).mockResolvedValue(mockPatient);

    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ patientIdString: 'PT-00001' });

    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid patient ID format', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ patientIdString: 'INVALID' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing patientIdString', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/patients/:patientIdString', () => {
  it('requires admin — counselor gets 403', async () => {
    const res = await request(app)
      .delete('/api/patients/PT-00001')
      .set('Authorization', `Bearer ${counselorToken()}`);
    expect(res.status).toBe(403);
  });

  it('deletes patient with no active sessions', async () => {
    (prisma.intakeSession.count as jest.Mock).mockResolvedValue(0);
    (prisma.patientId.delete as jest.Mock).mockResolvedValue(mockPatient);

    const res = await request(app)
      .delete('/api/patients/PT-00001')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('blocks delete when active sessions exist', async () => {
    (prisma.intakeSession.count as jest.Mock).mockResolvedValue(2);

    const res = await request(app)
      .delete('/api/patients/PT-00001')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/active/i);
  });
});
