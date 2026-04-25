import type { NutritionEstimate } from "@/types/recipe";

const CACHE_KEY = "bitebetter_usda_cache";

interface CacheEntry {
  nutritionPer100g: NutritionEstimate;
  description: string;
  fdcId: number;
  cachedAt: string;
}

type USDACache = Record<string, CacheEntry>;

function normalizeKey(name: string): string {
  return name.toLowerCase().trim();
}

function readCache(): USDACache {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as USDACache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: USDACache): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage may be full; silently ignore
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function searchUSDAFood(query: string): Promise<
  { fdcId: number; description: string; dataType: string; brandOwner?: string }[] | null
> {
  try {
    const res = await fetch("/api/nutrition/usda/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json() as
      | { success: true; foods: { fdcId: number; description: string; dataType: string; brandOwner?: string }[] }
      | { success: false; reason: string };
    return data.success ? data.foods : null;
  } catch {
    return null;
  }
}

export async function getUSDANutrition(fdcId: number): Promise<{
  nutritionPer100g: NutritionEstimate;
  description: string;
  fdcId: number;
} | null> {
  try {
    const res = await fetch("/api/nutrition/usda/food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fdcId }),
    });
    if (!res.ok) return null;
    const data = await res.json() as
      | { success: true; nutritionPer100g: NutritionEstimate; description: string; fdcId: number }
      | { success: false; reason: string };
    return data.success ? data : null;
  } catch {
    return null;
  }
}

export async function getBestUSDANutritionForIngredient(
  ingredientName: string
): Promise<CacheEntry | null> {
  const key = normalizeKey(ingredientName);

  // Check cache first
  const cache = readCache();
  if (cache[key]) return cache[key];

  // Search USDA
  const foods = await searchUSDAFood(ingredientName);
  if (!foods || foods.length === 0) return null;

  const best = foods[0];

  // Fetch food details
  const details = await getUSDANutrition(best.fdcId);
  if (!details) return null;

  const entry: CacheEntry = {
    nutritionPer100g: details.nutritionPer100g,
    description: details.description,
    fdcId: details.fdcId,
    cachedAt: new Date().toISOString(),
  };

  // Write to cache
  const updatedCache = readCache();
  updatedCache[key] = entry;
  writeCache(updatedCache);

  return entry;
}
