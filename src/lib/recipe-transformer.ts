import nutritionData from "@/data/nutrition-rules.json";
import type { ParsedIngredient, ParsedRecipe, NutritionEstimate, TransformedIngredient, TransformedRecipe } from "@/types/recipe";
import type { UserProfile } from "@/types/profile";
import { generateWarnings, disclaimerRequired } from "./safety";
import { estimateGroceryCost } from "./grocery-prices";
import { calculateScores } from "./scoring";

/*
 * TEST EXPECTATION — Miso Glazed Salmon with general_healthy profile:
 *
 *   Expected transformed ingredients should include at least:
 *     - "low-sodium soy sauce"                    (sodium reduction)
 *     - miso paste diluted with water/rice vinegar (sodium reduction)
 *     - omit or minimize added salt               (sodium reduction)
 *     - reduced brown sugar or honey/maple syrup  (sugar reduction)
 *
 * TEST EXPECTATION — Fresh and Wild Mushroom Stew with dislikedFoods = "mushrooms":
 *
 *   Expected:
 *     - brown mushrooms → eggplant or zucchini
 *     - wild mushrooms  → zucchini and mixed vegetables
 *     - mushroom broth  → vegetable broth
 *     - transformedRecipeName should not contain "Mushroom"
 *     - keyChanges[0] explains the preference-based rebuild
 *     - info warning about the disliked-food conflict
 */

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
  if (ing.amount && !ing.unit) return ing.amount * 80;
  return 100;
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

// ─── Profile helpers ───────────────────────────────────────────────────────

