/**
 * middleware/authenticate.ts
 * JWT authentication middleware — attach to any route that requires login.
 * Also checks the token denylist to reject explicitly logged-out tokens.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Reject tokens that have been explicitly logged out
  if (decoded.jti) {
    const denied = await prisma.tokenDenylist.findUnique({ where: { jti: decoded.jti } });
    if (denied) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }
  }

  (req as any).user = decoded;
  return next();
};
