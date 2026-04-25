import { NextRequest, NextResponse } from "next/server";

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

export async function POST(req: NextRequest) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, reason: "missing_api_key" });
  }

  let query: string;
  try {
    const body = (await req.json()) as { query: string };
    query = body.query?.trim();
    if (!query) throw new Error("empty query");
  } catch {
    return NextResponse.json({ success: false, reason: "invalid_request" });
  }

  try {
    const url = new URL(`${USDA_BASE}/foods/search`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return NextResponse.json({ success: false, reason: "api_error" });

    const data = await res.json() as {
      foods?: { fdcId: number; description: string; dataType: string; brandOwner?: string }[];
    };

    return NextResponse.json({
      success: true,
      foods: (data.foods ?? []).map((f) => ({
        fdcId: f.fdcId,
        description: f.description,
        dataType: f.dataType,
        brandOwner: f.brandOwner,
      })),
    });
  } catch {
    return NextResponse.json({ success: false, reason: "api_error" });
  }
}
