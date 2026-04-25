const placeholderItems = [
  { name: "Chicken breast", amount: "400g", cost: 3.2, checked: false },
  { name: "Broccoli", amount: "300g", cost: 0.75, checked: false },
  { name: "Quinoa", amount: "200g", cost: 1.6, checked: true },
  { name: "Olive oil", amount: "2 tbsp", cost: 0.4, checked: true },
  { name: "Lemon", amount: "1 whole", cost: 0.3, checked: false },
  { name: "Spinach", amount: "150g", cost: 0.9, checked: false },
  { name: "Red lentils", amount: "250g", cost: 0.8, checked: false },
];

const total = placeholderItems.reduce((sum, item) => sum + item.cost, 0);

export default function GroceryListPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grocery List</h1>
          <p className="text-gray-500 mt-1">
            Ingredients from your saved recipes.
          </p>
        </div>
        <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
          Est. ${total.toFixed(2)}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {placeholderItems.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-4 px-5 py-4"
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                item.checked
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-gray-300"
              }`}
            >
              {item.checked && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span
              className={`flex-1 text-sm font-medium ${
                item.checked ? "line-through text-gray-400" : "text-gray-800"
              }`}
            >
              {item.name}
            </span>
            <span className="text-sm text-gray-400">{item.amount}</span>
            <span className="text-sm font-medium text-gray-600 w-12 text-right">
              ${item.cost.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Preview data only — live grocery list comes in Phase 5
      </p>
    </div>
  );
}
