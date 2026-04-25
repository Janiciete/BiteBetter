"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getSavedRecipes,
  getSavedRecipesFromSupabaseAndSync,
} from "@/lib/saved-recipes";
import { MEDICAL_DISCLAIMER } from "@/lib/safety";
import type { SavedRecipe, RecipeWarning, WarningCategory } from "@/types/recipe";

// ─── Category inference ────────────────────────────────────────────────────

function inferCategory(text: string): string {
  const t = text.toLowerCase();
  if (/sodium|salt|soy sauce|low.sodium/.test(t)) return "Sodium";
  if (/sugar|sweetener|blood sugar/.test(t)) return "Blood Sugar";
  if (/protein|chicken|tofu|yogurt|beans|lentils/.test(t)) return "Protein";
  if (/dairy.free|gluten.free|allergy|nuts|shellfish|eggs|soy|wheat|sesame/.test(t)) return "Safety";
  if (/cost|budget|price/.test(t)) return "Budget";
  return "Nutrition Goal";
}

const CATEGORY_COLORS: Record<string, string> = {
  Sodium: "bg-blue-100 text-blue-700",
  "Blood Sugar": "bg-purple-100 text-purple-700",
  Protein: "bg-emerald-100 text-emerald-700",
  Safety: "bg-red-100 text-red-700",
  Budget: "bg-yellow-100 text-yellow-700",
  "Nutrition Goal": "bg-teal-100 text-teal-700",
};

// ─── Warning styling ───────────────────────────────────────────────────────

