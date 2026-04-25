import type { TransformedRecipe, NutritionEstimate, ParsedIngredient } from "@/types/recipe";
import { getBestUSDANutritionForIngredient } from "@/lib/usda-nutrition";

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
  if (ing.amount && !ing.unit) return ing.amount * 80; // count-based (egg, onion…)
  return 100;
}

// Strip leading quantity/unit from a raw ingredient string to extract the food name.
// e.g. "300g penne pasta" → "penne pasta"
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

async function computeNutrition(
  ingredients: ParsedIngredient[],
  nutritionMap: Map<string, NutritionEstimate>,
  servings: number
): Promise<{ estimate: NutritionEstimate; matched: number }> {
  let cal = 0, pro = 0, car = 0, fat = 0, fib = 0, sod = 0, sug = 0;
  let matched = 0;

  for (const ing of ingredients) {
    const data = nutritionMap.get(ing.item.toLowerCase().trim());
    if (!data) continue;
    matched++;
    const grams = estimateGrams(ing);
    const f = grams / 100;
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

export async function enhanceRecipeNutritionWithUSDA(
  recipe: TransformedRecipe
): Promise<{ recipe: TransformedRecipe; usedUSDA: boolean }> {
  const fallback = { recipe, usedUSDA: false };

  try {
    // Build the full set of item names to look up:
    //   • all original ingredient items (for beforeNutrition)
    //   • extracted names from changed transformed strings (for afterNutrition)
    const lookupNames = new Set<string>();

    for (const ing of recipe.originalIngredients) {
      lookupNames.add(ing.item.toLowerCase().trim());
    }

    // Build the "after" ingredient list in ParsedIngredient shape
    const afterIngredients: ParsedIngredient[] = recipe.transformedIngredients.map((t, i) => {
      const orig = recipe.originalIngredients[i];
      if (!t.changed) return orig;
      const item = extractItemFromRaw(t.transformed);
      lookupNames.add(item);
      return { ...orig, item };
    });

    // Fetch all USDA entries in parallel
    const names = Array.from(lookupNames);
    const entries = await Promise.allSettled(
      names.map((name) =>
        getBestUSDANutritionForIngredient(name).then((data) => ({ name, data }))
      )
    );

    // Build a map: item name → NutritionEstimate per 100g
    const nutritionMap = new Map<string, NutritionEstimate>();
    for (const result of entries) {
      if (result.status === "fulfilled" && result.value.data) {
        nutritionMap.set(result.value.name, result.value.data.nutritionPer100g);
      }
    }

    // Need at least 2 ingredient matches to trust the result
    const previewMatchCount = recipe.originalIngredients.filter((ing) =>
      nutritionMap.has(ing.item.toLowerCase().trim())
    ).length;
    if (previewMatchCount < 2) return fallback;

    const { estimate: beforeNutrition } = await computeNutrition(
      recipe.originalIngredients,
      nutritionMap,
      recipe.servings
    );

    const { estimate: afterNutrition } = await computeNutrition(
      afterIngredients,
      nutritionMap,
      recipe.servings
    );

    return {
      recipe: { ...recipe, beforeNutrition, afterNutrition },
      usedUSDA: true,
    };
  } catch {
    return fallback;
  }
}
