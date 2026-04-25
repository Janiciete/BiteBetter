export default function ChefPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chef</h1>
        <p className="text-gray-500 mt-1">
          Paste any recipe and we'll transform it to fit your profile.
        </p>
      </div>

      {/* Recipe input card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <label className="block text-sm font-semibold text-gray-700">
          Your Recipe
        </label>
        <textarea
          disabled
          rows={10}
          placeholder="Paste or type your recipe here — ingredients and instructions…"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400 resize-none cursor-not-allowed"
        />
        <button
          disabled
          className="w-full bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl opacity-40 cursor-not-allowed"
        >
          Transform Recipe
        </button>
        <p className="text-xs text-gray-400 text-center">
          Recipe transformation coming in Phase 3
        </p>
      </div>

      {/* Result preview placeholder */}
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 flex flex-col items-center justify-center text-center space-y-2 min-h-48">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">
          Your personalized recipe will appear here
        </p>
        <p className="text-xs text-gray-400">
          Scores, ingredient swaps, cost summary, and warnings
        </p>
      </div>
    </div>
  );
}
