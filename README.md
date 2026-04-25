# BiteBetter

An AI-powered personalized recipe transformation app. Paste any recipe, and BiteBetter rewrites it around your allergies, dietary preferences, health goals, budget, and safety needs.

---

## What It Does

Users create a nutrition profile once. Then, in the Chef tab, they paste or type any recipe. The app transforms it into a personalized version and shows a simplified result — ingredient swaps, before/after nutrition, scores, cost summary, and safety warnings. Transformed recipes can be saved, rated, and aggregated into a grocery list.

> This app is not medical advice or a medical diagnostic tool. For high-risk concerns (pregnancy, medications, severe allergies, medical conditions), consult a doctor or healthcare professional.

---

## Core User Flow

1. Create a nutrition profile
2. Open the Chef tab and paste a recipe
3. App transforms the recipe based on your profile
4. View simplified results first (scores, ingredients, cost, warnings)
5. Expand for full detail or visit the Why This? tab
6. Save the recipe
7. Saved recipes appear in the Recipes tab (with star ratings)
8. Ingredients from saved recipes roll up into the Grocery List tab

---

## App Tabs

| Tab | Purpose |
|---|---|
| Chef | Paste a recipe and get a personalized transformation |
| Recipes | View, rate, and manage your saved recipes |
| Grocery List | Aggregated ingredients from all saved recipes with estimated costs |
| Why This? | Expandable explanations of why each change was made |
| Profile | View and edit your nutrition profile |

---

## Profile Fields Collected

- Age, gender, height, weight (BMI calculated automatically)
- Activity level
- Medical conditions and medications (optional)
- Pregnancy status (if relevant)
- Allergies and dietary preferences (vegan, halal, gluten-free, etc.)
- Nutrition goals (weight loss, muscle gain, heart health, etc.)
- Disliked foods and appetite level
- Weekly grocery budget
- Chewing/swallowing difficulty questions (shown only if age ≥ 65)

---

## Transformation Output

Each transformed recipe shows:

- Personalized recipe name
- Final ingredients and procedure
- Before/after nutrition snapshot (calories, protein, carbs, fat, fiber)
- Scores: Overall, Health, Taste, Transformation, Budget
- Estimated cost and budget remaining
- Key warnings and safety flags
- Short explanation of why changes were made
- Medical disclaimer when high-risk factors are detected

---

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Backend / Auth / DB:** Supabase (magic link auth, PostgreSQL with RLS)
- **AI:** Claude API (Anthropic)
- **Static data:** JSON files for nutrition rules, safety rules, and simulated grocery prices

---

## Folder Structure

```
BiteBetter/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Redirects to onboarding or dashboard
│   │   ├── onboarding/page.tsx       # Multi-step profile wizard
│   │   ├── dashboard/
│   │   │   ├── layout.tsx            # Sidebar + tab shell
│   │   │   ├── chef/page.tsx
│   │   │   ├── recipes/page.tsx
│   │   │   ├── grocery-list/page.tsx
│   │   │   ├── why-this/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── api/
│   │       ├── profile/route.ts
│   │       ├── transform-recipe/route.ts
│   │       ├── recipes/route.ts
│   │       ├── recipes/[id]/route.ts
│   │       └── grocery-list/route.ts
│   ├── components/
│   │   ├── ui/                       # Shared primitives
│   │   ├── onboarding/               # ProfileWizard + step components
│   │   ├── chef/                     # RecipeInput, TransformResult, ScoreBadges, etc.
│   │   ├── recipes/                  # RecipeCard, StarRating
│   │   └── grocery/                  # GroceryListView
│   ├── lib/
│   │   ├── supabase/                 # Browser + server clients
│   │   ├── recipe-transformer.ts     # Core transformation logic
│   │   ├── scoring.ts
│   │   ├── safety.ts
│   │   ├── grocery-prices.ts
│   │   └── bmi.ts
│   ├── data/
│   │   ├── nutrition-rules.json
│   │   ├── safety-rules.json
│   │   └── grocery-prices.json
│   └── types/
│       ├── profile.ts
│       ├── recipe.ts
│       └── scores.ts
```

---

## Supabase Tables

| Table | Purpose |
|---|---|
| `profiles` | One row per user, stores all profile fields. RLS: user sees only their own row. |
| `recipes` | Saved transformed recipes (includes original text + full transformation as JSONB). RLS: user sees only their own rows. |

Grocery list is derived client-side from saved recipe ingredients — no separate table needed.

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/profile` | Fetch current user's profile |
| POST | `/api/profile` | Create or upsert profile |
| POST | `/api/transform-recipe` | Transform a pasted recipe |
| GET | `/api/recipes` | List saved recipes |
| POST | `/api/recipes` | Save a transformed recipe |
| PATCH | `/api/recipes/[id]` | Update star rating |
| DELETE | `/api/recipes/[id]` | Delete a saved recipe |
| GET | `/api/grocery-list` | Aggregated ingredients from all saved recipes |

---

## Build Phases

| Phase | Scope | Est. Time |
|---|---|---|
| 1 | Project bootstrap (Next.js, Tailwind, Supabase setup) | ~1 hour |
| 2 | Auth + profile onboarding wizard | ~2 hours |
| 3 | Recipe transformer core (rule-based) + Chef tab UI | ~3 hours |
| 4 | Save recipes + Recipes tab + star ratings | ~1 hour |
| 5 | Grocery List tab | ~45 min |
| 6 | Claude API integration (swap in for rule-based) | ~1.5 hours |
| 7 | Why This? tab, Profile tab, polish | ~1 hour |

---

## What Is Simulated in the MVP

| Feature | MVP Approach | Future |
|---|---|---|
| Recipe parsing | Regex line splitting | NLP / Claude parsing |
| Nutrition estimates | Static lookup table | USDA API |
| Grocery prices | `grocery-prices.json` flat file | Real grocery API |
| Taste Score | Formula based on substitution count | User rating feedback loop |
| Personalization from ratings | Not yet implemented | Feed ratings back to transformer |
| Why This? explanations | Static change-reason bullets | Claude-generated |
