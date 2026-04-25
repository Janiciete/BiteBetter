"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parseRecipe } from "@/lib/recipe-parser";
import { transformRecipe } from "@/lib/recipe-transformer";
import { MEDICAL_DISCLAIMER } from "@/lib/safety";
import type { UserProfile } from "@/types/profile";
import type { TransformedRecipe, RecipeWarning } from "@/types/recipe";

// ─── Tiny helpers ─────────────────────────────────────────────────────────

function fmt(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(n: number): string {
  if (n >= 80) return "text-emerald-600";
  if (n >= 60) return "text-amber-500";
  return "text-red-500";
}
function scoreBg(n: number): string {
  if (n >= 80) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (n >= 60) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-red-50 border-red-200 text-red-600";
}
function warnBg(level: RecipeWarning["level"]): string {
  if (level === "warning") return "bg-red-50 border-red-200 text-red-700";
  if (level === "caution") return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-blue-50 border-blue-200 text-blue-700";
}

const EXAMPLE_RECIPE = `Chicken Pasta Bake

Serves 4

Ingredients:
- 400g chicken breast
- 300g penne pasta
- 2 tbsp butter
- 1 cup heavy cream
- 1/2 cup parmesan cheese, grated
- 2 cloves garlic, minced
- 1 tsp salt
- 1/2 tsp black pepper
- 1 tbsp olive oil
- 100g spinach

Instructions:
1. Preheat oven to 200°C (400°F).
2. Cook pasta until al dente, drain and set aside.
3. Heat butter and olive oil in a pan over medium heat.
4. Add garlic and cook for 1 minute.
5. Add chicken and cook until golden, about 8 minutes.
6. Pour in cream, season with salt and pepper, simmer 5 minutes.
7. Combine pasta, chicken mixture, and spinach in a baking dish.
8. Top with parmesan and bake for 20 minutes until golden.`;

// ─── Nutrition row ─────────────────────────────────────────────────────────

function NutritionRow({
  label,
  before,
  after,
  unit,
  lowerIsBetter = true,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  const improved = lowerIsBetter ? after < before - 0.5 : after > before + 0.5;
  const worsened = lowerIsBetter ? after > before + 0.5 : after < before - 0.5;
  const delta = after - before;
  const sign = delta >= 0 ? "+" : "";

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="py-2 pr-4 text-sm text-gray-500 w-36">{label}</td>
      <td className="py-2 pr-4 text-sm text-gray-700 text-right">{before}{unit}</td>
      <td className="py-2 pr-4 text-sm font-semibold text-gray-800 text-right">{after}{unit}</td>
      <td className="py-2 text-sm text-right font-medium">
        <span
          className={
            improved
              ? "text-emerald-600"
              : worsened
              ? "text-red-500"
              : "text-gray-400"
          }
        >
          {sign}{Math.round(delta * 10) / 10}{unit}
          {improved ? " ↓" : worsened ? " ↑" : " →"}
        </span>
      </td>
    </tr>
  );
}

// ─── Score badge ───────────────────────────────────────────────────────────

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className={`text-center p-3 rounded-xl border ${scoreBg(value)}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5">{label}</p>
    </div>
  );
}

// ─── Profile status card ────────────────────────────────────────────────────

function ProfileStatusCard({ profile }: { profile: UserProfile }) {
  const goals = profile.nutritionGoals.slice(0, 3).map(fmt);
  const allergies = profile.allergies.filter((a) => a !== "other");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <span className="text-xs font-medium text-gray-500">Transforming for</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {goals.length > 0 ? (
          goals.map((g) => (
            <span key={g} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-medium">
              {g}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">No goals set</span>
        )}
      </div>
      {allergies.length > 0 && (
        <>
          <span className="text-xs text-gray-300">|</span>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs font-medium text-gray-500">Allergies:</span>
            {allergies.map((a) => (
              <span key={a} className="text-xs bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full font-medium">
                {fmt(a)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ChefPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [recipeText, setRecipeText] = useState("");
  const [result, setResult] = useState<TransformedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bitebetter_profile");
      if (raw) setProfile(JSON.parse(raw) as UserProfile);
    } catch {
      // ignore
    }
    setProfileLoaded(true);
  }, []);

  async function handleTransform() {
    if (!recipeText.trim()) {
      setError("Please paste a recipe before transforming.");
      return;
    }
    if (!profile) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setShowDetails(false);

    // Small delay so the loading state renders visibly
    await new Promise((r) => setTimeout(r, 350));

    try {
      const parsed = parseRecipe(recipeText);
      const transformed = transformRecipe(recipeText, parsed, profile);
      setResult(transformed);
      // Scroll result into view
      setTimeout(() => document.getElementById("result-top")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
      setError("Something went wrong. Try repasting your recipe or use the example.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── No-profile state ────────────────────────────────────────────────────
  if (profileLoaded && !profile) {
    return (
      <div className="max-w-xl mx-auto mt-16 flex flex-col items-center text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Create your nutrition profile first</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          BiteBetter personalizes every recipe transformation based on your goals, allergies, and health background. Set up your profile to get started.
        </p>
        <Link
          href="/onboarding"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Create Nutrition Profile
        </Link>
      </div>
    );
  }

  if (!profileLoaded) return null;

  // ── Main view ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chef</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Paste any recipe and get a personalized transformation based on your profile.
        </p>
      </div>

      {/* Profile status */}
      {profile && <ProfileStatusCard profile={profile} />}

      {/* Input card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700">Your Recipe</label>
          <button
            onClick={() => setRecipeText(EXAMPLE_RECIPE)}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
          >
            Use example recipe
          </button>
        </div>
        <textarea
          rows={12}
          value={recipeText}
          onChange={(e) => {
            setRecipeText(e.target.value);
            setError(null);
          }}
          placeholder={"Paste or type your recipe here...\n\nIncludes:\n- Recipe name\n- Servings\n- Ingredients list\n- Instructions"}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-colors"
        />
        {error && (
          <p className="text-sm text-red-500 font-medium">{error}</p>
        )}
        <button
          onClick={handleTransform}
          disabled={isLoading || !recipeText.trim()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Personalizing your recipe…
            </>
          ) : (
            "Transform Recipe"
          )}
        </button>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {result && (
        <div id="result-top" className="space-y-4">

          {/* Header card: name + overall score */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                Personalized Recipe
              </p>
              <h2 className="text-xl font-bold text-gray-900">{result.transformedRecipeName}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {result.servings} serving{result.servings !== 1 ? "s" : ""}
                {" · "}Original: {result.originalRecipeName}
              </p>
            </div>
            <div className="text-center shrink-0">
              <p className={`text-5xl font-bold leading-none ${scoreColor(result.scores.overall)}`}>
                {result.scores.overall}
              </p>
              <p className="text-xs text-gray-400 mt-1 font-medium">Overall Score</p>
            </div>
          </div>

          {/* Before / after nutrition */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Nutrition per Serving <span className="text-gray-300 font-normal">(estimated)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="py-1.5 pr-4 text-left font-medium w-36">Nutrient</th>
                    <th className="py-1.5 pr-4 text-right font-medium">Before</th>
                    <th className="py-1.5 pr-4 text-right font-medium">After</th>
                    <th className="py-1.5 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  <NutritionRow label="Calories" before={result.beforeNutrition.calories} after={result.afterNutrition.calories} unit=" kcal" />
                  <NutritionRow label="Protein" before={result.beforeNutrition.protein_g} after={result.afterNutrition.protein_g} unit="g" lowerIsBetter={false} />
                  <NutritionRow label="Sodium" before={result.beforeNutrition.sodium_mg} after={result.afterNutrition.sodium_mg} unit="mg" />
                  <NutritionRow label="Added Sugar" before={result.beforeNutrition.added_sugar_g} after={result.afterNutrition.added_sugar_g} unit="g" />
                  <NutritionRow label="Fiber" before={result.beforeNutrition.fiber_g} after={result.afterNutrition.fiber_g} unit="g" lowerIsBetter={false} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Key changes */}
          {result.keyChanges.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Key Changes
              </h3>
              <ul className="space-y-2">
                {result.keyChanges.map((change, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 text-xs flex items-center justify-center shrink-0 font-bold">
                      {i + 1}
                    </span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cost summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Estimated Cost
              </h3>
              <p className="text-2xl font-bold text-gray-900">${result.estimatedCost.toFixed(2)}</p>
              <p className="text-sm text-gray-400">${result.costPerServing.toFixed(2)} per serving</p>
            </div>
            {profile && profile.weeklyBudget > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Weekly budget</p>
                <p className="text-sm font-semibold text-gray-700">${profile.weeklyBudget}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {Math.round((result.estimatedCost / profile.weeklyBudget) * 100)}% of budget
                </p>
              </div>
            )}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <div key={i} className={`rounded-xl border p-4 text-sm ${warnBg(w.level)}`}>
                  <p>{w.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Explanation */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Why These Changes?
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">{result.explanation}</p>
          </div>

          {/* Transformed ingredients */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Final Ingredients
            </h3>
            <ul className="space-y-2">
              {result.transformedIngredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  {ing.changed ? (
                    <>
                      <span className="mt-0.5 text-emerald-500 shrink-0 font-bold">→</span>
                      <div>
                        <span className="font-medium text-emerald-700">{ing.transformed}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          (was: <span className="line-through">{ing.original}</span>)
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="mt-0.5 text-gray-300 shrink-0">•</span>
                      <span className="text-gray-700">{ing.original}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions */}
          {result.instructions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Instructions
              </h3>
              <ol className="space-y-3">
                {result.instructions.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              {result.transformedIngredients.some((t) => t.changed) && (
                <p className="text-xs text-gray-400 mt-4 border-t border-gray-50 pt-3">
                  Use the substituted ingredients listed above wherever the original recipe calls for them.
                </p>
              )}
            </div>
          )}

          {/* Expandable details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span>Show Details</span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${showDetails ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDetails && (
              <div className="px-6 pb-6 space-y-5 border-t border-gray-50">
                {/* Full scores */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-3">
                    Full Scores
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <ScoreBadge label="Health" value={result.scores.health} />
                    <ScoreBadge label="Taste" value={result.scores.taste} />
                    <ScoreBadge label="Transformation" value={result.scores.transformation} />
                    <ScoreBadge label="Budget" value={result.scores.budget} />
                  </div>
                </div>

                {/* Full nutrition */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Full Nutrition (per serving, estimated)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    {(
                      [
                        ["Calories", result.afterNutrition.calories, " kcal"],
                        ["Protein", result.afterNutrition.protein_g, "g"],
                        ["Carbs", result.afterNutrition.carbs_g, "g"],
                        ["Fat", result.afterNutrition.fat_g, "g"],
                        ["Fiber", result.afterNutrition.fiber_g, "g"],
                        ["Sodium", result.afterNutrition.sodium_mg, "mg"],
                        ["Added Sugar", result.afterNutrition.added_sugar_g, "g"],
                      ] as [string, number, string][]
                    ).map(([label, val, unit]) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="font-semibold text-gray-800">{val}{unit}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grocery items */}
                {result.groceryItems.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                      Grocery Items Preview
                    </h4>
                    <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                      {result.groceryItems.slice(0, 8).map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-gray-700 truncate flex-1">{item.name}</span>
                          <span className="text-gray-400 text-xs ml-3 shrink-0">{item.amount}</span>
                          <span className="font-medium text-gray-600 ml-4 w-14 text-right shrink-0">
                            ${item.estimatedPrice.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Prices are rough estimates for demo purposes only.
                    </p>
                  </div>
                )}

                {/* Missing info questions */}
                {result.missingInfoQuestions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Vague Quantities Detected
                    </h4>
                    <ul className="space-y-1.5">
                      {result.missingInfoQuestions.map((q, i) => (
                        <li key={i} className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Medical disclaimer */}
          {result.disclaimerRequired && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              {MEDICAL_DISCLAIMER}
            </div>
          )}

          {/* Save recipe placeholder */}
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">Save this recipe</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Saving to your Recipes tab and Grocery List is coming in the next phase.
              </p>
            </div>
            <button
              disabled
              className="shrink-0 bg-gray-100 text-gray-400 font-semibold px-5 py-2.5 rounded-xl text-sm cursor-not-allowed"
            >
              Save Recipe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
