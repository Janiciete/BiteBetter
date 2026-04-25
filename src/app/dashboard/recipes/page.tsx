"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getSavedRecipes,
  deleteSavedRecipeEverywhere,
  getSavedRecipesFromSupabaseAndSync,
} from "@/lib/saved-recipes";
import { MEDICAL_DISCLAIMER } from "@/lib/safety";
import type { SavedRecipe, RecipeWarning } from "@/types/recipe";

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function scoreColor(n: number): string {
  if (n >= 80) return "text-emerald-600";
  if (n >= 60) return "text-amber-500";
  return "text-red-500";
}
function scoreBg(n: number): string {
  if (n >= 80) return "bg-emerald-50 border-emerald-100 text-emerald-700";
  if (n >= 60) return "bg-amber-50 border-amber-100 text-amber-700";
  return "bg-red-50 border-red-100 text-red-600";
}
function warnBg(level: RecipeWarning["level"]): string {
  if (level === "warning") return "bg-red-50 border-red-200 text-red-700";
  if (level === "caution") return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-blue-50 border-blue-200 text-blue-700";
}

function StarDisplay({ rating }: { rating?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${rating && star <= rating ? "text-amber-400" : "text-gray-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Recipe card ───────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  expanded,
  onToggle,
  onDelete,
}: {
  recipe: SavedRecipe;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const mainWarning = recipe.warnings.find(
    (w) => w.level === "warning" || w.level === "caution"
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Left: names + meta */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <h2 className="font-semibold text-gray-900 leading-snug">{recipe.transformedRecipeName}</h2>
            <p className="text-xs text-gray-400">
              From: {recipe.originalRecipeName} · {formatDate(recipe.savedAt)}
              {" · "}{recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
            </p>

            {/* Rating + would make again */}
            <div className="flex items-center flex-wrap gap-3 pt-0.5">
              {recipe.rating ? (
                <StarDisplay rating={recipe.rating} />
              ) : (
                <span className="text-xs text-gray-300 italic">Not rated</span>
              )}
              {recipe.feedback?.wouldMakeAgain === true && (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium border border-emerald-100">
                  Would make again ✓
                </span>
              )}
              {recipe.feedback?.wouldMakeAgain === false && (
                <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium border border-red-100">
                  Wouldn't make again
                </span>
              )}
            </div>

            {/* Main warning */}
            {mainWarning && (
              <div className={`text-xs rounded-lg border px-2.5 py-1.5 mt-1 ${warnBg(mainWarning.level)}`}>
                {mainWarning.message}
              </div>
            )}
          </div>

          {/* Right: scores + cost */}
          <div className="shrink-0 text-right space-y-1.5">
            <div>
              <p className={`text-3xl font-bold leading-none ${scoreColor(recipe.scores.overall)}`}>
                {recipe.scores.overall}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Overall</p>
            </div>
            <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${scoreBg(recipe.scores.health)}`}>
              Health {recipe.scores.health}
            </div>
            <p className="text-xs text-gray-500 font-medium">
              ${recipe.estimatedCost.toFixed(2)}
              <span className="text-gray-400 font-normal"> total</span>
            </p>
            <p className="text-xs text-gray-400">${recipe.costPerServing.toFixed(2)}/serving</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
          <button
            onClick={onToggle}
            className="flex-1 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            {expanded ? "Hide Details" : "View Details"}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="text-sm font-medium text-red-400 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-50 px-5 pb-5 space-y-5">

          {/* Key changes */}
          {recipe.keyChanges.length > 0 && (
            <div className="pt-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Key Changes</h3>
              <ul className="space-y-1.5">
                {recipe.keyChanges.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 text-xs flex items-center justify-center shrink-0 font-bold">
                      {i + 1}
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Before/after nutrition */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Nutrition per Serving <span className="text-gray-300 font-normal">(estimated)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  ["Calories", recipe.beforeNutrition.calories, recipe.afterNutrition.calories, " kcal"],
                  ["Protein", recipe.beforeNutrition.protein_g, recipe.afterNutrition.protein_g, "g"],
                  ["Sodium", recipe.beforeNutrition.sodium_mg, recipe.afterNutrition.sodium_mg, "mg"],
                  ["Fiber", recipe.beforeNutrition.fiber_g, recipe.afterNutrition.fiber_g, "g"],
                ] as [string, number, number, string][]
              ).map(([label, before, after, unit]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{after}{unit}</p>
                  <p className="text-xs text-gray-400 mt-0.5">was {before}{unit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ingredients</h3>
            <ul className="space-y-1.5">
              {recipe.transformedIngredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {ing.changed ? (
                    <>
                      <span className="text-emerald-500 shrink-0 font-bold mt-0.5">→</span>
                      <div>
                        <span className="font-medium text-emerald-700">{ing.transformed}</span>
                        <span className="text-xs text-gray-400 ml-1.5">
                          (was: <span className="line-through">{ing.original}</span>)
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-300 shrink-0 mt-0.5">•</span>
                      <span className="text-gray-700">{ing.original}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions */}
          {recipe.instructions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Instructions</h3>
              <ol className="space-y-2">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Explanation */}
          {recipe.explanation && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Why These Changes?</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{recipe.explanation}</p>
            </div>
          )}

          {/* Feedback summary */}
          {recipe.feedback && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Feedback</h3>
              {recipe.feedback.wouldMakeAgain !== null && (
                <p className="text-sm text-gray-600">
                  Would make again:{" "}
                  <span className={recipe.feedback.wouldMakeAgain ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                    {recipe.feedback.wouldMakeAgain ? "Yes" : "No"}
                  </span>
                </p>
              )}
              {recipe.feedback.tooExpensive !== null && (
                <p className="text-sm text-gray-600">
                  Too expensive:{" "}
                  <span className="font-medium text-gray-700">{recipe.feedback.tooExpensive ? "Yes" : "No"}</span>
                </p>
              )}
              {recipe.feedback.easyToFollow !== null && (
                <p className="text-sm text-gray-600">
                  Easy to follow:{" "}
                  <span className="font-medium text-gray-700">{recipe.feedback.easyToFollow ? "Yes" : "No"}</span>
                </p>
              )}
              {recipe.feedback.badSwaps.trim() && (
                <p className="text-sm text-gray-600">
                  Bad swaps: <span className="font-medium text-gray-700">{recipe.feedback.badSwaps}</span>
                </p>
              )}
              {recipe.feedback.notes.trim() && (
                <p className="text-sm text-gray-600">
                  Notes: <span className="italic text-gray-500">{recipe.feedback.notes}</span>
                </p>
              )}
            </div>
          )}

          {/* Medical disclaimer */}
          {recipe.disclaimerRequired && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
              {MEDICAL_DISCLAIMER}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRecipes(getSavedRecipes());
    setLoaded(true);
    getSavedRecipesFromSupabaseAndSync()
      .then((synced) => setRecipes(synced))
      .catch(console.warn);
  }, []);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete(id: string) {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    deleteSavedRecipeEverywhere(id).catch(console.warn);
  }

  if (!loaded) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="text-gray-500 mt-1 text-sm">Your saved personalized recipes.</p>
        </div>
        {recipes.length > 0 && (
          <span className="text-sm text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-1 shadow-sm">
            {recipes.length} saved
          </span>
        )}
      </div>

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 space-y-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-700">No saved recipes yet</h2>
            <p className="text-sm text-gray-400 mt-1">Transform and save a recipe from the Chef tab to see it here.</p>
          </div>
          <Link
            href="/dashboard/chef"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Go to Chef
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              expanded={expandedIds.has(recipe.id)}
              onToggle={() => toggleExpand(recipe.id)}
              onDelete={() => handleDelete(recipe.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
