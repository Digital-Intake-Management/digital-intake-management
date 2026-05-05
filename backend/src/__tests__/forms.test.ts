import request from 'supertest';
import app from '../app';
import { prisma } from '../config/database';
import { counselorToken } from './helpers';

jest.mock('../config/database', () => ({
  prisma: {
    formTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const mockForm = {
  id: 'form-1',
  name: 'Assessment Disclosure',
  slug: 'assessment-disclosure',
  description: 'Initial assessment form',
  fieldDefinitions: [
    { key: 'client_name', label: 'Client Name', type: 'text', required: true },
  ],
  isActive: true,
  sortOrder: 1,
};

describe('GET /api/forms', () => {
  it('returns list of active form templates', async () => {
    (prisma.formTemplate.findMany as jest.Mock).mockResolvedValue([mockForm]);

    const res = await request(app)
      .get('/api/forms')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].name).toBe('Assessment Disclosure');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/forms');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no forms', async () => {
    (prisma.formTemplate.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app)
      .get('/api/forms')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/forms/:id', () => {
  it('returns a single form template by id', async () => {
    (prisma.formTemplate.findUnique as jest.Mock).mockResolvedValue(mockForm);

    const res = await request(app)
      .get('/api/forms/form-1')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('form-1');
    expect(res.body.slug).toBe('assessment-disclosure');
  });

  it('returns 404 when form not found', async () => {
    (prisma.formTemplate.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/forms/nonexistent')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/forms/form-1');
    expect(res.status).toBe(401);
  });
});
