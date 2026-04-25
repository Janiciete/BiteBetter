import type { RecipeScores } from "./scores";

export interface RecipeFeedback {
  wouldMakeAgain: boolean | null;
  badSwaps: string;
  tooExpensive: boolean | null;
  easyToFollow: boolean | null;
  notes: string;
}

export interface SavedRecipe {
  id: string;
  savedAt: string;
  originalRecipeName: string;
  transformedRecipeName: string;
  servings: number;
  originalText: string;
  transformedIngredients: TransformedIngredient[];
  instructions: string[];
  keyChanges: string[];
  warnings: RecipeWarning[];
  explanation: string;
  beforeNutrition: NutritionEstimate;
  afterNutrition: NutritionEstimate;
  scores: RecipeScores;
  groceryItems: GroceryItem[];
  estimatedCost: number;
  costPerServing: number;
  disclaimerRequired: boolean;
  missingInfoQuestions: string[];
  nutritionSource?: "usda" | "fatsecret" | "static";
  rating?: number;
  feedback?: RecipeFeedback;
}

export interface GroceryChecklistItem {
  key: string;
  name: string;
  amounts: string[];
  estimatedPrice: number;
  recipeNames: string[];
  checked: boolean;
}

export interface ParsedIngredient {
  raw: string;
  amount?: number;
  unit?: string;
  item: string;
  isVague: boolean;
}

export interface ParsedRecipe {
  recipeName: string;
  servings: number;
  ingredients: ParsedIngredient[];
  instructions: string[];
  missingInfoQuestions: string[];
}

export interface NutritionEstimate {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  added_sugar_g: number;
}

export type WarningLevel = "info" | "caution" | "warning";
export type WarningCategory =
  | "allergy"
  | "medical"
  | "pregnancy"
  | "elderly"
  | "food_safety"
  | "general";

export interface RecipeWarning {
  message: string;
  level: WarningLevel;
  category: WarningCategory;
}

export type ChangeType = "substitution" | "reduction" | "addition" | "removal";

export interface TransformedIngredient {
  original: string;
  transformed: string;
  changed: boolean;
  changeType?: ChangeType;
  reason?: string;
}

export interface GroceryItem {
  name: string;
  amount: string;
  estimatedPrice: number;
}

export interface TransformedRecipe {
  originalRecipeName: string;
  transformedRecipeName: string;
  servings: number;
  originalIngredients: ParsedIngredient[];
  transformedIngredients: TransformedIngredient[];
  instructions: string[];
  keyChanges: string[];
  warnings: RecipeWarning[];
  explanation: string;
  beforeNutrition: NutritionEstimate;
  afterNutrition: NutritionEstimate;
  scores: RecipeScores;
  groceryItems: GroceryItem[];
  estimatedCost: number;
  costPerServing: number;
  disclaimerRequired: boolean;
  missingInfoQuestions: string[];
  nutritionSource?: "usda" | "fatsecret" | "static";
}
