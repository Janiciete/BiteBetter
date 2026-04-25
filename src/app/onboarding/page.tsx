"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateBMI, getBMICategory, calculateSimpleEER } from "@/lib/bmi";
import type {
  ActivityLevel,
  Allergy,
  AppetiteLevel,
  DietaryPreference,
  ElderlyConcern,
  ElderlyActivityLevel,
  Gender,
  HealthCondition,
  HeightUnit,
  NutritionGoal,
  PregnancyConcern,
  UserProfile,
  WeightUnit,
} from "@/types/profile";

// ─── Form state (strings for inputs, parsed on save) ────────────────────────

type FormData = {
  age: string;
  gender: Gender | "";
  heightValue: string;
  heightUnit: HeightUnit;
  weightValue: string;
  weightUnit: WeightUnit;
  activityLevel: ActivityLevel | "";
  healthConditions: HealthCondition[];
  medications: string;
  isPregnant: "yes" | "no" | "";
  weeksPregnant: string;
  pregnancyConcerns: PregnancyConcern[];
  allergies: Allergy[];
  allergyOther: string;
  dietaryPreferences: DietaryPreference[];
  nutritionGoals: NutritionGoal[];
  dislikedFoods: string;
  appetiteLevel: AppetiteLevel | "";
  weeklyBudget: string;
  elderlyConcerns: ElderlyConcern[];
  elderlyActivityLevel: ElderlyActivityLevel | "";
};

