import type { TransformedRecipe, NutritionEstimate, ParsedIngredient } from "@/types/recipe";
import { getBestUSDANutritionForIngredient } from "@/lib/usda-nutrition";
import { getBestFatSecretNutritionForIngredient } from "@/lib/fatsecret-nutrition";

// Same unit→grams table used in recipe-transformer
const UNIT_GRAMS: Record<string, number> = {
  cup: 240, tbsp: 15, tsp: 5,
  oz: 28, lb: 454, g: 1, kg: 1000,
  ml: 1, l: 1000,
  clove: 5, slice: 25, piece: 100, can: 400,
  stalk: 40, sprig: 5, bunch: 80, head: 400,
};

function estimateGrams(ing: ParsedIngredient): number {
  if (ing.amount && ing.unit) {
    const key = ing.unit.toLowerCase().replace(/s$/, "");
    return ing.amount * (UNIT_GRAMS[key] ?? UNIT_GRAMS[ing.unit.toLowerCase()] ?? 100);
  }
  if (ing.amount && !ing.unit) return ing.amount * 80;
  return 100;
}

// Strip leading quantity/unit to extract a clean food name for API lookup.
function extractItemFromRaw(raw: string): string {
  return raw
    .replace(/^[\d\s/½¼¾⅓⅔⅛⅜⅝⅞.]+/, "")
    .replace(
      /^(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|lbs?|pounds?|grams?|g|kgs?|ml|l|cloves?|slices?|pieces?|cans?|stalks?|sprigs?|bunches?|heads?)\s+/i,
      ""
    )
    .replace(/,.*$/, "")
    .replace(/\(.*?\)/g, "")
    .trim()
    .toLowerCase();
}

function computeNutritionSync(
  ingredients: ParsedIngredient[],
  nutritionMap: Map<string, NutritionEstimate>,
  servings: number
): { estimate: NutritionEstimate; matched: number } {
  let cal = 0, pro = 0, car = 0, fat = 0, fib = 0, sod = 0, sug = 0;
  let matched = 0;

  for (const ing of ingredients) {
    const data = nutritionMap.get(ing.item.toLowerCase().trim());
    if (!data) continue;
    matched++;
    const f = estimateGrams(ing) / 100;
    cal += data.calories * f;
    pro += data.protein_g * f;
    car += data.carbs_g * f;
    fat += data.fat_g * f;
    fib += data.fiber_g * f;
    sod += data.sodium_mg * f;
    sug += data.added_sugar_g * f;
  }

  const s = Math.max(servings, 1);
  return {
    estimate: {
      calories: Math.round(cal / s),
      protein_g: Math.round((pro / s) * 10) / 10,
      carbs_g: Math.round((car / s) * 10) / 10,
      fat_g: Math.round((fat / s) * 10) / 10,
      fiber_g: Math.round((fib / s) * 10) / 10,
      sodium_mg: Math.round(sod / s),
      added_sugar_g: Math.round((sug / s) * 10) / 10,
    },
    matched,
  };
}

// Build the after-ingredient list from the transformed recipe.
function buildAfterIngredients(recipe: TransformedRecipe): {
  afterIngredients: ParsedIngredient[];
  extraNames: string[];
} {
  const extraNames: string[] = [];
  const afterIngredients: ParsedIngredient[] = recipe.transformedIngredients.map((t, i) => {
    const orig = recipe.originalIngredients[i];
    if (!t.changed) return orig;
    const item = extractItemFromRaw(t.transformed);
    extraNames.push(item);
    return { ...orig, item };
  });
  return { afterIngredients, extraNames };
}

// Attempt to build a nutrition map by fetching all unique ingredient names in parallel.
async function buildNutritionMap(
  names: string[],
  fetcher: (name: string) => Promise<{ nutritionPer100g?: NutritionEstimate; nutritionEstimate?: NutritionEstimate } | null>
): Promise<Map<string, NutritionEstimate>> {
  const results = await Promise.allSettled(
    names.map((name) => fetcher(name).then((data) => ({ name, data })))
  );
  const map = new Map<string, NutritionEstimate>();
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.data) {
      const nutrition = r.value.data.nutritionPer100g ?? r.value.data.nutritionEstimate;
      if (nutrition) map.set(r.value.name, nutrition);
    }
  }
  return map;
}

export async function enhanceRecipeNutritionWithUSDA(
  recipe: TransformedRecipe
): Promise<{ recipe: TransformedRecipe; nutritionSource: "usda" | "fatsecret" | "static" }> {
  const fallback = { recipe, nutritionSource: "static" as const };

  try {
    const { afterIngredients, extraNames } = buildAfterIngredients(recipe);

    const allNames = Array.from(
      new Set([
        ...recipe.originalIngredients.map((i) => i.item.toLowerCase().trim()),
        ...extraNames,
      ])
    );

    // ── Tier 1: USDA ───────────────────────────────────────��─────────────
    try {
      const usdaMap = await buildNutritionMap(allNames, getBestUSDANutritionForIngredient);

      const usdaMatchCount = recipe.originalIngredients.filter((ing) =>
        usdaMap.has(ing.item.toLowerCase().trim())
      ).length;

      if (usdaMatchCount >= 2) {
        const { estimate: beforeNutrition } = computeNutritionSync(
          recipe.originalIngredients, usdaMap, recipe.servings
        );
        const { estimate: afterNutrition } = computeNutritionSync(
          afterIngredients, usdaMap, recipe.servings
        );
        return {
          recipe: { ...recipe, beforeNutrition, afterNutrition },
          nutritionSource: "usda",
        };
      }
    } catch {
      // USDA failed — fall through to FatSecret
    }

    // ── Tier 2: FatSecret ─────────────────────────────────────────────────
    try {
      const fsMap = await buildNutritionMap(allNames, getBestFatSecretNutritionForIngredient);

      const fsMatchCount = recipe.originalIngredients.filter((ing) =>
        fsMap.has(ing.item.toLowerCase().trim())
      ).length;

      if (fsMatchCount >= 2) {
        const { estimate: beforeNutrition } = computeNutritionSync(
          recipe.originalIngredients, fsMap, recipe.servings
        );
        const { estimate: afterNutrition } = computeNutritionSync(
          afterIngredients, fsMap, recipe.servings
        );
        return {
          recipe: { ...recipe, beforeNutrition, afterNutrition },
          nutritionSource: "fatsecret",
        };
      }
    } catch {
      // FatSecret failed — fall through to static
    }

    return fallback;
  } catch {
    return fallback;
  }
}
