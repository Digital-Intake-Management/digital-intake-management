import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { adminToken, counselorToken } from './helpers';

jest.mock('../config/database', () => ({
  prisma: {
    formTemplate: {
      create: jest.fn(),
      update: jest.fn(),
    },
    systemConfig: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    intakeSession: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockForm = {
  id: 'form-1',
  name: 'Assessment Disclosure',
  slug: 'assessment-disclosure',
  description: null,
  fieldDefinitions: [],
  isActive: true,
  sortOrder: 1,
};

const newFormPayload = {
  name: 'New Form',
  slug: 'new-form',
  fieldDefinitions: [
    { key: 'field_1', label: 'Field One', type: 'text', required: true },
  ],
};

describe('POST /api/admin/forms', () => {
  it('creates a new form template (admin only)', async () => {
    (prisma.formTemplate.create as jest.Mock).mockResolvedValue({ ...mockForm, ...newFormPayload });

    const res = await request(app)
      .post('/api/admin/forms')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(newFormPayload);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Form');
  });

  it('returns 403 for counselor', async () => {
    const res = await request(app)
      .post('/api/admin/forms')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send(newFormPayload);

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid payload (missing name)', async () => {
    const res = await request(app)
      .post('/api/admin/forms')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ slug: 'no-name', fieldDefinitions: [] });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid field type', async () => {
    const res = await request(app)
      .post('/api/admin/forms')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        name: 'Bad Form',
        slug: 'bad-form',
        fieldDefinitions: [{ key: 'f', label: 'F', type: 'invalid_type', required: true }],
      });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/admin/forms/:id', () => {
  it('updates a form template', async () => {
    (prisma.formTemplate.update as jest.Mock).mockResolvedValue({ ...mockForm, isActive: false });

    const res = await request(app)
      .patch('/api/admin/forms/form-1')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('returns 403 for counselor', async () => {
    const res = await request(app)
      .patch('/api/admin/forms/form-1')
      .set('Authorization', `Bearer ${counselorToken()}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/forms/:id', () => {
  it('deactivates (soft-deletes) a form template', async () => {
    (prisma.formTemplate.update as jest.Mock).mockResolvedValue({ ...mockForm, isActive: false });

    const res = await request(app)
      .delete('/api/admin/forms/form-1')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it('returns 403 for counselor', async () => {
    const res = await request(app)
      .delete('/api/admin/forms/form-1')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/config', () => {
  it('returns system config for admin', async () => {
    (prisma.systemConfig.findMany as jest.Mock).mockResolvedValue([
      { id: 'cfg-1', configKey: 'sharepoint_folder_path', configValue: '/secure/carelink/' },
    ]);

    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].configKey).toBe('sharepoint_folder_path');
  });

  it('returns 403 for counselor', async () => {
    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/config/:key', () => {
  it('upserts a config value', async () => {
    (prisma.systemConfig.upsert as jest.Mock).mockResolvedValue({
      id: 'cfg-1',
      configKey: 'sharepoint_folder_path',
      configValue: '/new/path/',
    });

    const res = await request(app)
      .patch('/api/admin/config/sharepoint_folder_path')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ value: '/new/path/' });

    expect(res.status).toBe(200);
    expect(res.body.configValue).toBe('/new/path/');
  });
});

describe('GET /api/admin/stats', () => {
  it('returns stats object with expected shape', async () => {
    (prisma.intakeSession.count as jest.Mock)
      .mockResolvedValueOnce(10)  // totalSessions
      .mockResolvedValueOnce(3)   // activeSessions
      .mockResolvedValueOnce(5);  // completedSessions
    (prisma.intakeSession.findMany as jest.Mock).mockResolvedValue([
      { createdAt: new Date().toISOString(), status: 'IN_PROGRESS' },
    ]);

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalSessions: 10,
      activeSessions: 3,
      completedSessions: 5,
    });
    expect(Array.isArray(res.body.recentSessions)).toBe(true);
  });

  it('returns 403 for counselor', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(403);
  });
});
