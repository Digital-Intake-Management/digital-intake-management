import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/authenticate';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// GET /api/notifications — fetch the 50 most recent notifications for the caller
notificationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json(notifications);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read-all — mark every unread notification as read
// Must be registered before /:id/read so Express doesn't treat "read-all" as an id
notificationsRouter.patch('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return res.json({ message: 'All notifications marked as read' });
  } catch {
    return res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// PATCH /api/notifications/:id/read — mark a single notification as read
notificationsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId },
      data: { read: true },
    });
    return res.json({ message: 'Marked as read' });
  } catch {
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});
