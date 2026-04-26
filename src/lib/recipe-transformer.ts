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

// ─── Substitution rules ────────────────────────────────────────────────────

interface SubRule {
  triggers: string[];
  condition: (p: UserProfile) => boolean;
  substitute: string;
  reason: string;
  priority: number;
  bakingUnsafe?: boolean; // skip this rule when transforming dessert/baking recipes
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
  { triggers: ["chicken breast", "boneless chicken", "grilled chicken"], condition: isVegOrVegan, substitute: "firm tofu", reason: "Replaced chicken with tofu (plant-based)", priority: 100 },
  { triggers: ["chicken thigh", "chicken thighs", "chicken leg"], condition: isVegOrVegan, substitute: "firm tofu", reason: "Replaced chicken with tofu (plant-based)", priority: 100 },
  { triggers: ["chicken"], condition: isVegOrVegan, substitute: "firm tofu", reason: "Replaced chicken with tofu (plant-based)", priority: 95 },
  { triggers: ["ground beef", "beef mince", "minced beef"], condition: isVegOrVegan, substitute: "lentils", reason: "Replaced beef with lentils (plant-based, high fiber)", priority: 100 },
  { triggers: ["beef"], condition: isVegOrVegan, substitute: "lentils", reason: "Replaced beef with lentils (plant-based)", priority: 95 },
  { triggers: ["pork", "bacon", "ham", "prosciutto", "pancetta"], condition: isVegOrVegan, substitute: "mushrooms", reason: "Replaced pork/bacon with mushrooms (plant-based, umami flavour)", priority: 100 },
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
  { triggers: ["soy sauce", "dark soy sauce", "light soy sauce"], condition: isGlutenFree, substitute: "tamari (gluten-free soy sauce)", reason: "Replaced soy sauce with tamari (gluten-free)", priority: 92 },

  // ── Low sodium / High BP (priority 70) ──────────────────────────────
  { triggers: ["soy sauce", "dark soy sauce"], condition: (p) => p.dietaryPreferences.includes("low_sodium") || hasCondition(p, "high_blood_pressure") || hasGoal(p, "heart_health"), substitute: "low-sodium soy sauce", reason: "Reduced sodium by switching to low-sodium soy sauce", priority: 70 },
  { triggers: ["fish sauce"], condition: (p) => p.dietaryPreferences.includes("low_sodium") || hasCondition(p, "high_blood_pressure"), substitute: "low-sodium fish sauce or lime juice", reason: "Reduced sodium by using a lower-sodium alternative", priority: 70 },

  // ── Heart health / Weight loss — butter/cream swaps (priority 60) ────
  // bakingUnsafe: olive oil and evaporated milk are wrong substitutes in baking/dessert context
  {
    triggers: ["butter", "unsalted butter", "salted butter"],
    condition: (p) => hasGoal(p, "weight_loss", "cutting", "heart_health") || hasCondition(p, "heart_disease", "high_cholesterol"),
    substitute: "olive oil",
    reason: "Replaced saturated fat in butter with heart-healthy olive oil",
    priority: 60,
    bakingUnsafe: true,
  },
  {
    triggers: ["heavy cream", "double cream", "whipping cream"],
    condition: (p) => hasGoal(p, "weight_loss", "cutting") || hasCondition(p, "heart_disease", "high_cholesterol"),
    substitute: "light evaporated milk",
    reason: "Reduced calories by replacing heavy cream with a lighter alternative",
    priority: 60,
    bakingUnsafe: true,
  },

  // ── Blood sugar / Diabetes — lower-GI swaps (priority 55) ────────────
  { triggers: ["white rice", "jasmine rice"], condition: (p) => hasGoal(p, "blood_sugar_balance", "weight_loss") || hasCondition(p, "diabetes", "prediabetes"), substitute: "brown rice", reason: "Replaced white rice with lower-GI brown rice for better blood sugar control", priority: 55 },
  { triggers: ["spaghetti", "fettuccine", "penne", "rigatoni", "linguine", "pasta"], condition: (p) => hasGoal(p, "blood_sugar_balance", "weight_loss") || hasCondition(p, "diabetes", "prediabetes"), substitute: "whole wheat pasta", reason: "Replaced white pasta with higher-fiber whole wheat pasta", priority: 55 },

  // ── Elderly soft-food preference (priority 50) ────────────────────────
  { triggers: ["steak", "beef steak", "pork chop", "chicken breast"], condition: (p) => p.elderlyConcerns.includes("chewing_difficulty") || p.elderlyConcerns.includes("soft_foods"), substitute: "slow-cooked tender chicken or fish", reason: "Suggested a softer protein preparation for easier chewing", priority: 50 },
];

