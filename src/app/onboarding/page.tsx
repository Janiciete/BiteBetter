import Link from "next/link";

const steps = [
  { label: "Basic Info", description: "Age, height, weight, activity level" },
  { label: "Health", description: "Medical conditions and medications" },
  { label: "Allergies", description: "Food allergies and intolerances" },
  { label: "Dietary", description: "Preferences and nutrition goals" },
  { label: "Budget & Goals", description: "Grocery budget and appetite" },
];

export default function OnboardingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4 py-12">
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="text-sm font-medium text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
            Step 1 of 1
          </span>
          <h1 className="text-3xl font-bold text-gray-900">
            Create Your Nutrition Profile
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Answer a few stable questions about yourself once. BiteBetter uses
            your profile to personalize every recipe transformation — ingredient
            swaps, portion sizes, safety checks, and cost estimates.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            What we'll ask
          </h2>
          <ul className="space-y-3">
            {steps.map((step, i) => (
              <li key={step.label} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {step.label}
                  </p>
                  <p className="text-sm text-gray-500">{step.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          This is not medical advice or a medical diagnosis. Consult a doctor or
          healthcare professional for high-risk concerns.
        </div>

        <Link
          href="/dashboard/chef"
          className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center"
        >
          Continue to Dashboard
        </Link>

        <Link
          href="/"
          className="block text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
