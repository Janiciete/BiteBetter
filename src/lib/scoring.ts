import type { NutritionEstimate } from "@/types/recipe";
import type { RecipeScores } from "@/types/scores";
import type { UserProfile } from "@/types/profile";

export function calculateScores(
  profile: UserProfile,
  before: NutritionEstimate,
  after: NutritionEstimate,
  numChanges: number,
  numWarnings: number,
  estimatedCost: number
): RecipeScores {
  // ── Health Score (0–100) ───────────────────────────────────────────────
  let health = 58;

  if (after.calories < before.calories - 20) health += 10;
  if (after.sodium_mg < before.sodium_mg - 50) health += 12;
  if (after.added_sugar_g < before.added_sugar_g - 2) health += 10;
  if (after.protein_g > before.protein_g + 2) health += 8;
  if (after.fiber_g > before.fiber_g + 0.5) health += 8;
  if (after.fat_g < before.fat_g - 3) health += 4;

  // Profile alignment bonuses
  if (
    profile.nutritionGoals.includes("heart_health") &&
    after.sodium_mg < before.sodium_mg
  )
    health += 5;
  if (
    (profile.healthConditions.includes("diabetes") ||
      profile.nutritionGoals.includes("blood_sugar_balance")) &&
    after.added_sugar_g < before.added_sugar_g
  )
    health += 5;

  // Deduct for warnings
  health -= numWarnings * 4;

  health = Math.min(100, Math.max(10, Math.round(health)));

  // ── Taste Score (0–100) ────────────────────────────────────────────────
  // Starts high — the goal is to keep flavour while improving health
  let taste = 90;
  taste -= Math.min(numChanges * 5, 35);
  taste = Math.min(100, Math.max(35, Math.round(taste)));

  // ── Transformation Score (0–100) ───────────────────────────────────────
  // Measures meaningful positive nutritional change
  let transformation = 25;
  if (after.calories < before.calories - 20) transformation += 18;
  if (after.sodium_mg < before.sodium_mg - 50) transformation += 18;
  if (after.added_sugar_g < before.added_sugar_g - 1) transformation += 18;
  if (after.protein_g > before.protein_g + 2) transformation += 12;
  if (after.fiber_g > before.fiber_g + 0.5) transformation += 9;

  transformation = Math.min(100, Math.round(transformation));

  // ── Budget Score (0–100) ───────────────────────────────────────────────
  // Compare estimated recipe cost to the user's weekly budget
  let budget = 100;
  if (profile.weeklyBudget > 0) {
    // A reasonable single-recipe cost is ~25% of weekly budget
    const costRatio = estimatedCost / (profile.weeklyBudget * 0.25);
    if (costRatio > 1.0) budget = Math.round(100 - (costRatio - 1) * 40);
    if (costRatio > 2.0) budget = Math.round(100 - (costRatio - 1) * 35);
    budget = Math.max(10, Math.min(100, budget));
  }

  // ── Overall Score (weighted) ───────────────────────────────────────────
  const overall = Math.round(
    health * 0.40 +
    taste * 0.30 +
    transformation * 0.20 +
    budget * 0.10
  );

  return {
    overall: Math.min(100, Math.max(1, overall)),
    health: Math.min(100, Math.max(1, health)),
    taste: Math.min(100, Math.max(1, taste)),
    transformation: Math.min(100, Math.max(1, transformation)),
    budget: Math.min(100, Math.max(1, budget)),
  };
}
