const placeholderReasons = [
  {
    change: "Swapped white rice → brown rice",
    reason:
      "Brown rice has a lower glycemic index and more fiber, supporting your weight loss goal.",
    category: "Nutrition Goal",
  },
  {
    change: "Replaced butter → olive oil",
    reason:
      "Olive oil reduces saturated fat intake, which aligns with your heart health preference.",
    category: "Health",
  },
  {
    change: "Removed shrimp → tofu",
    reason: "Shrimp was flagged in your shellfish allergy. Tofu provides similar protein.",
    category: "Allergy Safety",
  },
  {
    change: "Reduced portion of soy sauce",
    reason:
      "High sodium ingredients are moderated due to your hypertension flag.",
    category: "Medical Safety",
  },
  {
    change: "Added extra spinach",
    reason:
      "Leafy greens increase fiber and micronutrients without significantly affecting cost.",
    category: "Nutrition Goal",
  },
];

const categoryColors: Record<string, string> = {
  "Nutrition Goal": "bg-emerald-100 text-emerald-700",
  Health: "bg-blue-100 text-blue-700",
  "Allergy Safety": "bg-red-100 text-red-700",
  "Medical Safety": "bg-amber-100 text-amber-700",
};

export default function WhyThisPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Why This?</h1>
        <p className="text-gray-500 mt-1">
          Explanations for every change made to your recipe.
        </p>
      </div>

      <div className="space-y-3">
        {placeholderReasons.map((item) => (
          <div
            key={item.change}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-gray-800">{item.change}</p>
              <span
                className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  categoryColors[item.category] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {item.category}
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{item.reason}</p>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        This is not medical advice or a medical diagnosis. Consult a doctor or
        healthcare professional for high-risk concerns.
      </div>

      <p className="text-xs text-gray-400 text-center">
        Preview data only — live explanations come with Phase 3 transformation
      </p>
    </div>
  );
}
