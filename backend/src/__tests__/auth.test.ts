import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { prisma } from '../config/database';
import { counselorToken, adminToken } from './helpers';

jest.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockUser = {
  id: 'user-1',
  username: 'testcounselor',
  passwordHash: 'hashed_password',
  role: 'COUNSELOR' as const,
  isActive: true,
};

describe('POST /api/auth/login', () => {
  it('returns token and user on valid credentials', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testcounselor', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.username).toBe('testcounselor');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 401 on wrong password', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testcounselor', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 401 when user does not exist', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'password' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for inactive user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, isActive: false });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testcounselor', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testcounselor' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user with valid token', async () => {
    // Mock returns the shape that Prisma's select: { id, username, role, isActive } produces
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockUser.id,
      username: mockUser.username,
      role: mockUser.role,
      isActive: mockUser.isActive,
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${counselorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testcounselor');
    expect(res.body.role).toBe('COUNSELOR');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });

  it('returns 401 when user has been deactivated', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, isActive: false });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(401);
  });
});
