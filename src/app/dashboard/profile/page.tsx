"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BMICategory, UserProfile } from "@/types/profile";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const BMI_COLORS: Record<BMICategory, string> = {
  underweight: "bg-blue-100 text-blue-700",
  normal: "bg-emerald-100 text-emerald-700",
  overweight: "bg-amber-100 text-amber-700",
  obese: "bg-red-100 text-red-700",
};

function needsDisclaimer(p: UserProfile): boolean {
  return (
    p.healthConditions.some((c) => c !== "none") ||
    p.medications.trim().length > 0 ||
    p.isPregnant === true ||
    p.elderlyConcerns.length > 0 ||
    p.allergies.length > 0
  );
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

function Tags({ label, items }: { label: string; items: string[] }) {
  const visible = items.filter((i) => i !== "none" && i.trim().length > 0);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((item) => (
          <span
            key={item}
            className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full"
          >
            {fmt(item)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Goal labels ─────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  weight_loss: "Weight Loss",
  muscle_gain: "Muscle Gain",
  maintenance: "Maintenance",
  bulking: "Bulking",
  cutting: "Cutting",
  heart_health: "Heart Health",
  blood_sugar_balance: "Blood Sugar Balance",
  budget_friendly: "Budget-Friendly Eating",
  general_healthy: "General Healthy Eating",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bitebetter_profile");
      if (raw) setProfile(JSON.parse(raw) as UserProfile);
    } catch {
      // malformed data
    }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto mt-16 flex flex-col items-center text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <svg
            className="w-7 h-7 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">No profile yet</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          Create your nutrition profile so BiteBetter can personalize every recipe
          transformation for you.
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

  const goalLabels = profile.nutritionGoals.map(
    (g) => GOAL_LABELS[g] ?? fmt(g)
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Your nutrition profile used to personalize recipes.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-4 py-2 rounded-xl transition-colors"
        >
          Edit Profile
        </Link>
      </div>

      {/* Physical background */}
      <Section title="Physical Background">
        <Row label="Age" value={`${profile.age} years`} />
        <Row
          label="Gender"
          value={profile.gender === "other" ? "Other / Prefer not to say" : fmt(profile.gender)}
        />
        <Row
          label="Height"
          value={`${profile.heightValue} ${profile.heightUnit}`}
        />
        <Row
          label="Weight"
          value={`${profile.weightValue} ${profile.weightUnit}`}
        />
        <Row label="Activity Level" value={fmt(profile.activityLevel)} />
      </Section>

      {/* BMI + Energy */}
      <Section title="Body Metrics">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">BMI</p>
            <p className="text-2xl font-bold text-gray-900">{profile.bmi}</p>
          </div>
          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full ${BMI_COLORS[profile.bmiCategory]}`}
          >
            {fmt(profile.bmiCategory)}
          </span>
        </div>
        <div className="border-t border-gray-50 pt-3">
          <Row
            label="Estimated Daily Energy"
            value={`~${profile.estimatedEnergyRequirement.toLocaleString()} kcal`}
          />
          <p className="text-xs text-gray-400 mt-1">
            Estimated using Harris-Benedict BMR × activity multiplier. For
            reference only.
          </p>
        </div>
      </Section>

      {/* Health background */}
      <Section title="Health Background">
        <Tags label="Health Conditions" items={profile.healthConditions} />
        {profile.healthConditions.every((c) => c === "none") && (
          <p className="text-sm text-gray-400">No reported conditions.</p>
        )}
        {profile.medications.trim() && (
          <Row label="Medications" value={profile.medications} />
        )}
        {!profile.medications.trim() && (
          <Row label="Medications" value="None reported" />
        )}
      </Section>

      {/* Pregnancy — only show if female */}
      {profile.gender === "female" && (
        <Section title="Pregnancy">
          <Row
            label="Currently pregnant"
            value={profile.isPregnant ? "Yes" : "No"}
          />
          {profile.isPregnant && profile.weeksPregnant && (
            <Row
              label="Weeks pregnant"
              value={`${profile.weeksPregnant} weeks`}
            />
          )}
          {profile.isPregnant && (
            <Tags
              label="Pregnancy concerns"
              items={profile.pregnancyConcerns}
            />
          )}
        </Section>
      )}

      {/* Allergies */}
      <Section title="Allergies">
        {profile.allergies.length > 0 ? (
          <>
            <Tags label="" items={profile.allergies} />
            {profile.allergyOther && (
              <Row label="Other" value={profile.allergyOther} />
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">No known allergies.</p>
        )}
      </Section>

      {/* Dietary preferences */}
      <Section title="Dietary Preferences">
        {profile.dietaryPreferences.length > 0 ? (
          <Tags label="" items={profile.dietaryPreferences} />
        ) : (
          <p className="text-sm text-gray-400">No specific preferences.</p>
        )}
      </Section>

      {/* Nutrition goals */}
      <Section title="Nutrition Goals">
        {goalLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {goalLabels.map((lbl) => (
              <span
                key={lbl}
                className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full"
              >
                {lbl}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No goals set.</p>
        )}
      </Section>

      {/* Food preferences */}
      <Section title="Food Preferences">
        <Row label="Appetite Level" value={fmt(profile.appetiteLevel)} />
        <Row
          label="Disliked Foods"
          value={profile.dislikedFoods.trim() || "None listed"}
        />
      </Section>

      {/* Budget */}
      <Section title="Budget">
        <Row
          label="Weekly Grocery Budget"
          value={`$${profile.weeklyBudget.toLocaleString()}`}
        />
      </Section>

      {/* Elderly — only show if age 65+ */}
      {profile.age >= 65 && (
        <Section title="Elderly Considerations">
          {profile.elderlyConcerns.length > 0 ? (
            <Tags label="Concerns" items={profile.elderlyConcerns} />
          ) : (
            <p className="text-sm text-gray-400">No specific concerns noted.</p>
          )}
          {profile.elderlyActivityLevel && (
            <Row
              label="Activity Level (Simplified)"
              value={fmt(profile.elderlyActivityLevel)}
            />
          )}
        </Section>
      )}

      {/* Medical disclaimer */}
      {needsDisclaimer(profile) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          This is not medical advice or a medical diagnosis. Consult a doctor or
          healthcare professional for high-risk concerns.
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-4">
        Profile last updated{" "}
        {new Date(profile.updatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
    </div>
  );
}
