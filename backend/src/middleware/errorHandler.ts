/**
 * middleware/errorHandler.ts
 * Global error handler — catches anything that falls through route handlers.
 */

import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
};
