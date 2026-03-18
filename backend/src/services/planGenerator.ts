import {
  WgerExercise,
  getExercisesForCategories,
  MUSCLE_TO_CATEGORY,
  PUSH_CATEGORIES,
  PULL_CATEGORIES,
  LEGS_CATEGORIES,
  UPPER_CATEGORIES,
  LOWER_CATEGORIES,
  FULLBODY_CATEGORIES,
} from './wger.service';

export interface SessionTemplate {
  dayLabel: string;
  categoryIds: number[];
  muscleGroupLabel: string;
}

export interface GeneratedExercise {
  wgerId: number;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  imageUrl: string | null;
  description: string;
}

export interface GeneratedSession {
  dayLabel: string;
  dayIndex: number;
  muscleGroupLabel: string;
  exercises: GeneratedExercise[];
}

const DAYS_OF_WEEK = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

function getSplitTemplates(daysPerWeek: number): SessionTemplate[] {
  switch (daysPerWeek) {
    case 1:
      return [{ dayLabel: 'Full Body', categoryIds: FULLBODY_CATEGORIES, muscleGroupLabel: 'full body' }];
    case 2:
      return [
        { dayLabel: 'Full Body A', categoryIds: FULLBODY_CATEGORIES, muscleGroupLabel: 'full body' },
        { dayLabel: 'Full Body B', categoryIds: FULLBODY_CATEGORIES, muscleGroupLabel: 'full body' },
      ];
    case 3:
      return [
        { dayLabel: 'Push', categoryIds: PUSH_CATEGORIES, muscleGroupLabel: 'petto, spalle, tricipiti' },
        { dayLabel: 'Pull', categoryIds: PULL_CATEGORIES, muscleGroupLabel: 'schiena, bicipiti' },
        { dayLabel: 'Legs', categoryIds: LEGS_CATEGORIES, muscleGroupLabel: 'gambe, glutei, polpacci' },
      ];
    case 4:
      return [
        { dayLabel: 'Upper A', categoryIds: UPPER_CATEGORIES, muscleGroupLabel: 'parte superiore' },
        { dayLabel: 'Lower A', categoryIds: LOWER_CATEGORIES, muscleGroupLabel: 'parte inferiore' },
        { dayLabel: 'Upper B', categoryIds: UPPER_CATEGORIES, muscleGroupLabel: 'parte superiore' },
        { dayLabel: 'Lower B', categoryIds: LOWER_CATEGORIES, muscleGroupLabel: 'parte inferiore' },
      ];
    case 5:
      return [
        { dayLabel: 'Push', categoryIds: PUSH_CATEGORIES, muscleGroupLabel: 'petto, spalle, tricipiti' },
        { dayLabel: 'Pull', categoryIds: PULL_CATEGORIES, muscleGroupLabel: 'schiena, bicipiti' },
        { dayLabel: 'Legs', categoryIds: LEGS_CATEGORIES, muscleGroupLabel: 'gambe, glutei, polpacci' },
        { dayLabel: 'Upper', categoryIds: UPPER_CATEGORIES, muscleGroupLabel: 'parte superiore' },
        { dayLabel: 'Lower', categoryIds: LOWER_CATEGORIES, muscleGroupLabel: 'parte inferiore' },
      ];
    case 6:
      return [
        { dayLabel: 'Push A', categoryIds: PUSH_CATEGORIES, muscleGroupLabel: 'petto, spalle, tricipiti' },
        { dayLabel: 'Pull A', categoryIds: PULL_CATEGORIES, muscleGroupLabel: 'schiena, bicipiti' },
        { dayLabel: 'Legs A', categoryIds: LEGS_CATEGORIES, muscleGroupLabel: 'gambe, glutei, polpacci' },
        { dayLabel: 'Push B', categoryIds: PUSH_CATEGORIES, muscleGroupLabel: 'petto, spalle, tricipiti' },
        { dayLabel: 'Pull B', categoryIds: PULL_CATEGORIES, muscleGroupLabel: 'schiena, bicipiti' },
        { dayLabel: 'Legs B', categoryIds: LEGS_CATEGORIES, muscleGroupLabel: 'gambe, glutei, polpacci' },
      ];
    case 7:
    default:
      return [
        { dayLabel: 'Push A', categoryIds: PUSH_CATEGORIES, muscleGroupLabel: 'petto, spalle, tricipiti' },
        { dayLabel: 'Pull A', categoryIds: PULL_CATEGORIES, muscleGroupLabel: 'schiena, bicipiti' },
        { dayLabel: 'Legs A', categoryIds: LEGS_CATEGORIES, muscleGroupLabel: 'gambe, glutei, polpacci' },
        { dayLabel: 'Push B', categoryIds: PUSH_CATEGORIES, muscleGroupLabel: 'petto, spalle, tricipiti' },
        { dayLabel: 'Pull B', categoryIds: PULL_CATEGORIES, muscleGroupLabel: 'schiena, bicipiti' },
        { dayLabel: 'Legs B', categoryIds: LEGS_CATEGORIES, muscleGroupLabel: 'gambe, glutei, polpacci' },
        { dayLabel: 'Active Recovery', categoryIds: [10], muscleGroupLabel: 'core, mobilità' },
      ];
  }
}

