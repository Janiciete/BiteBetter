import { NextRequest, NextResponse } from "next/server";
import type { NutritionEstimate } from "@/types/recipe";

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

// USDA returns nutrients in different shapes depending on dataType.
// This handles both SR Legacy / Foundation and Branded.
type RawNutrient = {
  nutrientName?: string;
  nutrient?: { name?: string; unitName?: string };
  value?: number;
  amount?: number;
  unitName?: string;
};

function extractNutrients(raw: RawNutrient[]): NutritionEstimate {
  let calories = 0, protein_g = 0, carbs_g = 0, fat_g = 0;
  let fiber_g = 0, sodium_mg = 0, added_sugar_g = 0;

  for (const fn of raw) {
    const name = (fn.nutrientName ?? fn.nutrient?.name ?? "").toLowerCase().trim();
    const unit = (fn.unitName ?? fn.nutrient?.unitName ?? "").toLowerCase().trim();
    const value = fn.value ?? fn.amount ?? 0;

    if (name.includes("energy") && unit === "kcal") {
      calories = value;
    } else if (name === "protein") {
      protein_g = value;
    } else if (name.startsWith("carbohydrate")) {
      carbs_g = value;
    } else if (name.startsWith("total lipid") || name === "fat") {
      fat_g = value;
    } else if (name.startsWith("fiber, total dietary")) {
      fiber_g = value;
    } else if (name.startsWith("sodium")) {
      sodium_mg = value; // USDA reports sodium in mg
    } else if (name === "sugars, added") {
      added_sugar_g = value;
    }
  }

  return {
    calories: Math.round(calories),
    protein_g: Math.round(protein_g * 10) / 10,
    carbs_g: Math.round(carbs_g * 10) / 10,
    fat_g: Math.round(fat_g * 10) / 10,
    fiber_g: Math.round(fiber_g * 10) / 10,
    sodium_mg: Math.round(sodium_mg),
    added_sugar_g: Math.round(added_sugar_g * 10) / 10,
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, reason: "missing_api_key" });
  }

  let fdcId: number;
  try {
    const body = (await req.json()) as { fdcId: number };
    fdcId = Number(body.fdcId);
    if (!Number.isFinite(fdcId)) throw new Error("invalid fdcId");
  } catch {
    return NextResponse.json({ success: false, reason: "invalid_request" });
  }

  try {
    const url = new URL(`${USDA_BASE}/food/${fdcId}`);
    url.searchParams.set("api_key", apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return NextResponse.json({ success: false, reason: "api_error" });

    const data = await res.json() as {
      fdcId: number;
      description: string;
      foodNutrients?: RawNutrient[];
    };

    const nutritionPer100g = extractNutrients(data.foodNutrients ?? []);

    return NextResponse.json({
      success: true,
      fdcId: data.fdcId,
      description: data.description,
      nutritionPer100g,
    });
  } catch {
    return NextResponse.json({ success: false, reason: "api_error" });
  }
}
