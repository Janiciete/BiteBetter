const placeholderRecipes = [
  {
    name: "Grilled Chicken & Veggie Bowl",
    date: "Apr 25, 2026",
    scores: { overall: 87, health: 91 },
    rating: 4,
  },
  {
    name: "Lentil Soup with Spinach",
    date: "Apr 24, 2026",
    scores: { overall: 92, health: 95 },
    rating: 5,
  },
  {
    name: "Baked Salmon with Quinoa",
    date: "Apr 23, 2026",
    scores: { overall: 89, health: 93 },
    rating: null,
  },
];

function StarRating({ rating }: { rating: number | null }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${
            rating !== null && star <= rating
              ? "text-amber-400"
              : "text-gray-200"
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function RecipesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="text-gray-500 mt-1">Your saved personalized recipes.</p>
        </div>
        <span className="text-sm text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-1 shadow-sm">
          {placeholderRecipes.length} saved
        </span>
      </div>

      {/* Preview cards */}
      <div className="space-y-3">
        {placeholderRecipes.map((recipe) => (
          <div
            key={recipe.name}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-gray-800 truncate">{recipe.name}</p>
              <p className="text-xs text-gray-400">{recipe.date}</p>
              <StarRating rating={recipe.rating} />
            </div>
            <div className="shrink-0 text-right space-y-1">
              <span className="block text-lg font-bold text-emerald-600">
                {recipe.scores.overall}
              </span>
              <span className="block text-xs text-gray-400">Overall Score</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Preview data only — saving recipes comes in Phase 4
      </p>
    </div>
  );
}
