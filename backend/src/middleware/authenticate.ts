/**
 * middleware/authenticate.ts
 * JWT authentication middleware — attach to any route that requires login.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    (req as any).user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
