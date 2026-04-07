/**
 * routes/auth.ts
 * Authentication endpoints.
 * Owner: Sydney / Anthony
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database';
import { validate } from '../middleware/validate';

export const authRouter = Router();

// ── Validation schemas ─────────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────
authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' } // Shift-length session
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────────
authRouter.get('/me', async (req: Request, res: Response) => {
  // TODO: Add authenticate middleware — implemented in middleware/authenticate.ts
  res.json({ message: 'Get current user — add authenticate middleware' });
});
