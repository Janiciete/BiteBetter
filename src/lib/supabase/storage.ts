import { supabase } from "./client";
import type { UserProfile } from "@/types/profile";
import type { RecipeFeedback, SavedRecipe } from "@/types/recipe";

const DEMO_USER_ID = "demo-user";

// ─── Profile ───────────────────────────────────────────────────────────────

export async function saveProfileToSupabase(
  profile: UserProfile
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: DEMO_USER_ID,
        profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.warn("Supabase profile save failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase profile save failed:", e);
    return false;
  }
}

export async function getProfileFromSupabase(): Promise<UserProfile | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("profile")
      .eq("user_id", DEMO_USER_ID)
      .maybeSingle();
    if (error) {
      console.warn("Supabase profile fetch failed:", error.message);
      return null;
    }
    return data ? (data.profile as UserProfile) : null;
  } catch (e) {
    console.warn("Supabase profile fetch failed:", e);
    return null;
  }
}

// ─── Recipes ───────────────────────────────────────────────────────────────

export async function saveRecipeToSupabase(
  recipe: SavedRecipe
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("recipes").insert({
      user_id: DEMO_USER_ID,
      recipe,
      rating: recipe.rating ?? null,
      feedback: recipe.feedback ?? null,
    });
    if (error) {
      console.warn("Supabase recipe save failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase recipe save failed:", e);
    return false;
  }
}

export async function getRecipesFromSupabase(): Promise<SavedRecipe[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("recipes")
      .select("recipe, rating, feedback")
      .eq("user_id", DEMO_USER_ID)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("Supabase recipes fetch failed:", error.message);
      return null;
    }
    return (data ?? []).map((row) => ({
      ...(row.recipe as SavedRecipe),
      ...(row.rating !== null && row.rating !== undefined
        ? { rating: row.rating as number }
        : {}),
      ...(row.feedback !== null && row.feedback !== undefined
        ? { feedback: row.feedback as RecipeFeedback }
        : {}),
    }));
  } catch (e) {
    console.warn("Supabase recipes fetch failed:", e);
    return null;
  }
}

export async function deleteRecipeFromSupabase(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("user_id", DEMO_USER_ID)
      .filter("recipe->>id", "eq", id);
    if (error) {
      console.warn("Supabase recipe delete failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase recipe delete failed:", e);
    return false;
  }
}

export async function updateRecipeRatingInSupabase(
  id: string,
  rating: number
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("recipes")
      .update({ rating })
      .eq("user_id", DEMO_USER_ID)
      .filter("recipe->>id", "eq", id);
    if (error) {
      console.warn("Supabase rating update failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase rating update failed:", e);
    return false;
  }
}

export async function updateRecipeFeedbackInSupabase(
  id: string,
  feedback: RecipeFeedback
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("recipes")
      .update({ feedback })
      .eq("user_id", DEMO_USER_ID)
      .filter("recipe->>id", "eq", id);
    if (error) {
      console.warn("Supabase feedback update failed:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Supabase feedback update failed:", e);
    return false;
  }
}
