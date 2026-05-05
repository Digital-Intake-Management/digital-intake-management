/**
 * routes/auth.ts
 * Authentication endpoints.
 * Owner: Sydney / Anthony
 */

import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';

export const authRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Shared password complexity rule — used for change-password too
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────
authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });

    // Always return the same message to prevent username enumeration
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check lockout before verifying password
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return res.status(429).json({
        error: `Account locked due to too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          ...(shouldLock
            ? { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) }
            : {}),
        },
      });

      if (shouldLock) {
        await prisma.auditLog.create({
          data: {
            action: 'ACCOUNT_LOCKED',
            performedById: user.id,
            metadata: { reason: 'Too many failed login attempts' },
          },
        });
        return res.status(429).json({
          error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
        });
      }

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Successful login — reset lockout counters
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const jti = randomUUID();
    const token = jwt.sign(
      { userId: user.id, role: user.role, jti },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────────
// Adds the token's JTI to the denylist so it can't be reused after logout.
authRouter.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const { jti, exp } = (req as any).user;
    if (jti) {
      // Purge expired denylist entries while we're here to keep the table small
      await prisma.tokenDenylist.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      await prisma.tokenDenylist.create({
        data: {
          jti,
          expiresAt: new Date((exp ?? 0) * 1000),
        },
      });
    }
    return res.json({ message: 'Logged out' });
  } catch {
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// ── POST /api/auth/change-password ─────────────────────────────────────────────
// Requires authentication. Verifies current password, enforces complexity on the
// new one, invalidates the current token, and issues a fresh one.
authRouter.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const { userId, jti, exp } = (req as any).user;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must be different from your current password' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
      });

      // Invalidate the old token
      if (jti) {
        await prisma.tokenDenylist.create({
          data: { jti, expiresAt: new Date((exp ?? 0) * 1000) },
        }).catch(() => {}); // ignore if already denied
      }

      // Issue a fresh token without mustChangePassword
      const newJti = randomUUID();
      const token = jwt.sign(
        { userId: user.id, role: user.role, jti: newJti },
        process.env.JWT_SECRET!,
        { expiresIn: '8h' }
      );

      await prisma.auditLog.create({
        data: {
          action: 'PASSWORD_CHANGED',
          performedById: userId,
          metadata: { forced: user.mustChangePassword },
        },
      });

      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          mustChangePassword: false,
        },
      });
    } catch {
      return res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// ── GET /api/auth/me ───────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, isActive: true, mustChangePassword: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    return res.json(user);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch current user' });
  }
});
