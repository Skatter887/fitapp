import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { getAlternativeExercises, getExercisesForCategories, MUSCLE_TO_CATEGORY } from '../services/wger.service';

const router = Router();

// PATCH /api/exercises/:id/complete — toggle exercise completion
router.patch('/:id/complete', async (req: Request, res: Response) => {
  const { completed } = req.body as { completed: boolean };
  const id = req.params['id'] as string;

  try {
    const exercise = await prisma.exerciseEntry.update({
      where: { id },
      data: { completed },
    });

    const sessionExercises = await prisma.exerciseEntry.findMany({
      where: { sessionId: exercise.sessionId },
    });

    const allDone = sessionExercises.every((e) => e.completed);

    if (allDone) {
      await prisma.workoutSession.update({
        where: { id: exercise.sessionId },
        data: { completed: true, completedAt: new Date() },
      });
    } else {
      await prisma.workoutSession.update({
        where: { id: exercise.sessionId },
        data: { completed: false, completedAt: null },
      });
    }

    return res.json(exercise);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/exercises/:wgerId/alternatives — get alternative exercises
router.get('/:wgerId/alternatives', async (req: Request, res: Response) => {
  const wgerId = parseInt(req.params['wgerId'] as string, 10);
  const { muscleGroup } = req.query as { muscleGroup?: string };

  if (isNaN(wgerId)) {
    return res.status(400).json({ error: 'Invalid exercise id' });
  }

  try {
    let categoryIds: number[] = [];
    if (muscleGroup) {
      categoryIds = MUSCLE_TO_CATEGORY[muscleGroup.toLowerCase()] ?? [];
    }

    if (categoryIds.length === 0) {
      const allExercises = await getExercisesForCategories([8, 9, 10, 11, 12, 13, 14, 15]);
      const found = allExercises.find((e) => e.id === wgerId);
      if (found) categoryIds = [found.category];
    }

    if (categoryIds.length === 0) {
      return res.status(404).json({ error: 'Could not find exercise category' });
    }

    const alternatives = await getAlternativeExercises(categoryIds[0], wgerId, 4);
    return res.json(alternatives);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/exercises/:id/replace — swap exercise in session
router.put('/:id/replace', async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const { wgerId, name, muscleGroup, imageUrl, description } = req.body as {
    wgerId: number;
    name: string;
    muscleGroup: string;
    imageUrl: string | null;
    description: string;
  };

  try {
    const updated = await prisma.exerciseEntry.update({
      where: { id },
      data: {
        wgerId,
        name,
        muscleGroup,
        imageUrl,
        description,
        completed: false,
      },
    });

    await prisma.workoutSession.update({
      where: { id: updated.sessionId },
      data: { completed: false, completedAt: null },
    });

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
