const placeholderProfile = {
  name: "Alex",
  age: 34,
  gender: "Female",
  height: "165 cm",
  weight: "68 kg",
  bmi: "25.0",
  activityLevel: "Moderate",
  allergies: ["Shellfish", "Tree nuts"],
  dietaryPreferences: ["Gluten-free"],
  nutritionGoals: ["Weight loss", "Heart health"],
  medicalConditions: ["Hypertension"],
  medications: [],
  weeklyBudget: "$80",
  appetiteLevel: "Medium",
};

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-sm text-gray-400">None</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-500 mt-1">Your nutrition profile used to personalize recipes.</p>
        </div>
        <button
          disabled
          className="text-sm font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl opacity-50 cursor-not-allowed"
        >
          Edit Profile
        </button>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Basic Info
        </h2>
        <ProfileRow label="Age" value={`${placeholderProfile.age} years`} />
        <ProfileRow label="Gender" value={placeholderProfile.gender} />
        <ProfileRow label="Height" value={placeholderProfile.height} />
        <ProfileRow label="Weight" value={placeholderProfile.weight} />
        <ProfileRow label="BMI" value={placeholderProfile.bmi} />
        <ProfileRow label="Activity Level" value={placeholderProfile.activityLevel} />
        <ProfileRow label="Appetite" value={placeholderProfile.appetiteLevel} />
        <ProfileRow label="Weekly Budget" value={placeholderProfile.weeklyBudget} />
      </div>

      {/* Tags */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Health & Preferences
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">Allergies</p>
            <TagList items={placeholderProfile.allergies} />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Dietary Preferences</p>
            <TagList items={placeholderProfile.dietaryPreferences} />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Nutrition Goals</p>
            <TagList items={placeholderProfile.nutritionGoals} />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Medical Conditions</p>
            <TagList items={placeholderProfile.medicalConditions} />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-2">Medications</p>
            <TagList items={placeholderProfile.medications} />
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        This is not medical advice or a medical diagnosis. Consult a doctor or
        healthcare professional for high-risk concerns.
      </div>

      <p className="text-xs text-gray-400 text-center">
        Preview data only — profile form and Supabase integration come in Phase 2
      </p>
    </div>
  );
}
