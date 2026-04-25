import type { ActivityLevel, BMICategory, Gender, HeightUnit, WeightUnit } from "@/types/profile";

function toHeightCm(value: number, unit: HeightUnit): number {
  return unit === "in" ? value * 2.54 : value;
}

function toWeightKg(value: number, unit: WeightUnit): number {
  return unit === "lb" ? value * 0.453592 : value;
}

export function calculateBMI(
  heightValue: number,
  weightValue: number,
  heightUnit: HeightUnit,
  weightUnit: WeightUnit
): number {
  const heightM = toHeightCm(heightValue, heightUnit) / 100;
  const weightKg = toWeightKg(weightValue, weightUnit);
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}

export function getBMICategory(bmi: number): BMICategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function calculateSimpleEER(
  age: number,
  gender: Gender,
  heightValue: number,
  heightUnit: HeightUnit,
  weightValue: number,
  weightUnit: WeightUnit,
  activityLevel: ActivityLevel
): number {
  const heightCm = toHeightCm(heightValue, heightUnit);
  const weightKg = toWeightKg(weightValue, weightUnit);

  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    low_active: 1.375,
    active: 1.55,
    very_active: 1.725,
  };

  // Harris-Benedict BMR
  const bmr =
    gender === "male"
      ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
      : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;

  return Math.round(bmr * multipliers[activityLevel]);
}