const SORTED_RULES = [...SUB_RULES].sort((a, b) => b.priority - a.priority);

// ─── Baking / dessert detection ────────────────────────────────────────────

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

  // Two or more of these together → likely baking
  const comboSignals = ["sugar", "flour", "vanilla", "baking powder", "baking soda"];
  const comboHits = comboSignals.filter((s) => items.some((it) => it.includes(s)));
  return comboHits.length >= 2;
}

export function isCakeOrFrostingIngredient(item: string): boolean {
  const lower = item.toLowerCase();
  return ["powdered sugar", "icing sugar", "confectioners", "cream cheese frosting", "frosting"].some((s) => lower.includes(s));
}

// ─── Amount formatting helpers ─────────────────────────────────────────────

function formatAmount(val: number): string {
  if (val <= 0) return "a pinch";
  const eighth = Math.round(val * 8) / 8;
  const whole = Math.floor(eighth);
  const frac = Math.round((eighth - whole) * 8); // in eighths
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
  // ── Nut allergy — remove nuts (priority 95) ───────────────────────────
  {
    triggers: ["walnuts", "walnut", "pecans", "pecan", "almonds", "almond", "hazelnuts"],
    condition: (p) => p.allergies.includes("nuts"),
    substitute: "pumpkin seeds or sunflower seeds",
    reason: "Replaced tree nuts with seeds due to nut allergy",
    priority: 95,
  },

  // ── Egg allergy (priority 90) ─────────────────────────────────────────
  {
    triggers: ["egg", "eggs", "large egg", "large eggs"],
    condition: (p) => p.allergies.includes("eggs"),
    substitute: "flax egg (1 tbsp ground flaxseed + 3 tbsp water per egg)",
    reason: "Replaced eggs with flax egg substitute due to egg allergy",
    priority: 90,
  },

  // ── Dairy-free baking (priority 88) ──────────────────────────────────
  {
    triggers: ["buttermilk"],
    condition: isDairyFree,
    substitute: "plant-based milk + 1 tbsp lemon juice or white vinegar (dairy-free buttermilk)",
    reason: "Replaced buttermilk with a dairy-free alternative (plant milk + acid)",
    priority: 88,
  },
  {
    triggers: ["sour cream"],
    condition: isDairyFree,
    substitute: "dairy-free sour cream or coconut yogurt",
    reason: "Replaced sour cream with a dairy-free alternative",
    priority: 88,
  },

  // ── Alcohol → safe alternative (priority 85) ─────────────────────────
  {
    triggers: ["dark rum", "rum", "bourbon", "whiskey", "brandy", "kahlua", "amaretto", "beer", "stout"],
    condition: SAFETY_CONCERN,
    substitute: "orange juice, apple juice, or vanilla extract",
    reason: "Replaced alcohol with a non-alcoholic alternative for safety",
    priority: 85,
  },
  // Also remove rum for general health goals (lighter cake)
  {
    triggers: ["dark rum", "rum"],
    condition: (p) => HEALTH_GOALS_BAKING(p) && !SAFETY_CONCERN(p),
    substitute: "orange juice or omit",
    reason: "Replaced rum with orange juice for a lighter recipe",
    priority: 78,
  },

  // ── Cream cheese → reduced-fat (priority 82, non-dairy-free) ─────────
  {
    triggers: ["cream cheese"],
    condition: (p) => HEALTH_GOALS_BAKING(p) && !isDairyFree(p),
    substitute: "reduced-fat cream cheese",
    reason: "Lightened frosting by using reduced-fat cream cheese",
    priority: 82,
  },

  // ── Butter in baking → Greek yogurt (priority 75, health, non-dairy-free, non-vegan) ──
  {
    triggers: ["unsalted butter", "salted butter", "butter"],
    condition: (p) => HEALTH_GOALS_BAKING(p) && !isDairyFree(p) && !isVegOrVegan(p),
    substitute: "half butter + half plain Greek yogurt (or reduced-fat cream cheese for frosting)",
    reason: "Reduced saturated fat by replacing part of the butter with Greek yogurt",
    priority: 75,
  },
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
  // Sugar reduction — granulated/white/caster
  {
    triggers: ["granulated sugar", "white sugar", "caster sugar"],
    condition: HEALTH_GOALS_BAKING,
    transform: (ing) => buildScaledIngredientString(ing, 0.7, "(or substitute up to half with monk fruit/erythritol blend)"),
    reason: "Reduced granulated sugar by ~30% to lower added sugar",
  },
  // Catch-all "sugar" that isn't brown or powdered
  {
    triggers: ["sugar"],
    condition: HEALTH_GOALS_BAKING,
    transform: (ing) => buildScaledIngredientString(ing, 0.75),
    reason: "Reduced sugar by ~25% to lower added sugar",
  },
  // Brown sugar reduction
  {
    triggers: ["dark brown sugar", "light brown sugar", "brown sugar"],
    condition: HEALTH_GOALS_BAKING,
    transform: (ing) => buildScaledIngredientString(ing, 0.7),
    reason: "Reduced brown sugar by ~30% to lower added sugar",
  },
  // Powdered sugar (frosting) — larger reduction
  {
    triggers: ["powdered sugar", "icing sugar", "confectioners sugar", "confectioners' sugar"],
    condition: HEALTH_GOALS_BAKING,
    transform: (ing) => buildScaledIngredientString(ing, 0.65, "(add more to taste)"),
    reason: "Lightened frosting by reducing powdered sugar by ~35%",
  },
  // Vegetable/neutral oil — replace half with applesauce (non-dairy-free: optionally Greek yogurt)
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
  // Dairy-free oil swap
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
  // All-purpose flour → half + half whole wheat pastry (non-GF, health goals)
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
  // Salt reduction
  {
    triggers: ["kosher salt", "sea salt", "salt"],
    condition: (p) => p.dietaryPreferences.includes("low_sodium") || hasCondition(p, "high_blood_pressure") || hasGoal(p, "heart_health"),
    transform: (ing) => buildScaledIngredientString(ing, 0.5, "(reduced)"),
    reason: "Reduced salt to lower sodium content",
  },
];

