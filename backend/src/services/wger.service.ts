import axios, { AxiosResponse } from 'axios';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 86400 }); // 24h TTL

export function clearExerciseCache(): void {
  cache.flushAll();
}

const WGER_BASE = 'https://wger.de/api/v2';

export interface WgerExercise {
  id: number;
  name: string;
  description: string;
  category: number;
  muscles: number[];
  muscles_secondary: number[];
  equipment: number[];
  imageUrl: string | null;
}

interface WgerTranslation {
  name: string;
  description: string;
  language: number;
}

interface WgerImage {
  image: string;
  is_main: boolean;
}

interface WgerMuscle {
  id: number;
}

interface WgerCategory {
  id: number;
}

interface WgerExerciseInfo {
  id: number;
  translations: WgerTranslation[];
  category: WgerCategory;
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: WgerMuscle[];
  images: WgerImage[];
}

interface WgerListResponse {
  count: number;
  next: string | null;
  results: WgerExerciseInfo[];
}

// Map muscle group names (from frontend) to wger exercise category IDs
export const MUSCLE_TO_CATEGORY: Record<string, number[]> = {
  petto: [11],
  schiena: [12],
  gambe: [9, 14, 15],
  spalle: [13],
  braccia: [8],
  addome: [10],
  'corpo intero': [8, 9, 10, 11, 12, 13, 14, 15],
};

export const PUSH_CATEGORIES = [11, 13, 8]; // chest, shoulders, arms
export const PULL_CATEGORIES = [12, 8]; // back, arms
export const LEGS_CATEGORIES = [9, 14, 15]; // legs, calves, glutes
export const UPPER_CATEGORIES = [11, 12, 13, 8]; // chest, back, shoulders, arms
export const LOWER_CATEGORIES = [9, 14, 15]; // legs, calves, glutes
export const FULLBODY_CATEGORIES = [11, 12, 13, 8, 9, 10, 14, 15];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const WGER_LANG_ITALIAN = 13; // Wger language ID for Italiano
const WGER_LANG_ENGLISH = 2;  // Wger language ID for English

function parseExerciseInfo(info: WgerExerciseInfo): WgerExercise | null {
  // Name: English (language 2) — most complete and consistent across exercises
  const enTranslation = info.translations.find(
    (t: WgerTranslation) => t.language === WGER_LANG_ENGLISH
  );
  if (!enTranslation || !enTranslation.name) return null;

  // Description: Italian preferred (language 13), fallback to English.
  // Require at least 60 chars to avoid placeholder entries (e.g. just the name repeated).
  const itTranslation = info.translations.find(
    (t: WgerTranslation) =>
      t.language === WGER_LANG_ITALIAN &&
      t.description?.trim().length > 60
  );
  const descriptionSource = itTranslation ?? enTranslation;

  const mainImage = info.images.find((img: WgerImage) => img.is_main);
  const anyImage = info.images[0] as WgerImage | undefined;

  return {
    id: info.id,
    name: enTranslation.name,
    description: descriptionSource.description
      ? stripHtml(descriptionSource.description)
      : '',
    category: info.category.id,
    muscles: info.muscles.map((m: WgerMuscle) => m.id),
    muscles_secondary: info.muscles_secondary.map((m: WgerMuscle) => m.id),
    equipment: info.equipment.map((e: WgerMuscle) => e.id),
    imageUrl: mainImage
      ? `https://wger.de${mainImage.image}`
      : anyImage
      ? `https://wger.de${anyImage.image}`
      : null,
  };
}

async function fetchCategoryExercises(categoryId: number, limit = 100): Promise<WgerExercise[]> {
  const catCacheKey = `exercises_cat_${categoryId}`;
  const catCached = cache.get<WgerExercise[]>(catCacheKey);
  if (catCached) return catCached;

  const catExercises: WgerExercise[] = [];
  let nextUrl: string | null =
    `${WGER_BASE}/exerciseinfo/?format=json&language=2&category=${categoryId}&limit=100`;

  while (nextUrl && catExercises.length < limit) {
    try {
      const response: AxiosResponse<WgerListResponse> = await axios.get<WgerListResponse>(nextUrl, {
        timeout: 10000,
        headers: { Accept: 'application/json' },
      });

      for (const info of response.data.results) {
        const parsed = parseExerciseInfo(info);
        if (parsed) catExercises.push(parsed);
      }

      nextUrl = response.data.next;
    } catch (err) {
      console.error(`Failed to fetch exercises for category ${categoryId}:`, err);
      break;
    }
  }

  cache.set(catCacheKey, catExercises);
  return catExercises;
}

async function fetchExercisesFromWger(categoryIds: number[], limit = 100): Promise<WgerExercise[]> {
  const cacheKey = `exercises_cat_${[...categoryIds].sort().join('_')}`;
  const cached = cache.get<WgerExercise[]>(cacheKey);
  if (cached) return cached;

  const allExercises: WgerExercise[] = [];

  for (const categoryId of categoryIds) {
    const catExercises = await fetchCategoryExercises(categoryId, limit);
    allExercises.push(...catExercises);
  }

  // Deduplicate by id
  const unique = Array.from(
    new Map(allExercises.map((e) => [e.id, e])).values()
  );

  cache.set(cacheKey, unique);
  return unique;
}

export async function getExercisesForCategories(
  categoryIds: number[],
  targetMuscles?: string[]
): Promise<WgerExercise[]> {
  let exercises = await fetchExercisesFromWger(categoryIds);

  if (targetMuscles && targetMuscles.length > 0) {
    const requestedCategories = new Set<number>();
    for (const muscle of targetMuscles) {
      const cats = MUSCLE_TO_CATEGORY[muscle.toLowerCase()] ?? [];
      cats.forEach((c) => requestedCategories.add(c));
    }
    if (requestedCategories.size > 0) {
      exercises = exercises.filter((e) => requestedCategories.has(e.category));
    }
  }

  return exercises;
}

export async function getExerciseById(id: number): Promise<WgerExercise | null> {
  const cacheKey = `exercise_${id}`;
  const cached = cache.get<WgerExercise>(cacheKey);
  if (cached) return cached;

  try {
    const response: AxiosResponse<WgerExerciseInfo> = await axios.get<WgerExerciseInfo>(
      `${WGER_BASE}/exerciseinfo/${id}/?format=json`,
      { timeout: 10000, headers: { Accept: 'application/json' } }
    );

    const exercise = parseExerciseInfo(response.data);
    if (!exercise) return null;

    cache.set(cacheKey, exercise);
    return exercise;
  } catch {
    return null;
  }
}

export async function getAlternativeExercises(
  categoryId: number,
  excludeId: number,
  count = 3
): Promise<WgerExercise[]> {
  const exercises = await fetchExercisesFromWger([categoryId]);
  const alternatives = exercises.filter((e) => e.id !== excludeId);
  const shuffled = alternatives.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
