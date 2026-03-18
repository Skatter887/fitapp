import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';

const router = Router();

// PATCH /api/sessions/:id/complete — mark session as complete/incomplete
router.patch('/:id/complete', async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const { completed } = req.body as { completed?: boolean };
  const isCompleted = completed !== false;

  try {
    const session = await prisma.workoutSession.update({
      where: { id },
      data: {
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      include: { exercises: { orderBy: { order: 'asc' } } },
    });

    return res.json(session);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sessions/:id — get single session
router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params['id'] as string;

  try {
    const session = await prisma.workoutSession.findUnique({
      where: { id },
      include: { exercises: { orderBy: { order: 'asc' } } },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
