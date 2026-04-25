import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FAF8F3] flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-2xl w-full text-center space-y-8">

          {/* Brand */}
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#EEF6F0] mb-2">
              <svg className="w-8 h-8 text-[#2F5D62]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-[#2F5D62] tracking-tight">
              BetterBites
            </h1>
            <p className="text-xl text-[#253238]/70 font-medium">
              Healthier recipes made for you
            </p>
          </div>

          {/* Description card */}
          <div className="bg-white rounded-2xl border border-[#A9C9A4]/40 shadow-sm p-8 space-y-6 text-left">
            <p className="text-[#253238] text-base leading-relaxed text-center">
              Create a nutrition profile, paste a recipe, and get a personalized version
              that fits your goals, allergies, budget, and safety needs.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Link
                href="/onboarding"
                className="flex-1 text-center bg-[#2F5D62] hover:bg-[#264f54] text-white font-semibold py-3.5 px-6 rounded-xl transition-colors text-base"
              >
                Get Started
              </Link>
              <Link
                href="/dashboard/chef"
                className="flex-1 text-center bg-[#EEF6F0] hover:bg-[#dff0e4] text-[#2F5D62] font-semibold py-3.5 px-6 rounded-xl transition-colors text-base border border-[#A9C9A4]/50"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
                title: "Personalized to your profile",
                body: "Goals, allergies, health conditions, and budget all shape every change.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: "Clear nutrition changes",
                body: "See exactly what improved — calories, protein, sodium, fiber, and more.",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                title: "Grocery list ready",
                body: "All saved recipes roll up into a single estimated grocery list.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-2xl border border-[#A9C9A4]/40 p-5 space-y-2"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EEF6F0] flex items-center justify-center text-[#2F5D62]">
                  {card.icon}
                </div>
                <p className="font-semibold text-[#253238] text-sm">{card.title}</p>
                <p className="text-sm text-[#253238]/65 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-[#253238]/50 leading-relaxed">
            Not medical advice. BetterBites does not diagnose or treat any condition. Always consult a
            healthcare professional for high-risk concerns.
          </p>
        </div>
      </div>
    </main>
  );
}