// ─── Apply substitutions ───────────────────────────────────────────────────

function substituteIngredient(raw: string, trigger: string, newItem: string): string {
  const idx = raw.toLowerCase().indexOf(trigger.toLowerCase());
  if (idx < 0) return raw;
  return (raw.slice(0, idx) + newItem + raw.slice(idx + trigger.length)).trim();
}

function applySubstitutions(
  ingredients: ParsedIngredient[],
  profile: UserProfile,
  isBaking: boolean = false
): TransformedIngredient[] {
  // In baking context: combine baking-specific rules + savory rules that are safe for baking
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
// Runs after applySubstitutions; only touches ingredients not already changed.

function applyBakingReductions(
  originalIngredients: ParsedIngredient[],
  substituted: TransformedIngredient[],
  profile: UserProfile
): TransformedIngredient[] {
  return substituted.map((t, i) => {
    if (t.changed) return t; // already handled by substitution pass

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
  profile: UserProfile,
  isBaking: boolean
): string[] {
  const items: string[] = [];
  const seenReasons = new Set<string>();

  for (const c of changes) {
    if (c.changed && c.reason && !seenReasons.has(c.reason)) {
      items.push(c.reason);
      seenReasons.add(c.reason);
    }
    if (items.length >= 4) break;
  }

  // Baking-specific summary notes (add only if relevant and not already covered)
  if (isBaking) {
    const hasSugarReduction = changes.some(
      (c) => c.changed && c.reason?.toLowerCase().includes("sugar")
    );
    const hasOilSwap = changes.some(
      (c) => c.changed && c.reason?.toLowerCase().includes("oil")
    );
    const hasFrostingChange = changes.some(
      (c) => c.changed && (c.reason?.toLowerCase().includes("frosting") || c.reason?.toLowerCase().includes("powdered"))
    );

    if (hasSugarReduction && items.length < 5 && !seenReasons.has("_sugar_summary")) {
      seenReasons.add("_sugar_summary");
    }
    if (hasOilSwap && hasFrostingChange && items.length < 5) {
      // Already collected individually
    }

    // Pregnancy baking safety note
    if (profile.isPregnant && items.length < 5) {
      const hasAlcoholSwap = changes.some((c) => c.changed && c.reason?.toLowerCase().includes("alcohol"));
      if (hasAlcoholSwap) {
        // Already mentioned in the ingredient reason
      } else if (!seenReasons.has("_preg_baking")) {
        items.push("Added pregnancy food-safety notes for raw batter and pasteurized dairy");
        seenReasons.add("_preg_baking");
      }
    }
  }

  // Nutrition improvement notes
  if (after.added_sugar_g < before.added_sugar_g - 2) {
    const note = `Added sugar reduced by ~${Math.round(before.added_sugar_g - after.added_sugar_g)} g per serving`;
    if (!seenReasons.has(note)) { items.push(note); seenReasons.add(note); }
  } else if (after.sodium_mg < before.sodium_mg - 100) {
    const note = `Sodium reduced by ~${Math.round(before.sodium_mg - after.sodium_mg)} mg per serving`;
    if (!seenReasons.has(note)) { items.push(note); seenReasons.add(note); }
  } else if (after.protein_g > before.protein_g + 3) {
    const note = `Protein increased by ~${Math.round(after.protein_g - before.protein_g)} g`;
    if (!seenReasons.has(note)) { items.push(note); seenReasons.add(note); }
  }

  const proteinTip = proteinAdditionSuggestion(before, profile);
  if (proteinTip && items.length < 5) items.push(proteinTip);

  if (
    profile.elderlyConcerns.includes("chewing_difficulty") ||
    profile.elderlyConcerns.includes("swallowing_difficulty")
  ) {
    if (items.length < 5) items.push("Suggest cooking ingredients until very tender for easier chewing");
  }

  return items.slice(0, 5);
}

// ─── Explanation generator ─────────────────────────────────────────────────

function generateExplanation(
  profile: UserProfile,
  numChanges: number,
  before: NutritionEstimate,
  after: NutritionEstimate,
  isBaking: boolean
): string {
  const goals = profile.nutritionGoals
    .slice(0, 2)
    .map((g) => g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" and ");

  const focusLabel = goals || "your health goals";
  const changeWord = numChanges === 1 ? "1 adjustment" : `${numChanges} adjustments`;

  let detail = "";
  if (after.added_sugar_g < before.added_sugar_g - 2) {
    detail += ` Added sugar was reduced by about ${Math.round(before.added_sugar_g - after.added_sugar_g)} g per serving.`;
  }
  if (after.sodium_mg < before.sodium_mg - 50) {
    detail += ` Sodium was reduced by about ${Math.round(before.sodium_mg - after.sodium_mg)} mg per serving.`;
  }
  if (after.calories < before.calories - 30) {
    detail += ` Estimated calories dropped by around ${Math.round(before.calories - after.calories)} kcal per serving.`;
  }
  if (after.protein_g > before.protein_g + 2) {
    detail += ` Protein was increased by ~${Math.round(after.protein_g - before.protein_g)} g.`;
  }

  const bakingNote = isBaking
    ? " Baking ratios were preserved to maintain texture and structure."
    : "";

  return `Your recipe was personalized for ${focusLabel}. We made ${changeWord} to better align with your nutrition profile.${detail}${bakingNote} All nutrition values shown are estimates and for reference only.`;
}

// ─── Main export ───────────────────────────────────────────────────────────

export function transformRecipe(
  _rawText: string,
  parsed: ParsedRecipe,
  profile: UserProfile
): TransformedRecipe {
  const isBaking = isDessertOrBakingRecipe(parsed);

  // 1. Apply substitutions (baking-aware)
  const afterSubs = applySubstitutions(parsed.ingredients, profile, isBaking);

  // 2. Apply baking-specific amount reductions (second pass, only on un-changed ingredients)
  const transformedIngredients = isBaking
    ? applyBakingReductions(parsed.ingredients, afterSubs, profile)
    : afterSubs;

  // 3. Build "after" ingredient list for nutrition estimation
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

  // 4. Nutrition estimates
  const beforeNutrition = estimateNutrition(parsed.ingredients, parsed.servings);
  const afterNutrition = estimateNutrition(afterIngredients, parsed.servings);

  // 5. Safety warnings
  const warnings = generateWarnings(parsed.ingredients, profile);

  // 6. Extra baking-specific pregnancy warnings
  if (isBaking && profile.isPregnant) {
    warnings.push({
      level: "caution",
      category: "pregnancy",
      message:
        "Pregnancy food safety: ensure the baked goods are fully cooked through (no raw batter tasting). Confirm that cream cheese, buttermilk, and other dairy in this recipe are from pasteurized sources.",
    });
  }

  // 7. Grocery cost
  const { groceryItems, totalCost, costPerServing } = estimateGroceryCost(
    transformedIngredients,
    parsed.servings
  );

  // 8. Scores
  const numChanges = transformedIngredients.filter((t) => t.changed).length;
  const scores = calculateScores(
    profile,
    beforeNutrition,
    afterNutrition,
    numChanges,
    warnings.length,
    totalCost
  );

  // 9. Key changes & explanation
  const keyChanges = collectKeyChanges(
    transformedIngredients,
    beforeNutrition,
    afterNutrition,
    profile,
    isBaking
  );
  const explanation = generateExplanation(
    profile,
    numChanges,
    beforeNutrition,
    afterNutrition,
    isBaking
  );

  // 10. Disclaimer
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