interface SubRule {
  triggers: string[];
  condition: (p: UserProfile) => boolean;
  substitute: string;
  reason: string;
  priority: number;
  bakingUnsafe?: boolean;
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
function hasSoyAllergy(p: UserProfile): boolean {
  return p.allergies.includes("soy");
}
function hasSesameAllergy(p: UserProfile): boolean {
  return p.allergies.includes("sesame");
}
function hasLowSodiumConcern(p: UserProfile): boolean {
  return (
    p.dietaryPreferences.includes("low_sodium") ||
    hasCondition(p, "high_blood_pressure", "kidney_issues") ||
    hasGoal(p, "heart_health", "general_healthy")
  );
}
function hasSugarReductionGoal(p: UserProfile): boolean {
  return (
    p.dietaryPreferences.includes("low_sugar") ||
    hasGoal(p, "blood_sugar_balance", "weight_loss", "cutting", "general_healthy") ||
    hasCondition(p, "diabetes", "prediabetes")
  );
}

// ─── Disliked food handling ────────────────────────────────────────────────

// Canonical term → all ingredient aliases we should recognize.
// Keep "oyster" out of seafood to avoid false-matching "oyster mushrooms".
const DISLIKED_FOOD_ALIASES: Record<string, string[]> = {
  mushroom: [
    "mushroom", "mushrooms", "shiitake", "cremini", "portobello", "chanterelle",
    "oyster mushroom", "oyster mushrooms", "king trumpet", "wild mushroom",
    "wild mushrooms", "brown mushroom", "brown mushrooms", "button mushroom",
    "button mushrooms", "porcini", "morel", "enoki", "maitake",
  ],
  seafood: [
    "salmon", "tuna", "cod", "halibut", "tilapia", "shrimp", "prawn", "prawns",
    "fish", "seafood", "crab", "lobster", "scallop", "scallops", "clam", "clams",
    "oysters", "mahi", "trout", "anchovy", "anchovies", "sardine",
  ],
  egg: ["egg", "eggs", "egg yolk", "egg white", "large egg"],
  tofu: ["tofu", "silken tofu", "firm tofu", "extra firm tofu"],
  bean: [
    "black beans", "kidney beans", "pinto beans", "cannellini", "white beans",
    "navy beans", "chickpeas", "garbanzo", "baked beans",
  ],
  eggplant: ["eggplant", "aubergine"],
  onion: ["onion", "onions", "yellow onion", "red onion", "white onion", "shallot", "shallots"],
  garlic: ["garlic", "garlic cloves", "minced garlic"],
  cilantro: ["cilantro", "coriander leaf", "fresh coriander"],
};

export function parseDislikedFoods(text: string): string[] {
  if (!text || !text.trim()) return [];

  const cleaned = text.toLowerCase()
    .replace(/i (don'?t|do not|hate|dislike|can'?t stand|cannot stand|won'?t eat|avoid|really don'?t like|don'?t enjoy) (eating |the )?/g, "")
    .replace(/\b(and|or)\b/g, ",")
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const result = new Set<string>();

  for (const phrase of cleaned) {
    let matched = false;
    for (const [canonical, aliases] of Object.entries(DISLIKED_FOOD_ALIASES)) {
      if (aliases.some((alias) => phrase.includes(alias) || alias.includes(phrase))) {
        result.add(canonical);
        matched = true;
      }
    }
    if (!matched) result.add(phrase);
  }

  return Array.from(result);
}

// Returns true if a proposed substitute string itself contains a disliked food term.
// Used to prevent rules from suggesting a disliked ingredient as a replacement.
function substituteContainsDislikedFood(substitute: string, dislikedTerms: string[]): boolean {
  const subLower = substitute.toLowerCase();
  return dislikedTerms.some((term) => {
    if (subLower.includes(term)) return true;
    const aliases = DISLIKED_FOOD_ALIASES[term];
    return aliases ? aliases.some((a) => subLower.includes(a)) : false;
  });
}

// Returns the canonical disliked term that matches this ingredient, or null.
function ingredientMatchesDislikedFood(
  ing: ParsedIngredient,
  dislikedTerms: string[]
): string | null {
  const itemLower = ing.item.toLowerCase();
  const rawLower = ing.raw.toLowerCase();

  for (const term of dislikedTerms) {
    if (itemLower.includes(term) || rawLower.includes(term)) return term;
    const aliases = DISLIKED_FOOD_ALIASES[term];
    if (aliases) {
      // Sort longest-first so "oyster mushroom" beats "oyster" when checking mushrooms
      const sorted = [...aliases].sort((a, b) => b.length - a.length);
      for (const alias of sorted) {
        if (itemLower.includes(alias) || rawLower.includes(alias)) return term;
      }
    }
  }
  return null;
}

interface DislikedFoodAnalysis {
  matchingIndices: number[];
  isCenteredAround: boolean;    // ≥30% of ingredients or ≥2 matches for one term
  centeredAroundTerm: string | null;
  dislikedTerms: string[];
}

function analyzeDislikedFoodConflict(
  ingredients: ParsedIngredient[],
  recipeName: string,
  dislikedFoods: string
): DislikedFoodAnalysis {
  const dislikedTerms = parseDislikedFoods(dislikedFoods);
  if (dislikedTerms.length === 0) {
    return { matchingIndices: [], isCenteredAround: false, centeredAroundTerm: null, dislikedTerms: [] };
  }

  const matchingIndices: number[] = [];
  const termCounts: Record<string, number> = {};

  for (let i = 0; i < ingredients.length; i++) {
    const matched = ingredientMatchesDislikedFood(ingredients[i], dislikedTerms);
    if (matched) {
      matchingIndices.push(i);
      termCounts[matched] = (termCounts[matched] ?? 0) + 1;
    }
  }

  const matchRatio = ingredients.length > 0 ? matchingIndices.length / ingredients.length : 0;

  let topTerm: string | null = null;
  let topCount = 0;
  for (const [term, count] of Object.entries(termCounts)) {
    if (count > topCount) { topTerm = term; topCount = count; }
  }

  // Boost confidence if the recipe name itself contains a disliked food term
  const nameLower = recipeName.toLowerCase();
  for (const term of dislikedTerms) {
    const termAliases = [term, ...(DISLIKED_FOOD_ALIASES[term] ?? [])];
    if (termAliases.some((a) => nameLower.includes(a))) {
      if (!topTerm || topCount < 1) topTerm = term;
      topCount = Math.max(topCount, 2);
    }
  }

  const isCenteredAround = matchRatio >= 0.30 || topCount >= 2;

  return { matchingIndices, isCenteredAround, centeredAroundTerm: topTerm, dislikedTerms };
}

function getDislikedFoodSubstitute(
  ing: ParsedIngredient,
  dislikedTerm: string,
  profile: UserProfile
): { substitute: string; reason: string } {
  const isVeg = isVegOrVegan(profile);
  const noSoy = hasSoyAllergy(profile);
  const itemLower = ing.item.toLowerCase();
  const rawLower = ing.raw.toLowerCase();

  switch (dislikedTerm) {
    case "mushroom": {
      if (itemLower.includes("broth") || itemLower.includes("stock") ||
          rawLower.includes("broth") || rawLower.includes("stock")) {
        return {
          substitute: "vegetable broth",
          reason: "Replaced mushroom broth with vegetable broth (mushrooms disliked)",
        };
      }
      if (rawLower.includes("wild") || rawLower.includes("mixed") || rawLower.includes("assorted")) {
        return {
          substitute: "zucchini and mixed vegetables",
          reason: "Replaced wild mushrooms with zucchini and mixed vegetables (mushrooms disliked)",
        };
      }
      return {
        substitute: "eggplant or zucchini",
        reason: "Replaced mushrooms with eggplant or zucchini (mushrooms disliked)",
      };
    }

    case "seafood": {
      if (isVeg) {
        const sub = noSoy ? "white beans or chickpeas" : "firm tofu or chickpeas";
        return { substitute: sub, reason: `Replaced seafood with ${sub} (seafood disliked, plant-based preference)` };
      }
      return { substitute: "boneless chicken breast", reason: "Replaced seafood with chicken (seafood disliked)" };
    }

    case "egg": {
      if (isVeg) {
        return { substitute: "silken tofu scramble or chickpea flour mixture", reason: "Replaced eggs with a plant-based alternative (eggs disliked)" };
      }
      return { substitute: "chickpea flour mixture", reason: "Replaced eggs with chickpea flour mixture (eggs disliked)" };
    }

    case "tofu": {
      if (isVeg) {
        return { substitute: "white beans or lentils", reason: "Replaced tofu with white beans or lentils (tofu disliked)" };
      }
      return { substitute: "diced chicken or white beans", reason: "Replaced tofu with chicken or white beans (tofu disliked)" };
    }

    case "bean": {
      if (isVeg) {
        return { substitute: "lentils or extra vegetables", reason: "Replaced beans with lentils (beans disliked)" };
      }
      return { substitute: "diced chicken or lentils", reason: "Replaced beans with chicken or lentils (beans disliked)" };
    }

    case "eggplant": {
      return { substitute: "zucchini or bell pepper", reason: "Replaced eggplant with zucchini or bell pepper (eggplant disliked)" };
    }

    case "onion": {
      return { substitute: "celery or leek greens", reason: "Replaced onion with celery or leek greens (onion disliked)" };
    }

    case "garlic": {
      return { substitute: "fresh herbs (thyme, parsley, or chives)", reason: "Replaced garlic with fresh herbs (garlic disliked)" };
    }

    case "cilantro": {
      return { substitute: "fresh parsley or basil", reason: "Replaced cilantro with parsley or basil (cilantro disliked)" };
    }

    default: {
      return { substitute: "a suitable alternative", reason: `Replaced ${dislikedTerm} (listed as a disliked food)` };
    }
  }
}

function applyDislikedFoodSubstitutions(
  ingredients: ParsedIngredient[],
  analysis: DislikedFoodAnalysis,
  profile: UserProfile,
  prior: TransformedIngredient[]
): TransformedIngredient[] {
  if (analysis.matchingIndices.length === 0) return prior;

  return prior.map((t, i) => {
    if (t.changed) return t; // allergy rule already fired — don't override
    if (!analysis.matchingIndices.includes(i)) return t;

    const ing = ingredients[i];
    const matchedTerm = ingredientMatchesDislikedFood(ing, analysis.dislikedTerms);
    if (!matchedTerm) return t;

    const { substitute, reason } = getDislikedFoodSubstitute(ing, matchedTerm, profile);

    let transformed: string;
    if (ing.amount && ing.unit) {
      const amtStr = Number.isInteger(ing.amount) ? String(ing.amount) : formatAmount(ing.amount);
      transformed = `${amtStr} ${ing.unit} ${substitute}`;
    } else if (ing.amount && !ing.unit) {
      transformed = `${formatAmount(ing.amount)} ${substitute}`;
    } else {
      // Vague/no-amount ingredient: replace the disliked term in the raw text
      const allAliases = [...(DISLIKED_FOOD_ALIASES[matchedTerm] ?? [matchedTerm])]
        .sort((a, b) => b.length - a.length);
      let swapped = ing.raw;
      for (const alias of allAliases) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = new RegExp(escaped, "gi");
        if (rx.test(swapped)) {
          swapped = swapped.replace(rx, substitute);
          break;
        }
      }
      transformed = swapped !== ing.raw ? swapped : substitute;
    }

    return {
      original: ing.raw,
      transformed: transformed.trim(),
      changed: true,
      changeType: "substitution" as const,
      reason,
    };
  });
}

// Build a replacement recipe name when a disliked ingredient was the centrepiece.
function buildDislikedFoodRecipeName(
  original: string,
  centeredAroundTerm: string,
  profile: UserProfile
): string {
  const isVeg = isVegOrVegan(profile);
  const nameLower = original.toLowerCase();

  if (centeredAroundTerm === "mushroom") {
    if (nameLower.includes("stew") || nameLower.includes("ragout") || nameLower.includes("braise")) {
      return "Vegetable and White Bean Herb Stew";
    }
    if (nameLower.includes("soup")) return "Hearty Vegetable Soup";
    if (nameLower.includes("pasta") || nameLower.includes("risotto")) return "Herb Vegetable Pasta";
    if (nameLower.includes("burger") || nameLower.includes("patty")) return "Lentil and Veggie Burger";
    const stripped = original.replace(/\b(mushroom|mushrooms)\b/gi, "vegetable").replace(/\s+/g, " ").trim();
    return stripped || `Vegetable ${original}`;
  }

  if (centeredAroundTerm === "seafood") {
    const sub = isVeg ? "Chickpea" : "Chicken";
    return original.replace(/(salmon|tuna|fish|seafood|shrimp|prawn)s?/gi, sub).replace(/\s+/g, " ").trim();
  }

  const termSingular = centeredAroundTerm.replace(/s$/, "");
  const stripped = original
    .replace(new RegExp(`\\b${termSingular}s?\\b`, "gi"), "vegetable")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || `Personalized ${original}`;
}

// ─── Substitution rules ────────────────────────────────────────────────────

const SUB_RULES: SubRule[] = [
  // ── Allergy overrides — highest priority (105) ────────────────────────
  { triggers: ["miso paste", "miso"], condition: hasSoyAllergy, substitute: "coconut aminos mixed with garlic and a squeeze of lime juice (soy-free alternative)", reason: "Replaced miso paste with a soy-free alternative (coconut aminos + garlic + lime) due to soy allergy", priority: 105 },
  { triggers: ["soy sauce", "dark soy sauce", "light soy sauce"], condition: hasSoyAllergy, substitute: "coconut aminos", reason: "Replaced soy sauce with coconut aminos due to soy allergy", priority: 105 },
  { triggers: ["tofu", "firm tofu", "silken tofu", "extra firm tofu"], condition: hasSoyAllergy, substitute: "chickpea tofu (soy-free)", reason: "Replaced soy-based tofu with a soy-free protein alternative due to soy allergy", priority: 105 },
  { triggers: ["edamame"], condition: hasSoyAllergy, substitute: "shelled peas or fava beans", reason: "Replaced edamame with peas due to soy allergy", priority: 105 },
  { triggers: ["sesame oil", "toasted sesame oil"], condition: hasSesameAllergy, substitute: "avocado oil", reason: "Replaced sesame oil with avocado oil due to sesame allergy", priority: 105 },
  { triggers: ["sesame seeds", "sesame seed", "toasted sesame seeds"], condition: hasSesameAllergy, substitute: "chopped green onions (garnish only)", reason: "Removed sesame seeds due to sesame allergy; use extra green onions for garnish", priority: 105 },
  { triggers: ["tahini"], condition: hasSesameAllergy, substitute: "sunflower seed butter", reason: "Replaced tahini with sunflower seed butter due to sesame allergy", priority: 105 },
  { triggers: ["cashews", "cashew", "peanuts", "peanut", "pine nuts", "pine nut"], condition: (p) => p.allergies.includes("nuts"), substitute: "pumpkin seeds", reason: "Replaced nuts with pumpkin seeds due to nut allergy", priority: 102 },

  // ── Vegan / Vegetarian (priority 100) ─────────────────────────────────
  { triggers: ["chicken breast", "boneless chicken", "grilled chicken"], condition: isVegOrVegan, substitute: "firm tofu", reason: "Replaced chicken with tofu (plant-based)", priority: 100 },
  { triggers: ["chicken thigh", "chicken thighs", "chicken leg"], condition: isVegOrVegan, substitute: "firm tofu", reason: "Replaced chicken with tofu (plant-based)", priority: 100 },
  { triggers: ["chicken"], condition: isVegOrVegan, substitute: "firm tofu", reason: "Replaced chicken with tofu (plant-based)", priority: 95 },
  { triggers: ["ground beef", "beef mince", "minced beef"], condition: isVegOrVegan, substitute: "lentils", reason: "Replaced beef with lentils (plant-based, high fiber)", priority: 100 },
  { triggers: ["beef"], condition: isVegOrVegan, substitute: "lentils", reason: "Replaced beef with lentils (plant-based)", priority: 95 },
  // Pork → mushrooms (vegan), but priority 100 so a disliked-mushroom check can skip it
  { triggers: ["pork", "bacon", "ham", "prosciutto", "pancetta"], condition: isVegOrVegan, substitute: "mushrooms", reason: "Replaced pork/bacon with mushrooms (plant-based, umami flavour)", priority: 100 },
  // Fallback vegan pork sub when mushrooms are disliked (priority 99 < 100)
  { triggers: ["pork", "bacon", "ham", "prosciutto", "pancetta"], condition: isVegOrVegan, substitute: "jackfruit or eggplant (plant-based)", reason: "Replaced pork/bacon with jackfruit or eggplant (plant-based)", priority: 99 },
  { triggers: ["sausage"], condition: isVegOrVegan, substitute: "plant-based sausage", reason: "Replaced sausage with plant-based alternative", priority: 100 },

  // ── Dairy-free (priority 90) ─────────────────────────────────────────
  { triggers: ["butter", "unsalted butter", "salted butter"], condition: isDairyFree, substitute: "vegan butter", reason: "Replaced dairy butter with vegan alternative", priority: 90 },
  { triggers: ["heavy cream", "double cream", "whipping cream", "heavy whipping cream"], condition: isDairyFree, substitute: "full-fat coconut milk", reason: "Replaced heavy cream with coconut milk (dairy-free, rich texture)", priority: 90 },
  { triggers: ["whole milk", "skim milk", "2% milk", "milk"], condition: isDairyFree, substitute: "oat milk", reason: "Replaced dairy milk with oat milk", priority: 90 },
  { triggers: ["greek yogurt", "greek yoghurt", "plain yogurt", "yogurt", "yoghurt"], condition: isDairyFree, substitute: "coconut yogurt", reason: "Replaced dairy yogurt with coconut yogurt", priority: 90 },
  { triggers: ["parmesan", "mozzarella", "cheddar", "feta", "brie", "cream cheese", "cheese"], condition: isDairyFree, substitute: "dairy-free cheese alternative", reason: "Replaced dairy cheese with dairy-free alternative", priority: 90 },

  // ── Gluten-free (priority 92) ────────────────────────────────────────
  { triggers: ["spaghetti", "fettuccine", "penne", "rigatoni", "linguine", "pasta"], condition: isGlutenFree, substitute: "gluten-free pasta", reason: "Replaced pasta with gluten-free pasta", priority: 92 },
  { triggers: ["bread"], condition: isGlutenFree, substitute: "gluten-free bread", reason: "Replaced bread with gluten-free bread", priority: 92 },
  { triggers: ["all-purpose flour", "plain flour", "wheat flour", "flour"], condition: isGlutenFree, substitute: "gluten-free flour blend", reason: "Replaced wheat flour with gluten-free blend", priority: 92 },
  { triggers: ["soy sauce", "dark soy sauce", "light soy sauce"], condition: (p) => isGlutenFree(p) && !hasSoyAllergy(p), substitute: "tamari (gluten-free soy sauce)", reason: "Replaced soy sauce with tamari (gluten-free)", priority: 92 },

  // ── Low sodium / general healthy / heart / high BP / kidney (priority 70) ──
  { triggers: ["soy sauce", "dark soy sauce", "light soy sauce"], condition: (p) => !hasSoyAllergy(p) && !isGlutenFree(p) && hasLowSodiumConcern(p), substitute: "low-sodium soy sauce", reason: "Reduced sodium by switching to low-sodium soy sauce", priority: 70 },
  { triggers: ["fish sauce"], condition: (p) => p.dietaryPreferences.includes("low_sodium") || hasCondition(p, "high_blood_pressure"), substitute: "low-sodium fish sauce or a squeeze of lime juice", reason: "Reduced sodium by using a lower-sodium alternative", priority: 70 },
  { triggers: ["miso paste", "miso"], condition: (p) => !hasSoyAllergy(p) && hasLowSodiumConcern(p), substitute: "miso paste mixed with 1 tbsp water or rice vinegar (to reduce sodium intensity)", reason: "Reduced sodium intensity by diluting miso paste with water or rice vinegar", priority: 68 },

  // ── Heart health / weight loss — butter/cream swaps (priority 60) ─────
  { triggers: ["butter", "unsalted butter", "salted butter"], condition: (p) => hasGoal(p, "weight_loss", "cutting", "heart_health") || hasCondition(p, "heart_disease", "high_cholesterol"), substitute: "olive oil", reason: "Replaced saturated fat in butter with heart-healthy olive oil", priority: 60, bakingUnsafe: true },
  { triggers: ["heavy cream", "double cream", "whipping cream"], condition: (p) => hasGoal(p, "weight_loss", "cutting") || hasCondition(p, "heart_disease", "high_cholesterol"), substitute: "light evaporated milk", reason: "Reduced calories by replacing heavy cream with a lighter alternative", priority: 60, bakingUnsafe: true },

  // ── Blood sugar / Diabetes (priority 55) ─────────────────────────────
  { triggers: ["white rice", "jasmine rice"], condition: (p) => hasGoal(p, "blood_sugar_balance", "weight_loss") || hasCondition(p, "diabetes", "prediabetes"), substitute: "brown rice", reason: "Replaced white rice with lower-GI brown rice for better blood sugar control", priority: 55 },
  { triggers: ["spaghetti", "fettuccine", "penne", "rigatoni", "linguine", "pasta"], condition: (p) => hasGoal(p, "blood_sugar_balance", "weight_loss") || hasCondition(p, "diabetes", "prediabetes"), substitute: "whole wheat pasta", reason: "Replaced white pasta with higher-fiber whole wheat pasta", priority: 55 },

  // ── Elderly soft-food preference (priority 50) ────────────────────────
  { triggers: ["steak", "beef steak", "pork chop", "chicken breast"], condition: (p) => p.elderlyConcerns.includes("chewing_difficulty") || p.elderlyConcerns.includes("soft_foods"), substitute: "slow-cooked tender chicken or fish", reason: "Suggested a softer protein preparation for easier chewing", priority: 50 },
];

const SORTED_RULES = [...SUB_RULES].sort((a, b) => b.priority - a.priority);

// ─── Recipe category detection ─────────────────────────────────────────────

const BAKING_NAME_KEYWORDS = [
  "cake", "frosting", "brownie", "cookie", "cookies", "muffin", "muffins",
  "cupcake", "cupcakes", "pie", "tart", "pastry", "biscuit", "scone",
  "cobbler", "crumble", "dessert", "pudding", "cheesecake", "loaf",
  "sweet bread", "banana bread",
];

export function isDessertOrBakingRecipe(parsed: ParsedRecipe): boolean {
  const nameLower = parsed.recipeName.toLowerCase();
  if (BAKING_NAME_KEYWORDS.some((k) => nameLower.includes(k))) return true;

  const items = parsed.ingredients.map((i) => i.item.toLowerCase());
  const strongSignals = ["powdered sugar", "icing sugar", "confectioners", "baking powder", "baking soda", "vanilla extract", "cream cheese frosting"];
  if (items.some((it) => strongSignals.some((s) => it.includes(s)))) return true;

  const comboSignals = ["sugar", "flour", "vanilla", "baking powder", "baking soda"];
  const comboHits = comboSignals.filter((s) => items.some((it) => it.includes(s)));
  return comboHits.length >= 2;
}

export function isCakeOrFrostingIngredient(item: string): boolean {
  const lower = item.toLowerCase();
  return ["powdered sugar", "icing sugar", "confectioners", "cream cheese frosting", "frosting"].some((s) => lower.includes(s));
}

const SAVORY_NAME_KEYWORDS = [
  "salmon", "chicken", "beef", "pork", "steak", "fish", "shrimp", "prawn",
  "tuna", "cod", "tilapia", "halibut", "trout", "mahi",
  "soup", "stew", "curry", "stir fry", "stir-fry", "noodle",
  "taco", "burger", "casserole", "glaze", "marinade", "roast",
  "miso", "teriyaki", "satay", "pad thai", "mushroom",
];

export function isSavoryCookingRecipe(parsed: ParsedRecipe): boolean {
  if (isDessertOrBakingRecipe(parsed)) return false;
  const nameLower = parsed.recipeName.toLowerCase();
  if (SAVORY_NAME_KEYWORDS.some((k) => nameLower.includes(k))) return true;
  const items = parsed.ingredients.map((i) => i.item.toLowerCase());
  const savorySignals = ["soy sauce", "miso", "fish sauce", "oyster sauce", "garlic", "ginger", "broth", "stock", "sesame oil", "cumin", "paprika", "turmeric", "oregano", "thyme"];
  const hits = savorySignals.filter((s) => items.some((it) => it.includes(s)));
  return hits.length >= 2;
}

export function isSeafoodRecipe(parsed: ParsedRecipe): boolean {
  const name = parsed.recipeName.toLowerCase();
  const items = parsed.ingredients.map((i) => i.item.toLowerCase());
  const seafoodKeywords = ["salmon", "tuna", "cod", "halibut", "tilapia", "shrimp", "prawn", "fish", "seafood", "crab", "lobster", "scallop", "clam", "mahi", "trout"];
  return seafoodKeywords.some((k) => name.includes(k) || items.some((it) => it.includes(k)));
}

export function isSauceOrMarinadeHeavyRecipe(parsed: ParsedRecipe): boolean {
  const items = parsed.ingredients.map((i) => i.item.toLowerCase());
  const sauceSignals = ["soy sauce", "miso", "fish sauce", "oyster sauce", "teriyaki", "hoisin", "worcestershire", "hot sauce", "sriracha", "vinegar", "marinade", "glaze", "coconut aminos"];
  const matches = sauceSignals.filter((s) => items.some((it) => it.includes(s)));
  return matches.length >= 2;
}

// ─── Amount formatting helpers ─────────────────────────────────────────────

function formatAmount(val: number): string {
  if (val <= 0) return "a pinch";
  const eighth = Math.round(val * 8) / 8;
  const whole = Math.floor(eighth);
  const frac = Math.round((eighth - whole) * 8);
  const fracStr: Record<number, string> = { 0: "", 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" };
  const fracPart = fracStr[frac] ?? "";
  if (whole === 0) return fracPart || "1/8";
  if (!fracPart) return String(whole);
  return `${whole} ${fracPart}`;
}

function buildScaledIngredientString(
  ing: ParsedIngredient,
  factor: number,
  suffix?: string
): string {
  if (!ing.amount) return suffix ? `${ing.raw} ${suffix}` : ing.raw;
  const scaled = ing.amount * factor;
  const amtStr = formatAmount(scaled);
  const unitPart = ing.unit ? ` ${ing.unit}` : "";
  const suffixPart = suffix ? ` ${suffix}` : "";
  return `${amtStr}${unitPart} ${ing.item}${suffixPart}`;
}

// ─── Baking-specific substitution rules ───────────────────────────────────

const HEALTH_GOALS_BAKING = (p: UserProfile): boolean =>
  hasGoal(p, "blood_sugar_balance", "weight_loss", "cutting", "heart_health", "general_healthy") ||
  hasCondition(p, "diabetes", "prediabetes", "high_cholesterol");

const SAFETY_CONCERN = (p: UserProfile): boolean =>
  p.isPregnant === true ||
  p.medications.trim().length > 0 ||
  p.elderlyConcerns.length > 0;

const BAKING_SUB_RULES: SubRule[] = [
  { triggers: ["walnuts", "walnut", "pecans", "pecan", "almonds", "almond", "hazelnuts"], condition: (p) => p.allergies.includes("nuts"), substitute: "pumpkin seeds or sunflower seeds", reason: "Replaced tree nuts with seeds due to nut allergy", priority: 95 },
  { triggers: ["egg", "eggs", "large egg", "large eggs"], condition: (p) => p.allergies.includes("eggs"), substitute: "flax egg (1 tbsp ground flaxseed + 3 tbsp water per egg)", reason: "Replaced eggs with flax egg substitute due to egg allergy", priority: 90 },
  { triggers: ["buttermilk"], condition: isDairyFree, substitute: "plant-based milk + 1 tbsp lemon juice or white vinegar (dairy-free buttermilk)", reason: "Replaced buttermilk with a dairy-free alternative (plant milk + acid)", priority: 88 },
  { triggers: ["sour cream"], condition: isDairyFree, substitute: "dairy-free sour cream or coconut yogurt", reason: "Replaced sour cream with a dairy-free alternative", priority: 88 },
  { triggers: ["dark rum", "rum", "bourbon", "whiskey", "brandy", "kahlua", "amaretto", "beer", "stout"], condition: SAFETY_CONCERN, substitute: "orange juice, apple juice, or vanilla extract", reason: "Replaced alcohol with a non-alcoholic alternative for safety", priority: 85 },
  { triggers: ["dark rum", "rum"], condition: (p) => HEALTH_GOALS_BAKING(p) && !SAFETY_CONCERN(p), substitute: "orange juice or omit", reason: "Replaced rum with orange juice for a lighter recipe", priority: 78 },
  { triggers: ["cream cheese"], condition: (p) => HEALTH_GOALS_BAKING(p) && !isDairyFree(p), substitute: "reduced-fat cream cheese", reason: "Lightened frosting by using reduced-fat cream cheese", priority: 82 },
  { triggers: ["unsalted butter", "salted butter", "butter"], condition: (p) => HEALTH_GOALS_BAKING(p) && !isDairyFree(p) && !isVegOrVegan(p), substitute: "half butter + half plain Greek yogurt (or reduced-fat cream cheese for frosting)", reason: "Reduced saturated fat by replacing part of the butter with Greek yogurt", priority: 75 },
];

const SORTED_BAKING_RULES = [...BAKING_SUB_RULES].sort((a, b) => b.priority - a.priority);

// ─── Baking amount-reduction rules ────────────────────────────────────────

interface BakingReductionRule {
  triggers: string[];
  condition: (p: UserProfile) => boolean;
  transform: (ing: ParsedIngredient) => string;
  reason: string;
}

const BAKING_REDUCTION_RULES: BakingReductionRule[] = [
  { triggers: ["granulated sugar", "white sugar", "caster sugar"], condition: HEALTH_GOALS_BAKING, transform: (ing) => buildScaledIngredientString(ing, 0.7, "(or substitute up to half with monk fruit/erythritol blend)"), reason: "Reduced granulated sugar by ~30% to lower added sugar" },
  { triggers: ["sugar"], condition: HEALTH_GOALS_BAKING, transform: (ing) => buildScaledIngredientString(ing, 0.75), reason: "Reduced sugar by ~25% to lower added sugar" },
  { triggers: ["dark brown sugar", "light brown sugar", "brown sugar"], condition: HEALTH_GOALS_BAKING, transform: (ing) => buildScaledIngredientString(ing, 0.7), reason: "Reduced brown sugar by ~30% to lower added sugar" },
  { triggers: ["powdered sugar", "icing sugar", "confectioners sugar", "confectioners' sugar"], condition: HEALTH_GOALS_BAKING, transform: (ing) => buildScaledIngredientString(ing, 0.65, "(add more to taste)"), reason: "Lightened frosting by reducing powdered sugar by ~35%" },
  {
    triggers: ["vegetable oil", "canola oil", "sunflower oil", "rapeseed oil"],
    condition: (p) => HEALTH_GOALS_BAKING(p) && !isDairyFree(p),
    transform: (ing) => {
      if (!ing.amount) return `half the original oil + equal amount unsweetened applesauce or plain Greek yogurt`;
      const halfAmt = formatAmount(ing.amount * 0.5);
      const unit = ing.unit ?? "cup";
      return `${halfAmt} ${unit} vegetable oil + ${halfAmt} ${unit} unsweetened applesauce or plain Greek yogurt`;
    },
    reason: "Replaced half the oil with unsweetened applesauce to reduce fat and calories",
  },
  {
    triggers: ["vegetable oil", "canola oil", "sunflower oil"],
    condition: (p) => HEALTH_GOALS_BAKING(p) && isDairyFree(p),
    transform: (ing) => {
      if (!ing.amount) return `half the original oil + equal amount unsweetened applesauce`;
      const halfAmt = formatAmount(ing.amount * 0.5);
      const unit = ing.unit ?? "cup";
      return `${halfAmt} ${unit} vegetable oil + ${halfAmt} ${unit} unsweetened applesauce`;
    },
    reason: "Replaced half the oil with unsweetened applesauce to reduce fat and calories",
  },
  {
    triggers: ["all-purpose flour", "plain flour", "all purpose flour"],
    condition: (p) => !isGlutenFree(p) && (hasGoal(p, "blood_sugar_balance", "general_healthy", "weight_loss") || hasCondition(p, "diabetes", "prediabetes")),
    transform: (ing) => {
      if (!ing.amount) return `half all-purpose flour + half whole wheat pastry flour`;
      const halfAmt = formatAmount(ing.amount * 0.5);
      const unit = ing.unit ?? "cup";
      return `${halfAmt} ${unit} all-purpose flour + ${halfAmt} ${unit} whole wheat pastry flour`;
    },
    reason: "Replaced half the all-purpose flour with whole wheat pastry flour for more fiber and lower GI",
  },
  { triggers: ["kosher salt", "sea salt", "salt"], condition: hasLowSodiumConcern, transform: (ing) => buildScaledIngredientString(ing, 0.5, "(reduced)"), reason: "Reduced salt to lower sodium content" },
];

// ─── Savory/cooking amount-reduction rules ─────────────────────────────────

interface SavoryReductionRule {
  triggers: string[];
  condition: (p: UserProfile) => boolean;
  transform: (ing: ParsedIngredient) => string;
  reason: string;
}

const SAVORY_REDUCTION_RULES: SavoryReductionRule[] = [
  { triggers: ["salt and pepper", "salt"], condition: hasLowSodiumConcern, transform: (_ing) => "black pepper to taste; skip added salt or use a very small pinch only", reason: "Reduced sodium by omitting or minimizing added salt" },
  {
    triggers: ["dark brown sugar", "light brown sugar", "brown sugar"],
    condition: hasSugarReductionGoal,
    transform: (ing) => {
      if (!ing.amount || !ing.unit) return "2 tsp brown sugar (or 2 tsp honey or maple syrup)";
      const reduced = ing.amount * (2 / 3);
      return `${formatAmount(reduced)} ${ing.unit} brown sugar (or ${formatAmount(reduced)} ${ing.unit} honey or maple syrup)`;
    },
    reason: "Reduced brown sugar to lower added sugar; optionally replace with honey or maple syrup",
  },
  { triggers: ["granulated sugar", "white sugar", "sugar"], condition: hasSugarReductionGoal, transform: (ing) => buildScaledIngredientString(ing, 0.67), reason: "Reduced sugar by ~33% to lower added sugar in the sauce" },
];

// ─── Apply substitutions ───────────────────────────────────────────────────

function substituteIngredient(raw: string, trigger: string, newItem: string): string {
  const idx = raw.toLowerCase().indexOf(trigger.toLowerCase());
  if (idx < 0) return raw;
  return (raw.slice(0, idx) + newItem + raw.slice(idx + trigger.length)).trim();
}

// dislikedTerms is used to skip rules whose substitute itself contains a disliked food
// (e.g. vegan pork→mushrooms rule is skipped when user dislikes mushrooms)
function applySubstitutions(
  ingredients: ParsedIngredient[],
  profile: UserProfile,
  isBaking: boolean = false,
  dislikedTerms: string[] = []
): TransformedIngredient[] {
  const safeRules = isBaking
    ? SORTED_RULES.filter((r) => !r.bakingUnsafe)
    : SORTED_RULES;

  const allRules: SubRule[] = isBaking
    ? [...SORTED_BAKING_RULES, ...safeRules].sort((a, b) => b.priority - a.priority)
    : safeRules;

  return ingredients.map((ing) => {
    const itemLower = ing.item.toLowerCase();

    for (const rule of allRules) {
      if (!rule.condition(profile)) continue;

      const matchedTrigger = rule.triggers
        .slice()
        .sort((a, b) => b.length - a.length)
        .find((t) => itemLower.includes(t.toLowerCase()));

      if (!matchedTrigger) continue;

      // Skip this rule if its substitute is itself a disliked food
      if (dislikedTerms.length > 0 && substituteContainsDislikedFood(rule.substitute, dislikedTerms)) continue;

      const transformed = substituteIngredient(ing.raw, matchedTrigger, rule.substitute);
      return {
        original: ing.raw,
        transformed,
        changed: true,
        changeType: "substitution" as const,
        reason: rule.reason,
      };
    }

    return { original: ing.raw, transformed: ing.raw, changed: false };
  });
}

// ─── Baking amount-reduction pass ─────────────────────────────────────────

function applyBakingReductions(
  originalIngredients: ParsedIngredient[],
  substituted: TransformedIngredient[],
  profile: UserProfile
): TransformedIngredient[] {
  return substituted.map((t, i) => {
    if (t.changed) return t;

    const ing = originalIngredients[i];
    const itemLower = ing.item.toLowerCase();

    for (const rule of BAKING_REDUCTION_RULES) {
      if (!rule.condition(profile)) continue;

      const matched = rule.triggers
        .slice()
        .sort((a, b) => b.length - a.length)
        .find((tr) => itemLower.includes(tr.toLowerCase()));

      if (!matched) continue;

      const transformed = rule.transform(ing);
      if (transformed === ing.raw) return t;

      return {
        original: ing.raw,
        transformed,
        changed: true,
        changeType: "reduction" as const,
        reason: rule.reason,
      };
    }

    return t;
  });
}

// ─── Savory amount-reduction pass ─────────────────────────────────────────

function applySavoryReductions(
  originalIngredients: ParsedIngredient[],
  substituted: TransformedIngredient[],
  profile: UserProfile
): TransformedIngredient[] {
  return substituted.map((t, i) => {
    if (t.changed) return t;

    const ing = originalIngredients[i];
    const itemLower = ing.item.toLowerCase();

    for (const rule of SAVORY_REDUCTION_RULES) {
      if (!rule.condition(profile)) continue;

      const matched = rule.triggers
        .slice()
        .sort((a, b) => b.length - a.length)
        .find((tr) => itemLower.includes(tr.toLowerCase()));

      if (!matched) continue;

      const transformed = rule.transform(ing);
      if (transformed === ing.raw) return t;

      return {
        original: ing.raw,
        transformed,
        changed: true,
        changeType: "reduction" as const,
        reason: rule.reason,
      };
    }

    return t;
  });
}

// ─── Minimum edit guarantee ────────────────────────────────────────────────

function applyMinimumEditGuarantee(
  originalIngredients: ParsedIngredient[],
  current: TransformedIngredient[],
  profile: UserProfile,
  isSavory: boolean
): TransformedIngredient[] {
  if (!isSavory) return current;

  const numChanged = current.filter((t) => t.changed).length;
  if (numChanged >= 2) return current;

  const result = [...current];
  let made = numChanged;

  for (let i = 0; i < originalIngredients.length && made < 3; i++) {
    if (result[i].changed) continue;
    const item = originalIngredients[i].item.toLowerCase();
    const ing = originalIngredients[i];

    if (item.includes("soy sauce") && !hasSoyAllergy(profile)) {
      result[i] = { original: result[i].original, transformed: result[i].original.replace(/soy sauce/i, "low-sodium soy sauce"), changed: true, changeType: "substitution", reason: "Reduced sodium by switching to low-sodium soy sauce" };
      made++;
      continue;
    }
    if (item === "salt" || item === "salt and pepper" || (item.startsWith("salt") && item.length < 20)) {
      result[i] = { original: result[i].original, transformed: "black pepper to taste; skip added salt or use a very small pinch only", changed: true, changeType: "reduction", reason: "Reduced sodium by omitting or minimizing added salt" };
      made++;
      continue;
    }
    if (item.includes("brown sugar")) {
      const newText = ing.amount && ing.unit ? `${formatAmount(ing.amount * 0.67)} ${ing.unit} brown sugar (or honey)` : "2 tsp brown sugar (or 2 tsp honey)";
      result[i] = { original: result[i].original, transformed: newText, changed: true, changeType: "reduction", reason: "Reduced brown sugar to lower added sugar" };
      made++;
      continue;
    }
    if (item.includes("miso") && !hasSoyAllergy(profile)) {
      result[i] = { original: result[i].original, transformed: result[i].original + " (diluted with 1 tbsp water to reduce sodium)", changed: true, changeType: "reduction", reason: "Reduced sodium intensity by diluting miso paste" };
      made++;
    }
  }

  return result;
}

// ─── Protein addition suggestion ──────────────────────────────────────────

function proteinAdditionSuggestion(
  before: NutritionEstimate,
  profile: UserProfile
): string | null {
  if (!hasGoal(profile, "muscle_gain", "high_protein", "bulking") || before.protein_g >= 20) return null;

  if (isVegOrVegan(profile)) {
    return "Add ½ cup chickpeas or edamame to boost plant-based protein";
  }
  if (!profile.allergies.includes("eggs")) {
    return "Add an egg or ½ cup Greek yogurt as a side to boost protein";
  }
  return "Consider adding a lean protein source (fish, chicken, or tofu) to reach your muscle-gain goals";
}

// ─── Serving suggestion ────────────────────────────────────────────────────

function generateServingSuggestion(
  profile: UserProfile,
  isSavory: boolean,
  isSeafood: boolean
): string | null {
  if (!isSavory) return null;

  const hasSoy = hasSoyAllergy(profile);
  const wantsProtein = hasGoal(profile, "muscle_gain", "high_protein", "bulking");
  const isVeg = isVegOrVegan(profile);
  const edamamePart = hasSoy ? "" : ", edamame";

  if (isSeafood) {
    if (wantsProtein && !isVeg) {
      return `For extra protein, serve alongside brown rice or quinoa${edamamePart} and steamed vegetables`;
    }
    return "Serve with steamed broccoli, bok choy, or asparagus and a side of brown rice or quinoa for added fiber";
  }

  if (hasGoal(profile, "general_healthy", "weight_loss", "cutting", "heart_health") ||
      hasCondition(profile, "diabetes", "prediabetes", "high_blood_pressure")) {
    return "Pair with a side of steamed or roasted vegetables and a whole grain (brown rice or quinoa) for a balanced plate";
  }

  return null;
}

// ─── Recipe name generator ─────────────────────────────────────────────────

function transformedRecipeName(original: string, profile: UserProfile): string {
  const prefixes: string[] = [];
  if (isVegOrVegan(profile)) prefixes.push("Plant-Based");
  else if (hasGoal(profile, "heart_health")) prefixes.push("Heart-Healthy");
  else if (hasGoal(profile, "weight_loss", "cutting")) prefixes.push("Lightened-Up");
  else if (hasGoal(profile, "muscle_gain", "bulking")) prefixes.push("High-Protein");
  else if (hasGoal(profile, "blood_sugar_balance")) prefixes.push("Blood-Sugar Friendly");
  else if (hasGoal(profile, "general_healthy")) prefixes.push("Wholesome");
  else if (isGlutenFree(profile)) prefixes.push("Gluten-Free");

  return prefixes.length > 0 ? `${prefixes[0]} ${original}` : `Personalized ${original}`;
}

// ─── Key changes collector ─────────────────────────────────────────────────

function collectKeyChanges(
  changes: TransformedIngredient[],
  before: NutritionEstimate,
  after: NutritionEstimate,
  profile: UserProfile,
  isBaking: boolean,
  extraSuggestions: string[],
  priorityNote: string | null // shown first — used for disliked-food rebuild messages
): string[] {
  const items: string[] = [];
  const seenReasons = new Set<string>();

  // Disliked-food rebuild note is always the first key change when present
  if (priorityNote) {
    items.push(priorityNote);
    seenReasons.add(priorityNote);
  }

  for (const c of changes) {
    if (items.length >= 5) break;
    if (c.changed && c.reason && !seenReasons.has(c.reason)) {
      items.push(c.reason);
      seenReasons.add(c.reason);
    }
  }

  // Baking-specific pregnancy note
  if (isBaking && profile.isPregnant) {
    const hasAlcoholSwap = changes.some((c) => c.changed && c.reason?.toLowerCase().includes("alcohol"));
    if (!hasAlcoholSwap && !seenReasons.has("_preg_baking") && items.length < 5) {
      items.push("Added pregnancy food-safety notes for raw batter and pasteurized dairy");
      seenReasons.add("_preg_baking");
    }
  }

  // Nutrition improvement notes
  if (after.added_sugar_g < before.added_sugar_g - 2) {
    const note = `Added sugar reduced by ~${Math.round(before.added_sugar_g - after.added_sugar_g)} g per serving`;
    if (!seenReasons.has(note) && items.length < 5) { items.push(note); seenReasons.add(note); }
  } else if (after.sodium_mg < before.sodium_mg - 100) {
    const note = `Sodium reduced by ~${Math.round(before.sodium_mg - after.sodium_mg)} mg per serving`;
    if (!seenReasons.has(note) && items.length < 5) { items.push(note); seenReasons.add(note); }
  } else if (after.protein_g > before.protein_g + 3) {
    const note = `Protein increased by ~${Math.round(after.protein_g - before.protein_g)} g`;
    if (!seenReasons.has(note) && items.length < 5) { items.push(note); seenReasons.add(note); }
  }

  const proteinTip = proteinAdditionSuggestion(before, profile);
  if (proteinTip && items.length < 5) items.push(proteinTip);

  if (
    (profile.elderlyConcerns.includes("chewing_difficulty") ||
      profile.elderlyConcerns.includes("swallowing_difficulty")) &&
    items.length < 5
  ) {
    items.push("Suggest cooking ingredients until very tender for easier chewing");
  }

  for (const suggestion of extraSuggestions) {
    if (items.length >= 5) break;
    if (!seenReasons.has(suggestion)) {
      items.push(suggestion);
      seenReasons.add(suggestion);
    }
  }

  return items.slice(0, 5);
}

// ─── Explanation generator ─────────────────────────────────────────────────

function generateExplanation(
  profile: UserProfile,
  numChanges: number,
  before: NutritionEstimate,
  after: NutritionEstimate,
  isBaking: boolean,
  isSauceHeavy: boolean,
  dislikedCenteredTerm: string | null
): string {
  const goals = profile.nutritionGoals
    .slice(0, 2)
    .map((g) => g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" and ");

  const focusLabel = goals || "a healthier lifestyle";
  const changeWord = numChanges === 1 ? "1 adjustment" : `${numChanges} adjustments`;

  let detail = "";
  if (after.added_sugar_g < before.added_sugar_g - 2) detail += ` Added sugar was reduced by about ${Math.round(before.added_sugar_g - after.added_sugar_g)} g per serving.`;
  if (after.sodium_mg < before.sodium_mg - 50) detail += ` Sodium was reduced by about ${Math.round(before.sodium_mg - after.sodium_mg)} mg per serving.`;
  if (after.calories < before.calories - 30) detail += ` Estimated calories dropped by around ${Math.round(before.calories - after.calories)} kcal per serving.`;
  if (after.protein_g > before.protein_g + 2) detail += ` Protein was increased by ~${Math.round(after.protein_g - before.protein_g)} g.`;
  if (after.fiber_g > before.fiber_g + 0.5) detail += ` Fiber was increased by ~${Math.round((after.fiber_g - before.fiber_g) * 10) / 10} g.`;

  // Recipe was rebuilt because of a disliked main ingredient
  if (dislikedCenteredTerm) {
    return `This recipe was centered around ${dislikedCenteredTerm}s, which you listed as a disliked food. BiteBetter rebuilt it using vegetables and beans while preserving the original cooking style.${detail} All nutrition values shown are estimates and for reference only.`;
  }

  if (!isBaking && isSauceHeavy) {
    return `This version keeps the sweet-savory flavor while reducing sodium and added sugar. We made ${changeWord} tailored to ${focusLabel}.${detail} All nutrition values shown are estimates and for reference only.`;
  }

  const bakingNote = isBaking ? " Baking ratios were preserved to maintain texture and structure." : "";
  return `Your recipe was personalized for ${focusLabel}. We made ${changeWord} to better align with your nutrition profile.${detail}${bakingNote} All nutrition values shown are estimates and for reference only.`;
}

// ─── Main export ───────────────────────────────────────────────────────────

export function transformRecipe(
  _rawText: string,
  parsed: ParsedRecipe,
  profile: UserProfile
): TransformedRecipe {
  // Default to general_healthy when no goals selected
  const effectiveProfile: UserProfile =
    profile.nutritionGoals.length === 0
      ? { ...profile, nutritionGoals: ["general_healthy" as never] }
      : profile;

  // Analyse disliked foods before any transformation
  const dislikedAnalysis = analyzeDislikedFoodConflict(
    parsed.ingredients,
    parsed.recipeName,
    profile.dislikedFoods
  );
  const dislikedTerms = dislikedAnalysis.dislikedTerms;

  const isBaking = isDessertOrBakingRecipe(parsed);
  const isSavory = isSavoryCookingRecipe(parsed);
  const isSeafood = isSeafoodRecipe(parsed);
  const isSauceHeavy = isSauceOrMarinadeHeavyRecipe(parsed);

  // 1. Allergy + health substitution rules.
  //    Pass dislikedTerms so rules whose substitute is a disliked food are skipped.
  const afterSubs = applySubstitutions(parsed.ingredients, effectiveProfile, isBaking, dislikedTerms);

  // 2. Disliked-food substitutions (runs after allergy rules so allergy changes are not overridden)
  const afterDisliked = applyDislikedFoodSubstitutions(
    parsed.ingredients,
    dislikedAnalysis,
    effectiveProfile,
    afterSubs
  );

  // 3. Amount-reduction pass based on recipe type
  let afterReductions: TransformedIngredient[];
  if (isBaking) {
    afterReductions = applyBakingReductions(parsed.ingredients, afterDisliked, effectiveProfile);
  } else {
    afterReductions = applySavoryReductions(parsed.ingredients, afterDisliked, effectiveProfile);
  }

  // 4. Minimum edit guarantee for savory recipes
  const transformedIngredients = applyMinimumEditGuarantee(
    parsed.ingredients,
    afterReductions,
    effectiveProfile,
    isSavory
  );

  // 5. Build "after" ingredient list for nutrition estimation
  const afterIngredients: ParsedIngredient[] = transformedIngredients.map((t, i) => {
    if (!t.changed) return parsed.ingredients[i];
    const raw = t.transformed;
    const itemMatch = raw.match(
      /(?:\d+(?:\.\d+)?\s*)?(?:cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|lbs?|grams?|g|kgs?|ml|l)?\s*(.*)/i
    );
    return {
      ...parsed.ingredients[i],
      item: (itemMatch?.[1] ?? raw).replace(/,.*$/, "").trim().toLowerCase(),
    };
  });

  // 6. Nutrition estimates
  const beforeNutrition = estimateNutrition(parsed.ingredients, parsed.servings);
  const afterNutrition = estimateNutrition(afterIngredients, parsed.servings);

  // 7. Safety warnings (original profile for allergy/medical checks)
  const warnings = generateWarnings(parsed.ingredients, profile);

  // 8. Disliked-food info warning (info level, not allergy level)
  if (dislikedAnalysis.isCenteredAround && dislikedAnalysis.centeredAroundTerm) {
    warnings.push({
      level: "info",
      category: "general",
      message: `Preference note: This recipe was centered around ${dislikedAnalysis.centeredAroundTerm}s, which you listed as a disliked food. BiteBetter replaced the ${dislikedAnalysis.centeredAroundTerm}-heavy base with vegetables and beans.`,
    });
  }

  // 9. Pregnancy + seafood temperature warning
  if (profile.isPregnant && isSeafood) {
    warnings.push({
      level: "warning",
      category: "pregnancy",
      message:
        "Pregnancy food safety: cook fish to an internal temperature of 145°F (63°C) — fully cooked through. Avoid recipes that call for rare or medium-rare fish (e.g., 125–130°F). Consult your healthcare provider if unsure.",
    });
  }

  // 10. Extra baking pregnancy warning
  if (isBaking && profile.isPregnant) {
    warnings.push({
      level: "caution",
      category: "pregnancy",
      message:
        "Pregnancy food safety: ensure baked goods are fully cooked through (no raw batter tasting). Confirm that cream cheese, buttermilk, and other dairy are from pasteurized sources.",
    });
  }

  // 11. Grocery cost
  const { groceryItems, totalCost, costPerServing } = estimateGroceryCost(
    transformedIngredients,
    parsed.servings
  );

  // 12. Scores
  const numChanges = transformedIngredients.filter((t) => t.changed).length;
  const scores = calculateScores(
    effectiveProfile,
    beforeNutrition,
    afterNutrition,
    numChanges,
    warnings.length,
    totalCost
  );

  // 13. Extra suggestions (non-ingredient key changes)
  const extraSuggestions: string[] = [];
  const servingSuggestion = generateServingSuggestion(effectiveProfile, isSavory, isSeafood);
  if (servingSuggestion) extraSuggestions.push(servingSuggestion);
  if (profile.isPregnant && isSeafood) {
    extraSuggestions.push("Pregnancy note: cook fish to 145°F (fully cooked) — avoid undercooked seafood during pregnancy");
  }

  // Priority note for key changes: disliked-food rebuild message shown first
  const priorityNote =
    dislikedAnalysis.isCenteredAround && dislikedAnalysis.centeredAroundTerm
      ? `Rebuilt recipe around vegetables and beans because ${dislikedAnalysis.centeredAroundTerm}s are listed as a disliked food`
      : null;

  // 14. Key changes & explanation
  const keyChanges = collectKeyChanges(
    transformedIngredients,
    beforeNutrition,
    afterNutrition,
    effectiveProfile,
    isBaking,
    extraSuggestions,
    priorityNote
  );
  const explanation = generateExplanation(
    effectiveProfile,
    numChanges,
    beforeNutrition,
    afterNutrition,
    isBaking,
    isSauceHeavy,
    dislikedAnalysis.isCenteredAround ? dislikedAnalysis.centeredAroundTerm : null
  );

  // 15. Disclaimer
  const needsDisclaimer = disclaimerRequired(profile, warnings);

  // 16. Override recipe name when the original was centred on a disliked ingredient
  const overrideRecipeName =
    dislikedAnalysis.isCenteredAround && dislikedAnalysis.centeredAroundTerm
      ? buildDislikedFoodRecipeName(parsed.recipeName, dislikedAnalysis.centeredAroundTerm, effectiveProfile)
      : null;

  return {
    originalRecipeName: parsed.recipeName,
    transformedRecipeName: overrideRecipeName ?? transformedRecipeName(parsed.recipeName, effectiveProfile),
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
