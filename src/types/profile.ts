export type Gender = "male" | "female" | "other";
export type HeightUnit = "cm" | "in";
export type WeightUnit = "kg" | "lb";

export type ActivityLevel = "sedentary" | "low_active" | "active" | "very_active";
export type ElderlyActivityLevel = "low" | "moderate" | "active";
export type AppetiteLevel = "normal" | "low_appetite" | "small_portions";
export type BMICategory = "underweight" | "normal" | "overweight" | "obese";

export type HealthCondition =
  | "diabetes"
  | "prediabetes"
  | "high_blood_pressure"
  | "high_cholesterol"
  | "kidney_issues"
  | "heart_disease"
  | "none";

export type Allergy = "nuts" | "dairy" | "shellfish" | "eggs" | "soy" | "wheat" | "sesame" | "other";

export type DietaryPreference =
  | "vegetarian"
  | "vegan"
  | "low_carb"
  | "keto"
  | "high_protein"
  | "gluten_free"
  | "dairy_free"
  | "low_sodium"
  | "low_sugar";

export type NutritionGoal =
  | "weight_loss"
  | "muscle_gain"
  | "maintenance"
  | "bulking"
  | "cutting"
  | "heart_health"
  | "blood_sugar_balance"
  | "budget_friendly"
  | "general_healthy";

export type PregnancyConcern =
  | "gestational_diabetes"
  | "anemia"
  | "preeclampsia"
  | "cravings"
  | "lactation_concerns"
  | "none";

export type ElderlyConcern = "soft_foods" | "chewing_difficulty" | "swallowing_difficulty";

export interface UserProfile {
  // Basic
  age: number;
  gender: Gender;
  heightValue: number;
  heightUnit: HeightUnit;
  weightValue: number;
  weightUnit: WeightUnit;
  activityLevel: ActivityLevel;

  // Health
  healthConditions: HealthCondition[];
  medications: string;

  // Pregnancy (female only)
  isPregnant: boolean | null;
  weeksPregnant: number | null;
  pregnancyConcerns: PregnancyConcern[];

  // Diet
  allergies: Allergy[];
  allergyOther: string;
  dietaryPreferences: DietaryPreference[];

  // Goals
  nutritionGoals: NutritionGoal[];
  dislikedFoods: string;
  appetiteLevel: AppetiteLevel;
  weeklyBudget: number;

  // Elderly (65+)
  elderlyConcerns: ElderlyConcern[];
  elderlyActivityLevel: ElderlyActivityLevel | null;

  // Calculated
  bmi: number;
  bmiCategory: BMICategory;
  estimatedEnergyRequirement: number;

  // Meta
  createdAt: string;
  updatedAt: string;
}