const EMPTY: FormData = {
  age: "",
  gender: "",
  heightValue: "",
  heightUnit: "cm",
  weightValue: "",
  weightUnit: "kg",
  activityLevel: "",
  healthConditions: [],
  medications: "",
  isPregnant: "",
  weeksPregnant: "",
  pregnancyConcerns: [],
  allergies: [],
  allergyOther: "",
  dietaryPreferences: [],
  nutritionGoals: [],
  dislikedFoods: "",
  appetiteLevel: "",
  weeklyBudget: "",
  elderlyConcerns: [],
  elderlyActivityLevel: "",
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function fmt(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toggleCheck<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
}

// When "none" is selected it clears others; selecting anything else clears "none"
function toggleExclusive<T extends string>(list: T[], item: T, none: T): T[] {
  if (item === none) return list.includes(none) ? [] : [none];
  const withoutNone = list.filter((i) => i !== none);
  return withoutNone.includes(item)
    ? withoutNone.filter((i) => i !== item)
    : [...withoutNone, item];
}

function canProceed(step: number, d: FormData): boolean {
  switch (step) {
    case 1:
      return (
        Number(d.age) > 0 &&
        d.gender !== "" &&
        Number(d.heightValue) > 0 &&
        Number(d.weightValue) > 0 &&
        d.activityLevel !== ""
      );
    case 2:
      return (
        d.healthConditions.length > 0 &&
        (d.gender !== "female" || d.isPregnant !== "")
      );
    case 3:
      return !d.allergies.includes("other") || d.allergyOther.trim().length > 0;
    case 4:
      return (
        d.nutritionGoals.length > 0 &&
        d.appetiteLevel !== "" &&
        Number(d.weeklyBudget) > 0
      );
    case 5: {
      if (d.isPregnant !== "yes") return true;
      return Number(d.weeksPregnant) > 0 && d.pregnancyConcerns.length > 0;
    }
    default:
      return true;
  }
}

// ─── Reusable UI atoms ───────────────────────────────────────────────────────

function CheckboxOpt({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/60 cursor-pointer transition-colors select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 accent-emerald-600 rounded shrink-0"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function RadioOpt({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none ${
        checked
          ? "border-emerald-400 bg-emerald-50"
          : "border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/40"
      }`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 accent-emerald-600 mt-0.5 shrink-0"
      />
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className={`border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${className ?? "w-full"}`}
      />
    </div>
  );
}

// ─── Review helpers ───────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}

function ReviewTags({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-medium"
          >
            {item === "none" ? "None" : fmt(item)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Goal labels (a few need custom text) ────────────────────────────────────

const GOAL_LABELS: Record<NutritionGoal, string> = {
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

// ─── Main component ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "Basic Info",
  "Health Background",
  "Diet & Allergies",
  "Goals & Budget",
  "Special Considerations",
  "Review Your Profile",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY);

  const age = Number(form.age);
  const isElderly = age >= 65;
  const isPregnant = form.isPregnant === "yes";

  // Pre-fill form when editing an existing profile
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bitebetter_profile");
      if (!raw) return;
      const p: UserProfile = JSON.parse(raw);
      setForm({
        age: String(p.age),
        gender: p.gender,
        heightValue: String(p.heightValue),
        heightUnit: p.heightUnit,
        weightValue: String(p.weightValue),
        weightUnit: p.weightUnit,
        activityLevel: p.activityLevel,
        healthConditions: p.healthConditions,
        medications: p.medications,
        isPregnant:
          p.isPregnant === null ? "" : p.isPregnant ? "yes" : "no",
        weeksPregnant: p.weeksPregnant ? String(p.weeksPregnant) : "",
        pregnancyConcerns: p.pregnancyConcerns,
        allergies: p.allergies,
        allergyOther: p.allergyOther,
        dietaryPreferences: p.dietaryPreferences,
        nutritionGoals: p.nutritionGoals,
        dislikedFoods: p.dislikedFoods,
        appetiteLevel: p.appetiteLevel,
        weeklyBudget: String(p.weeklyBudget),
        elderlyConcerns: p.elderlyConcerns,
        elderlyActivityLevel: p.elderlyActivityLevel ?? "",
      });
    } catch {
      // ignore malformed data
    }
  }, []);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value } as FormData));
  }

  function handleSave() {
    const raw = localStorage.getItem("bitebetter_profile");
    const existingCreatedAt = raw
      ? (JSON.parse(raw) as UserProfile).createdAt
      : new Date().toISOString();

    const bmi = calculateBMI(
      Number(form.heightValue),
      Number(form.weightValue),
      form.heightUnit,
      form.weightUnit
    );

    const profile: UserProfile = {
      age,
      gender: form.gender as Gender,
      heightValue: Number(form.heightValue),
      heightUnit: form.heightUnit,
      weightValue: Number(form.weightValue),
      weightUnit: form.weightUnit,
      activityLevel: form.activityLevel as ActivityLevel,
      healthConditions: form.healthConditions,
      medications: form.medications,
      isPregnant: form.gender === "female" ? isPregnant : null,
      weeksPregnant:
        isPregnant && form.weeksPregnant ? Number(form.weeksPregnant) : null,
      pregnancyConcerns: form.pregnancyConcerns,
      allergies: form.allergies,
      allergyOther: form.allergyOther,
      dietaryPreferences: form.dietaryPreferences,
      nutritionGoals: form.nutritionGoals,
      dislikedFoods: form.dislikedFoods,
      appetiteLevel: form.appetiteLevel as AppetiteLevel,
      weeklyBudget: Number(form.weeklyBudget),
      elderlyConcerns: form.elderlyConcerns,
      elderlyActivityLevel: form.elderlyActivityLevel
        ? (form.elderlyActivityLevel as ElderlyActivityLevel)
        : null,
      bmi,
      bmiCategory: getBMICategory(bmi),
      estimatedEnergyRequirement: calculateSimpleEER(
        age,
        form.gender as Gender,
        Number(form.heightValue),
        form.heightUnit,
        Number(form.weightValue),
        form.weightUnit,
        form.activityLevel as ActivityLevel
      ),
      createdAt: existingCreatedAt,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem("bitebetter_profile", JSON.stringify(profile));
    router.push("/dashboard/chef");
  }

  // ─── Step content ─────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      // ── Step 1: Basic Info ──────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4">
            <Card title="Personal Info">
              <TextInput
                label="Age"
                value={form.age}
                onChange={(v) => set("age", v)}
                type="number"
                placeholder="e.g. 34"
                min={1}
                max={120}
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ["male", "Male", undefined],
                      ["female", "Female", undefined],
                      ["other", "Other / Prefer not to say", undefined],
                    ] as [Gender, string, string | undefined][]
                  ).map(([val, lbl]) => (
                    <RadioOpt
                      key={val}
                      label={lbl}
                      checked={form.gender === val}
                      onChange={() => set("gender", val)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Height</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={form.heightValue}
                    onChange={(e) => set("heightValue", e.target.value)}
                    placeholder={form.heightUnit === "cm" ? "e.g. 170" : "e.g. 67"}
                    min={1}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <select
                    value={form.heightUnit}
                    onChange={(e) => set("heightUnit", e.target.value as HeightUnit)}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Weight</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={form.weightValue}
                    onChange={(e) => set("weightValue", e.target.value)}
                    placeholder={form.weightUnit === "kg" ? "e.g. 68" : "e.g. 150"}
                    min={1}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <select
                    value={form.weightUnit}
                    onChange={(e) => set("weightUnit", e.target.value as WeightUnit)}
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card title="Activity Level">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    ["sedentary", "Little or no exercise"],
                    ["low_active", "Light exercise 1–3 days/week"],
                    ["active", "Moderate exercise 3–5 days/week"],
                    ["very_active", "Hard exercise 6–7 days/week"],
                  ] as [ActivityLevel, string][]
                ).map(([val, desc]) => (
                  <RadioOpt
                    key={val}
                    label={fmt(val)}
                    desc={desc}
                    checked={form.activityLevel === val}
                    onChange={() => set("activityLevel", val)}
                  />
                ))}
              </div>
            </Card>
          </div>
        );

      // ── Step 2: Health Background ───────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4">
            <Card title="Health Conditions">
              <p className="text-xs text-gray-400">Select all that apply.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    "diabetes",
                    "prediabetes",
                    "high_blood_pressure",
                    "high_cholesterol",
                    "kidney_issues",
                    "heart_disease",
                    "none",
                  ] as HealthCondition[]
                ).map((c) => (
                  <CheckboxOpt
                    key={c}
                    label={c === "none" ? "None of the above" : fmt(c)}
                    checked={form.healthConditions.includes(c)}
                    onChange={() =>
                      set(
                        "healthConditions",
                        toggleExclusive(form.healthConditions, c, "none")
                      )
                    }
                  />
                ))}
              </div>
            </Card>

            <Card title="Medications">
              <p className="text-xs text-gray-400">Optional. List medications you take regularly.</p>
              <textarea
                rows={2}
                value={form.medications}
                onChange={(e) => set("medications", e.target.value)}
                placeholder="e.g. metformin, lisinopril…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              />
            </Card>

            {form.gender === "female" && (
              <Card title="Pregnancy">
                <p className="text-xs text-gray-400">Are you currently pregnant?</p>
                <div className="grid grid-cols-2 gap-2">
                  <RadioOpt
                    label="Yes"
                    checked={form.isPregnant === "yes"}
                    onChange={() => set("isPregnant", "yes")}
                  />
                  <RadioOpt
                    label="No"
                    checked={form.isPregnant === "no"}
                    onChange={() => set("isPregnant", "no")}
                  />
                </div>
              </Card>
            )}
          </div>
        );

      // ── Step 3: Diet & Allergies ────────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-4">
            <Card title="Food Allergies">
              <p className="text-xs text-gray-400">
                Select all that apply. Leave blank if none.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    "nuts",
                    "dairy",
                    "shellfish",
                    "eggs",
                    "soy",
                    "wheat",
                    "sesame",
                    "other",
                  ] as Allergy[]
                ).map((a) => (
                  <CheckboxOpt
                    key={a}
                    label={fmt(a)}
                    checked={form.allergies.includes(a)}
                    onChange={() =>
                      set("allergies", toggleCheck(form.allergies, a))
                    }
                  />
                ))}
              </div>
              {form.allergies.includes("other") && (
                <input
                  type="text"
                  value={form.allergyOther}
                  onChange={(e) => set("allergyOther", e.target.value)}
                  placeholder="Describe your other allergy…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              )}
            </Card>

            <Card title="Dietary Preferences">
              <p className="text-xs text-gray-400">Select all that apply.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    "vegetarian",
                    "vegan",
                    "low_carb",
                    "keto",
                    "high_protein",
                    "gluten_free",
                    "dairy_free",
                    "low_sodium",
                    "low_sugar",
                  ] as DietaryPreference[]
                ).map((d) => (
                  <CheckboxOpt
                    key={d}
                    label={fmt(d)}
                    checked={form.dietaryPreferences.includes(d)}
                    onChange={() =>
                      set(
                        "dietaryPreferences",
                        toggleCheck(form.dietaryPreferences, d)
                      )
                    }
                  />
                ))}
              </div>
            </Card>
          </div>
        );

      // ── Step 4: Goals & Budget ──────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-4">
            <Card title="Nutrition Goals">
              <p className="text-xs text-gray-400">Select all that apply.</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(GOAL_LABELS) as NutritionGoal[]).map((g) => (
                  <CheckboxOpt
                    key={g}
                    label={GOAL_LABELS[g]}
                    checked={form.nutritionGoals.includes(g)}
                    onChange={() =>
                      set("nutritionGoals", toggleCheck(form.nutritionGoals, g))
                    }
                  />
                ))}
              </div>
            </Card>

            <Card title="Food Preferences">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Foods you dislike{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={form.dislikedFoods}
                  onChange={(e) => set("dislikedFoods", e.target.value)}
                  placeholder="e.g. cilantro, mushrooms, olives…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                />
              </div>

              <div className="space-y-2 mt-2">
                <label className="block text-sm font-medium text-gray-700">
                  Appetite Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      ["normal", "Standard portion sizes"],
                      ["low_appetite", "Often can't finish meals"],
                      ["small_portions", "Prefer smaller meals"],
                    ] as [AppetiteLevel, string][]
                  ).map(([val, desc]) => (
                    <RadioOpt
                      key={val}
                      label={fmt(val)}
                      desc={desc}
                      checked={form.appetiteLevel === val}
                      onChange={() => set("appetiteLevel", val)}
                    />
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Weekly Grocery Budget">
              <p className="text-xs text-gray-400">
                Approximate weekly grocery spend in USD.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">$</span>
                <input
                  type="number"
                  value={form.weeklyBudget}
                  onChange={(e) => set("weeklyBudget", e.target.value)}
                  placeholder="e.g. 80"
                  min={1}
                  className="w-36 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <span className="text-sm text-gray-400">per week</span>
              </div>
            </Card>
          </div>
        );

      // ── Step 5: Special Considerations ─────────────────────────────────────
      case 5:
        if (!isPregnant && !isElderly) {
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <svg
                  className="w-6 h-6 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-gray-800">No additional questions</p>
              <p className="text-sm text-gray-400">
                Click Continue to review your profile.
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {isPregnant && (
              <>
                <Card title="Pregnancy Details">
                  <TextInput
                    label="Weeks pregnant"
                    value={form.weeksPregnant}
                    onChange={(v) => set("weeksPregnant", v)}
                    type="number"
                    placeholder="e.g. 20"
                    min={1}
                    max={42}
                    className="w-32"
                  />
                </Card>

                <Card title="Pregnancy Concerns">
                  <p className="text-xs text-gray-400">Select all that apply.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(
                      [
                        "gestational_diabetes",
                        "anemia",
                        "preeclampsia",
                        "cravings",
                        "lactation_concerns",
                        "none",
                      ] as PregnancyConcern[]
                    ).map((c) => (
                      <CheckboxOpt
                        key={c}
                        label={c === "none" ? "None of the above" : fmt(c)}
                        checked={form.pregnancyConcerns.includes(c)}
                        onChange={() =>
                          set(
                            "pregnancyConcerns",
                            toggleExclusive(form.pregnancyConcerns, c, "none")
                          )
                        }
                      />
                    ))}
                  </div>
                </Card>
              </>
            )}

            {isElderly && (
              <>
                <Card title="Eating & Swallowing">
                  <p className="text-xs text-gray-400">Select all that apply.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(
                      [
                        ["soft_foods", "Prefer soft foods"],
                        ["chewing_difficulty", "Difficulty chewing"],
                        ["swallowing_difficulty", "Difficulty swallowing"],
                      ] as [ElderlyConcern, string][]
                    ).map(([val, lbl]) => (
                      <CheckboxOpt
                        key={val}
                        label={lbl}
                        checked={form.elderlyConcerns.includes(val)}
                        onChange={() =>
                          set(
                            "elderlyConcerns",
                            toggleCheck(form.elderlyConcerns, val)
                          )
                        }
                      />
                    ))}
                  </div>
                </Card>

                <Card title="Activity Level (Simplified)">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        ["low", "Mostly seated or resting"],
                        ["moderate", "Light daily movement"],
                        ["active", "Regular exercise or walking"],
                      ] as [ElderlyActivityLevel, string][]
                    ).map(([val, desc]) => (
                      <RadioOpt
                        key={val}
                        label={fmt(val)}
                        desc={desc}
                        checked={form.elderlyActivityLevel === val}
                        onChange={() => set("elderlyActivityLevel", val)}
                      />
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        );

      // ── Step 6: Review ──────────────────────────────────────────────────────
      case 6: {
        const bmi =
          Number(form.heightValue) > 0 && Number(form.weightValue) > 0
            ? calculateBMI(
                Number(form.heightValue),
                Number(form.weightValue),
                form.heightUnit,
                form.weightUnit
              )
            : 0;
        const bmiCat = bmi > 0 ? getBMICategory(bmi) : "";
        const eer =
          bmi > 0 && form.activityLevel
            ? calculateSimpleEER(
                age,
                (form.gender || "other") as Gender,
                Number(form.heightValue),
                form.heightUnit,
                Number(form.weightValue),
                form.weightUnit,
                form.activityLevel as ActivityLevel
              )
            : 0;

        const needsDisclaimer =
          form.healthConditions.some((c) => c !== "none") ||
          form.medications.trim().length > 0 ||
          isPregnant ||
          isElderly ||
          form.allergies.length > 0;

        return (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Physical
              </h3>
              <ReviewRow label="Age" value={`${form.age} years`} />
              <ReviewRow
                label="Gender"
                value={
                  form.gender === "other"
                    ? "Other / Prefer not to say"
                    : fmt(form.gender || "—")
                }
              />
              <ReviewRow
                label="Height"
                value={`${form.heightValue} ${form.heightUnit}`}
              />
              <ReviewRow
                label="Weight"
                value={`${form.weightValue} ${form.weightUnit}`}
              />
              {bmi > 0 && (
                <ReviewRow
                  label="BMI"
                  value={`${bmi} — ${fmt(bmiCat)}`}
                />
              )}
              {eer > 0 && (
                <ReviewRow label="Est. Daily Energy" value={`~${eer} kcal`} />
              )}
              <ReviewRow
                label="Activity Level"
                value={fmt(form.activityLevel || "—")}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Health & Diet
              </h3>
              <ReviewTags label="Health Conditions" items={form.healthConditions} />
              {form.medications.trim() && (
                <ReviewRow label="Medications" value={form.medications} />
              )}
              {form.gender === "female" && (
                <ReviewRow
                  label="Pregnant"
                  value={
                    form.isPregnant === "yes"
                      ? `Yes${form.weeksPregnant ? ` (${form.weeksPregnant} weeks)` : ""}`
                      : "No"
                  }
                />
              )}
              <ReviewTags label="Allergies" items={form.allergies} />
              {form.allergyOther && (
                <ReviewRow label="Other Allergy" value={form.allergyOther} />
              )}
              <ReviewTags label="Dietary Preferences" items={form.dietaryPreferences} />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Goals & Budget
              </h3>
              <ReviewTags
                label="Nutrition Goals"
                items={form.nutritionGoals.map((g) => GOAL_LABELS[g])}
              />
              {form.dislikedFoods && (
                <ReviewRow label="Dislikes" value={form.dislikedFoods} />
              )}
              <ReviewRow label="Appetite" value={fmt(form.appetiteLevel || "—")} />
              <ReviewRow label="Weekly Budget" value={`$${form.weeklyBudget}`} />
            </div>

            {(isPregnant || isElderly) && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Special Considerations
                </h3>
                {isPregnant && (
                  <ReviewTags
                    label="Pregnancy Concerns"
                    items={form.pregnancyConcerns}
                  />
                )}
                {isElderly && form.elderlyConcerns.length > 0 && (
                  <ReviewTags label="Elderly Concerns" items={form.elderlyConcerns} />
                )}
                {isElderly && form.elderlyActivityLevel && (
                  <ReviewRow
                    label="Elderly Activity"
                    value={fmt(form.elderlyActivityLevel)}
                  />
                )}
              </div>
            )}

            {needsDisclaimer && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                This is not medical advice or a medical diagnosis. Consult a doctor
                or healthcare professional for high-risk concerns.
              </div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const ready = canProceed(step, form);

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 px-4 py-10">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <span className="text-sm font-medium text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
            Step {step} of {TOTAL_STEPS}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {STEP_TITLES[step - 1]}
          </h1>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white rounded-full overflow-hidden border border-gray-100">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Navigation */}
        <div className="flex gap-3 pb-6">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 border border-gray-200 bg-white text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              disabled={!ready}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition-colors"
            >
              Save Profile
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
