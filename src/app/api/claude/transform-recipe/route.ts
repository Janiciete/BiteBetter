import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { TransformedRecipe, TransformedIngredient, RecipeWarning } from "@/types/recipe";
import type { UserProfile } from "@/types/profile";
import type { ParsedRecipe } from "@/types/recipe";

// ─── Types ─────────────────────────────────────────────────────────────────

interface RequestBody {
  rawRecipeText: string;
  parsedRecipe: ParsedRecipe;
  userProfile: UserProfile;
  ruleBasedResult: TransformedRecipe;
}

interface ClaudeEnhancement {
  transformedRecipeName: string;
  transformedIngredients: TransformedIngredient[];
  keyChanges: string[];
  explanation: string;
  instructions: string[];
  additionalWarnings: RecipeWarning[];
}

// ─── Profile summary for prompt ────────────────────────────────────────────

function buildProfileSummary(p: UserProfile): string {
  const lines: string[] = [
    `Age: ${p.age}, Gender: ${p.gender}`,
    `Goals: ${p.nutritionGoals.length ? p.nutritionGoals.join(", ") : "none"}`,
    `Allergies: ${p.allergies.length ? p.allergies.join(", ") : "none"}`,
    `Dietary preferences: ${p.dietaryPreferences.length ? p.dietaryPreferences.join(", ") : "none"}`,
    `Health conditions: ${p.healthConditions.filter((c) => c !== "none").join(", ") || "none"}`,
    `Weekly grocery budget: $${p.weeklyBudget > 0 ? p.weeklyBudget : "not set"}`,
  ];
  if (p.isPregnant) lines.push(`Pregnant: yes (${p.weeksPregnant ?? "?"} weeks)`);
  if (p.elderlyConcerns.length) lines.push(`Elderly concerns: ${p.elderlyConcerns.join(", ")}`);
  return lines.join("\n");
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, reason: "missing_api_key" });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ success: false, reason: "invalid_request" });
  }

  const { rawRecipeText, userProfile, ruleBasedResult } = body;

  const profileSummary = buildProfileSummary(userProfile);

  const changedIngredients = ruleBasedResult.transformedIngredients
    .filter((i) => i.changed)
    .map((i) => `  • ${i.original} → ${i.transformed}${i.reason ? ` (${i.reason})` : ""}`)
    .join("\n");

  const { beforeNutrition: b, afterNutrition: a } = ruleBasedResult;

  const userMessage = `USER PROFILE:
${profileSummary}

ORIGINAL RECIPE:
${rawRecipeText}

RULE-BASED TRANSFORMATION TO IMPROVE:
Name: ${ruleBasedResult.transformedRecipeName}
Changed ingredients:
${changedIngredients || "  (none)"}
Key changes: ${JSON.stringify(ruleBasedResult.keyChanges)}
Explanation: ${ruleBasedResult.explanation}

Nutrition per serving (before → after):
  Calories: ${b.calories} → ${a.calories} kcal
  Protein: ${b.protein_g} → ${a.protein_g} g
  Sodium: ${b.sodium_mg} → ${a.sodium_mg} mg
  Added sugar: ${b.added_sugar_g} → ${a.added_sugar_g} g
  Fiber: ${b.fiber_g} → ${a.fiber_g} g`;

  const systemPrompt = `You are a professional recipe transformation assistant for BiteBetter, a personalized nutrition app.
Improve the rule-based recipe transformation provided to make it more helpful, natural, and aligned with the user's profile.

You MUST return ONLY a valid JSON object — no markdown, no code fences, no extra text.

Return exactly this structure:
{
  "transformedRecipeName": string,
  "transformedIngredients": [
    { "original": string, "transformed": string, "changed": boolean, "changeType": "substitution"|"reduction"|"addition"|"removal"|null, "reason": string|null }
  ],
  "keyChanges": string[],
  "explanation": string,
  "instructions": string[],
  "additionalWarnings": [
    { "level": "info"|"caution"|"warning", "category": "allergy"|"medical"|"pregnancy"|"elderly"|"food_safety"|"general", "message": string }
  ]
}

Rules you must follow:
- Include ALL ingredients from the original recipe in transformedIngredients (both changed and unchanged).
- For unchanged ingredients keep changed=false and transformed equal to original.
- Respect every allergy, dietary preference, and health condition in the profile — never undo an allergy-driven substitution.
- Do NOT add medical diagnosis language or claim to diagnose any condition.
- Do NOT mention "Worth-It %".
- Keep keyChanges to 3–5 concise bullet-style strings.
- Keep explanation to 2–4 sentences.
- additionalWarnings is for genuinely new warnings only — leave it empty if none are needed.
- Instructions must reflect substituted ingredients.`;

  let rawContent: string;
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      return NextResponse.json({ success: false, reason: "unexpected_response" });
    }
    rawContent = block.text.trim();
  } catch {
    return NextResponse.json({ success: false, reason: "api_error" });
  }

  let enhancement: ClaudeEnhancement;
  try {
    // Strip accidental markdown fences if Claude added them despite instructions
    const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    enhancement = JSON.parse(cleaned) as ClaudeEnhancement;
  } catch {
    return NextResponse.json({ success: false, reason: "invalid_json" });
  }

  // Validate required fields exist
  if (
    typeof enhancement.transformedRecipeName !== "string" ||
    !Array.isArray(enhancement.transformedIngredients) ||
    !Array.isArray(enhancement.keyChanges) ||
    typeof enhancement.explanation !== "string" ||
    !Array.isArray(enhancement.instructions)
  ) {
    return NextResponse.json({ success: false, reason: "invalid_json" });
  }

  // Merge: always keep all rule-based warnings; add Claude's additional ones
  const mergedWarnings: RecipeWarning[] = [
    ...ruleBasedResult.warnings,
    ...(Array.isArray(enhancement.additionalWarnings) ? enhancement.additionalWarnings : []),
  ];

  // Preserve all numeric/computed fields from the rule-based result
  const result: TransformedRecipe = {
    originalRecipeName: ruleBasedResult.originalRecipeName,
    transformedRecipeName: enhancement.transformedRecipeName,
    servings: ruleBasedResult.servings,
    originalIngredients: ruleBasedResult.originalIngredients,
    transformedIngredients: enhancement.transformedIngredients,
    instructions: enhancement.instructions,
    keyChanges: enhancement.keyChanges,
    warnings: mergedWarnings,
    explanation: enhancement.explanation,
    beforeNutrition: ruleBasedResult.beforeNutrition,
    afterNutrition: ruleBasedResult.afterNutrition,
    scores: ruleBasedResult.scores,
    groceryItems: ruleBasedResult.groceryItems,
    estimatedCost: ruleBasedResult.estimatedCost,
    costPerServing: ruleBasedResult.costPerServing,
    // Keep disclaimer true if rule-based required it
    disclaimerRequired:
      ruleBasedResult.disclaimerRequired || mergedWarnings.some((w) => w.level !== "info"),
    missingInfoQuestions: ruleBasedResult.missingInfoQuestions,
  };

  return NextResponse.json({ success: true, result });
}
