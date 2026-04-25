import { NextRequest, NextResponse } from "next/server";
import { getFatSecretToken, fatSecretPost } from "../_helpers";

type FSFood = {
  food_id?: string;
  food_name?: string;
  food_description?: string;
  brand_name?: string;
};

type FSSearchResponse = {
  foods?: {
    food?: FSFood | FSFood[];
  };
  error?: { code: string; message: string };
};

export async function POST(req: NextRequest) {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ success: false, reason: "missing_credentials" });
  }

  let query: string;
  try {
    const body = (await req.json()) as { query: string };
    query = body.query?.trim();
    if (!query) throw new Error("empty");
  } catch {
    return NextResponse.json({ success: false, reason: "invalid_request" });
  }

  try {
    const token = await getFatSecretToken(clientId, clientSecret);
    if (!token) return NextResponse.json({ success: false, reason: "api_error" });

    const data = (await fatSecretPost(token, {
      method: "foods.search",
      search_expression: query,
      max_results: "5",
    })) as FSSearchResponse | null;

    if (!data || data.error) {
      return NextResponse.json({ success: false, reason: "api_error" });
    }

    // FatSecret returns a single object instead of an array when there is only one result
    const raw = data.foods?.food;
    const foods: FSFood[] = !raw ? [] : Array.isArray(raw) ? raw : [raw];

    return NextResponse.json({
      success: true,
      foods: foods.map((f) => ({
        foodId: f.food_id ?? "",
        foodName: f.food_name ?? "",
        foodDescription: f.food_description,
        brandName: f.brand_name,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, reason: "api_error" });
  }
}
