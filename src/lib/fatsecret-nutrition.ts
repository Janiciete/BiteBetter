import type { NutritionEstimate } from "@/types/recipe";

const CACHE_KEY = "bitebetter_fatsecret_cache";

interface CacheEntry {
  nutritionEstimate: NutritionEstimate;
  description: string;
  foodId: string;
  isPer100g: boolean;
  cachedAt: string;
}

type FatSecretCache = Record<string, CacheEntry>;

function normalizeKey(name: string): string {
  return name.toLowerCase().trim();
}

function readCache(): FatSecretCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as FatSecretCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: FatSecretCache): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage may be full; ignore
  }
}

// ─── Public API ───────────────────────────────��────────────────────────────

export async function searchFatSecretFood(
  query: string
): Promise<{ foodId: string; foodName: string; foodDescription?: string; brandName?: string }[] | null> {
  try {
    const res = await fetch("/api/nutrition/fatsecret/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json() as
      | { success: true; foods: { foodId: string; foodName: string; foodDescription?: string; brandName?: string }[] }
      | { success: false; reason: string };
    return data.success ? data.foods : null;
  } catch {
    return null;
  }
}

export async function getFatSecretNutrition(
  foodId: string
): Promise<{
  nutritionEstimate: NutritionEstimate;
  description: string;
  foodId: string;
  isPer100g: boolean;
} | null> {
  try {
    const res = await fetch("/api/nutrition/fatsecret/food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodId }),
    });
    if (!res.ok) return null;
    const data = await res.json() as
      | { success: true; nutritionEstimate: NutritionEstimate; description: string; foodId: string; isPer100g: boolean }
      | { success: false; reason: string };
    return data.success ? data : null;
  } catch {
    return null;
  }
}

export async function getBestFatSecretNutritionForIngredient(
  ingredientName: string
): Promise<CacheEntry | null> {
  const key = normalizeKey(ingredientName);

  const cache = readCache();
  if (cache[key]) return cache[key];

  const foods = await searchFatSecretFood(ingredientName);
  if (!foods || foods.length === 0) return null;

  const details = await getFatSecretNutrition(foods[0].foodId);
  if (!details) return null;

  const entry: CacheEntry = {
    nutritionEstimate: details.nutritionEstimate,
    description: details.description,
    foodId: details.foodId,
    isPer100g: details.isPer100g,
    cachedAt: new Date().toISOString(),
  };

  const updated = readCache();
  updated[key] = entry;
  writeCache(updated);

  return entry;
}
