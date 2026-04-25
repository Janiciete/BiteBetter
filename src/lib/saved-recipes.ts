import type {
  TransformedRecipe,
  SavedRecipe,
  RecipeFeedback,
  GroceryChecklistItem,
} from "@/types/recipe";

const RECIPES_KEY = "bitebetter_saved_recipes";
const CHECKED_KEY = "bitebetter_grocery_checked_items";

// ─── Saved recipes ─────────────────────────────────────────────────────────

export function getSavedRecipes(): SavedRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECIPES_KEY);
    return raw ? (JSON.parse(raw) as SavedRecipe[]) : [];
  } catch {
    return [];
  }
}

function persistRecipes(recipes: SavedRecipe[]): void {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
}

export function saveRecipe(
  recipe: TransformedRecipe,
  originalText: string
): SavedRecipe {
  const saved: SavedRecipe = {
    id: `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
    originalRecipeName: recipe.originalRecipeName,
    transformedRecipeName: recipe.transformedRecipeName,
    servings: recipe.servings,
    originalText,
    transformedIngredients: recipe.transformedIngredients,
    instructions: recipe.instructions,
    keyChanges: recipe.keyChanges,
    warnings: recipe.warnings,
    explanation: recipe.explanation,
    beforeNutrition: recipe.beforeNutrition,
    afterNutrition: recipe.afterNutrition,
    scores: recipe.scores,
    groceryItems: recipe.groceryItems,
    estimatedCost: recipe.estimatedCost,
    costPerServing: recipe.costPerServing,
    disclaimerRequired: recipe.disclaimerRequired,
    missingInfoQuestions: recipe.missingInfoQuestions,
  };
  const existing = getSavedRecipes();
  existing.unshift(saved);
  persistRecipes(existing);
  return saved;
}

export function deleteSavedRecipe(id: string): void {
  const recipes = getSavedRecipes().filter((r) => r.id !== id);
  persistRecipes(recipes);
}

export function updateRecipeRating(id: string, rating: number): void {
  const recipes = getSavedRecipes().map((r) =>
    r.id === id ? { ...r, rating } : r
  );
  persistRecipes(recipes);
}

export function updateRecipeFeedback(
  id: string,
  feedback: RecipeFeedback
): void {
  const recipes = getSavedRecipes().map((r) =>
    r.id === id ? { ...r, feedback } : r
  );
  persistRecipes(recipes);
}

// ─── Grocery checklist ─────────────────────────────────────────────────────

export function getCheckedGroceryItems(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHECKED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function setGroceryItemChecked(
  itemKey: string,
  checked: boolean
): void {
  if (typeof window === "undefined") return;
  const current = getCheckedGroceryItems();
  if (checked) {
    current[itemKey] = true;
  } else {
    delete current[itemKey];
  }
  localStorage.setItem(CHECKED_KEY, JSON.stringify(current));
}

export function getAggregatedGroceryItems(): GroceryChecklistItem[] {
  const recipes = getSavedRecipes();
  const checked = getCheckedGroceryItems();
  const map = new Map<string, GroceryChecklistItem>();

  for (const recipe of recipes) {
    for (const item of recipe.groceryItems) {
      const key = item.name.toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.amounts.push(item.amount);
        existing.estimatedPrice = Math.round((existing.estimatedPrice + item.estimatedPrice) * 100) / 100;
        if (!existing.recipeNames.includes(recipe.transformedRecipeName)) {
          existing.recipeNames.push(recipe.transformedRecipeName);
        }
      } else {
        map.set(key, {
          key,
          name: item.name,
          amounts: [item.amount],
          estimatedPrice: item.estimatedPrice,
          recipeNames: [recipe.transformedRecipeName],
          checked: !!checked[key],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
