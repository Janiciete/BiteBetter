import nutritionData from "@/data/nutrition-rules.json";
import type { ParsedIngredient, ParsedRecipe, NutritionEstimate, TransformedIngredient, TransformedRecipe } from "@/types/recipe";
import type { UserProfile } from "@/types/profile";
import { generateWarnings, disclaimerRequired } from "./safety";
import { estimateGroceryCost } from "./grocery-prices";
import { calculateScores } from "./scoring";

// ─── Nutrition lookup ──────────────────────────────────────────────────────

interface NutritionEntry {
  id: string;
  keywords: string[];
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  added_sugar_g: number;
}

function findNutritionEntry(item: string): NutritionEntry | null {
  const lower = item.toLowerCase();
  let best: NutritionEntry | null = null;
  let bestLen = 0;
  for (const entry of nutritionData as NutritionEntry[]) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw.toLowerCase()) && kw.length > bestLen) {
        best = entry;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

// ─── Amount → grams estimation ─────────────────────────────────────────────

const UNIT_GRAMS: Record<string, number> = {
  cup: 240, tbsp: 15, tsp: 5,
  oz: 28, lb: 454, g: 1, kg: 1000,
  ml: 1, l: 1000,
  clove: 5, slice: 25, piece: 100, can: 400,
  stalk: 40, sprig: 5, bunch: 80, head: 400,
};

function estimateGrams(ing: ParsedIngredient): number {
  if (ing.amount && ing.unit) {
    const unitKey = ing.unit.toLowerCase().replace(/s$/, "");
    const mult = UNIT_GRAMS[unitKey] ?? UNIT_GRAMS[ing.unit.toLowerCase()] ?? 100;
    return ing.amount * mult;
  }
  if (ing.amount && !ing.unit) {
    // Count-based: egg, onion, clove, etc.
    return ing.amount * 80;
  }
  return 100; // default
}

function estimateNutrition(
  ingredients: ParsedIngredient[],
  servings: number
): NutritionEstimate {
  let cal = 0, pro = 0, car = 0, fat = 0, fib = 0, sod = 0, sug = 0;

  for (const ing of ingredients) {
    const entry = findNutritionEntry(ing.item);
    if (!entry) continue;
    const grams = estimateGrams(ing);
    const f = grams / 100;
    cal += entry.calories_per_100g * f;
    pro += entry.protein_g * f;
    car += entry.carbs_g * f;
    fat += entry.fat_g * f;
    fib += entry.fiber_g * f;
    sod += entry.sodium_mg * f;
    sug += entry.added_sugar_g * f;
  }

  const s = Math.max(servings, 1);
  return {
    calories: Math.round(cal / s),
    protein_g: Math.round((pro / s) * 10) / 10,
    carbs_g: Math.round((car / s) * 10) / 10,
    fat_g: Math.round((fat / s) * 10) / 10,
    fiber_g: Math.round((fib / s) * 10) / 10,
    sodium_mg: Math.round(sod / s),
    added_sugar_g: Math.round((sug / s) * 10) / 10,
  };
}

// ─── Substitution rules ────────────────────────────────────────────────────

interface SubRule {
  triggers: string[];           // keywords in ingredient item
  condition: (p: UserProfile) => boolean;
  substitute: string;           // replacement item name
  reason: string;
  priority: number;             // higher = applied first
}

function isVegOrVegan(p: UserProfile): boolean {
  return (
    p.dietaryPreferences.includes("vegetarian") ||
    p.dietaryPreferences.includes("vegan")
  );
}
function isDairyFree(p: UserProfile): boolean {
  return p.dietaryPreferences.includes("dairy_free") || p.allergies.includes("dairy");
}
function isGlutenFree(p: UserProfile): boolean {
  return p.dietaryPreferences.includes("gluten_free") || p.allergies.includes("wheat");
}
function hasGoal(p: UserProfile, ...goals: string[]): boolean {
  return goals.some((g) => p.nutritionGoals.includes(g as never));
}
function hasCondition(p: UserProfile, ...conds: string[]): boolean {
  return conds.some((c) => p.healthConditions.includes(c as never));
}

const SUB_RULES: SubRule[] = [
  // ── Vegan / Vegetarian (priority 100) ─────────────────────────────────
  {
    triggers: ["chicken breast", "boneless chicken", "grilled chicken"],
    condition: isVegOrVegan,
    substitute: "firm tofu",
    reason: "Replaced chicken with tofu (plant-based)",
    priority: 100,
  },
  {
    triggers: ["chicken thigh", "chicken thighs", "chicken leg"],
    condition: isVegOrVegan,
    substitute: "firm tofu",
    reason: "Replaced chicken with tofu (plant-based)",
    priority: 100,
  },
  {
    triggers: ["chicken"],
    condition: isVegOrVegan,
    substitute: "firm tofu",
    reason: "Replaced chicken with tofu (plant-based)",
    priority: 95,
  },
  {
    triggers: ["ground beef", "beef mince", "minced beef"],
    condition: isVegOrVegan,
    substitute: "lentils",
    reason: "Replaced beef with lentils (plant-based, high fiber)",
    priority: 100,
  },
  {
    triggers: ["beef"],
    condition: isVegOrVegan,
    substitute: "lentils",
    reason: "Replaced beef with lentils (plant-based)",
    priority: 95,
  },
  {
    triggers: ["pork", "bacon", "ham", "prosciutto", "pancetta"],
    condition: isVegOrVegan,
    substitute: "mushrooms",
    reason: "Replaced pork/bacon with mushrooms (plant-based, umami flavour)",
    priority: 100,
  },
  {
    triggers: ["sausage"],
    condition: isVegOrVegan,
    substitute: "plant-based sausage",
    reason: "Replaced sausage with plant-based alternative",
    priority: 100,
  },

  // ── Dairy-free (priority 90) ─────────────────────────────────────────
  {
    triggers: ["butter", "unsalted butter", "salted butter"],
    condition: isDairyFree,
    substitute: "vegan butter",
    reason: "Replaced dairy butter with vegan alternative",
    priority: 90,
  },
  {
    triggers: ["heavy cream", "double cream", "whipping cream", "heavy whipping cream"],
    condition: isDairyFree,
    substitute: "full-fat coconut milk",
    reason: "Replaced heavy cream with coconut milk (dairy-free, rich texture)",
    priority: 90,
  },
  {
    triggers: ["whole milk", "skim milk", "2% milk", "milk"],
    condition: isDairyFree,
    substitute: "oat milk",
    reason: "Replaced dairy milk with oat milk",
    priority: 90,
  },
  {
    triggers: ["greek yogurt", "greek yoghurt", "plain yogurt", "yogurt", "yoghurt"],
    condition: isDairyFree,
    substitute: "coconut yogurt",
    reason: "Replaced dairy yogurt with coconut yogurt",
    priority: 90,
  },
  {
    triggers: ["parmesan", "mozzarella", "cheddar", "feta", "brie", "cheese"],
    condition: isDairyFree,
    substitute: "dairy-free cheese",
    reason: "Replaced dairy cheese with dairy-free alternative",
    priority: 90,
  },

  // ── Gluten-free (priority 90) ────────────────────────────────────────
  {
    triggers: ["spaghetti", "fettuccine", "penne", "rigatoni", "linguine", "pasta"],
    condition: isGlutenFree,
    substitute: "gluten-free pasta",
    reason: "Replaced pasta with gluten-free pasta",
    priority: 92,
  },
  {
    triggers: ["bread"],
    condition: isGlutenFree,
    substitute: "gluten-free bread",
    reason: "Replaced bread with gluten-free bread",
    priority: 92,
  },
  {
    triggers: ["all-purpose flour", "plain flour", "wheat flour", "flour"],
    condition: isGlutenFree,
    substitute: "gluten-free flour blend",
    reason: "Replaced wheat flour with gluten-free blend",
    priority: 92,
  },
  {
    triggers: ["soy sauce", "dark soy sauce", "light soy sauce"],
    condition: isGlutenFree,
    substitute: "tamari (gluten-free soy sauce)",
    reason: "Replaced soy sauce with tamari (gluten-free)",
    priority: 92,
  },

  // ── Low sodium / High BP (priority 70) ──────────────────────────────
  {
    triggers: ["soy sauce", "dark soy sauce"],
    condition: (p) =>
      p.dietaryPreferences.includes("low_sodium") ||
      hasCondition(p, "high_blood_pressure") ||
      hasGoal(p, "heart_health"),
    substitute: "low-sodium soy sauce",
    reason: "Reduced sodium by switching to low-sodium soy sauce",
    priority: 70,
  },
  {
    triggers: ["fish sauce"],
    condition: (p) =>
      p.dietaryPreferences.includes("low_sodium") ||
      hasCondition(p, "high_blood_pressure"),
    substitute: "low-sodium fish sauce or lime juice",
    reason: "Reduced sodium by using a lower-sodium alternative",
    priority: 70,
  },

  // ── Heart health / Weight loss — butter swap (priority 60) ──────────
  {
    triggers: ["butter", "unsalted butter", "salted butter"],
    condition: (p) =>
      hasGoal(p, "weight_loss", "cutting", "heart_health") ||
      hasCondition(p, "heart_disease", "high_cholesterol"),
    substitute: "olive oil",
    reason: "Replaced saturated fat in butter with heart-healthy olive oil",
    priority: 60,
  },
  {
    triggers: ["heavy cream", "double cream", "whipping cream"],
    condition: (p) =>
      hasGoal(p, "weight_loss", "cutting") ||
      hasCondition(p, "heart_disease", "high_cholesterol"),
    substitute: "light evaporated milk",
    reason: "Reduced calories by replacing heavy cream with a lighter alternative",
    priority: 60,
  },

  // ── Blood sugar / Diabetes — lower-GI swaps (priority 55) ────────────
  {
    triggers: ["white rice", "jasmine rice"],
    condition: (p) =>
      hasGoal(p, "blood_sugar_balance", "weight_loss") ||
      hasCondition(p, "diabetes", "prediabetes"),
    substitute: "brown rice",
    reason: "Replaced white rice with lower-GI brown rice for better blood sugar control",
    priority: 55,
  },
  {
    triggers: ["spaghetti", "fettuccine", "penne", "rigatoni", "linguine", "pasta"],
    condition: (p) =>
      hasGoal(p, "blood_sugar_balance", "weight_loss") ||
      hasCondition(p, "diabetes", "prediabetes"),
    substitute: "whole wheat pasta",
    reason: "Replaced white pasta with higher-fiber whole wheat pasta",
    priority: 55,
  },

  // ── Elderly soft-food preference (priority 50) ────────────────────────
  {
    triggers: ["steak", "beef steak", "pork chop", "chicken breast"],
    condition: (p) =>
      p.elderlyConcerns.includes("chewing_difficulty") ||
      p.elderlyConcerns.includes("soft_foods"),
    substitute: "slow-cooked tender chicken or fish",
    reason: "Suggested a softer protein preparation for easier chewing",
    priority: 50,
  },
];

// Sort rules highest priority first so first-match wins correctly
const SORTED_RULES = [...SUB_RULES].sort((a, b) => b.priority - a.priority);

// ─── Apply substitutions ───────────────────────────────────────────────────

function substituteIngredient(raw: string, trigger: string, newItem: string): string {
  const idx = raw.toLowerCase().indexOf(trigger.toLowerCase());
  if (idx < 0) return raw;
  return (raw.slice(0, idx) + newItem + raw.slice(idx + trigger.length)).trim();
}

function applySubstitutions(
  ingredients: ParsedIngredient[],
  profile: UserProfile
): TransformedIngredient[] {
  return ingredients.map((ing) => {
    const itemLower = ing.item.toLowerCase();

    for (const rule of SORTED_RULES) {
      if (!rule.condition(profile)) continue;

      const matchedTrigger = rule.triggers
        .slice()
        .sort((a, b) => b.length - a.length) // longest trigger first
        .find((t) => itemLower.includes(t.toLowerCase()));

      if (!matchedTrigger) continue;

      const transformed = substituteIngredient(ing.raw, matchedTrigger, rule.substitute);
      return {
        original: ing.raw,
        transformed,
        changed: true,
        changeType: "substitution",
        reason: rule.reason,
      };
    }

    return { original: ing.raw, transformed: ing.raw, changed: false };
  });
}

// ─── Protein addition suggestion ──────────────────────────────────────────

function proteinAdditionSuggestion(
  before: NutritionEstimate,
  profile: UserProfile
): string | null {
  const wantsProtein =
    hasGoal(profile, "muscle_gain", "high_protein", "bulking") &&
    before.protein_g < 20;

  if (!wantsProtein) return null;

  if (isVegOrVegan(profile)) {
    return "Add ½ cup chickpeas or edamame to boost plant-based protein";
  }
  if (!profile.allergies.includes("eggs")) {
    return "Add an egg or ½ cup Greek yogurt as a side to boost protein";
  }
  return "Consider adding a lean protein source (fish, chicken, or tofu) to reach your muscle-gain goals";
}

// ─── Recipe name generator ─────────────────────────────────────────────────

function transformedRecipeName(original: string, profile: UserProfile): string {
  const prefixes: string[] = [];
  if (isVegOrVegan(profile)) prefixes.push("Plant-Based");
  else if (hasGoal(profile, "heart_health")) prefixes.push("Heart-Healthy");
  else if (hasGoal(profile, "weight_loss", "cutting")) prefixes.push("Lightened-Up");
  else if (hasGoal(profile, "muscle_gain", "bulking")) prefixes.push("High-Protein");
  else if (hasGoal(profile, "blood_sugar_balance")) prefixes.push("Blood-Sugar Friendly");
  else if (isGlutenFree(profile)) prefixes.push("Gluten-Free");

  return prefixes.length > 0 ? `${prefixes[0]} ${original}` : `Personalized ${original}`;
}

// ─── Key changes collector ─────────────────────────────────────────────────

function collectKeyChanges(
  changes: TransformedIngredient[],
  before: NutritionEstimate,
  after: NutritionEstimate,
  profile: UserProfile
): string[] {
  const items: string[] = [];

  // Substitution-based changes (deduped)
  const seenReasons = new Set<string>();
  for (const c of changes) {
    if (c.changed && c.reason && !seenReasons.has(c.reason)) {
      items.push(c.reason);
      seenReasons.add(c.reason);
    }
    if (items.length >= 3) break;
  }

  // Nutrition improvement notes
  if (after.sodium_mg < before.sodium_mg - 100) {
    items.push(
      `Sodium reduced by ~${Math.round(before.sodium_mg - after.sodium_mg)} mg per serving`
    );
  } else if (after.added_sugar_g < before.added_sugar_g - 2) {
    items.push(
      `Added sugar reduced by ~${Math.round(before.added_sugar_g - after.added_sugar_g)} g per serving`
    );
  } else if (after.protein_g > before.protein_g + 3) {
    items.push(`Protein increased by ~${Math.round(after.protein_g - before.protein_g)} g`);
  }

  // Protein suggestion
  const proteinTip = proteinAdditionSuggestion(before, profile);
  if (proteinTip && items.length < 4) items.push(proteinTip);

  // Elderly soft-food note
  if (
    profile.elderlyConcerns.includes("chewing_difficulty") ||
    profile.elderlyConcerns.includes("swallowing_difficulty")
  ) {
    items.push("Suggest cooking ingredients until very tender for easier chewing");
  }

  return items.slice(0, 4);
}

// ─── Explanation generator ─────────────────────────────────────────────────

function generateExplanation(
  profile: UserProfile,
  numChanges: number,
  before: NutritionEstimate,
  after: NutritionEstimate
): string {
  const goals = profile.nutritionGoals
    .slice(0, 2)
    .map((g) => g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" and ");

  const focusLabel = goals || "your health goals";

  let detail = "";
  if (after.sodium_mg < before.sodium_mg - 50) {
    detail += ` Sodium was reduced by about ${Math.round(before.sodium_mg - after.sodium_mg)} mg per serving.`;
  }
  if (after.calories < before.calories - 30) {
    detail += ` Estimated calories dropped by around ${Math.round(before.calories - after.calories)} kcal per serving.`;
  }
  if (after.protein_g > before.protein_g + 2) {
    detail += ` Protein was increased by ~${Math.round(after.protein_g - before.protein_g)} g.`;
  }

  const changeWord = numChanges === 1 ? "1 adjustment" : `${numChanges} adjustments`;

  return `Your recipe was personalized for ${focusLabel}. We made ${changeWord} to better align with your nutrition profile.${detail} All nutrition values shown are estimates and for reference only.`;
}

// ─── Main export ───────────────────────────────────────────────────────────

export function transformRecipe(
  _rawText: string,
  parsed: ParsedRecipe,
  profile: UserProfile
): TransformedRecipe {
  // 1. Apply substitutions
  const transformedIngredients = applySubstitutions(parsed.ingredients, profile);

  // 2. Build "after" ingredient list for nutrition estimation
  const afterIngredients: ParsedIngredient[] = transformedIngredients.map((t, i) => {
    if (!t.changed) return parsed.ingredients[i];
    // Re-parse the transformed string to get item name
    const raw = t.transformed;
    const itemMatch = raw.match(
      /(?:\d+(?:\.\d+)?\s*)?(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|lbs?|grams?|g|kgs?|ml|l)?\s*(.*)/i
    );
    return {
      ...parsed.ingredients[i],
      item: (itemMatch?.[1] ?? raw).replace(/,.*$/, "").trim().toLowerCase(),
    };
  });

  // 3. Nutrition estimates
  const beforeNutrition = estimateNutrition(parsed.ingredients, parsed.servings);
  const afterNutrition = estimateNutrition(afterIngredients, parsed.servings);

  // 4. Safety warnings
  const warnings = generateWarnings(parsed.ingredients, profile);

  // 5. Grocery cost
  const { groceryItems, totalCost, costPerServing } = estimateGroceryCost(
    transformedIngredients,
    parsed.servings
  );

  // 6. Scores
  const numChanges = transformedIngredients.filter((t) => t.changed).length;
  const scores = calculateScores(
    profile,
    beforeNutrition,
    afterNutrition,
    numChanges,
    warnings.length,
    totalCost
  );

  // 7. Key changes & explanation
  const keyChanges = collectKeyChanges(
    transformedIngredients,
    beforeNutrition,
    afterNutrition,
    profile
  );
  const explanation = generateExplanation(
    profile,
    numChanges,
    beforeNutrition,
    afterNutrition
  );

  // 8. Disclaimer
  const needsDisclaimer = disclaimerRequired(profile, warnings);

  return {
    originalRecipeName: parsed.recipeName,
    transformedRecipeName: transformedRecipeName(parsed.recipeName, profile),
    servings: parsed.servings,
    originalIngredients: parsed.ingredients,
    transformedIngredients,
    instructions: parsed.instructions,
    keyChanges,
    warnings,
    explanation,
    beforeNutrition,
    afterNutrition,
    scores,
    groceryItems,
    estimatedCost: totalCost,
    costPerServing,
    disclaimerRequired: needsDisclaimer,
    missingInfoQuestions: parsed.missingInfoQuestions,
  };
}
