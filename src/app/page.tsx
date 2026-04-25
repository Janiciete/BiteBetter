import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-emerald-700 tracking-tight">
            BiteBetter
          </h1>
          <p className="text-lg text-gray-600">
            AI-powered recipe transformation tailored to you
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <p className="text-gray-700 text-base leading-relaxed">
            Paste any recipe and BiteBetter rewrites it around your allergies,
            dietary preferences, health goals, budget, and safety needs.
          </p>
          <p className="text-sm text-gray-500">
            First, tell us a little about yourself so we can personalize every
            transformation.
          </p>
          <Link
            href="/onboarding"
            className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-center"
          >
            Create Nutrition Profile
          </Link>
        </div>

        <p className="text-xs text-gray-400">
          Not medical advice. Always consult a healthcare professional for
          high-risk concerns.
        </p>
      </div>
    </main>
  );
}
