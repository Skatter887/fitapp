import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';

const router = Router();

// GET /api/calendar?year=&month= — completed session dates
router.get('/', async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string, 10);
  const month = parseInt(req.query.month as string, 10); // 1-12

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Invalid year or month' });
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  try {
    const completedSessions = await prisma.workoutSession.findMany({
      where: {
        completed: true,
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        dayLabel: true,
        completedAt: true,
        planId: true,
      },
      orderBy: { completedAt: 'asc' },
    });

    const days = completedSessions.reduce<Record<number, { label: string; sessionId: string }[]>>(
      (acc, session) => {
        if (!session.completedAt) return acc;
        const day = session.completedAt.getDate();
        if (!acc[day]) acc[day] = [];
        acc[day].push({ label: session.dayLabel, sessionId: session.id });
        return acc;
      },
      {}
    );

    return res.json({
      year,
      month,
      completedDays: days,
      totalCompleted: completedSessions.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/calendar/history — recent completed sessions
router.get('/history', async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.workoutSession.findMany({
      where: { completed: true },
      orderBy: { completedAt: 'desc' },
      take: 50,
      include: {
        exercises: { orderBy: { order: 'asc' } },
        plan: { select: { id: true, daysPerWeek: true, targetMuscles: true } },
      },
    });

    return res.json(sessions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