function getSetsAndReps(categoryId: number): { sets: number; reps: string } {
  // Compound movements (chest, back, legs)
  if ([11, 12, 9, 15].includes(categoryId)) {
    return { sets: 4, reps: '6-8' };
  }
  // Isolation (arms, shoulders, calves, abs)
  return { sets: 3, reps: '10-15' };
}

function pickExercises(
  exercises: WgerExercise[],
  count: number,
  existingIds: Set<number>
): WgerExercise[] {
  const eligible = exercises.filter((e) => !existingIds.has(e.id));
  // Prefer exercises with images
  const withImage = eligible.filter((e) => e.imageUrl);
  const pool = withImage.length >= count ? withImage : eligible;
  // Shuffle for variety
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getCategoryLabel(categoryId: number): string {
  const labels: Record<number, string> = {
    8: 'braccia',
    9: 'gambe',
    10: 'addome',
    11: 'petto',
    12: 'schiena',
    13: 'spalle',
    14: 'polpacci',
    15: 'glutei',
  };
  return labels[categoryId] ?? 'esercizio';
}

function getTargetCategories(targetMuscles: string[]): Set<number> {
  const cats = new Set<number>();
  for (const m of targetMuscles) {
    const mapped = MUSCLE_TO_CATEGORY[m.toLowerCase()] ?? [];
    mapped.forEach((c) => cats.add(c));
  }
  return cats;
}

export async function generatePlan(
  daysPerWeek: number,
  targetMuscles: string[]
): Promise<GeneratedSession[]> {
  const templates = getSplitTemplates(Math.min(daysPerWeek, 7));
  const targetCats = getTargetCategories(targetMuscles);

  const sessions: GeneratedSession[] = [];

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];

    // Intersect template categories with target muscles (if any target given)
    let effectiveCats = template.categoryIds;
    if (targetCats.size > 0) {
      const intersection = template.categoryIds.filter((c) => targetCats.has(c));
      if (intersection.length > 0) {
        effectiveCats = intersection;
      }
      // If no intersection (e.g. user only wants chest but it's a Legs day), keep full template
    }

    // Fetch exercises for this session
    const allExercises = await getExercisesForCategories(effectiveCats);

    // Group exercises by category
    const byCat = new Map<number, WgerExercise[]>();
    for (const ex of allExercises) {
      const arr = byCat.get(ex.category) ?? [];
      arr.push(ex);
      byCat.set(ex.category, arr);
    }

    const usedIds = new Set<number>();
    const sessionExercises: GeneratedExercise[] = [];

    // Distribute 5-6 exercises across categories
    const targetCount = effectiveCats.length > 2 ? 6 : 5;
    const perCat = Math.ceil(targetCount / effectiveCats.length);

    for (const catId of effectiveCats) {
      const pool = byCat.get(catId) ?? [];
      const picked = pickExercises(pool, perCat, usedIds);

      for (const ex of picked) {
        usedIds.add(ex.id);
        const { sets, reps } = getSetsAndReps(catId);
        sessionExercises.push({
          wgerId: ex.id,
          name: ex.name,
          muscleGroup: getCategoryLabel(catId),
          sets,
          reps,
          imageUrl: ex.imageUrl,
          description: ex.description,
        });
      }

      if (sessionExercises.length >= targetCount) break;
    }

    // Fallback: if we got no exercises, use full body
    if (sessionExercises.length === 0) {
      const fallback = await getExercisesForCategories(FULLBODY_CATEGORIES);
      const picked = pickExercises(fallback, 5, new Set());
      for (const ex of picked) {
        const { sets, reps } = getSetsAndReps(ex.category);
        sessionExercises.push({
          wgerId: ex.id,
          name: ex.name,
          muscleGroup: getCategoryLabel(ex.category),
          sets,
          reps,
          imageUrl: ex.imageUrl,
          description: ex.description,
        });
      }
    }

    sessions.push({
      dayLabel: `${DAYS_OF_WEEK[i] ?? `Giorno ${i + 1}`} — ${template.dayLabel}`,
      dayIndex: i,
      muscleGroupLabel: template.muscleGroupLabel,
      exercises: sessionExercises,
    });
  }

  return sessions;
}
