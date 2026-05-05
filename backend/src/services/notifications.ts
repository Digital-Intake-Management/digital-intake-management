import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export async function createNotification(
  userId: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      message,
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function notifyAllAdmins(
  type: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  await Promise.all(admins.map((a) => createNotification(a.id, type, message, metadata)));
}

export async function notifyAllCounselors(
  type: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  const counselors = await prisma.user.findMany({
    where: { role: 'COUNSELOR', isActive: true },
    select: { id: true },
  });
  await Promise.all(counselors.map((c) => createNotification(c.id, type, message, metadata)));
}