const WARNING_LEVEL_STYLES: Record<string, string> = {
  warning: "bg-red-50 border-red-200 text-red-800",
  caution: "bg-amber-50 border-amber-200 text-amber-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

const WARNING_LEVEL_BADGE: Record<string, string> = {
  warning: "bg-red-100 text-red-700",
  caution: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
};

function warningCategoryExplanation(category: WarningCategory): string {
  switch (category) {
    case "allergy":
      return "This warning appears because your profile includes an allergy that may conflict with this recipe.";
    case "pregnancy":
      return "This warning appears because some ingredients or preparation methods may need extra caution during pregnancy.";
    case "medical":
      return "This warning appears because your health profile includes a condition or medication-related consideration.";
    case "elderly":
      return "This warning appears because your profile includes chewing, swallowing, or age-related considerations.";
    case "food_safety":
      return "This warning appears because this ingredient or preparation method may need safer handling.";
    default:
      return "This warning is related to a general safety consideration.";
  }
}

// ─── Score explanations ────────────────────────────────────────────────────

const SCORE_META: Record<
  string,
  { label: string; color: string; explanation: string }
> = {
  overall: {
    label: "Overall Score",
    color: "text-emerald-600",
    explanation:
      "A combined score based on health, taste preservation, transformation quality, budget, and safety.",
  },
  health: {
    label: "Health Score",
    color: "text-blue-600",
    explanation:
      "How well the new recipe matches your nutrition goals and health profile.",
  },
  taste: {
    label: "Taste Score",
    color: "text-orange-500",
    explanation:
      "How much the transformed recipe tries to preserve the original flavor and style.",
  },
  transformation: {
    label: "Transformation Score",
    color: "text-purple-600",
    explanation:
      "How much the recipe improved compared with the original.",
  },
  budget: {
    label: "Budget Score",
    color: "text-yellow-600",
    explanation:
      "How well the recipe fits your grocery budget and estimated ingredient cost.",
  },
};

// ─── Nutrition rows ────────────────────────────────────────────────────────

const NUTRITION_META = [
  {
    key: "calories" as const,
    label: "Calories",
    unit: "kcal",
    explanation:
      "Calories are adjusted based on your goal, but lower is not always better.",
  },
  {
    key: "protein_g" as const,
    label: "Protein",
    unit: "g",
    explanation:
      "Protein supports fullness, muscle maintenance, and pregnancy/elderly nutrition needs depending on the profile.",
  },
  {
    key: "sodium_mg" as const,
    label: "Sodium",
    unit: "mg",
    explanation:
      "Sodium is especially important for users with blood pressure or heart-health goals.",
  },
  {
    key: "added_sugar_g" as const,
    label: "Added Sugar",
    unit: "g",
    explanation: "Added sugar is important for blood sugar balance goals.",
  },
  {
    key: "fiber_g" as const,
    label: "Fiber",
    unit: "g",
    explanation: "Fiber supports fullness and steadier blood sugar.",
  },
];

// ─── Helper components ─────────────────────────────────────────────────────

function CategoryBadge({ text }: { text: string }) {
  return (
    <span
      className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${
        CATEGORY_COLORS[text] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {text}
    </span>
  );
}

function ScoreCircle({
  value,
  colorClass,
}: {
  value: number;
  colorClass: string;
}) {
  return (
    <span className={`text-3xl font-bold ${colorClass}`}>
      {Math.round(value)}
    </span>
  );
}

function Delta({ before, after }: { before: number; after: number }) {
  const diff = Math.round(after - before);
  if (diff === 0) return <span className="text-gray-400 text-sm">—</span>;
  const positive = diff > 0;
  return (
    <span
      className={`text-sm font-medium ${
        positive ? "text-red-500" : "text-emerald-600"
      }`}
    >
      {positive ? "+" : ""}
      {diff}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function WhyThisPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const local = getSavedRecipes();
    setRecipes(local);
    if (local.length > 0) setSelectedId(local[0].id);
    setLoading(false);

    getSavedRecipesFromSupabaseAndSync().then((synced) => {
      setRecipes(synced);
      setSelectedId((prev) => prev ?? (synced[0]?.id ?? null));
    });
  }, []);

  const selected = recipes.find((r) => r.id === selectedId) ?? null;
  const changedIngredients = selected?.transformedIngredients.filter(
    (i) => i.changed
  ) ?? [];

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-gray-400">
        Loading…
      </div>
    );
  }

  // ── Empty state
  if (recipes.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Why This?</h1>
          <p className="text-gray-500 mt-1">
            Understand why BiteBetter changed your recipe.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center space-y-4">
          <p className="text-lg font-semibold text-gray-700">
            No recipe explanations yet.
          </p>
          <p className="text-sm text-gray-500">
            Transform and save a recipe in Chef to see why BiteBetter made each
            change.
          </p>
          <Link
            href="/dashboard/chef"
            className="inline-block mt-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Go to Chef
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Why This?</h1>
        <p className="text-gray-500 mt-1">
          Understand why BiteBetter changed your recipe.
        </p>
      </div>

      {/* Recipe selector */}
      {recipes.length > 1 && (
        <div>
          <label
            htmlFor="recipe-select"
            className="block text-xs font-medium text-gray-500 mb-1.5"
          >
            Select a recipe
          </label>
          <select
            id="recipe-select"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.transformedRecipeName} —{" "}
                {new Date(r.savedAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected && (
        <>
          {/* 1. Recipe summary card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {selected.transformedRecipeName}
              </h2>
              <p className="text-sm text-gray-500">
                Based on: {selected.originalRecipeName}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Saved {new Date(selected.savedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                {
                  label: "Overall",
                  value: Math.round(selected.scores.overall),
                  color: "text-emerald-600",
                },
                {
                  label: "Health",
                  value: Math.round(selected.scores.health),
                  color: "text-blue-600",
                },
                {
                  label: "Est. Cost",
                  value: `$${selected.estimatedCost.toFixed(2)}`,
                  color: "text-gray-700",
                },
                {
                  label: "Per Serving",
                  value: `$${selected.costPerServing.toFixed(2)}`,
                  color: "text-gray-700",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-gray-50 rounded-xl p-3 text-center"
                >
                  <p className={`text-xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Key Changes */}
          <Section title="Key Changes">
            {selected.keyChanges.length === 0 ? (
              <EmptyNote text="No key changes recorded for this recipe." />
            ) : (
              <div className="space-y-3">
                {selected.keyChanges.map((change, i) => {
                  const cat = inferCategory(change);
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-3"
                    >
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {change}
                      </p>
                      <CategoryBadge text={cat} />
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* 3. Ingredient Changes */}
          <Section title="Ingredient Substitutions">
            {changedIngredients.length === 0 ? (
              <EmptyNote text="No major ingredient substitutions were needed for this recipe." />
            ) : (
              <div className="space-y-3">
                {changedIngredients.map((ing, i) => {
                  const cat = ing.reason
                    ? inferCategory(ing.reason)
                    : inferCategory(ing.transformed);
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-sm text-gray-400 line-through">
                            {ing.original}
                          </p>
                          <p className="text-sm font-semibold text-emerald-700">
                            → {ing.transformed}
                          </p>
                        </div>
                        <CategoryBadge text={cat} />
                      </div>
                      {ing.reason && (
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {ing.reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* 4. Warnings Explained */}
          <Section title="Safety Warnings">
            {selected.warnings.length === 0 ? (
              <EmptyNote text="No major safety warnings were detected for this recipe." />
            ) : (
              <div className="space-y-3">
                {selected.warnings.map((w, i) => (
                  <WarningCard key={i} warning={w} />
                ))}
              </div>
            )}
          </Section>

          {/* 5. Score Explanations */}
          <Section title="Score Breakdown">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                ["overall", "health", "taste", "transformation", "budget"] as const
              ).map((key) => {
                const meta = SCORE_META[key];
                const value =
                  selected.scores[key as keyof typeof selected.scores];
                return (
                  <div
                    key={key}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-4"
                  >
                    <ScoreCircle
                      value={value}
                      colorClass={meta.color}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {meta.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {meta.explanation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 6. Nutrition Comparison */}
          <Section title="Nutrition Comparison">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="text-left px-4 py-3 font-medium">Nutrient</th>
                    <th className="text-right px-4 py-3 font-medium">Before</th>
                    <th className="text-right px-4 py-3 font-medium">After</th>
                    <th className="text-right px-4 py-3 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {NUTRITION_META.map((nm) => {
                    const before = selected.beforeNutrition[nm.key];
                    const after = selected.afterNutrition[nm.key];
                    return (
                      <tr
                        key={nm.key}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">
                            {nm.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {nm.explanation}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {Math.round(before)}
                          <span className="text-xs text-gray-400 ml-0.5">
                            {nm.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800 font-medium">
                          {Math.round(after)}
                          <span className="text-xs text-gray-400 ml-0.5">
                            {nm.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Delta before={before} after={after} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 7. Grocery Cost */}
          <Section title="Grocery Cost Estimate">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    ${selected.estimatedCost.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-700">
                    ${selected.costPerServing.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Per serving</p>
                </div>
              </div>
              {selected.groceryItems.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="text-left py-2 font-medium">Item</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                      <th className="text-right py-2 font-medium">Est. Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.groceryItems.slice(0, 8).map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 last:border-0"
                      >
                        <td className="py-2 text-gray-700">{item.name}</td>
                        <td className="py-2 text-right text-gray-500">
                          {item.amount}
                        </td>
                        <td className="py-2 text-right text-gray-700">
                          ${item.estimatedPrice.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-gray-400">
                Prices are rough estimates from the demo grocery price file, not
                live store prices.
              </p>
            </div>
          </Section>

          {/* 8. Medical Disclaimer */}
          {selected.disclaimerRequired && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              {MEDICAL_DISCLAIMER}
            </div>
          )}
        </>
      )}

      {/* Navigation CTA */}
      <div className="flex flex-wrap gap-3 pt-2 pb-6">
        <Link
          href="/dashboard/chef"
          className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Transform another recipe
        </Link>
        <Link
          href="/dashboard/recipes"
          className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
        >
          View saved recipes
        </Link>
      </div>
    </div>
  );
}

// ─── Small layout helpers ──────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <p className="text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      {text}
    </p>
  );
}

function WarningCard({ warning }: { warning: RecipeWarning }) {
  return (
    <div
      className={`rounded-2xl border p-4 space-y-2 ${
        WARNING_LEVEL_STYLES[warning.level] ?? "bg-gray-50 border-gray-200 text-gray-700"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${
            WARNING_LEVEL_BADGE[warning.level] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {warning.level}
        </span>
        <span className="text-xs font-medium capitalize text-current opacity-70">
          {warning.category}
        </span>
      </div>
      <p className="text-sm font-medium leading-snug">{warning.message}</p>
      <p className="text-xs opacity-75 leading-relaxed">
        {warningCategoryExplanation(warning.category)}
      </p>
    </div>
  );
}
