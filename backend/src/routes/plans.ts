import { Router, Request, Response } from 'express';
import prisma from '../prisma/client';
import { generatePlan } from '../services/planGenerator';

type PlanRow = { targetMuscles: string; [key: string]: unknown };
function parsePlan<T extends PlanRow>(plan: T) {
  return { ...plan, targetMuscles: JSON.parse(plan.targetMuscles) as string[] };
}

const router = Router();

// POST /api/plans — generate a new plan
router.post('/', async (req: Request, res: Response) => {
  const { daysPerWeek, targetMuscles } = req.body as {
    daysPerWeek: number;
    targetMuscles: string[];
  };

  if (!daysPerWeek || daysPerWeek < 1 || daysPerWeek > 7) {
    return res.status(400).json({ error: 'daysPerWeek must be between 1 and 7' });
  }
  if (!Array.isArray(targetMuscles) || targetMuscles.length === 0) {
    return res.status(400).json({ error: 'targetMuscles must be a non-empty array' });
  }

  try {
    const sessions = await generatePlan(daysPerWeek, targetMuscles);

    const plan = await prisma.workoutPlan.create({
      data: {
        daysPerWeek,
        targetMuscles: JSON.stringify(targetMuscles),
        sessions: {
          create: sessions.map((s) => ({
            dayLabel: s.dayLabel,
            dayIndex: s.dayIndex,
            exercises: {
              create: s.exercises.map((e, idx) => ({
                wgerId: e.wgerId,
                name: e.name,
                muscleGroup: e.muscleGroup,
                sets: e.sets,
                reps: e.reps,
                imageUrl: e.imageUrl,
                description: e.description,
                order: idx,
              })),
            },
          })),
        },
      },
      include: {
        sessions: {
          include: { exercises: { orderBy: { order: 'asc' } } },
          orderBy: { dayIndex: 'asc' },
        },
      },
    });

    return res.status(201).json(parsePlan(plan));
  } catch (err) {
    console.error('Plan generation error:', err);
    return res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// GET /api/plans/latest — get most recent plan
router.get('/latest', async (_req: Request, res: Response) => {
  try {
    const plan = await prisma.workoutPlan.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          include: { exercises: { orderBy: { order: 'asc' } } },
          orderBy: { dayIndex: 'asc' },
        },
      },
    });

    if (!plan) return res.status(404).json({ error: 'No plan found' });
    return res.json(parsePlan(plan));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/plans/:id — get specific plan
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const plan = await prisma.workoutPlan.findUnique({
      where: { id: req.params['id'] as string },
      include: {
        sessions: {
          include: { exercises: { orderBy: { order: 'asc' } } },
          orderBy: { dayIndex: 'asc' },
        },
      },
    });

    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    return res.json(parsePlan(plan));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
