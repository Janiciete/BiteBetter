import type { TransformedRecipe } from "@/types/recipe";
import type { UserProfile } from "@/types/profile";
import type { ParsedRecipe } from "@/types/recipe";

interface TransformInput {
  rawRecipeText: string;
  parsedRecipe: ParsedRecipe;
  userProfile: UserProfile;
  ruleBasedResult: TransformedRecipe;
}

export async function transformRecipeWithClaude(
  input: TransformInput
): Promise<TransformedRecipe | null> {
  try {
    const res = await fetch("/api/claude/transform-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as
      | { success: true; result: TransformedRecipe }
      | { success: false; reason: string };

    if (!data.success) return null;

    return data.result;
  } catch {
    return null;
  }
}
