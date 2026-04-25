import safetyData from "@/data/safety-rules.json";
import type { ParsedIngredient, RecipeWarning } from "@/types/recipe";
import type { UserProfile } from "@/types/profile";

export const MEDICAL_DISCLAIMER =
  "This is not medical advice or a medical diagnosis. Consult a doctor or healthcare professional for high-risk concerns.";

// ─── Helpers ──────────────────────────────────────────────────────────────

function ingredientsContain(ingredients: ParsedIngredient[], keywords: string[]): string[] {
  const found: string[] = [];
  for (const ing of ingredients) {
    const item = ing.item.toLowerCase();
    const raw = ing.raw.toLowerCase();
    for (const kw of keywords) {
      if (item.includes(kw.toLowerCase()) || raw.includes(kw.toLowerCase())) {
        found.push(ing.raw);
        break;
      }
    }
  }
  return found;
}

// ─── Main warning generator ────────────────────────────────────────────────

export function generateWarnings(
  ingredients: ParsedIngredient[],
  profile: UserProfile
): RecipeWarning[] {
  const warnings: RecipeWarning[] = [];
  const allergies = safetyData.allergy_triggers as Record<string, string[]>;

  // ── Allergy checks
  for (const allergy of profile.allergies) {
    if (allergy === "other") continue;
    const triggers = allergies[allergy] ?? [];
    const found = ingredientsContain(ingredients, triggers);
    if (found.length > 0) {
      warnings.push({
        level: "warning",
        category: "allergy",
        message: `Allergy alert (${allergy}): This recipe contains ingredients that may not be safe for you — ${found.slice(0, 3).join(", ")}.`,
      });
    }
  }

  // ── Pregnancy checks
  if (profile.isPregnant) {
    const pregnancyRules = safetyData.pregnancy_warnings as Record<
      string,
      { triggers: string[]; message: string }
    >;
    for (const rule of Object.values(pregnancyRules)) {
      const found = ingredientsContain(ingredients, rule.triggers);
      if (found.length > 0) {
        warnings.push({
          level: "warning",
          category: "pregnancy",
          message: rule.message,
        });
      }
    }

    // General pregnancy calorie warning — don't reduce calories
    warnings.push({
      level: "info",
      category: "pregnancy",
      message:
        "During pregnancy, avoid calorie restriction. Focus on nutrient-dense foods and consult your healthcare provider for dietary guidance.",
    });
  }

  // ── High blood pressure: flag high-sodium ingredients
  if (
    profile.healthConditions.includes("high_blood_pressure") ||
    profile.dietaryPreferences.includes("low_sodium")
  ) {
    const highSodiumFound = ingredientsContain(
      ingredients,
      safetyData.high_sodium_ingredients
    );
    if (highSodiumFound.length > 0) {
      warnings.push({
        level: "caution",
        category: "medical",
        message: `High-sodium ingredients detected: ${highSodiumFound.slice(0, 3).join(", ")}. We've suggested lower-sodium alternatives where possible.`,
      });
    }
  }

  // ── Diabetes / blood sugar: flag high-sugar ingredients
  if (
    profile.healthConditions.includes("diabetes") ||
    profile.healthConditions.includes("prediabetes") ||
    profile.nutritionGoals.includes("blood_sugar_balance")
  ) {
    const highSugarFound = ingredientsContain(
      ingredients,
      safetyData.high_sugar_ingredients
    );
    if (highSugarFound.length > 0) {
      warnings.push({
        level: "caution",
        category: "medical",
        message: `High-sugar ingredients detected: ${highSugarFound.slice(0, 2).join(", ")}. Consider reducing amounts or using lower-sugar alternatives.`,
      });
    }
  }

  // ── Kidney issues: flag high-potassium / high-protein overload
  if (profile.healthConditions.includes("kidney_issues")) {
    warnings.push({
      level: "caution",
      category: "medical",
      message:
        "Kidney health note: Some high-potassium or high-protein ingredients may need to be moderated. Consult your dietitian or nephrologist.",
    });
  }

  // ── Medications: general caution
  if (profile.medications.trim().length > 0) {
    warnings.push({
      level: "info",
      category: "medical",
      message:
        "You listed medications in your profile. Some foods may interact with medications (e.g., grapefruit with certain drugs, leafy greens with blood thinners). Consult your pharmacist or doctor.",
    });
  }

  // ── Elderly swallowing / chewing
  if (
    profile.elderlyConcerns.includes("chewing_difficulty") ||
    profile.elderlyConcerns.includes("swallowing_difficulty")
  ) {
    const firmFoods = ingredientsContain(ingredients, [
      "steak", "raw carrot", "raw celery", "nuts", "seeds", "whole grain", "crusty bread",
    ]);
    if (firmFoods.length > 0) {
      warnings.push({
        level: "caution",
        category: "elderly",
        message: `Some ingredients may be difficult to chew or swallow: ${firmFoods.slice(0, 2).join(", ")}. Consider softer preparations or finer cuts.`,
      });
    }
  }

  return warnings;
}

// ─── Disclaimer required logic ─────────────────────────────────────────────

export function disclaimerRequired(profile: UserProfile, warnings: RecipeWarning[]): boolean {
  return (
    warnings.some((w) => w.level === "warning" || w.level === "caution") ||
    profile.healthConditions.some((c) => c !== "none") ||
    profile.medications.trim().length > 0 ||
    profile.isPregnant === true ||
    profile.age >= 65 ||
    profile.allergies.length > 0
  );
}
