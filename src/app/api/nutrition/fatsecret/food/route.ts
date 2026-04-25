import { NextRequest, NextResponse } from "next/server";
import { getFatSecretToken, fatSecretPost } from "../_helpers";
import type { NutritionEstimate } from "@/types/recipe";

type FSServing = {
  serving_description?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  fiber?: string;
  sodium?: string;
  sugar?: string;
  added_sugars?: string;
};

type FSFoodResponse = {
  food?: {
    food_id?: string;
    food_name?: string;
    servings?: {
      serving?: FSServing | FSServing[];
    };
  };
  error?: { code: string; message: string };
};

function n(v: string | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

function servingToEstimate(s: FSServing, scaleFactor: number): NutritionEstimate {
  return {
    calories: Math.round(n(s.calories) * scaleFactor),
    protein_g: Math.round(n(s.protein) * scaleFactor * 10) / 10,
    carbs_g: Math.round(n(s.carbohydrate) * scaleFactor * 10) / 10,
    fat_g: Math.round(n(s.fat) * scaleFactor * 10) / 10,
    fiber_g: Math.round(n(s.fiber) * scaleFactor * 10) / 10,
    sodium_mg: Math.round(n(s.sodium) * scaleFactor),
    // Prefer added_sugars if present, fall back to sugar
    added_sugar_g: Math.round(n(s.added_sugars ?? s.sugar) * scaleFactor * 10) / 10,
  };
}

export async function POST(req: NextRequest) {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ success: false, reason: "missing_credentials" });
  }

  let foodId: string;
  try {
    const body = (await req.json()) as { foodId: string };
    foodId = String(body.foodId ?? "").trim();
    if (!foodId) throw new Error("empty");
  } catch {
    return NextResponse.json({ success: false, reason: "invalid_request" });
  }

  try {
    const token = await getFatSecretToken(clientId, clientSecret);
    if (!token) return NextResponse.json({ success: false, reason: "api_error" });

    const data = (await fatSecretPost(token, {
      method: "food.get.v2",
      food_id: foodId,
    })) as FSFoodResponse | null;

    if (!data || data.error || !data.food) {
      return NextResponse.json({ success: false, reason: "api_error" });
    }

    const food = data.food;
    const raw = food.servings?.serving;
    const servings: FSServing[] = !raw ? [] : Array.isArray(raw) ? raw : [raw];

    if (servings.length === 0) {
      return NextResponse.json({ success: false, reason: "no_servings" });
    }

    // Prefer a serving described as "100g" or with metric_serving_amount = 100 and unit = g
    const per100g = servings.find(
      (s) =>
        (s.serving_description?.toLowerCase().includes("100g") ||
          s.serving_description?.toLowerCase().includes("100 g")) ||
        (parseFloat(s.metric_serving_amount ?? "") === 100 &&
          s.metric_serving_unit?.toLowerCase() === "g")
    );

    let nutritionEstimate: NutritionEstimate;
    let isPer100g: boolean;

    if (per100g) {
      nutritionEstimate = servingToEstimate(per100g, 1);
      isPer100g = true;
    } else {
      // Normalize the first serving to per-100g if metric info is available
      const first = servings[0];
      const grams = parseFloat(first.metric_serving_amount ?? "0");
      const unit = first.metric_serving_unit?.toLowerCase();
      const scaleFactor = grams > 0 && unit === "g" ? 100 / grams : 1;
      nutritionEstimate = servingToEstimate(first, scaleFactor);
      isPer100g = grams > 0 && unit === "g";
    }

    return NextResponse.json({
      success: true,
      foodId: food.food_id ?? foodId,
      description: food.food_name ?? "",
      nutritionEstimate,
      isPer100g,
    });
  } catch {
    return NextResponse.json({ success: false, reason: "api_error" });
  }
}
