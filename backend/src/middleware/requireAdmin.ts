/**
 * middleware/requireAdmin.ts
 * Restricts a route to admin users only. Must be used AFTER authenticate.
 */

import { Request, Response, NextFunction } from 'express';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};
